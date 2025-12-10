import React, { useState } from 'react';
import { MessageSquare, CheckCircle, AlertCircle, GripVertical } from 'lucide-react';
import { OutlineSection, Comment } from '../types';

interface OutlineReviewProps {
  data: OutlineSection[];
  projectName: string;
  existingComments?: Comment[];
  onSubmit: (approved: boolean, comments: Comment[]) => void;
}

const OutlineReview: React.FC<OutlineReviewProps> = ({ data, projectName, existingComments = [], onSubmit }) => {
  const [comments, setComments] = useState<Comment[]>(existingComments);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');

  const handleAddComment = () => {
    if (!activeSectionId || !newCommentText.trim()) return;

    const newComment: Comment = {
      id: Date.now().toString(),
      targetId: activeSectionId,
      author: 'You',
      text: newCommentText,
      timestamp: new Date(),
      resolved: false,
    };

    setComments([...comments, newComment]);
    setNewCommentText('');
  };

  const getSectionComments = (sectionId: string) => comments.filter(c => c.targetId === sectionId);

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col md:flex-row gap-6 max-w-7xl mx-auto">
      {/* Left Column: Outline */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="mb-6 flex-shrink-0">
          <h1 className="text-3xl font-bold text-slate-900">Outline Review</h1>
          <p className="text-slate-600 mt-2">
            Review the structure for <span className="font-semibold text-slate-800">"{projectName}"</span> before production begins.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-3 pb-20">
          {data.map((section) => {
            const sectionComments = getSectionComments(section.id);
            const hasComments = sectionComments.length > 0;
            const isActive = activeSectionId === section.id;

            return (
              <div
                key={section.id}
                onClick={() => setActiveSectionId(section.id)}
                className={`relative group p-4 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? 'border-indigo-500 bg-indigo-50/30 shadow-sm ring-1 ring-indigo-500/20'
                    : hasComments 
                        ? 'border-amber-300 bg-amber-50/30' 
                        : 'border-slate-200 bg-white hover:border-indigo-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1 text-slate-300 group-hover:text-slate-400">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        section.level === 'H1' ? 'bg-slate-800 text-white' :
                        section.level === 'H2' ? 'bg-indigo-100 text-indigo-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {section.level}
                      </span>
                      {section.wordCountEstimate && (
                        <span className="text-xs text-slate-400">~{section.wordCountEstimate}w</span>
                      )}
                    </div>
                    <h3 className={`font-semibold text-slate-900 ${
                      section.level === 'H1' ? 'text-xl' :
                      section.level === 'H2' ? 'text-lg' : 'text-base'
                    }`}>
                      {section.title}
                    </h3>
                    {section.description && (
                      <p className="text-slate-600 text-sm mt-1">{section.description}</p>
                    )}
                  </div>
                  
                  {(hasComments || isActive) && (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      hasComments ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'
                    }`}>
                      <MessageSquare className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Comments & Actions */}
      <div className="w-full md:w-96 flex flex-col h-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-shrink-0">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-semibold text-slate-900">Comments & Actions</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
          {activeSectionId ? (
            <>
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                Selected Section
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 text-sm text-slate-700 italic mb-6">
                "{data.find(s => s.id === activeSectionId)?.title}"
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
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-6">
              <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">Select a section on the left to add comments or view details.</p>
            </div>
          )}
        </div>

        <div className="p-4 bg-white border-t border-slate-200">
          <p className="text-xs text-slate-500 text-center mb-3">
            Please review all sections before approving.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onSubmit(false, comments)}
              className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              <AlertCircle className="w-4 h-4" />
              Request Changes
            </button>
            <button
              onClick={() => onSubmit(true, comments)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Approve Outline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OutlineReview;
