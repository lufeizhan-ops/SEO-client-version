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
