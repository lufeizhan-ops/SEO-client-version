import React, { useState } from 'react';
import { MessageSquarePlus, X, Check, CornerUpLeft } from 'lucide-react';
import { ContentBlock, Comment } from '../types';

interface ContentReviewProps {
  data: ContentBlock[];
  projectName: string;
  onSubmit: (approved: boolean, comments: Comment[]) => void;
}

const ContentReview: React.FC<ContentReviewProps> = ({ data, projectName, onSubmit }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [isCommentDrawerOpen, setIsCommentDrawerOpen] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');

  const handleBlockClick = (id: string) => {
    setActiveBlockId(id);
    setIsCommentDrawerOpen(true);
  };

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

  const activeComments = comments.filter(c => c.targetId === activeBlockId);
  const totalComments = comments.length;

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-[#FAFAFA]">
      
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-4 py-8 md:px-12 md:py-12 flex justify-center">
        <div className="max-w-2xl w-full bg-white shadow-sm border border-slate-100 p-12 min-h-[800px]">
          <div className="mb-8 border-b pb-4">
             <div className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold mb-2">Draft</div>
             <p className="text-slate-400 text-sm">Last updated 2 hours ago</p>
          </div>
          
          <div className="space-y-6 font-serif text-lg leading-relaxed text-slate-800">
            {data.map((block) => {
              const blockComments = comments.filter(c => c.targetId === block.id);
              const hasComments = blockComments.length > 0;
              const isActive = activeBlockId === block.id;

              return (
                <div 
                  key={block.id}
                  onClick={() => handleBlockClick(block.id)}
                  className={`relative p-2 rounded-lg transition-colors cursor-text group ${
                    isActive ? 'bg-indigo-50/50 ring-2 ring-indigo-100' : 
                    hasComments ? 'bg-amber-50/50' : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Visual Indicator for comments */}
                  {hasComments && (
                    <div className="absolute -right-12 top-2 w-8 h-8 flex items-center justify-center">
                      <div className="bg-amber-100 text-amber-600 text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-sm">
                        {blockComments.length}
                      </div>
                    </div>
                  )}

                  {/* Render content based on type */}
                  {block.type === 'header' && (
                    <h2 className="text-3xl font-bold font-sans text-slate-900 mb-4 mt-8">{block.content}</h2>
                  )}
                  {block.type === 'paragraph' && (
                    <p>{block.content}</p>
                  )}
                  {block.type === 'quote' && (
                    <blockquote className="border-l-4 border-indigo-500 pl-4 italic text-slate-600 my-6">
                      "{block.content}"
                    </blockquote>
                  )}
                  {block.type === 'image' && (
                     <div className="my-6 bg-slate-100 h-64 flex items-center justify-center rounded-lg text-slate-400">
                        [Image Placeholder: {block.content}]
                     </div>
                  )}

                  {/* Hover Action */}
                  <div className={`absolute right-2 top-0 transform translate-y-[-50%] ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                    <button className="bg-white shadow-md border border-slate-200 rounded-full p-1.5 text-slate-500 hover:text-indigo-600">
                      <MessageSquarePlus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating Action Bar (Sticky Bottom in Mobile, or Top Right) */}
      <div className="absolute top-4 right-8 flex items-center gap-3">
        <button 
           onClick={() => onSubmit(false, comments)}
           className="px-4 py-2 bg-white border border-slate-200 shadow-sm text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm flex items-center gap-2"
        >
          <CornerUpLeft className="w-4 h-4" /> Request Changes {totalComments > 0 && `(${totalComments})`}
        </button>
        <button 
           onClick={() => onSubmit(true, comments)}
           className="px-4 py-2 bg-indigo-600 shadow-md text-white rounded-lg hover:bg-indigo-700 font-medium text-sm flex items-center gap-2"
        >
          <Check className="w-4 h-4" /> Approve Final
        </button>
      </div>

      {/* Comment Drawer */}
      {isCommentDrawerOpen && (
        <div className="w-80 bg-white border-l border-slate-200 shadow-xl flex flex-col h-full z-20 absolute right-0 top-0">
          <div className="p-4 border-b flex justify-between items-center bg-slate-50">
            <h3 className="font-semibold text-slate-800">Add Comment</h3>
            <button onClick={() => setIsCommentDrawerOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
             {activeBlockId && (
               <div className="text-xs text-slate-400 italic mb-4 border-l-2 border-slate-200 pl-2">
                 Selected: "{data.find(b => b.id === activeBlockId)?.content.substring(0, 50)}..."
               </div>
             )}
             
             {activeComments.map(c => (
               <div key={c.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                 <div className="flex justify-between mb-1">
                   <span className="font-bold text-xs text-slate-700">{c.author}</span>
                   <span className="text-xs text-slate-400">Today</span>
                 </div>
                 <p className="text-sm text-slate-800">{c.text}</p>
               </div>
             ))}

             {activeComments.length === 0 && (
               <div className="text-center py-8 text-slate-400 text-sm">
                 No comments on this section yet.
               </div>
             )}
          </div>

          <div className="p-4 border-t bg-white">
            <textarea
              autoFocus
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none resize-none mb-2"
              rows={3}
              placeholder="Type your feedback here..."
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handlePostComment())}
            />
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setIsCommentDrawerOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button 
                onClick={handlePostComment}
                disabled={!newCommentText.trim()}
                className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                Post Comment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentReview;
