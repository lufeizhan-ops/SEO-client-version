import React, { useState } from 'react';
import { Check, Edit2, Info, Sparkles, XCircle } from 'lucide-react';
import { TitleOption } from '../types';
import { suggestAlternativeTitles } from '../services/geminiService';

interface TitleReviewProps {
  data: TitleOption[];
  projectName: string;
  onSubmit: (titles: TitleOption[], rejected: boolean, rejectReason?: string) => void;
}

const TitleReview: React.FC<TitleReviewProps> = ({ data, projectName, onSubmit }) => {
  const [titles, setTitles] = useState<TitleOption[]>(data);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
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
    const alternatives = await suggestAlternativeTitles(title.text, title.keywords);
    setIsGenerating(false);

    if (alternatives.length > 0) {
      const newText = alternatives[0]; // Just take the first for simplicity in this UI
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
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-8">
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
            onClick={() => onSubmit(titles, true, rejectReason)}
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
    <div className="max-w-5xl mx-auto">
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

      <div className="grid gap-6 mb-8">
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

                <div className="flex flex-wrap gap-2 mb-4">
                  {title.keywords.map((kw, idx) => (
                    <span key={idx} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md">
                      #{kw}
                    </span>
                  ))}
                </div>

                <div className="flex items-start gap-2 text-sm text-slate-500 bg-slate-50 p-3 rounded-lg">
                  <Info className="w-4 h-4 mt-0.5 text-slate-400" />
                  <p>Strategy: {title.strategyGoal}</p>
                </div>

                <div className="mt-4">
                  <input
                    type="text"
                    placeholder="Add specific feedback or notes..."
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

      <div className="sticky bottom-6 bg-white/90 backdrop-blur-md p-4 rounded-xl border border-slate-200 shadow-lg flex justify-between items-center z-10">
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
            onClick={() => onSubmit(titles, false)}
            disabled={selectedCount === 0}
            className="px-8 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200"
          >
            Approve Selection ({selectedCount})
          </button>
        </div>
      </div>
    </div>
  );
};

export default TitleReview;
