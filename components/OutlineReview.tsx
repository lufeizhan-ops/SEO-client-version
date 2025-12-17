import React, { useState, useEffect, useCallback } from 'react';
import { 
  MessageSquare, 
  CheckCircle, 
  AlertCircle, 
  GripVertical, 
  Edit3, 
  Trash2, 
  Plus, 
  Save, 
  X, 
  Users,
  Clock
} from 'lucide-react';
import { 
  OutlineSection, 
  Comment, 
  OutlineEditSuggestion,
  ActiveReviewer
} from '../types';
import { createOutlineEdit } from '../services/draftService';

interface OutlineReviewProps {
  data: OutlineSection[];
  projectName: string;
  existingComments?: Comment[];
  existingEdits?: OutlineEditSuggestion[];
  activeReviewers?: ActiveReviewer[];
  contactName: string;
  contactEmail: string;
  existingGeneralComments?: string;
  onSubmit: (approved: boolean, comments: Comment[], edits: OutlineEditSuggestion[], generalComments?: string) => void;
  onSaveDraft: (comments: Comment[], edits: OutlineEditSuggestion[], generalComments?: string) => void;
  readOnly?: boolean;
}

const OutlineReview: React.FC<OutlineReviewProps> = ({ 
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
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  
  // State for edits
  const [edits, setEdits] = useState<OutlineEditSuggestion[]>(existingEdits);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<OutlineSection>>({});
  
  // State for adding new sections
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [addAfterSectionId, setAddAfterSectionId] = useState<string | null>(null);
  const [newSectionData, setNewSectionData] = useState<Partial<OutlineSection>>({
    level: 'H2',
    title: '',
    description: ''
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

  // Get merged view of original data with edits
  const getMergedSections = useCallback((): OutlineSection[] => {
    const result: OutlineSection[] = [];
    const deletedIds = new Set(
      edits.filter(e => e.actionType === 'delete').map(e => e.targetId)
    );
    
    for (const section of data) {
      if (deletedIds.has(section.id)) continue;
      
      // Check for modifications
      const modification = edits.find(
        e => e.targetId === section.id && e.actionType === 'modify'
      );
      
      if (modification && modification.suggestedContent) {
        result.push(modification.suggestedContent as OutlineSection);
      } else {
        result.push(section);
      }
    }
    
    // Add new sections
    const additions = edits.filter(e => e.actionType === 'add');
    for (const add of additions) {
      if (add.suggestedContent) {
        result.push(add.suggestedContent as OutlineSection);
      }
    }
    
    return result;
  }, [data, edits]);

  // Handlers
  const handleAddComment = () => {
    if (!activeSectionId || !newCommentText.trim()) return;

    const newComment: Comment = {
      id: Date.now().toString(),
      targetId: activeSectionId,
      author: contactName,
      text: newCommentText,
      timestamp: new Date(),
      resolved: false,
    };

    setComments([...comments, newComment]);
    setNewCommentText('');
  };

  const handleStartEdit = (section: OutlineSection) => {
    setEditingSection(section.id);
    setEditFormData({ ...section });
    setActiveSectionId(section.id);
  };

  const handleCancelEdit = () => {
    setEditingSection(null);
    setEditFormData({});
  };

  const handleSaveEdit = () => {
    if (!editingSection || !editFormData.title?.trim()) return;
    
    const originalSection = data.find(s => s.id === editingSection);
    if (!originalSection) return;
    
    // Check if anything actually changed
    if (
      originalSection.title === editFormData.title &&
      originalSection.description === editFormData.description &&
      originalSection.level === editFormData.level
    ) {
      handleCancelEdit();
      return;
    }
    
    // Remove any existing edit for this section
    const filteredEdits = edits.filter(e => e.targetId !== editingSection);
    
    // Create new edit suggestion
    const newEdit = createOutlineEdit(
      editingSection,
      'modify',
      originalSection,
      {
        ...originalSection,
        title: editFormData.title || originalSection.title,
        description: editFormData.description,
        level: editFormData.level || originalSection.level
      } as OutlineSection,
      contactName,
      contactEmail
    );
    
    setEdits([...filteredEdits, newEdit]);
    handleCancelEdit();
  };

  const handleDeleteSection = (sectionId: string) => {
    const section = data.find(s => s.id === sectionId);
    if (!section) return;
    
    // Check if this section was added (not in original data)
    const wasAdded = edits.find(e => e.targetId === sectionId && e.actionType === 'add');
    if (wasAdded) {
      // Just remove the add edit
      setEdits(edits.filter(e => e.targetId !== sectionId));
      return;
    }
    
    // Remove any existing edits for this section
    const filteredEdits = edits.filter(e => e.targetId !== sectionId);
    
    // Create delete suggestion
    const deleteEdit = createOutlineEdit(
      sectionId,
      'delete',
      section,
      null,
      contactName,
      contactEmail
    );
    
    setEdits([...filteredEdits, deleteEdit]);
  };

  const handleUndoDelete = (sectionId: string) => {
    setEdits(edits.filter(e => !(e.targetId === sectionId && e.actionType === 'delete')));
  };

  const handleUndoEdit = (sectionId: string) => {
    setEdits(edits.filter(e => e.targetId !== sectionId));
  };

  const handleStartAddSection = (afterSectionId: string | null) => {
    setIsAddingSection(true);
    setAddAfterSectionId(afterSectionId);
    setNewSectionData({
      level: 'H2',
      title: '',
      description: ''
    });
  };

  const handleCancelAddSection = () => {
    setIsAddingSection(false);
    setAddAfterSectionId(null);
    setNewSectionData({});
  };

  const handleSaveNewSection = () => {
    if (!newSectionData.title?.trim()) return;
    
    const newSection: OutlineSection = {
      id: `new-${Date.now()}`,
      level: newSectionData.level || 'H2',
      title: newSectionData.title,
      description: newSectionData.description
    };
    
    const addEdit = createOutlineEdit(
      newSection.id,
      'add',
      null,
      newSection,
      contactName,
      contactEmail
    );
    
    setEdits([...edits, addEdit]);
    handleCancelAddSection();
  };

  const handleSaveDraft = () => {
    onSaveDraft(comments, edits, generalComments);
    setLastSaved(new Date());
    setHasUnsavedChanges(false);
  };

  const handleSubmit = (approved: boolean) => {
    onSubmit(approved, comments, edits, generalComments);
  };

  const getSectionComments = (sectionId: string) => 
    comments.filter(c => c.targetId === sectionId);

  const getSectionEdit = (sectionId: string) => 
    edits.find(e => e.targetId === sectionId);

  const isDeleted = (sectionId: string) => 
    edits.some(e => e.targetId === sectionId && e.actionType === 'delete');

  const isModified = (sectionId: string) => 
    edits.some(e => e.targetId === sectionId && e.actionType === 'modify');

  // Get other active reviewers (excluding current user)
  const otherReviewers = activeReviewers.filter(r => r.contactEmail !== contactEmail);

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col md:flex-row gap-6 max-w-7xl mx-auto">
      {/* Left Column: Outline */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="mb-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Outline Review</h1>
              <p className="text-slate-600 mt-2">
                Review the structure for <span className="font-semibold text-slate-800">"{projectName}"</span> before production begins.
              </p>
            </div>
            
            {/* Collaboration indicator */}
            {otherReviewers.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg">
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {otherReviewers.length} other{otherReviewers.length > 1 ? 's' : ''} reviewing
                </span>
              </div>
            )}
          </div>
          
          {/* Edit mode notice */}
          {!readOnly && (
            <div className="mt-4 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 text-amber-800">
                <Edit3 className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Edit Mode: Click on any section to edit, delete, or add comments
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

        {/* Add section button at top */}
        {!readOnly && (
          <button
            onClick={() => handleStartAddSection(null)}
            className="mb-3 flex items-center justify-center gap-2 p-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">Add section at beginning</span>
          </button>
        )}

        {/* Sections list */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-3 pb-20">
          {data.map((section, index) => {
            const sectionComments = getSectionComments(section.id);
            const hasComments = sectionComments.length > 0;
            const isActive = activeSectionId === section.id;
            const deleted = isDeleted(section.id);
            const modified = isModified(section.id);
            const edit = getSectionEdit(section.id);
            const isEditing = editingSection === section.id;
            
            // Get display content (modified or original)
            const displaySection = modified && edit?.suggestedContent 
              ? edit.suggestedContent as OutlineSection
              : section;

            return (
              <React.Fragment key={section.id}>
                <div
                  onClick={() => !isEditing && setActiveSectionId(section.id)}
                  className={`relative group p-4 rounded-xl border transition-all ${
                    deleted
                      ? 'border-red-300 bg-red-50/50 opacity-60'
                      : modified
                        ? 'border-amber-400 bg-amber-50/30'
                        : isActive
                          ? 'border-indigo-500 bg-indigo-50/30 shadow-sm ring-1 ring-indigo-500/20'
                          : hasComments 
                            ? 'border-amber-300 bg-amber-50/30' 
                            : 'border-slate-200 bg-white hover:border-indigo-300'
                  } ${!isEditing && !readOnly ? 'cursor-pointer' : ''}`}
                >
                  {/* Deleted overlay */}
                  {deleted && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-50/80 rounded-xl z-10">
                      <div className="text-center">
                        <p className="text-red-600 font-medium text-sm mb-2">Marked for deletion</p>
                        {!readOnly && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleUndoDelete(section.id); }}
                            className="text-xs text-red-700 underline hover:no-underline"
                          >
                            Undo
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Modified badge */}
                  {modified && !deleted && (
                    <div className="absolute top-2 right-2 flex items-center gap-2">
                      <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                        Modified
                      </span>
                      {!readOnly && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleUndoEdit(section.id); }}
                          className="text-xs text-amber-700 hover:text-amber-900"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}

                  {isEditing ? (
                    // Edit form
                    <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <select
                          value={editFormData.level || 'H2'}
                          onChange={(e) => setEditFormData({ ...editFormData, level: e.target.value as 'H1' | 'H2' | 'H3' })}
                          className="px-2 py-1 border border-slate-300 rounded text-sm"
                        >
                          <option value="H1">H1</option>
                          <option value="H2">H2</option>
                          <option value="H3">H3</option>
                        </select>
                        <input
                          type="text"
                          value={editFormData.title || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                          placeholder="Section title"
                          className="flex-1 px-3 py-1 border border-slate-300 rounded text-sm"
                          autoFocus
                        />
                      </div>
                      <textarea
                        value={editFormData.description || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                        placeholder="Description (optional)"
                        className="w-full px-3 py-2 border border-slate-300 rounded text-sm resize-none"
                        rows={2}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1 text-sm text-slate-600 hover:text-slate-800"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Display view
                    <div className="flex items-start gap-3">
                      <div className="mt-1 text-slate-300 group-hover:text-slate-400">
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            displaySection.level === 'H1' ? 'bg-slate-800 text-white' :
                            displaySection.level === 'H2' ? 'bg-indigo-100 text-indigo-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {displaySection.level}
                          </span>
                          {displaySection.wordCountEstimate && (
                            <span className="text-xs text-slate-400">~{displaySection.wordCountEstimate}w</span>
                          )}
                        </div>
                        <h3 className={`font-semibold text-slate-900 ${
                          displaySection.level === 'H1' ? 'text-xl' :
                          displaySection.level === 'H2' ? 'text-lg' : 'text-base'
                        } ${deleted ? 'line-through' : ''}`}>
                          {displaySection.title}
                        </h3>
                        {displaySection.description && (
                          <p className={`text-slate-600 text-sm mt-1 ${deleted ? 'line-through' : ''}`}>
                            {displaySection.description}
                          </p>
                        )}
                      </div>
                      
                      {/* Action buttons */}
                      {!readOnly && !deleted && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStartEdit(section); }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                            title="Edit section"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteSection(section.id); }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Delete section"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      
                      {/* Comment indicator */}
                      {(hasComments || isActive) && !deleted && (
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          hasComments ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'
                        }`}>
                          <MessageSquare className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Add section button after each section */}
                {!readOnly && (
                  <button
                    onClick={() => handleStartAddSection(section.id)}
                    className="w-full flex items-center justify-center gap-2 p-1.5 border-2 border-dashed border-transparent hover:border-green-300 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition opacity-0 hover:opacity-100 focus:opacity-100"
                  >
                    <Plus className="w-3 h-3" />
                    <span className="text-xs">Add section</span>
                  </button>
                )}
              </React.Fragment>
            );
          })}
          
          {/* New section form */}
          {isAddingSection && (
            <div className="p-4 rounded-xl border-2 border-green-400 bg-green-50/30">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <select
                    value={newSectionData.level || 'H2'}
                    onChange={(e) => setNewSectionData({ ...newSectionData, level: e.target.value as 'H1' | 'H2' | 'H3' })}
                    className="px-2 py-1 border border-slate-300 rounded text-sm"
                  >
                    <option value="H1">H1</option>
                    <option value="H2">H2</option>
                    <option value="H3">H3</option>
                  </select>
                  <input
                    type="text"
                    value={newSectionData.title || ''}
                    onChange={(e) => setNewSectionData({ ...newSectionData, title: e.target.value })}
                    placeholder="New section title"
                    className="flex-1 px-3 py-1 border border-slate-300 rounded text-sm"
                    autoFocus
                  />
                </div>
                <textarea
                  value={newSectionData.description || ''}
                  onChange={(e) => setNewSectionData({ ...newSectionData, description: e.target.value })}
                  placeholder="Description (optional)"
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm resize-none"
                  rows={2}
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleCancelAddSection}
                    className="px-3 py-1 text-sm text-slate-600 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNewSection}
                    disabled={!newSectionData.title?.trim()}
                    className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    Add Section
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Comments & Actions */}
      <div className="w-full md:w-96 flex flex-col h-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-shrink-0">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-semibold text-slate-900">Comments & Actions</h3>
          {edits.length > 0 && (
            <p className="text-xs text-amber-600 mt-1">
              {edits.length} edit suggestion{edits.length > 1 ? 's' : ''} pending
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
          {activeSectionId ? (
            <>
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                Selected Section
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 text-sm text-slate-700 italic mb-6">
                "{data.find(s => s.id === activeSectionId)?.title || 'New Section'}"
              </div>

              {getSectionComments(activeSectionId).map(comment => (
                <div key={comment.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold text-slate-900">{comment.author}</span>
                    <span className="text-xs text-slate-400">
                      {comment.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700">{comment.text}</p>
                </div>
              ))}

              {/* Comment input */}
              {!readOnly && (
                <div className="mt-4">
                  <textarea
                    className="w-full p-3 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none bg-white"
                    placeholder="Ask a question or request a change..."
                    rows={3}
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAddComment();
                      }
                    }}
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!newCommentText.trim()}
                    className="mt-2 w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    Post Comment
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-6">
              <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">Select a section on the left to add comments or view details.</p>
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

        <div className="p-4 bg-white border-t border-slate-200">
          {readOnly ? (
            <p className="text-sm text-slate-500 text-center py-2">
              <span className="font-medium">Read-only mode</span> — This review has been completed.
            </p>
          ) : (
            <>
              <p className="text-xs text-slate-500 text-center mb-3">
                {hasUnsavedChanges ? (
                  <span className="text-amber-600 font-medium">You have unsaved changes</span>
                ) : (
                  'Please review all sections before approving.'
                )}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleSubmit(false)}
                  className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <AlertCircle className="w-4 h-4" />
                  Request Changes
                </button>
                <button
                  onClick={() => handleSubmit(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve Outline
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OutlineReview;
