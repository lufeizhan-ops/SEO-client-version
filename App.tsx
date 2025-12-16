import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import TitleReview from './components/TitleReview';
import OutlineReview from './components/OutlineReview';
import ContentReview from './components/ContentReview';
import CampaignReviewDashboard from './components/CampaignReviewDashboard';
import Login from './components/Login';
import { 
  TaskType, 
  ClientTask, 
  TitleOption, 
  Comment,
  OutlineEditSuggestion,
  ContentEditSuggestion,
  ActiveReviewer
} from './types';
import { Loader2, ArrowRight, CheckCircle2, ArrowLeft, AlertCircle, LogOut } from 'lucide-react';
import { 
  getArticlesAwaitingReview, 
  getArticleById,
  submitTitleReview, 
  submitOutlineReview,
  submitContentReview 
} from './services/articleService';
import { 
  isAuthenticated, 
  revalidateAccess, 
  logout, 
  getAuthenticatedEmail 
} from './services/authService';
import {
  saveDraft,
  loadDraft,
  deleteDraft,
  submitEditSuggestions,
  loadEditSuggestions,
  getActiveReviewers
} from './services/draftService';

// View types for the app
type ViewType = 'LOADING' | 'LOGIN' | 'CAMPAIGN_DASHBOARD' | 'ARTICLE_REVIEW' | 'LEGACY_LANDING' | 'SUCCESS' | 'ERROR';

// --- APP COMPONENT ---

const App: React.FC = () => {
  // URL parameters
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [articleId, setArticleId] = useState<string | null>(null);
  
  // View state
  const [view, setView] = useState<ViewType>('LOADING');
  const [currentTask, setCurrentTask] = useState<ClientTask | null>(null);
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Read-only mode for completed articles
  const [isReadOnly, setIsReadOnly] = useState(false);
  
  // Authentication state
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);

  // Draft and edit state
  const [outlineEdits, setOutlineEdits] = useState<OutlineEditSuggestion[]>([]);
  const [contentEdits, setContentEdits] = useState<ContentEditSuggestion[]>([]);
  const [existingComments, setExistingComments] = useState<Comment[]>([]);
  const [activeReviewers, setActiveReviewers] = useState<ActiveReviewer[]>([]);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Parse URL parameters on mount and handle authentication
  useEffect(() => {
    const initializeApp = async () => {
      const params = new URLSearchParams(window.location.search);
      const campId = params.get('campaignId');
      const artId = params.get('articleId');
      
      console.log('🔍 URL Parameters:', { campaignId: campId, articleId: artId });
      
      setCampaignId(campId);
      setArticleId(artId);
      
      // If campaign ID is present, check authentication
      if (campId) {
        // Check if user is already authenticated for this campaign
        const authenticated = isAuthenticated(campId);
        
        if (authenticated) {
          // Revalidate access in background
          const stillValid = await revalidateAccess(campId);
          
          if (!stillValid) {
            // Access no longer valid, show login
            setView('LOGIN');
            setLoading(false);
            return;
          }
          
          // User is authenticated, get their info
          setUserEmail(getAuthenticatedEmail());
          
          // Proceed to load content
          if (artId) {
            loadSingleArticle(artId, campId);
          } else {
            setView('CAMPAIGN_DASHBOARD');
            setLoading(false);
          }
        } else {
          // Not authenticated, show login
          setView('LOGIN');
          setLoading(false);
        }
      } else if (artId) {
        // Legacy: article ID only -> load article for review (backward compatibility)
        // No authentication for legacy direct links
        loadSingleArticle(artId, null);
      } else {
        // No params -> show legacy landing page
        loadArticles();
      }
    };

    initializeApp();
  }, []);

  // Load draft and active reviewers when article is loaded
  useEffect(() => {
    const loadDraftData = async () => {
      if (!currentTask || !userEmail || isReadOnly || draftLoaded) return;
      
      console.log('📥 Loading draft data for article:', currentTask.id);
      
      try {
        // Determine review type
        const reviewType = currentTask.type === TaskType.OUTLINE_REVIEW ? 'outline' 
          : currentTask.type === TaskType.CONTENT_REVIEW ? 'content' 
          : 'title';
        
        // Load existing draft
        const draft = await loadDraft(currentTask.id, userEmail, reviewType);
        
        if (draft) {
          console.log('✅ Draft found:', draft);
          setExistingComments(draft.draftComments);
          
          if (reviewType === 'outline') {
            setOutlineEdits(draft.draftEdits as OutlineEditSuggestion[]);
          } else if (reviewType === 'content') {
            setContentEdits(draft.draftEdits as ContentEditSuggestion[]);
          }
        }
        
        // Load existing edit suggestions from other users
        if (reviewType === 'outline' || reviewType === 'content') {
          const existingEdits = await loadEditSuggestions(currentTask.id, reviewType);
          console.log('📋 Existing edit suggestions:', existingEdits.length);
          
          // Filter out current user's edits (they're in the draft)
          const otherUserEdits = existingEdits.filter(e => e.authorEmail !== userEmail);
          
          if (reviewType === 'outline') {
            setOutlineEdits(prev => [...prev, ...otherUserEdits as OutlineEditSuggestion[]]);
          } else {
            setContentEdits(prev => [...prev, ...otherUserEdits as ContentEditSuggestion[]]);
          }
        }
        
        // Load active reviewers
        const reviewers = await getActiveReviewers(currentTask.id);
        setActiveReviewers(reviewers);
        
        setDraftLoaded(true);
      } catch (err) {
        console.error('Error loading draft data:', err);
      }
    };
    
    loadDraftData();
  }, [currentTask, userEmail, isReadOnly, draftLoaded]);

  // Load a single article by ID
  const loadSingleArticle = async (artId: string, campId: string | null) => {
    console.log('📥 Loading single article:', artId);
    setLoading(true);
    setError(null);
    setDraftLoaded(false);
    setOutlineEdits([]);
    setContentEdits([]);
    setExistingComments([]);
    
    try {
      const article = await getArticleById(artId);
      
      if (!article) {
        setError('Article not found. The link may be invalid or expired.');
        setView('ERROR');
        setLoading(false);
        return;
      }
      
      console.log('✅ Article loaded:', article);
      setCurrentTask(article);
      
      // Check if article is in a completed status (for read-only mode)
      const completedStatuses = ['TITLES_APPROVED', 'NEEDS_OUTLINE', 'OUTLINE_APPROVED', 
                                  'NEEDS_DRAFT', 'DRAFT_APPROVED', 'PUBLISHED'];
      // Note: We determine read-only based on current task status, not on the status itself
      // The task type tells us what was being reviewed
      setIsReadOnly(false); // Can be enhanced later for read-only views
      
      setView('ARTICLE_REVIEW');
    } catch (err: any) {
      console.error('❌ Failed to load article:', err);
      setError('Failed to load article. Please try again.');
      setView('ERROR');
    } finally {
      setLoading(false);
    }
  };

  // Load articles for legacy landing page
  const loadArticles = async () => {
    console.log('📥 loadArticles called');
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Fetching articles from Supabase...');
      const articles = await getArticlesAwaitingReview();
      console.log('✅ Articles loaded:', articles.length);
      setTasks(articles);
      setView('LEGACY_LANDING');
    } catch (err: any) {
      console.error('❌ Failed to load articles:', err);
      setError('Failed to load review tasks. Please try again.');
      setView('ERROR');
    } finally {
      setLoading(false);
    }
  };

  // Handle article selection from Campaign Dashboard
  const handleArticleSelect = (selectedArticleId: string, readOnly: boolean = false) => {
    // Update URL to include articleId and readonly flag
    let newUrl = campaignId 
      ? `${window.location.pathname}?campaignId=${campaignId}&articleId=${selectedArticleId}`
      : `${window.location.pathname}?articleId=${selectedArticleId}`;
    
    if (readOnly) {
      newUrl += '&readonly=true';
    }
    
    window.history.pushState({}, '', newUrl);
    
    setArticleId(selectedArticleId);
    setIsReadOnly(readOnly);
    loadSingleArticle(selectedArticleId, campaignId);
  };

  // Handle task selection from legacy landing
  const handleTaskSelect = (task: ClientTask) => {
    setCurrentTask(task);
    setDraftLoaded(false);
    setOutlineEdits([]);
    setContentEdits([]);
    setExistingComments([]);
    setView('ARTICLE_REVIEW');
  };

  // Navigate back to campaign dashboard
  const handleBackToCampaign = () => {
    if (campaignId) {
      const newUrl = `${window.location.pathname}?campaignId=${campaignId}`;
      window.history.pushState({}, '', newUrl);
      setArticleId(null);
      setCurrentTask(null);
      setDraftLoaded(false);
      setView('CAMPAIGN_DASHBOARD');
    } else {
      // Legacy: go back to landing
      setCurrentTask(null);
      setDraftLoaded(false);
      setView('LEGACY_LANDING');
      loadArticles();
    }
  };

  // Handle successful login
  const handleLoginSuccess = (email: string, contactName?: string, clientCompany?: string) => {
    setUserEmail(email);
    setUserName(contactName || null);
    setClientName(clientCompany || null);
    
    // Load content based on URL params
    if (articleId) {
      loadSingleArticle(articleId, campaignId);
    } else {
      setView('CAMPAIGN_DASHBOARD');
      setLoading(false);
    }
  };

  // Handle logout
  const handleLogout = () => {
    logout();
    setUserEmail(null);
    setUserName(null);
    setClientName(null);
    setView('LOGIN');
  };

  // Handle draft save for outline
  const handleOutlineSaveDraft = async (comments: Comment[], edits: OutlineEditSuggestion[]) => {
    if (!currentTask || !userEmail) return;
    
    console.log('💾 Saving outline draft...');
    const result = await saveDraft(
      currentTask.id,
      userEmail,
      'outline',
      edits,
      comments
    );
    
    if (result.success) {
      console.log('✅ Outline draft saved');
    } else {
      console.error('❌ Failed to save draft:', result.error);
    }
  };

  // Handle draft save for content
  const handleContentSaveDraft = async (comments: Comment[], edits: ContentEditSuggestion[]) => {
    if (!currentTask || !userEmail) return;
    
    console.log('💾 Saving content draft...');
    const result = await saveDraft(
      currentTask.id,
      userEmail,
      'content',
      edits,
      comments
    );
    
    if (result.success) {
      console.log('✅ Content draft saved');
    } else {
      console.error('❌ Failed to save draft:', result.error);
    }
  };

  // Handle title review submission
  const handleSubmit = async (
    titles: TitleOption[],
    rejected: boolean,
    reason?: string,
    generalComments?: string
  ) => {
    console.log('=== handleSubmit called ===');
    if (!currentTask) {
      console.error('No current task!');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await submitTitleReview(
        currentTask.id,
        titles,
        rejected,
        reason,
        generalComments
      );

      if (result.success) {
        // Delete draft after successful submission
        if (userEmail) {
          await deleteDraft(currentTask.id, userEmail, 'title');
        }
        setLoading(false);
        setView('SUCCESS');
      } else {
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
  const handleOutlineSubmit = async (approved: boolean, comments: Comment[], edits: OutlineEditSuggestion[]) => {
    console.log('=== handleOutlineSubmit called ===');
    if (!currentTask) {
      console.error('No current task!');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // First, submit edit suggestions to database
      if (edits.length > 0 && userEmail && userName) {
        const editResult = await submitEditSuggestions(
          currentTask.id,
          userEmail,
          userName,
          edits,
          'outline'
        );
        
        if (!editResult.success) {
          console.error('Failed to submit edits:', editResult.error);
        }
      }

      // Then submit the review
      const result = await submitOutlineReview(
        currentTask.id,
        approved,
        comments.map(c => ({ targetId: c.targetId, text: c.text })),
        ''
      );

      if (result.success) {
        // Delete draft after successful submission
        if (userEmail) {
          await deleteDraft(currentTask.id, userEmail, 'outline');
        }
        setLoading(false);
        setView('SUCCESS');
      } else {
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
  const handleContentSubmit = async (approved: boolean, comments: Comment[], edits: ContentEditSuggestion[]) => {
    console.log('=== handleContentSubmit called ===');
    if (!currentTask) {
      console.error('No current task!');
      return;
    }

    if (approved) {
      exportContentAsMarkdown();
    }

    setLoading(true);
    setError(null);

    try {
      // First, submit edit suggestions to database
      if (edits.length > 0 && userEmail && userName) {
        const editResult = await submitEditSuggestions(
          currentTask.id,
          userEmail,
          userName,
          edits,
          'content'
        );
        
        if (!editResult.success) {
          console.error('Failed to submit edits:', editResult.error);
        }
      }

      // Then submit the review
      const result = await submitContentReview(
        currentTask.id,
        approved,
        comments.map(c => ({ targetId: c.targetId, text: c.text })),
        ''
      );

      if (result.success) {
        // Delete draft after successful submission
        if (userEmail) {
          await deleteDraft(currentTask.id, userEmail, 'content');
        }
        setLoading(false);
        setView('SUCCESS');
      } else {
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

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentTask.projectName.replace(/\s+/g, '_')}_approved.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ============================================
  // RENDER LOGIC
  // ============================================

  // Loading state
  if (view === 'LOADING' || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium animate-pulse">Loading...</p>
      </div>
    );
  }

  // Error state
  if (view === 'ERROR') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Error</h2>
          <p className="text-slate-500 mb-6">{error || 'Something went wrong.'}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Login view
  if (view === 'LOGIN' && campaignId) {
    return (
      <Login 
        campaignId={campaignId}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  // Success state
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
          onClick={handleBackToCampaign}
          className="px-6 py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors"
        >
          {campaignId ? 'Back to Campaign' : 'Return to Dashboard'}
        </button>
      </div>
    );
  }

  // Campaign Dashboard view
  if (view === 'CAMPAIGN_DASHBOARD' && campaignId) {
    return (
      <div className="min-h-screen bg-slate-50">
        {/* User info header */}
        {userEmail && (
          <div className="bg-white border-b border-slate-200 px-4 py-2">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold">
                  {userName ? userName.charAt(0).toUpperCase() : userEmail.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="text-sm font-medium text-slate-700">
                    {userName || userEmail}
                  </span>
                  {clientName && (
                    <span className="text-xs text-slate-500 block">{clientName}</span>
                  )}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600 transition"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        )}
        <CampaignReviewDashboard 
          campaignId={campaignId}
          onSelectArticle={handleArticleSelect}
        />
      </div>
    );
  }

  // Article Review view
  if (view === 'ARTICLE_REVIEW' && currentTask) {
    return (
      <Layout>
        {/* Top bar with back button and user info */}
        <div className="flex items-center justify-between mb-4">
          {/* Back button for campaign context */}
          {campaignId && (
            <button
              onClick={handleBackToCampaign}
              className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition font-medium"
            >
              <ArrowLeft size={18} />
              Back to Campaign
            </button>
          )}
          
          {/* User info & logout */}
          {userEmail && (
            <div className="flex items-center gap-3 ml-auto">
              <span className="text-sm text-slate-500">{userName || userEmail}</span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-red-600 transition"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        {currentTask.type === TaskType.TITLE_REVIEW && (
          <TitleReview 
            data={currentTask.titles!} 
            projectName={currentTask.projectName}
            keywords={currentTask.keywords || []}
            strategyGoal={currentTask.strategyGoal || ''}
            targetAudience={currentTask.targetAudience || ''}
            onSubmit={handleSubmit}
            readOnly={isReadOnly}
          />
        )}
        
        {currentTask.type === TaskType.OUTLINE_REVIEW && (
          <OutlineReview 
            data={currentTask.outline || []}
            projectName={currentTask.projectName}
            existingComments={existingComments}
            existingEdits={outlineEdits}
            activeReviewers={activeReviewers}
            contactName={userName || userEmail || 'Client'}
            contactEmail={userEmail || ''}
            onSubmit={handleOutlineSubmit}
            onSaveDraft={handleOutlineSaveDraft}
            readOnly={isReadOnly}
          />
        )}

        {currentTask.type === TaskType.CONTENT_REVIEW && (
          <ContentReview 
            data={currentTask.content || []}
            projectName={currentTask.projectName}
            existingComments={existingComments}
            existingEdits={contentEdits}
            activeReviewers={activeReviewers}
            contactName={userName || userEmail || 'Client'}
            contactEmail={userEmail || ''}
            onSubmit={handleContentSubmit}
            onSaveDraft={handleContentSaveDraft}
            readOnly={isReadOnly}
          />
        )}
      </Layout>
    );
  }

  // Legacy Landing view - Show articles awaiting review
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
