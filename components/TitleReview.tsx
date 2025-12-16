import React, { useState } from 'react';
import { Check, Edit2, Info, Sparkles, XCircle, Users, Target, Hash } from 'lucide-react';
import { TitleOption } from '../types';
import { suggestAlternativeTitles } from '../services/geminiService';

interface TitleReviewProps {
  data: TitleOption[];
  projectName: string;
  keywords: string[];
  strategyGoal: string;
  targetAudience: string;
  onSubmit: (titles: TitleOption[], rejected: boolean, rejectReason?: string, generalComments?: string) => void;
  readOnly?: boolean;
}

const TitleReview: React.FC<TitleReviewProps> = ({ 
  data, 
  projectName, 
  keywords, 
  strategyGoal, 
  targetAudience, 
  onSubmit,
  readOnly = false
}) => {
  const [titles, setTitles] = useState<TitleOption[]>(data);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [generalComments, setGeneralComments] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const toggleSelection = (id: string) => {
    setTitles(prev => prev.map(t => ({
      ...t,
      isSelected: t.id === id ? !t.isSelected : t.isSelected
    })));
  };

  const updateTitleText = (id: string, newText: string) => {
    setTitles(prev => prev.map(t => ({
      ...t,
      text: t.id === id ? newText : t.text
    })));
  };

  const updateNotes = (id: string, note: string) => {
    setTitles(prev => prev.map(t => ({
      ...t,
      clientNotes: t.id === id ? note : t.clientNotes
    })));
  };

  const handleGenerateAlternatives = async (id: string) => {
    const title = titles.find(t => t.id === id);
    if (!title) return;

    setIsGenerating(true);
    // Use the shared keywords from props instead of title-specific ones
    const alternatives = await suggestAlternativeTitles(title.text, keywords);
    setIsGenerating(false);

    if (alternatives.length > 0) {
      const newText = alternatives[0]; 
      if (confirm(`AI Suggestion: "${newText}"\n\nReplace current title with this suggestion?`)) {
        updateTitleText(id, newText);
      }
    } else {
      alert("Could not generate suggestions at this time.");
    }
  };

  const selectedCount = titles.filter(t => t.isSelected).length;

  if (isRejecting) {
    return (
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-8 mt-12">
        <div className="text-center mb-8">
          <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <XCircle className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-2xl font-semibold text-slate-900">Reject All Titles</h2>
          <p className="text-slate-600 mt-2">Please let us know why these titles don't work so we can provide better options.</p>
        </div>
        
        <textarea
          className="w-full h-32 p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none resize-none"
          placeholder="e.g., These feel too casual for our corporate clients..."
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />

        <div className="flex justify-end gap-3 mt-6">
          <button 
            onClick={() => setIsRejecting(false)}
            className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => onSubmit(titles, true, rejectReason, generalComments)}
            disabled={!rejectReason.trim()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            Submit Rejection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-0">
      
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
           <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">Step 1 of 3</span>
           <span className="text-slate-400 text-sm">/</span>
           <span className="text-slate-500 text-sm">{projectName}</span>
        </div>
        <h1 className="text-3xl font-bold text-slate-900">Title & Keyword Review</h1>
        <p className="text-slate-600 mt-2 max-w-2xl">
          Select your preferred title(s). You can edit them directly or add notes. 
          Your input helps us refine the content strategy.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Content: Titles List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-6">
            {titles.map((title) => (
              <div 
                key={title.id}
                className={`relative group rounded-xl border-2 transition-all duration-200 p-6 bg-white ${
                  title.isSelected 
                    ? 'border-indigo-600 shadow-md bg-indigo-50/10' 
                    : 'border-slate-200 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="pt-1">
                    <button
                      onClick={() => toggleSelection(title.id)}
                      className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors ${
                        title.isSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-slate-300 bg-white hover:border-indigo-500'
                      }`}
                    >
                      {title.isSelected && <Check className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="flex-1">
                    {editingId === title.id ? (
                      <div className="mb-3">
                        <input
                          autoFocus
                          type="text"
                          value={title.text}
                          onChange={(e) => updateTitleText(title.id, e.target.value)}
                          onBlur={() => setEditingId(null)}
                          onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)}
                          className="w-full text-xl font-semibold text-slate-900 border-b-2 border-indigo-500 focus:outline-none bg-transparent"
                        />
                        <span className="text-xs text-slate-500 mt-1 block">Press Enter to save</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 mb-2">
                        <h3 
                          className="text-xl font-semibold text-slate-900 cursor-pointer hover:text-indigo-700"
                          onClick={() => toggleSelection(title.id)}
                        >
                          {title.text}
                        </h3>
                        <button 
                          onClick={() => setEditingId(title.id)}
                          className="text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleGenerateAlternatives(title.id)}
                          className="text-slate-400 hover:text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs bg-slate-100 px-2 py-1 rounded-full"
                          disabled={isGenerating}
                        >
                          <Sparkles className="w-3 h-3" />
                          {isGenerating ? 'Thinking...' : 'AI Rephrase'}
                        </button>
                      </div>
                    )}

                    <div className="mt-4">
                      <input
                        type="text"
                        placeholder="Add specific feedback or notes about this title..."
                        value={title.clientNotes || ''}
                        onChange={(e) => updateNotes(title.id, e.target.value)}
                        className="w-full text-sm border-b border-transparent hover:border-slate-200 focus:border-indigo-400 outline-none bg-transparent transition-colors py-1 text-slate-600 placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* General Comments Section */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 mt-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wide">General Comments (Optional)</h3>
            <textarea
              className="w-full min-h-[100px] p-3 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-y bg-slate-50"
              placeholder="Any other thoughts on the direction, tone, or style?"
              value={generalComments}
              onChange={(e) => setGeneralComments(e.target.value)}
            />
          </div>
        </div>

        {/* Sidebar: Project Context */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm sticky top-24 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <Info className="w-4 h-4 text-slate-500" />
                Project Context
              </h2>
            </div>
            
            <div className="p-5 space-y-6">
              {/* Target Audience */}
              <div>
                <div className="flex items-center gap-2 mb-2 text-indigo-600 font-medium text-sm">
                  <Users className="w-4 h-4" /> Target Audience
                </div>
                <p className="text-sm text-slate-700 leading-relaxed bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
                  {targetAudience}
                </p>
              </div>

              {/* Strategy */}
              <div>
                <div className="flex items-center gap-2 mb-2 text-indigo-600 font-medium text-sm">
                  <Target className="w-4 h-4" /> Strategy Goal
                </div>
                <p className="text-sm text-slate-700 leading-relaxed bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
                  {strategyGoal}
                </p>
              </div>

              {/* Keywords */}
              <div>
                <div className="flex items-center gap-2 mb-3 text-indigo-600 font-medium text-sm">
                  <Hash className="w-4 h-4" /> Target Keywords
                </div>
                <div className="flex flex-wrap gap-2">
                  {keywords.map((kw, idx) => (
                    <span key={idx} className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-md border border-slate-200">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Floating Action Footer - Only show when not in read-only mode */}
      {!readOnly && (
        <div className="sticky bottom-6 mt-8 bg-white/90 backdrop-blur-md p-4 rounded-xl border border-slate-200 shadow-lg flex justify-between items-center z-20">
          <button 
            onClick={() => setIsRejecting(true)}
            className="px-6 py-2.5 text-red-600 font-medium hover:bg-red-50 rounded-lg transition-colors"
          >
            Reject All
          </button>

          <div className="flex items-center gap-4">
            <span className="text-slate-600 hidden sm:inline-block">
              {selectedCount} selected
            </span>
            <button
              onClick={() => onSubmit(titles, false, undefined, generalComments)}
              disabled={selectedCount === 0}
              className="px-8 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200"
            >
              Approve Selection ({selectedCount})
            </button>
          </div>
        </div>
      )}

      {/* Read-only notice */}
      {readOnly && (
        <div className="sticky bottom-6 mt-8 bg-slate-100 p-4 rounded-xl border border-slate-200 text-center">
          <p className="text-slate-600">
            <span className="font-medium">Read-only mode</span> — This review has been completed.
          </p>
        </div>
      )}
    </div>
  );
};

export default TitleReview;
