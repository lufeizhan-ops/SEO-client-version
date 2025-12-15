import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import TitleReview from './components/TitleReview';
import OutlineReview from './components/OutlineReview';
import ContentReview from './components/ContentReview';
import { TaskType, ClientTask, TitleOption, Comment } from './types';
import { Loader2, ArrowRight, CheckCircle2, Download } from 'lucide-react';
import { 
  getArticlesAwaitingReview, 
  submitTitleReview, 
  submitOutlineReview,
  submitContentReview 
} from './services/articleService';

// --- APP COMPONENT ---

const App: React.FC = () => {
  const [view, setView] = useState<'LANDING' | 'TASK' | 'SUCCESS'>('LANDING');
  const [currentTask, setCurrentTask] = useState<ClientTask | null>(null);
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load articles awaiting title review from Supabase
  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Query all types of review (titles, outline, content)
      const articles = await getArticlesAwaitingReview();
      setTasks(articles);
      
      if (articles.length === 0) {
        console.log('No articles awaiting review');
      }
    } catch (err: any) {
      console.error('Failed to load articles:', err);
      setError('Failed to load review tasks. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTaskSelect = (task: ClientTask) => {
    setCurrentTask(task);
    setView('TASK');
  };

  const handleSubmit = async (
    titles: TitleOption[],
    rejected: boolean,
    reason?: string,
    generalComments?: string
  ) => {
    console.log('=== handleSubmit called ===');
    console.log('currentTask:', currentTask);
    console.log('titles:', titles);
    console.log('rejected:', rejected);
    console.log('generalComments:', generalComments);

    if (!currentTask) {
      console.error('No current task!');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      console.log('Calling submitTitleReview...');
      const result = await submitTitleReview(
        currentTask.id,
        titles,
        rejected,
        reason,
        generalComments
      );

      console.log('submitTitleReview result:', result);

      if (result.success) {
        console.log('Success! Switching to SUCCESS view');
        setLoading(false);
        setView('SUCCESS');
      } else {
        console.error('Submit failed:', result.error);
        setError(`Failed to submit review: ${result.error}`);
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Error submitting review:', err);
      setError('Failed to submit review. Please try again.');
      setLoading(false);
    }
  };

  // Handle outline review submission
  const handleOutlineSubmit = async (approved: boolean, comments: Comment[]) => {
    console.log('=== handleOutlineSubmit called ===');
    console.log('currentTask:', currentTask);
    console.log('approved:', approved);
    console.log('comments:', comments);

    if (!currentTask) {
      console.error('No current task!');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Calling submitOutlineReview...');
      const result = await submitOutlineReview(
        currentTask.id,
        approved,
        comments.map(c => ({ targetId: c.targetId, text: c.text })),
        '' // general comments
      );

      console.log('submitOutlineReview result:', result);

      if (result.success) {
        console.log('Success! Switching to SUCCESS view');
        setLoading(false);
        setView('SUCCESS');
        // Reload articles to update the list
        await loadArticles();
      } else {
        console.error('Submit failed:', result.error);
        setError(`Failed to submit review: ${result.error}`);
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Error submitting outline review:', err);
      setError('Failed to submit review. Please try again.');
      setLoading(false);
    }
  };

  // Handle content review submission
  const handleContentSubmit = async (approved: boolean, comments: Comment[]) => {
    console.log('=== handleContentSubmit called ===');
    console.log('currentTask:', currentTask);
    console.log('approved:', approved);
    console.log('comments:', comments);

    if (!currentTask) {
      console.error('No current task!');
      return;
    }

    // If approved, export as Markdown first
    if (approved) {
      exportContentAsMarkdown();
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Calling submitContentReview...');
      const result = await submitContentReview(
        currentTask.id,
        approved,
        comments.map(c => ({ targetId: c.targetId, text: c.text })),
        '' // general comments
      );

      console.log('submitContentReview result:', result);

      if (result.success) {
        console.log('Success! Switching to SUCCESS view');
        setLoading(false);
        setView('SUCCESS');
        // Reload articles to update the list
        await loadArticles();
      } else {
        console.error('Submit failed:', result.error);
        setError(`Failed to submit review: ${result.error}`);
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Error submitting content review:', err);
      setError('Failed to submit review. Please try again.');
      setLoading(false);
    }
  };

  // Export content as Markdown file
  const exportContentAsMarkdown = () => {
    if (!currentTask || !currentTask.content) return;

    // Convert ContentBlock[] back to Markdown
    let markdown = '';
    currentTask.content.forEach(block => {
      if (block.type === 'header') {
        markdown += `# ${block.content}\n\n`;
      } else if (block.type === 'paragraph') {
        markdown += `${block.content}\n\n`;
      } else if (block.type === 'quote') {
        markdown += `> ${block.content}\n\n`;
      } else if (block.type === 'image') {
        markdown += `![${block.content}](${block.content})\n\n`;
      }
    });

    // Create a blob and download
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentTask.projectName.replace(/\s+/g, '_')}_approved.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('Content exported as Markdown');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium animate-pulse">Loading review tasks...</p>
      </div>
    );
  }

  // Error state
  if (error && tasks.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-2xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Connection Error</h1>
          <p className="text-slate-600 mb-6">{error}</p>
          <button 
            onClick={loadArticles}
            className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // View: Success
  if (view === 'SUCCESS') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Feedback Received!</h1>
        <p className="text-slate-600 max-w-md mb-8">
          Your feedback has been securely synchronized with the Agency team. We will notify you when the next stage is ready.
        </p>
        <button 
          onClick={() => { 
            setView('LANDING'); 
            setCurrentTask(null);
          }}
          className="px-6 py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // View: Specific Task Logic (Title Review, Outline Review, Content Review)
  if (view === 'TASK' && currentTask) {
    return (
      <Layout>
        {currentTask.type === TaskType.TITLE_REVIEW && (
          <TitleReview 
            data={currentTask.titles!} 
            projectName={currentTask.projectName}
            keywords={currentTask.keywords || []}
            strategyGoal={currentTask.strategyGoal || ''}
            targetAudience={currentTask.targetAudience || ''}
            onSubmit={handleSubmit} 
          />
        )}
        
        {currentTask.type === TaskType.OUTLINE_REVIEW && (
          <OutlineReview 
            data={currentTask.outline || []}
            projectName={currentTask.projectName}
            onSubmit={handleOutlineSubmit}
          />
        )}

        {currentTask.type === TaskType.CONTENT_REVIEW && (
          <ContentReview 
            data={currentTask.content || []}
            projectName={currentTask.projectName}
            onSubmit={handleContentSubmit}
          />
        )}
      </Layout>
    );
  }

  // View: Landing - Show articles awaiting title review
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-md mx-auto pt-20 px-6">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 text-white font-bold text-xl mb-4 shadow-lg shadow-indigo-200">
            T
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome, Client</h1>
          <p className="text-slate-500 mt-2">
            You have <span className="font-bold text-indigo-600">{tasks.length} pending {tasks.length === 1 ? 'item' : 'items'}</span> for review.
          </p>
        </div>

        {tasks.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-slate-200 text-center">
            <p className="text-slate-600">No articles awaiting review at this time.</p>
            <button 
              onClick={loadArticles}
              className="mt-4 px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              Refresh
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div 
                key={task.id}
                onClick={() => handleTaskSelect(task)}
                className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    task.type === TaskType.TITLE_REVIEW 
                      ? 'bg-blue-50 text-blue-700' 
                      : task.type === TaskType.OUTLINE_REVIEW
                      ? 'bg-purple-50 text-purple-700'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    {task.type === TaskType.TITLE_REVIEW 
                      ? 'TITLE REVIEW' 
                      : task.type === TaskType.OUTLINE_REVIEW
                      ? 'OUTLINE REVIEW'
                      : 'CONTENT REVIEW'}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">{task.dueDate}</span>
                </div>
                <h3 className="text-lg font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
                  {task.projectName}
                </h3>
                <div className="mt-4 flex items-center text-sm text-indigo-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-[-10px] group-hover:translate-x-0 duration-200">
                  Start Review <ArrowRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            ))}
          </div>
        )}
        
        <p className="text-center text-xs text-slate-400 mt-12">
          Secure review portal • Real-time sync
        </p>
      </div>
    </div>
  );
};

export default App;
