export enum TaskType {
  TITLE_REVIEW = 'TITLE_REVIEW',
  OUTLINE_REVIEW = 'OUTLINE_REVIEW',
  CONTENT_REVIEW = 'CONTENT_REVIEW',
}

export enum TaskStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  CHANGES_REQUESTED = 'changes_requested',
}

// Contact person interface for client authentication
export interface Contact {
  id: string;
  client_id: string;
  name: string;
  email: string;
  created_at?: string;
}

// Client interface
export interface Client {
  id: string;
  name: string;
  contacts?: Contact[];
}

export interface TitleOption {
  id: string;
  text: string;
  // keywords & strategy removed from here as they are now shared
  isSelected: boolean;
  clientNotes?: string;
}

export interface OutlineSection {
  id: string;
  level: 'H1' | 'H2' | 'H3';
  title: string;
  description?: string;
  wordCountEstimate?: number;
}

export interface ContentBlock {
  id: string;
  type: 'paragraph' | 'header' | 'quote' | 'image';
  content: string;
}

export interface Comment {
  id: string;
  targetId: string; // ID of the title, outline section, or content block
  author: string;
  text: string;
  timestamp: Date;
  resolved: boolean;
}

// Edit suggestion types for Track Changes mode
export type EditActionType = 'modify' | 'delete' | 'add';
export type EditType = 'outline' | 'content';
export type EditStatus = 'pending' | 'accepted' | 'rejected';

// Edit suggestion for outline sections
export interface OutlineEditSuggestion {
  id: string;
  targetId: string; // section id
  actionType: EditActionType;
  originalContent: OutlineSection | null; // null for 'add' actions
  suggestedContent: OutlineSection | null; // null for 'delete' actions
  author: string;
  authorEmail: string;
  timestamp: Date;
  status: EditStatus;
}

// Edit suggestion for content blocks
export interface ContentEditSuggestion {
  id: string;
  targetId: string; // block id
  actionType: EditActionType;
  originalContent: ContentBlock | null; // null for 'add' actions
  suggestedContent: ContentBlock | null; // null for 'delete' actions
  author: string;
  authorEmail: string;
  timestamp: Date;
  status: EditStatus;
}

// Union type for any edit suggestion
export type EditSuggestion = OutlineEditSuggestion | ContentEditSuggestion;

// Draft data structure for saving review progress
export interface ReviewDraft {
  id?: string;
  articleId: string;
  contactEmail: string;
  reviewType: 'title' | 'outline' | 'content';
  draftEdits: EditSuggestion[];
  draftComments: Comment[];
  draftSelections: Record<string, any>; // For title selections, etc.
  generalComments?: string; // General feedback on entire article
  updatedAt: Date;
}

// Active reviewer info for collaboration
export interface ActiveReviewer {
  contactEmail: string;
  contactName: string;
  reviewType: 'title' | 'outline' | 'content';
  lastActive: Date;
}

export interface ClientTask {
  id: string;
  type: TaskType;
  projectName: string;
  dueDate: string;
  status: TaskStatus;
  
  // Data payloads for specific views
  titles?: TitleOption[];
  outline?: OutlineSection[];
  content?: ContentBlock[];
  comments?: Comment[];

  // Shared Metadata for Title Review
  keywords?: string[];
  strategyGoal?: string;
  targetAudience?: string;
}
