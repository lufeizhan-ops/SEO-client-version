/**
 * Draft Service
 * 
 * Handles saving and loading review drafts for the Client Portal.
 * Supports:
 * - Auto-save and manual save of draft edits and comments
 * - Loading saved drafts when returning to a review
 * - Submitting final edit suggestions to the database
 * - Multi-person collaboration detection
 */

import { supabase } from './supabaseClient';
import { 
  Comment, 
  EditSuggestion, 
  OutlineEditSuggestion, 
  ContentEditSuggestion,
  ReviewDraft,
  ActiveReviewer,
  OutlineSection,
  ContentBlock
} from '../types';

// ============================================
// DRAFT SAVE/LOAD FUNCTIONS
// ============================================

/**
 * Save draft edits and comments for later resumption
 */
export async function saveDraft(
  articleId: string,
  contactEmail: string,
  reviewType: 'title' | 'outline' | 'content',
  edits: EditSuggestion[],
  comments: Comment[],
  selections: Record<string, any> = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('review_drafts')
      .upsert({
        article_id: articleId,
        contact_email: contactEmail,
        review_type: reviewType,
        draft_edits: edits,
        draft_comments: comments,
        draft_selections: selections,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'article_id,contact_email,review_type'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving draft:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Draft saved successfully');
    return { success: true };
  } catch (err) {
    console.error('Error saving draft:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Load saved draft for a specific review
 */
export async function loadDraft(
  articleId: string,
  contactEmail: string,
  reviewType: 'title' | 'outline' | 'content'
): Promise<ReviewDraft | null> {
  try {
    const { data, error } = await supabase
      .from('review_drafts')
      .select('*')
      .eq('article_id', articleId)
      .eq('contact_email', contactEmail)
      .eq('review_type', reviewType)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No draft found - not an error
        return null;
      }
      console.error('Error loading draft:', error);
      return null;
    }

    if (!data) return null;

    // Convert database format to TypeScript interface
    const draft: ReviewDraft = {
      id: data.id,
      articleId: data.article_id,
      contactEmail: data.contact_email,
      reviewType: data.review_type,
      draftEdits: (data.draft_edits || []).map((edit: any) => ({
        ...edit,
        timestamp: new Date(edit.timestamp)
      })),
      draftComments: (data.draft_comments || []).map((comment: any) => ({
        ...comment,
        timestamp: new Date(comment.timestamp)
      })),
      draftSelections: data.draft_selections || {},
      updatedAt: new Date(data.updated_at)
    };

    console.log('✅ Draft loaded successfully');
    return draft;
  } catch (err) {
    console.error('Error loading draft:', err);
    return null;
  }
}

/**
 * Delete draft after review is submitted
 */
export async function deleteDraft(
  articleId: string,
  contactEmail: string,
  reviewType: 'title' | 'outline' | 'content'
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('review_drafts')
      .delete()
      .eq('article_id', articleId)
      .eq('contact_email', contactEmail)
      .eq('review_type', reviewType);

    if (error) {
      console.error('Error deleting draft:', error);
      return false;
    }

    console.log('✅ Draft deleted successfully');
    return true;
  } catch (err) {
    console.error('Error deleting draft:', err);
    return false;
  }
}

// ============================================
// EDIT SUGGESTION FUNCTIONS
// ============================================

/**
 * Submit edit suggestions to the database
 */
export async function submitEditSuggestions(
  articleId: string,
  contactEmail: string,
  contactName: string,
  edits: EditSuggestion[],
  editType: 'outline' | 'content'
): Promise<{ success: boolean; error?: string }> {
  try {
    // Convert EditSuggestion array to database format
    const dbEdits = edits.map(edit => ({
      article_id: articleId,
      contact_email: contactEmail,
      contact_name: contactName,
      edit_type: editType,
      target_id: edit.targetId,
      action_type: edit.actionType,
      original_content: edit.originalContent,
      suggested_content: edit.suggestedContent,
      status: 'pending'
    }));

    const { error } = await supabase
      .from('client_edits')
      .insert(dbEdits);

    if (error) {
      console.error('Error submitting edits:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ ${edits.length} edit suggestions submitted successfully`);
    return { success: true };
  } catch (err) {
    console.error('Error submitting edits:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Load existing edit suggestions for an article
 */
export async function loadEditSuggestions(
  articleId: string,
  editType: 'outline' | 'content'
): Promise<EditSuggestion[]> {
  try {
    const { data, error } = await supabase
      .from('client_edits')
      .select('*')
      .eq('article_id', articleId)
      .eq('edit_type', editType)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading edit suggestions:', error);
      return [];
    }

    if (!data) return [];

    // Convert database format to TypeScript interface
    const edits: EditSuggestion[] = data.map(row => ({
      id: row.id,
      targetId: row.target_id,
      actionType: row.action_type as 'modify' | 'delete' | 'add',
      originalContent: row.original_content,
      suggestedContent: row.suggested_content,
      author: row.contact_name,
      authorEmail: row.contact_email,
      timestamp: new Date(row.created_at),
      status: row.status as 'pending' | 'accepted' | 'rejected'
    }));

    return edits;
  } catch (err) {
    console.error('Error loading edit suggestions:', err);
    return [];
  }
}

// ============================================
// COLLABORATION FUNCTIONS
// ============================================

/**
 * Get active reviewers for an article (within last 24 hours)
 */
export async function getActiveReviewers(
  articleId: string
): Promise<ActiveReviewer[]> {
  try {
    const { data, error } = await supabase
      .from('active_reviewers')
      .select('*')
      .eq('article_id', articleId);

    if (error) {
      console.error('Error loading active reviewers:', error);
      return [];
    }

    if (!data) return [];

    // Get contact names from contacts table
    const emails = data.map(row => row.contact_email);
    const { data: contactData } = await supabase
      .from('contacts')
      .select('email, name')
      .in('email', emails);

    const emailToName = new Map(
      (contactData || []).map(c => [c.email, c.name])
    );

    const reviewers: ActiveReviewer[] = data.map(row => ({
      contactEmail: row.contact_email,
      contactName: emailToName.get(row.contact_email) || row.contact_email,
      reviewType: row.review_type,
      lastActive: new Date(row.updated_at)
    }));

    return reviewers;
  } catch (err) {
    console.error('Error loading active reviewers:', err);
    return [];
  }
}

/**
 * Get count of pending edits by other users for collaboration awareness
 */
export async function getPendingEditCount(
  articleId: string,
  editType: 'outline' | 'content',
  excludeEmail?: string
): Promise<{ count: number; editors: string[] }> {
  try {
    let query = supabase
      .from('client_edits')
      .select('contact_name, contact_email')
      .eq('article_id', articleId)
      .eq('edit_type', editType)
      .eq('status', 'pending');

    if (excludeEmail) {
      query = query.neq('contact_email', excludeEmail);
    }

    const { data, error } = await query;

    if (error || !data) {
      return { count: 0, editors: [] };
    }

    const uniqueEditors = [...new Set(data.map(d => d.contact_name))];
    return { count: data.length, editors: uniqueEditors };
  } catch (err) {
    console.error('Error getting pending edit count:', err);
    return { count: 0, editors: [] };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Create a new outline edit suggestion
 */
export function createOutlineEdit(
  targetId: string,
  actionType: 'modify' | 'delete' | 'add',
  originalContent: OutlineSection | null,
  suggestedContent: OutlineSection | null,
  author: string,
  authorEmail: string
): OutlineEditSuggestion {
  return {
    id: `edit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    targetId,
    actionType,
    originalContent,
    suggestedContent,
    author,
    authorEmail,
    timestamp: new Date(),
    status: 'pending'
  };
}

/**
 * Create a new content edit suggestion
 */
export function createContentEdit(
  targetId: string,
  actionType: 'modify' | 'delete' | 'add',
  originalContent: ContentBlock | null,
  suggestedContent: ContentBlock | null,
  author: string,
  authorEmail: string
): ContentEditSuggestion {
  return {
    id: `edit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    targetId,
    actionType,
    originalContent,
    suggestedContent,
    author,
    authorEmail,
    timestamp: new Date(),
    status: 'pending'
  };
}

/**
 * Check if two edits conflict (same target, different original content)
 */
export function detectEditConflict(
  edit1: EditSuggestion,
  edit2: EditSuggestion
): boolean {
  if (edit1.targetId !== edit2.targetId) {
    return false;
  }
  
  // If both are modifying the same element, check if they're based on the same original
  if (edit1.actionType === 'modify' && edit2.actionType === 'modify') {
    const orig1 = JSON.stringify(edit1.originalContent);
    const orig2 = JSON.stringify(edit2.originalContent);
    return orig1 !== orig2;
  }
  
  // Other conflict scenarios
  if (edit1.actionType === 'delete' && edit2.actionType === 'modify') return true;
  if (edit1.actionType === 'modify' && edit2.actionType === 'delete') return true;
  
  return false;
}

/**
 * Merge edits from multiple sources, flagging conflicts
 */
export function mergeEdits(
  localEdits: EditSuggestion[],
  remoteEdits: EditSuggestion[]
): { merged: EditSuggestion[]; conflicts: Array<{ local: EditSuggestion; remote: EditSuggestion }> } {
  const merged: EditSuggestion[] = [...localEdits];
  const conflicts: Array<{ local: EditSuggestion; remote: EditSuggestion }> = [];

  for (const remoteEdit of remoteEdits) {
    const conflictingLocal = localEdits.find(local => detectEditConflict(local, remoteEdit));
    
    if (conflictingLocal) {
      conflicts.push({ local: conflictingLocal, remote: remoteEdit });
    } else {
      // Check if this edit already exists
      const exists = merged.some(e => e.id === remoteEdit.id);
      if (!exists) {
        merged.push(remoteEdit);
      }
    }
  }

  return { merged, conflicts };
}

