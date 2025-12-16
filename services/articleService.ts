import { supabase } from './supabaseClient';
import { ClientTask, TaskType, TaskStatus, TitleOption, OutlineSection } from '../types';
import { ARTICLE_STATUS } from '../constants/status';

/**
 * Article Service - Handles all Supabase database operations for articles
 */

// ContentBlock interface for structured draft content
interface ContentBlock {
  id: string;
  type: 'header' | 'paragraph' | 'quote' | 'image';
  content: string;
  src?: string;
  caption?: string;
}

// Database article type
interface DatabaseArticle {
  id: string;
  campaign_id: string;
  title: string;
  status: string;
  proposed_titles: string[];
  outline_content: string | null;
  outline_sections: OutlineSection[] | null; // Structured outline data (JSONB)
  draft_content: string | null;
  draft_blocks: ContentBlock[] | null; // Structured draft content (JSONB)
  client_comments: any;
  selected_title: string | null;
  created_at: string;
  last_updated?: string;
  campaigns: {
    id: string;
    name: string;
    strategy_goals: string | null;
  };
}

/**
 * Get all articles awaiting title review (status = AWAITING_REVIEW_TITLES)
 */
export async function getArticlesAwaitingTitleReview(): Promise<ClientTask[]> {
  try {
    const { data: articles, error } = await supabase
      .from('articles')
      .select(`
        *,
        campaigns (
          id,
          name,
          strategy_goals
        )
      `)
      .eq('status', 'AWAITING_REVIEW_TITLES')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching articles:', error);
      throw error;
    }

    if (!articles || articles.length === 0) {
      return [];
    }

    // Convert database articles to ClientTask format
    return articles.map((article: DatabaseArticle) => articleToClientTask(article));
  } catch (error) {
    console.error('Failed to fetch articles awaiting review:', error);
    return [];
  }
}

/**
 * Get all articles awaiting outline review (status = AWAITING_REVIEW_OUTLINE)
 */
export async function getArticlesAwaitingOutlineReview(): Promise<ClientTask[]> {
  try {
    const { data: articles, error } = await supabase
      .from('articles')
      .select(`
        *,
        campaigns (
          id,
          name,
          strategy_goals
        )
      `)
      .eq('status', 'AWAITING_REVIEW_OUTLINE')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching outline review articles:', error);
      throw error;
    }

    if (!articles || articles.length === 0) {
      return [];
    }

    return articles.map((article: DatabaseArticle) => articleToClientTask(article));
  } catch (error) {
    console.error('Failed to fetch articles awaiting outline review:', error);
    return [];
  }
}

/**
 * Get all articles awaiting any type of review
 */
export async function getArticlesAwaitingReview(): Promise<ClientTask[]> {
  try {
    const { data: articles, error } = await supabase
      .from('articles')
      .select(`
        *,
        campaigns (
          id,
          name,
          strategy_goals
        )
      `)
      .in('status', ['AWAITING_REVIEW_TITLES', 'AWAITING_REVIEW_OUTLINE', 'AWAITING_REVIEW_DRAFT'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching articles awaiting review:', error);
      throw error;
    }

    if (!articles || articles.length === 0) {
      return [];
    }

    return articles.map((article: DatabaseArticle) => articleToClientTask(article));
  } catch (error) {
    console.error('Failed to fetch articles awaiting review:', error);
    return [];
  }
}

/**
 * Get a specific article by ID (for direct access via URL token)
 */
export async function getArticleById(articleId: string): Promise<ClientTask | null> {
  try {
    const { data: article, error } = await supabase
      .from('articles')
      .select(`
        *,
        campaigns (
          id,
          name,
          strategy_goals
        )
      `)
      .eq('id', articleId)
      .single();

    if (error) {
      console.error('Error fetching article:', error);
      return null;
    }

    if (!article) {
      return null;
    }

    return articleToClientTask(article as DatabaseArticle);
  } catch (error) {
    console.error('Failed to fetch article:', error);
    return null;
  }
}

/**
 * Submit title review results to database
 * 
 * NEW BEHAVIOR (Multi-Title Approval):
 * - If rejected: Update original article status to NEEDS_REVISION
 * - If approved: Create a NEW article for EACH approved title, then delete original
 * 
 * @param articleId - Article ID
 * @param selectedTitles - Array of approved title objects
 * @param rejected - Whether all titles were rejected
 * @param rejectReason - Reason for rejection (if rejected)
 * @param generalComments - General feedback comments
 */
export async function submitTitleReview(
  articleId: string,
  selectedTitles: TitleOption[],
  rejected: boolean,
  rejectReason?: string,
  generalComments?: string
): Promise<{ success: boolean; error?: string }> {
  console.log('=== submitTitleReview called ===');
  console.log('articleId:', articleId);
  console.log('rejected:', rejected);
  console.log('selectedTitles:', selectedTitles);
  console.log('generalComments:', generalComments);

  try {
    // Prepare title notes (for all titles)
    const titleNotes: Record<string, string> = {};
    selectedTitles.forEach(t => {
      if (t.clientNotes) {
        titleNotes[t.id] = t.clientNotes;
      }
    });

    // Get approved titles (selected ones with their modified text)
    const approvedTitles = selectedTitles
      .filter(t => t.isSelected)
      .map(t => ({
        id: t.id,
        text: t.text,
        notes: t.clientNotes || null
      }));

    console.log('approvedTitles:', approvedTitles);

    // ========================================
    // REJECTION FLOW: Update original article
    // ========================================
    if (rejected) {
      const clientComments = {
        action: 'rejected',
        rejectReason: rejectReason || null,
        generalComments: generalComments || null,
        titleNotes,
        timestamp: new Date().toISOString(),
        reviewer: 'client'
      };

      // Determine the appropriate revision status based on current article status
      // For title review, we use NEEDS_TITLES_REVISION
      const revisionStatus = ARTICLE_STATUS.NEEDS_TITLES_REVISION;
      
      console.log('Rejection: Updating original article to', revisionStatus);

      const { error } = await supabase
        .from('articles')
        .update({
          client_comments: clientComments,
          status: revisionStatus
        })
        .eq('id', articleId);

      if (error) {
        console.error('Error updating article:', error);
        return { success: false, error: error.message };
      }

      console.log('=== Rejection submitted successfully ===');
      return { success: true };
    }

    // ========================================
    // APPROVAL FLOW: Create new article for each approved title
    // ========================================
    console.log('Approval: Creating new articles for each approved title');

    // 1. Get original article info (campaign_id, proposed_titles)
    const { data: originalArticle, error: fetchError } = await supabase
      .from('articles')
      .select('campaign_id, proposed_titles')
      .eq('id', articleId)
      .single();

    if (fetchError || !originalArticle) {
      console.error('Failed to fetch original article:', fetchError);
      return { success: false, error: 'Failed to fetch original article' };
    }

    console.log('Original article:', originalArticle);

    // 2. Create a new article for EACH approved title
    const newArticles = approvedTitles.map(title => ({
      campaign_id: originalArticle.campaign_id,
      title: title.text,
      selected_title: title.text,
      status: 'NEEDS_OUTLINE', // Ready for outline creation
      proposed_titles: originalArticle.proposed_titles, // Keep original proposals for reference
      client_comments: {
        action: 'approved',
        reviewer: 'client',
        timestamp: new Date().toISOString(),
        approvedTitles: [title], // Only this title's info
        selectedTitleIds: [title.id],
        titleNotes: title.notes ? { [title.id]: title.notes } : {},
        generalComments: generalComments || null
      }
    }));

    console.log('Creating new articles:', newArticles);

    const { error: insertError } = await supabase
      .from('articles')
      .insert(newArticles);

    if (insertError) {
      console.error('Error creating new articles:', insertError);
      return { success: false, error: insertError.message };
    }

    console.log(`✅ Created ${approvedTitles.length} new articles`);

    // 3. Delete the original article
    const { error: deleteError } = await supabase
      .from('articles')
      .delete()
      .eq('id', articleId);

    if (deleteError) {
      console.warn('⚠️ Failed to delete original article:', deleteError);
      // Don't block success - new articles are already created
    } else {
      console.log('✅ Original article deleted');
    }

    console.log('=== submitTitleReview SUCCESS ===');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to submit title review:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Submit outline review results to database
 * @param articleId - Article ID
 * @param approved - Whether the outline was approved
 * @param comments - Array of comments on outline sections
 * @param generalComments - General feedback comments
 */
export async function submitOutlineReview(
  articleId: string,
  approved: boolean,
  comments: Array<{ targetId: string; text: string }>,
  generalComments?: string
): Promise<{ success: boolean; error?: string }> {
  console.log('=== submitOutlineReview called ===');
  console.log('articleId:', articleId);
  console.log('approved:', approved);
  console.log('comments:', comments);
  console.log('generalComments:', generalComments);

  try {
    const clientComments = {
      action: approved ? 'approved' : 'revision_requested',
      reviewer: 'client',
      timestamp: new Date().toISOString(),
      sectionComments: comments,
      generalComments: generalComments || null
    };

    // Use specific revision status for outline review
    const newStatus = approved 
      ? ARTICLE_STATUS.OUTLINE_APPROVED 
      : ARTICLE_STATUS.NEEDS_OUTLINE_REVISION;

    console.log('Setting article status to:', newStatus);

    const { error } = await supabase
      .from('articles')
      .update({
        client_comments: clientComments,
        status: newStatus
      })
      .eq('id', articleId);

    if (error) {
      console.error('Error submitting outline review:', error);
      return { success: false, error: error.message };
    }

    console.log('=== submitOutlineReview SUCCESS ===');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to submit outline review:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Submit content/draft review results to database
 * @param articleId - Article ID
 * @param approved - Whether the content was approved
 * @param comments - Array of comments on content blocks
 * @param generalComments - General feedback comments
 */
export async function submitContentReview(
  articleId: string,
  approved: boolean,
  comments: Array<{ targetId: string; text: string }>,
  generalComments?: string
): Promise<{ success: boolean; error?: string }> {
  console.log('=== submitContentReview called ===');
  console.log('articleId:', articleId);
  console.log('approved:', approved);
  console.log('comments:', comments);
  console.log('generalComments:', generalComments);

  try {
    const clientComments = {
      action: approved ? 'approved' : 'revision_requested',
      reviewer: 'client',
      timestamp: new Date().toISOString(),
      contentComments: comments,
      generalComments: generalComments || null
    };

    // Use specific revision status for draft/content review
    const newStatus = approved 
      ? ARTICLE_STATUS.DRAFT_APPROVED 
      : ARTICLE_STATUS.NEEDS_DRAFT_REVISION;

    console.log('Setting article status to:', newStatus);

    const { error } = await supabase
      .from('articles')
      .update({
        client_comments: clientComments,
        status: newStatus
      })
      .eq('id', articleId);

    if (error) {
      console.error('Error submitting content review:', error);
      return { success: false, error: error.message };
    }

    console.log('=== submitContentReview SUCCESS ===');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to submit content review:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Parse markdown content to OutlineSection array (fallback)
 */
function parseMarkdownToOutline(markdown: string): OutlineSection[] {
  const lines = markdown.split('\n');
  const sections: OutlineSection[] = [];
  
  lines.forEach(line => {
    const h1Match = line.match(/^# (.+)$/);
    const h2Match = line.match(/^## (.+)$/);
    const h3Match = line.match(/^### (.+)$/);
    
    if (h1Match) {
      sections.push({
        id: `outline-${sections.length + 1}`,
        level: 'H1',
        title: h1Match[1].trim()
      });
    } else if (h2Match) {
      sections.push({
        id: `outline-${sections.length + 1}`,
        level: 'H2',
        title: h2Match[1].trim()
      });
    } else if (h3Match) {
      sections.push({
        id: `outline-${sections.length + 1}`,
        level: 'H3',
        title: h3Match[1].trim()
      });
    }
  });
  
  return sections;
}

/**
 * Parse markdown content to ContentBlock array
 */
function parseMarkdownToContent(markdown: string): ContentBlock[] {
  if (!markdown) return [];
  
  const lines = markdown.split('\n');
  const blocks: ContentBlock[] = [];
  let currentParagraph = '';
  
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (!trimmedLine) {
      if (currentParagraph) {
        blocks.push({
          id: `block-${blocks.length + 1}`,
          type: 'paragraph',
          content: currentParagraph.trim()
        });
        currentParagraph = '';
      }
      return;
    }
    
    // Headers
    const h1Match = trimmedLine.match(/^# (.+)$/);
    const h2Match = trimmedLine.match(/^## (.+)$/);
    const h3Match = trimmedLine.match(/^### (.+)$/);
    
    if (h1Match || h2Match || h3Match) {
      // Save current paragraph if exists
      if (currentParagraph) {
        blocks.push({
          id: `block-${blocks.length + 1}`,
          type: 'paragraph',
          content: currentParagraph.trim()
        });
        currentParagraph = '';
      }
      
      blocks.push({
        id: `block-${blocks.length + 1}`,
        type: 'header',
        content: (h1Match || h2Match || h3Match)![1].trim()
      });
      return;
    }
    
    // Quote (blockquote)
    const quoteMatch = trimmedLine.match(/^> (.+)$/);
    if (quoteMatch) {
      if (currentParagraph) {
        blocks.push({
          id: `block-${blocks.length + 1}`,
          type: 'paragraph',
          content: currentParagraph.trim()
        });
        currentParagraph = '';
      }
      
      blocks.push({
        id: `block-${blocks.length + 1}`,
        type: 'quote',
        content: quoteMatch[1].trim()
      });
      return;
    }
    
    // List items (treat as paragraph for now)
    if (trimmedLine.startsWith('*') || trimmedLine.startsWith('-') || /^\d+\./.test(trimmedLine)) {
      currentParagraph += (currentParagraph ? ' ' : '') + trimmedLine.replace(/^[*\-\d.]\s*/, '');
      return;
    }
    
    // Regular text - accumulate into paragraph
    currentParagraph += (currentParagraph ? ' ' : '') + trimmedLine;
  });
  
  // Add final paragraph if exists
  if (currentParagraph) {
    blocks.push({
      id: `block-${blocks.length + 1}`,
      type: 'paragraph',
      content: currentParagraph.trim()
    });
  }
  
  return blocks;
}

/**
 * Determine task type based on article status
 */
function getTaskTypeFromStatus(status: string): TaskType {
  if (status === 'AWAITING_REVIEW_TITLES') return TaskType.TITLE_REVIEW;
  if (status === 'AWAITING_REVIEW_OUTLINE') return TaskType.OUTLINE_REVIEW;
  if (status === 'AWAITING_REVIEW_DRAFT') return TaskType.CONTENT_REVIEW;
  return TaskType.TITLE_REVIEW; // Default
}

/**
 * Convert database article to ClientTask format
 */
function articleToClientTask(article: DatabaseArticle): ClientTask {
  // Parse proposed titles to TitleOption format
  const titles: TitleOption[] = article.proposed_titles
    ? article.proposed_titles.map((text, index) => ({
        id: `t${index + 1}`,
        text,
        isSelected: false,
        clientNotes: undefined
      }))
    : [];

  // Parse outline sections (prioritize outline_sections over outline_content)
  let outline: OutlineSection[] = [];
  if (article.outline_sections && Array.isArray(article.outline_sections)) {
    // Use structured data directly from database
    outline = article.outline_sections;
    console.log('Using structured outline_sections:', outline);
  } else if (article.outline_content) {
    // Fallback: parse markdown content
    outline = parseMarkdownToOutline(article.outline_content);
    console.log('Parsed outline from markdown:', outline);
  }

  // Parse content (for CONTENT_REVIEW)
  // Priority: draft_blocks (structured) > draft_content (markdown)
  let content: ContentBlock[] = [];
  if (article.draft_blocks && Array.isArray(article.draft_blocks) && article.draft_blocks.length > 0) {
    // Use structured data directly from database
    content = article.draft_blocks;
    console.log('Using structured draft_blocks:', content.length, 'blocks');
  } else if (article.draft_content) {
    // Fallback: parse markdown content
    content = parseMarkdownToContent(article.draft_content);
    console.log('Parsed content from markdown:', content.length, 'blocks');
  }

  // Extract keywords from strategy goals (simple split by comma)
  const keywords = article.campaigns.strategy_goals
    ? article.campaigns.strategy_goals.split(',').map(k => k.trim())
    : [];

  // Determine task type based on status
  const taskType = getTaskTypeFromStatus(article.status);

  return {
    id: article.id,
    type: taskType,
    projectName: article.campaigns.name,
    dueDate: 'Due Today', // Could be calculated from created_at
    status: TaskStatus.PENDING,
    titles,
    outline, // Add outline data
    content, // Add content data
    keywords,
    strategyGoal: article.campaigns.strategy_goals || '',
    targetAudience: 'General audience' // Client-specific tone_of_voice removed in new schema
  };
}

