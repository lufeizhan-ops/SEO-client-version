import { supabase } from './supabaseClient';
import { ClientTask, TaskType, TaskStatus, TitleOption, OutlineSection, ContentBlock } from '../types';
import { ARTICLE_STATUS } from '../constants/status';

/**
 * Campaign Service - Handles Supabase database operations for campaign-level views
 */

// Campaign info type
export interface CampaignInfo {
  id: string;
  name: string;
  clientName: string;
  strategyGoals: string;
}

// Database article type (matches articleService.ts)
interface DatabaseArticle {
  id: string;
  campaign_id: string;
  title: string;
  status: string;
  proposed_titles: string[];
  outline_content: string | null;
  outline_sections: OutlineSection[] | null;
  draft_content: string | null;
  draft_blocks: ContentBlock[] | null;
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

// Pending status list - articles awaiting client review
const PENDING_STATUSES = [
  ARTICLE_STATUS.AWAITING_REVIEW_TITLES,
  ARTICLE_STATUS.AWAITING_REVIEW_OUTLINE,
  ARTICLE_STATUS.AWAITING_REVIEW_DRAFT
];

// Completed status list - articles that have been reviewed or are in progress
const COMPLETED_STATUSES = [
  ARTICLE_STATUS.TITLES_APPROVED,
  ARTICLE_STATUS.NEEDS_OUTLINE,
  ARTICLE_STATUS.OUTLINE_APPROVED,
  ARTICLE_STATUS.NEEDS_DRAFT,
  ARTICLE_STATUS.DRAFT_APPROVED,
  ARTICLE_STATUS.PUBLISHED,
  // Revision states (new specific states)
  ARTICLE_STATUS.NEEDS_TITLES_REVISION,
  ARTICLE_STATUS.NEEDS_OUTLINE_REVISION,
  ARTICLE_STATUS.NEEDS_DRAFT_REVISION,
  // Deprecated: kept for backward compatibility
  ARTICLE_STATUS.NEEDS_REVISION,
];

/**
 * Get campaign basic info
 */
export async function getCampaignInfo(campaignId: string): Promise<CampaignInfo | null> {
  try {
    // Fetch campaign data
    const { data, error } = await supabase
      .from('campaigns')
      .select('id, name, strategy_goals')
      .eq('id', campaignId)
      .single();

    if (error) {
      console.error('Error fetching campaign info:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    // Fetch associated clients through campaign_clients junction table
    const { data: clientAssociations } = await supabase
      .from('campaign_clients')
      .select('clients(id, name)')
      .eq('campaign_id', campaignId);

    // Combine client names
    const clientNames = (clientAssociations || [])
      .filter((assoc: any) => assoc.clients)
      .map((assoc: any) => assoc.clients.name)
      .join(', ');

    return {
      id: data.id,
      name: data.name,
      clientName: clientNames || 'Unknown Client',
      strategyGoals: data.strategy_goals || ''
    };
  } catch (error) {
    console.error('Failed to fetch campaign info:', error);
    return null;
  }
}

/**
 * Get all pending (awaiting review) articles in a campaign
 */
export async function getCampaignPendingArticles(campaignId: string): Promise<ClientTask[]> {
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
      .eq('campaign_id', campaignId)
      .in('status', PENDING_STATUSES)
      .order('last_updated', { ascending: false });

    if (error) {
      console.error('Error fetching pending articles:', error);
      return [];
    }

    if (!articles || articles.length === 0) {
      return [];
    }

    return articles.map((article: DatabaseArticle) => articleToClientTask(article));
  } catch (error) {
    console.error('Failed to fetch pending articles:', error);
    return [];
  }
}

/**
 * Get all completed articles in a campaign
 */
export async function getCampaignCompletedArticles(campaignId: string): Promise<ClientTask[]> {
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
      .eq('campaign_id', campaignId)
      .in('status', COMPLETED_STATUSES)
      .order('last_updated', { ascending: false });

    if (error) {
      console.error('Error fetching completed articles:', error);
      return [];
    }

    if (!articles || articles.length === 0) {
      return [];
    }

    return articles.map((article: DatabaseArticle) => articleToClientTask(article));
  } catch (error) {
    console.error('Failed to fetch completed articles:', error);
    return [];
  }
}

/**
 * Convert a database article to ClientTask format
 */
function articleToClientTask(article: DatabaseArticle): ClientTask {
  // Determine task type based on status
  let taskType: TaskType;
  let taskStatus: TaskStatus = TaskStatus.PENDING;

  switch (article.status) {
    // Awaiting review states
    case ARTICLE_STATUS.AWAITING_REVIEW_TITLES:
      taskType = TaskType.TITLE_REVIEW;
      break;
    case ARTICLE_STATUS.AWAITING_REVIEW_OUTLINE:
      taskType = TaskType.OUTLINE_REVIEW;
      break;
    case ARTICLE_STATUS.AWAITING_REVIEW_DRAFT:
      taskType = TaskType.CONTENT_REVIEW;
      break;
    
    // Approved states - Title phase
    case ARTICLE_STATUS.TITLES_APPROVED:
    case ARTICLE_STATUS.NEEDS_OUTLINE:
      taskType = TaskType.TITLE_REVIEW;
      taskStatus = TaskStatus.APPROVED;
      break;
    
    // Approved states - Outline phase
    case ARTICLE_STATUS.OUTLINE_APPROVED:
    case ARTICLE_STATUS.NEEDS_DRAFT:
      taskType = TaskType.OUTLINE_REVIEW;
      taskStatus = TaskStatus.APPROVED;
      break;
    
    // Approved states - Content/Draft phase
    case ARTICLE_STATUS.DRAFT_APPROVED:
    case ARTICLE_STATUS.PUBLISHED:
      taskType = TaskType.CONTENT_REVIEW;
      taskStatus = TaskStatus.APPROVED;
      break;
    
    // Revision states - specific to each phase
    case ARTICLE_STATUS.NEEDS_TITLES_REVISION:
      taskType = TaskType.TITLE_REVIEW;
      taskStatus = TaskStatus.CHANGES_REQUESTED;
      break;
    case ARTICLE_STATUS.NEEDS_OUTLINE_REVISION:
      taskType = TaskType.OUTLINE_REVIEW;
      taskStatus = TaskStatus.CHANGES_REQUESTED;
      break;
    case ARTICLE_STATUS.NEEDS_DRAFT_REVISION:
      taskType = TaskType.CONTENT_REVIEW;
      taskStatus = TaskStatus.CHANGES_REQUESTED;
      break;
    
    // Deprecated: kept for backward compatibility
    case ARTICLE_STATUS.NEEDS_REVISION:
      taskType = TaskType.CONTENT_REVIEW;
      taskStatus = TaskStatus.CHANGES_REQUESTED;
      break;
    
    default:
      taskType = TaskType.TITLE_REVIEW;
  }

  // Build the task object
  const task: ClientTask = {
    id: article.id,
    type: taskType,
    projectName: article.selected_title || article.title,
    dueDate: article.last_updated || article.created_at,
    status: taskStatus,
    keywords: [],
    strategyGoal: article.campaigns?.strategy_goals || '',
  };

  // Add type-specific data
  if (taskType === TaskType.TITLE_REVIEW && article.proposed_titles) {
    task.titles = article.proposed_titles.map((text, index) => ({
      id: `title-${index + 1}`,
      text,
      isSelected: article.selected_title === text,
      clientNotes: ''
    }));
  }

  if (taskType === TaskType.OUTLINE_REVIEW) {
    // Use structured outline_sections if available, otherwise parse markdown
    if (article.outline_sections && Array.isArray(article.outline_sections) && article.outline_sections.length > 0) {
      task.outline = article.outline_sections;
    } else if (article.outline_content) {
      task.outline = parseMarkdownToOutline(article.outline_content);
    }
  }

  if (taskType === TaskType.CONTENT_REVIEW) {
    // Use structured draft_blocks if available, otherwise parse markdown
    if (article.draft_blocks && Array.isArray(article.draft_blocks) && article.draft_blocks.length > 0) {
      task.content = article.draft_blocks;
    } else if (article.draft_content) {
      task.content = parseMarkdownToContent(article.draft_content);
    }
  }

  // Add existing comments if any
  if (article.client_comments) {
    task.comments = parseExistingComments(article.client_comments);
  }

  return task;
}

/**
 * Parse markdown outline content into OutlineSection[]
 */
function parseMarkdownToOutline(markdown: string): OutlineSection[] {
  const lines = markdown.split('\n');
  const sections: OutlineSection[] = [];
  let sectionIndex = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let level: 'H1' | 'H2' | 'H3' | null = null;
    let title = '';

    if (trimmed.startsWith('# ')) {
      level = 'H1';
      title = trimmed.slice(2).trim();
    } else if (trimmed.startsWith('## ')) {
      level = 'H2';
      title = trimmed.slice(3).trim();
    } else if (trimmed.startsWith('### ')) {
      level = 'H3';
      title = trimmed.slice(4).trim();
    }

    if (level && title) {
      sectionIndex++;
      sections.push({
        id: `section-${sectionIndex}`,
        level,
        title,
        wordCountEstimate: level === 'H1' ? 200 : level === 'H2' ? 150 : 100
      });
    }
  }

  return sections;
}

/**
 * Parse markdown content into ContentBlock[]
 */
function parseMarkdownToContent(markdown: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const lines = markdown.split('\n');
  let blockIndex = 0;
  let currentParagraph = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Header detection
    if (trimmed.startsWith('#')) {
      // Save pending paragraph first
      if (currentParagraph) {
        blockIndex++;
        blocks.push({
          id: `block-${blockIndex}`,
          type: 'paragraph',
          content: currentParagraph.trim()
        });
        currentParagraph = '';
      }

      blockIndex++;
      blocks.push({
        id: `block-${blockIndex}`,
        type: 'header',
        content: trimmed.replace(/^#+\s*/, '')
      });
    }
    // Quote detection
    else if (trimmed.startsWith('>')) {
      if (currentParagraph) {
        blockIndex++;
        blocks.push({
          id: `block-${blockIndex}`,
          type: 'paragraph',
          content: currentParagraph.trim()
        });
        currentParagraph = '';
      }

      blockIndex++;
      blocks.push({
        id: `block-${blockIndex}`,
        type: 'quote',
        content: trimmed.slice(1).trim()
      });
    }
    // Empty line - end paragraph
    else if (!trimmed) {
      if (currentParagraph) {
        blockIndex++;
        blocks.push({
          id: `block-${blockIndex}`,
          type: 'paragraph',
          content: currentParagraph.trim()
        });
        currentParagraph = '';
      }
    }
    // Regular text - accumulate into paragraph
    else {
      currentParagraph += (currentParagraph ? '\n' : '') + trimmed;
    }
  }

  // Don't forget the last paragraph
  if (currentParagraph) {
    blockIndex++;
    blocks.push({
      id: `block-${blockIndex}`,
      type: 'paragraph',
      content: currentParagraph.trim()
    });
  }

  return blocks;
}

/**
 * Parse existing comments from database format
 */
function parseExistingComments(clientComments: any): any[] {
  if (!clientComments) return [];
  if (Array.isArray(clientComments)) return clientComments;
  
  // Handle structured comment format
  const comments: any[] = [];
  
  if (clientComments.titleComments && Array.isArray(clientComments.titleComments)) {
    comments.push(...clientComments.titleComments);
  }
  if (clientComments.outlineComments && Array.isArray(clientComments.outlineComments)) {
    comments.push(...clientComments.outlineComments);
  }
  if (clientComments.contentComments && Array.isArray(clientComments.contentComments)) {
    comments.push(...clientComments.contentComments);
  }
  if (clientComments.generalComments && Array.isArray(clientComments.generalComments)) {
    comments.push(...clientComments.generalComments);
  }
  
  return comments;
}

