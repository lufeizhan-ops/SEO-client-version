import React, { useState, useEffect, useCallback } from 'react';
import { 
  MessageSquare, 
  CheckCircle, 
  AlertCircle, 
  MessageSquarePlus,
  Edit3,
  Trash2,
  Plus,
  Save,
  X,
  Users,
  Clock
} from 'lucide-react';
import { 
  ContentBlock, 
  Comment,
  ContentEditSuggestion,
  ActiveReviewer
} from '../types';
import { createContentEdit } from '../services/draftService';

interface ContentReviewProps {
  data: ContentBlock[];
  projectName: string;
  existingComments?: Comment[];
  existingEdits?: ContentEditSuggestion[];
  activeReviewers?: ActiveReviewer[];
  contactName: string;
  contactEmail: string;
  existingGeneralComments?: string;
  onSubmit: (approved: boolean, comments: Comment[], edits: ContentEditSuggestion[], generalComments?: string) => void;
  onSaveDraft: (comments: Comment[], edits: ContentEditSuggestion[], generalComments?: string) => void;
  readOnly?: boolean;
}

const ContentReview: React.FC<ContentReviewProps> = ({ 
  data, 
  projectName, 
  existingComments = [],
  existingEdits = [],
  activeReviewers = [],
  contactName,
  contactEmail,
  existingGeneralComments = '',
  onSubmit, 
  onSaveDraft,
  readOnly = false 
}) => {
  // State for comments
  const [comments, setComments] = useState<Comment[]>(existingComments);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  
  // State for edits
  const [edits, setEdits] = useState<ContentEditSuggestion[]>(existingEdits);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<ContentBlock>>({});
  
  // State for adding new blocks
  const [isAddingBlock, setIsAddingBlock] = useState(false);
  const [addAfterBlockId, setAddAfterBlockId] = useState<string | null>(null);
  const [newBlockData, setNewBlockData] = useState<Partial<ContentBlock>>({
    type: 'paragraph',
    content: ''
  });
  
  // State for general comments
  const [generalComments, setGeneralComments] = useState(existingGeneralComments);
  
  // Auto-save state
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load existing data on mount
  useEffect(() => {
    setComments(existingComments);
    setEdits(existingEdits);
    setGeneralComments(existingGeneralComments);
  }, [existingComments, existingEdits, existingGeneralComments]);

  // Track unsaved changes
  useEffect(() => {
    const hasChanges = comments.length > 0 || edits.length > 0;
    setHasUnsavedChanges(hasChanges);
  }, [comments, edits]);

  // Auto-save every 30 seconds if there are changes
  useEffect(() => {
    if (readOnly || !hasUnsavedChanges) return;
    
    const timer = setInterval(() => {
      handleSaveDraft();
    }, 30000);
    
    return () => clearInterval(timer);
  }, [hasUnsavedChanges, readOnly, comments, edits]);

  // Handlers
  const handlePostComment = () => {
    if (!activeBlockId || !newCommentText.trim()) return;
    const newComment: Comment = {
      id: Date.now().toString(),
      targetId: activeBlockId,
      author: contactName,
      text: newCommentText,
      timestamp: new Date(),
      resolved: false
    };
    setComments([...comments, newComment]);
    setNewCommentText('');
  };

  const handleStartEdit = (block: ContentBlock) => {
    setEditingBlockId(block.id);
    setEditFormData({ ...block });
    setActiveBlockId(block.id);
  };

  const handleCancelEdit = () => {
    setEditingBlockId(null);
    setEditFormData({});
  };

  const handleSaveEdit = () => {
    if (!editingBlockId || !editFormData.content?.trim()) return;
    
    const originalBlock = data.find(b => b.id === editingBlockId);
    if (!originalBlock) return;
    
    // Check if anything actually changed
    if (
      originalBlock.content === editFormData.content &&
      originalBlock.type === editFormData.type
    ) {
      handleCancelEdit();
      return;
    }
    
    // Remove any existing edit for this block
    const filteredEdits = edits.filter(e => e.targetId !== editingBlockId);
    
    // Create new edit suggestion
    const newEdit = createContentEdit(
      editingBlockId,
      'modify',
      originalBlock,
      {
        ...originalBlock,
        content: editFormData.content || originalBlock.content,
        type: editFormData.type || originalBlock.type
      } as ContentBlock,
      contactName,
      contactEmail
    );
    
    setEdits([...filteredEdits, newEdit]);
    handleCancelEdit();
  };

  const handleDeleteBlock = (blockId: string) => {
    const block = data.find(b => b.id === blockId);
    if (!block) return;
    
    // Check if this block was added (not in original data)
    const wasAdded = edits.find(e => e.targetId === blockId && e.actionType === 'add');
    if (wasAdded) {
      // Just remove the add edit
      setEdits(edits.filter(e => e.targetId !== blockId));
      return;
    }
    
    // Remove any existing edits for this block
    const filteredEdits = edits.filter(e => e.targetId !== blockId);
    
    // Create delete suggestion
    const deleteEdit = createContentEdit(
      blockId,
      'delete',
      block,
      null,
      contactName,
      contactEmail
    );
    
    setEdits([...filteredEdits, deleteEdit]);
  };

  const handleUndoDelete = (blockId: string) => {
    setEdits(edits.filter(e => !(e.targetId === blockId && e.actionType === 'delete')));
  };

  const handleUndoEdit = (blockId: string) => {
    setEdits(edits.filter(e => e.targetId !== blockId));
  };

  const handleStartAddBlock = (afterBlockId: string | null) => {
    setIsAddingBlock(true);
    setAddAfterBlockId(afterBlockId);
    setNewBlockData({
      type: 'paragraph',
      content: ''
    });
  };

  const handleCancelAddBlock = () => {
    setIsAddingBlock(false);
    setAddAfterBlockId(null);
    setNewBlockData({});
  };

  const handleSaveNewBlock = () => {
    if (!newBlockData.content?.trim()) return;
    
    const newBlock: ContentBlock = {
      id: `new-${Date.now()}`,
      type: newBlockData.type || 'paragraph',
      content: newBlockData.content
    };
    
    const addEdit = createContentEdit(
      newBlock.id,
      'add',
      null,
      newBlock,
      contactName,
      contactEmail
    );
    
    setEdits([...edits, addEdit]);
    handleCancelAddBlock();
  };

  const handleSaveDraft = () => {
    onSaveDraft(comments, edits, generalComments);
    setLastSaved(new Date());
    setHasUnsavedChanges(false);
  };

  const handleSubmit = (approved: boolean) => {
    onSubmit(approved, comments, edits, generalComments);
  };

  const getBlockComments = (blockId: string) => 
    comments.filter(c => c.targetId === blockId);

  const getBlockEdit = (blockId: string) => 
    edits.find(e => e.targetId === blockId);

  const isDeleted = (blockId: string) => 
    edits.some(e => e.targetId === blockId && e.actionType === 'delete');

  const isModified = (blockId: string) => 
    edits.some(e => e.targetId === blockId && e.actionType === 'modify');

  // Get other active reviewers
  const otherReviewers = activeReviewers.filter(r => r.contactEmail !== contactEmail);

  // Render block content
  const renderBlockContent = (block: ContentBlock, isEditMode: boolean = false) => {
    if (isEditMode) {
      return (
        <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-2">
            <select
              value={editFormData.type || 'paragraph'}
              onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value as ContentBlock['type'] })}
              className="px-2 py-1 border border-slate-300 rounded text-sm font-sans"
            >
              <option value="paragraph">Paragraph</option>
              <option value="header">Header</option>
              <option value="quote">Quote</option>
            </select>
          </div>
          <textarea
            value={editFormData.content || ''}
            onChange={(e) => setEditFormData({ ...editFormData, content: e.target.value })}
            placeholder="Enter content..."
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm resize-none font-sans"
            rows={4}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={handleCancelEdit}
              className="px-3 py-1 text-sm text-slate-600 hover:text-slate-800 font-sans"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 font-sans"
            >
              Save Changes
            </button>
          </div>
        </div>
      );
    }

    switch (block.type) {
      case 'header':
        return <h2 className="text-2xl md:text-3xl font-bold font-sans text-slate-900 mb-2 mt-4">{block.content}</h2>;
      case 'paragraph':
        return <p>{block.content}</p>;
      case 'quote':
        return (
          <blockquote className="border-l-4 border-indigo-500 pl-4 italic text-slate-600 my-4 bg-slate-50/50 py-2 rounded-r">
            "{block.content}"
          </blockquote>
        );
      case 'image':
        return (
          <div className="my-4 bg-slate-100 h-48 flex items-center justify-center rounded-lg text-slate-400 text-sm border border-slate-200 border-dashed">
            [Image Placeholder: {block.content}]
          </div>
        );
      default:
        return <p>{block.content}</p>;
    }
  };

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col md:flex-row gap-6 max-w-7xl mx-auto">
      
      {/* Left Column: Document Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="mb-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Content Review</h1>
              <p className="text-slate-600 mt-2">
                Reviewing article: <span className="font-semibold text-slate-800">"{projectName}"</span>.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Collaboration indicator */}
              {otherReviewers.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg">
                  <Users className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {otherReviewers.length} other{otherReviewers.length > 1 ? 's' : ''} reviewing
                  </span>
                </div>
              )}
              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold uppercase tracking-wide">
                {readOnly ? 'View Mode' : 'Edit Mode'}
              </span>
            </div>
          </div>
          
          {/* Edit mode notice */}
          {!readOnly && (
            <div className="mt-4 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 text-amber-800">
                <Edit3 className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Edit Mode: Click on any block to edit, delete, or add comments
                </span>
              </div>
              <div className="flex items-center gap-3">
                {lastSaved && (
                  <span className="text-xs text-amber-600 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Saved {lastSaved.toLocaleTimeString()}
                  </span>
                )}
                <button
                  onClick={handleSaveDraft}
                  className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition"
                >
                  <Save className="w-3 h-3" />
                  Save Draft
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Document Area */}
        <div className="flex-1 overflow-y-auto pr-2 pb-20 scroll-smooth">
          <div className="bg-white shadow-sm border border-slate-200 p-8 md:p-12 rounded-xl min-h-[600px]">
            
            {/* Add block button at top */}
            {!readOnly && (
              <button
                onClick={() => handleStartAddBlock(null)}
                className="w-full mb-4 flex items-center justify-center gap-2 p-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium font-sans">Add content at beginning</span>
              </button>
            )}
            
            <div className="space-y-6 font-serif text-lg leading-relaxed text-slate-800">
              {data.map((block, index) => {
                const blockComments = getBlockComments(block.id);
                const hasComments = blockComments.length > 0;
                const isActive = activeBlockId === block.id;
                const deleted = isDeleted(block.id);
                const modified = isModified(block.id);
                const edit = getBlockEdit(block.id);
                const isEditing = editingBlockId === block.id;
                
                // Get display content (modified or original)
                const displayBlock = modified && edit?.suggestedContent 
                  ? edit.suggestedContent as ContentBlock
                  : block;

                return (
                  <React.Fragment key={block.id}>
                    <div 
                      onClick={() => !isEditing && setActiveBlockId(block.id)}
                      className={`relative p-4 -mx-4 rounded-lg transition-all duration-200 border group ${
                        deleted
                          ? 'border-red-300 bg-red-50/50 opacity-60'
                          : modified
                            ? 'border-amber-400 bg-amber-50/30'
                            : isActive 
                              ? 'bg-indigo-50/40 border-indigo-200 ring-1 ring-indigo-500/10' 
                              : hasComments 
                                ? 'bg-amber-50/40 border-amber-200' 
                                : 'border-transparent hover:bg-slate-50 hover:border-slate-100'
                      } ${!isEditing && !readOnly ? 'cursor-pointer' : ''}`}
                    >
                      {/* Deleted overlay */}
                      {deleted && (
                        <div className="absolute inset-0 flex items-center justify-center bg-red-50/80 rounded-lg z-10">
                          <div className="text-center">
                            <p className="text-red-600 font-medium text-sm mb-2 font-sans">Marked for deletion</p>
                            {!readOnly && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleUndoDelete(block.id); }}
                                className="text-xs text-red-700 underline hover:no-underline font-sans"
                              >
                                Undo
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Modified badge */}
                      {modified && !deleted && (
                        <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
                          <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-sans">
                            Modified
                          </span>
                          {!readOnly && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleUndoEdit(block.id); }}
                              className="text-xs text-amber-700 hover:text-amber-900"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Comment Counter Indicator */}
                      {hasComments && !deleted && !modified && (
                        <div className="absolute right-2 top-2">
                          <div className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 font-sans">
                            <MessageSquare className="w-3 h-3" />
                            {blockComments.length}
                          </div>
                        </div>
                      )}

                      {/* Content Rendering */}
                      {isEditing ? (
                        renderBlockContent(block, true)
                      ) : (
                        <div className={deleted ? 'line-through opacity-50' : ''}>
                          {renderBlockContent(displayBlock)}
                        </div>
                      )}

                      {/* Action buttons */}
                      {!readOnly && !deleted && !isEditing && (
                        <div className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 ${isActive || modified ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStartEdit(block); }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                            title="Edit block"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteBlock(block.id); }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Delete block"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {!hasComments && (
                            <MessageSquarePlus className="w-5 h-5 text-indigo-300 ml-1" />
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Add block button after each block */}
                    {!readOnly && (
                      <button
                        onClick={() => handleStartAddBlock(block.id)}
                        className="w-full flex items-center justify-center gap-2 p-1.5 border-2 border-dashed border-transparent hover:border-green-300 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition opacity-0 hover:opacity-100 focus:opacity-100"
                      >
                        <Plus className="w-3 h-3" />
                        <span className="text-xs font-sans">Add content</span>
                      </button>
                    )}
                  </React.Fragment>
                );
              })}
              
              {/* New block form */}
              {isAddingBlock && (
                <div className="p-4 rounded-xl border-2 border-green-400 bg-green-50/30">
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <select
                        value={newBlockData.type || 'paragraph'}
                        onChange={(e) => setNewBlockData({ ...newBlockData, type: e.target.value as ContentBlock['type'] })}
                        className="px-2 py-1 border border-slate-300 rounded text-sm font-sans"
                      >
                        <option value="paragraph">Paragraph</option>
                        <option value="header">Header</option>
                        <option value="quote">Quote</option>
                      </select>
                    </div>
                    <textarea
                      value={newBlockData.content || ''}
                      onChange={(e) => setNewBlockData({ ...newBlockData, content: e.target.value })}
                      placeholder="Enter content..."
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm resize-none font-sans"
                      rows={4}
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={handleCancelAddBlock}
                        className="px-3 py-1 text-sm text-slate-600 hover:text-slate-800 font-sans"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveNewBlock}
                        disabled={!newBlockData.content?.trim()}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 font-sans"
                      >
                        Add Content
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Spacer for bottom scrolling */}
          <div className="h-10"></div>
        </div>
      </div>

      {/* Right Column: Sidebar (Comments & Actions) */}
      <div className="w-full md:w-96 flex flex-col h-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-shrink-0">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-slate-900">Comments & Actions</h3>
            {edits.length > 0 && (
              <p className="text-xs text-amber-600 mt-1">
                {edits.length} edit suggestion{edits.length > 1 ? 's' : ''} pending
              </p>
            )}
          </div>
          <span className="text-xs text-slate-400 font-medium">{comments.length} comments</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
          {activeBlockId ? (
            <>
              {/* Context Header */}
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                Selected Text
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs text-slate-600 italic mb-6 shadow-sm border-l-4 border-l-indigo-500">
                "{data.find(b => b.id === activeBlockId)?.content.substring(0, 100)}..."
              </div>

              {/* Comments List */}
              <div className="space-y-3">
                {getBlockComments(activeBlockId).map(comment => (
                  <div key={comment.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-bold text-slate-900">{comment.author}</span>
                      <span className="text-[10px] text-slate-400">
                        {comment.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">{comment.text}</p>
                  </div>
                ))}
              </div>

              {/* Input Area - only show when not in read-only mode */}
              {!readOnly && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <textarea
                    autoFocus
                    className="w-full p-3 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none bg-white transition-shadow"
                    placeholder="Type your feedback here..."
                    rows={3}
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handlePostComment();
                      }
                    }}
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={handlePostComment}
                      disabled={!newCommentText.trim()}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      Post Comment
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            // Empty State
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-6">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-slate-300" />
              </div>
              <h4 className="text-slate-900 font-medium mb-1">No Selection</h4>
              <p className="text-sm text-slate-500 max-w-[200px]">
                Click on any paragraph, header, or quote on the left to add comments or edit.
              </p>
            </div>
          )}
        </div>

        {/* General Comments Section */}
        {!readOnly && (
          <div className="p-4 bg-slate-50/50 border-t border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 mb-2 uppercase tracking-wide">General Comments (Optional)</h3>
            <textarea
              className="w-full min-h-[80px] p-3 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-y bg-white"
              placeholder="Any other thoughts on the direction, tone, or style?"
              value={generalComments}
              onChange={(e) => setGeneralComments(e.target.value)}
            />
          </div>
        )}

        {/* Action Footer */}
        <div className="p-4 bg-white border-t border-slate-200">
          {readOnly ? (
            <p className="text-sm text-slate-500 text-center py-2">
              <span className="font-medium">Read-only mode</span> — This review has been completed.
            </p>
          ) : (
            <>
              <p className="text-xs text-slate-400 text-center mb-3">
                {hasUnsavedChanges ? (
                  <span className="text-amber-600 font-medium">You have unsaved changes</span>
                ) : comments.length === 0 && edits.length === 0 ? (
                  'No changes made yet.'
                ) : (
                  `${comments.length} comments, ${edits.length} edits recorded.`
                )}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleSubmit(false)}
                  className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors text-sm"
                >
                  <AlertCircle className="w-4 h-4" />
                  Request Changes
                </button>
                <button
                  onClick={() => handleSubmit(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors text-sm shadow-md shadow-indigo-200"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve Content
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContentReview;
