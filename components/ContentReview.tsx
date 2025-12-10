import React, { useState } from 'react';
import { MessageSquare, CheckCircle, AlertCircle, MessageSquarePlus } from 'lucide-react';
import { ContentBlock, Comment } from '../types';

interface ContentReviewProps {
  data: ContentBlock[];
  projectName: string;
  onSubmit: (approved: boolean, comments: Comment[]) => void;
}

const ContentReview: React.FC<ContentReviewProps> = ({ data, projectName, onSubmit }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');

  const handlePostComment = () => {
    if (!activeBlockId || !newCommentText.trim()) return;
    const newComment: Comment = {
      id: Date.now().toString(),
      targetId: activeBlockId,
      author: 'Client',
      text: newCommentText,
      timestamp: new Date(),
      resolved: false
    };
    setComments([...comments, newComment]);
    setNewCommentText('');
  };

  const getBlockComments = (blockId: string) => comments.filter(c => c.targetId === blockId);

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col md:flex-row gap-6 max-w-7xl mx-auto">
      
      {/* Left Column: Document Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="mb-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Content Review</h1>
              <p className="text-slate-600 mt-2">
                Reviewing article: <span className="font-semibold text-slate-800">"{projectName}"</span>.
              </p>
            </div>
            <div className="hidden sm:block">
               <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold uppercase tracking-wide">Draft Mode</span>
            </div>
          </div>
        </div>

        {/* Scrollable Document Area */}
        <div className="flex-1 overflow-y-auto pr-2 pb-20 scroll-smooth">
          <div className="bg-white shadow-sm border border-slate-200 p-8 md:p-12 rounded-xl min-h-[600px]">
             <div className="space-y-6 font-serif text-lg leading-relaxed text-slate-800">
                {data.map((block) => {
                  const blockComments = getBlockComments(block.id);
                  const hasComments = blockComments.length > 0;
                  const isActive = activeBlockId === block.id;

                  return (
                    <div 
                      key={block.id}
                      onClick={() => setActiveBlockId(block.id)}
                      className={`relative p-4 -mx-4 rounded-lg transition-all duration-200 cursor-pointer border group ${
                        isActive 
                          ? 'bg-indigo-50/40 border-indigo-200 ring-1 ring-indigo-500/10' 
                          : hasComments 
                            ? 'bg-amber-50/40 border-amber-200' 
                            : 'border-transparent hover:bg-slate-50 hover:border-slate-100'
                      }`}
                    >
                      {/* Comment Counter Indicator */}
                      {hasComments && (
                         <div className="absolute right-2 top-2">
                           <div className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                             <MessageSquare className="w-3 h-3" />
                             {blockComments.length}
                           </div>
                         </div>
                      )}

                      {/* Content Rendering */}
                      {block.type === 'header' && (
                        <h2 className="text-2xl md:text-3xl font-bold font-sans text-slate-900 mb-2 mt-4">{block.content}</h2>
                      )}
                      {block.type === 'paragraph' && (
                        <p>{block.content}</p>
                      )}
                      {block.type === 'quote' && (
                        <blockquote className="border-l-4 border-indigo-500 pl-4 italic text-slate-600 my-4 bg-slate-50/50 py-2 rounded-r">
                          "{block.content}"
                        </blockquote>
                      )}
                      {block.type === 'image' && (
                         <div className="my-4 bg-slate-100 h-48 flex items-center justify-center rounded-lg text-slate-400 text-sm border border-slate-200 border-dashed">
                            [Image Placeholder: {block.content}]
                         </div>
                      )}

                      {/* Hover Action Indicator */}
                      <div className={`absolute right-2 top-1/2 -translate-y-1/2 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                        {!hasComments && <MessageSquarePlus className="w-5 h-5 text-indigo-300" />}
                      </div>
                    </div>
                  );
                })}
             </div>
          </div>
          {/* Spacer for bottom scrolling */}
          <div className="h-10"></div>
        </div>
      </div>

      {/* Right Column: Sidebar (Comments & Actions) */}
      <div className="w-full md:w-96 flex flex-col h-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-shrink-0">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="font-semibold text-slate-900">Comments & Actions</h3>
          <span className="text-xs text-slate-400 font-medium">{comments.length} total</span>
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

              {/* Input Area */}
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
            </>
          ) : (
            // Empty State
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-6">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                 <MessageSquare className="w-8 h-8 text-slate-300" />
              </div>
              <h4 className="text-slate-900 font-medium mb-1">No Selection</h4>
              <p className="text-sm text-slate-500 max-w-[200px]">
                Click on any paragraph, header, or image on the left to add comments.
              </p>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="p-4 bg-white border-t border-slate-200">
          <p className="text-xs text-slate-400 text-center mb-3">
             {comments.length === 0 ? 'No comments added yet.' : `${comments.length} comments recorded.`}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onSubmit(false, comments)}
              className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors text-sm"
            >
              <AlertCircle className="w-4 h-4" />
              Request Changes
            </button>
            <button
              onClick={() => onSubmit(true, comments)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors text-sm shadow-md shadow-indigo-200"
            >
              <CheckCircle className="w-4 h-4" />
              Approve Content
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentReview;
