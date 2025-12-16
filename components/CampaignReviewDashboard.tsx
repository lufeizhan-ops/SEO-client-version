import React, { useState, useEffect } from 'react';
import { 
  getCampaignInfo, 
  getCampaignPendingArticles, 
  getCampaignCompletedArticles,
  CampaignInfo 
} from '../services/campaignService';
import { ClientTask, TaskType, TaskStatus } from '../types';
import { 
  FileText, 
  FileEdit, 
  FileCheck, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  ChevronRight,
  Target,
  User,
  MessageSquare
} from 'lucide-react';

interface CampaignReviewDashboardProps {
  campaignId: string;
  onSelectArticle: (articleId: string, readOnly?: boolean) => void;
}

const CampaignReviewDashboard: React.FC<CampaignReviewDashboardProps> = ({ 
  campaignId, 
  onSelectArticle 
}) => {
  const [campaignInfo, setCampaignInfo] = useState<CampaignInfo | null>(null);
  const [pendingArticles, setPendingArticles] = useState<ClientTask[]>([]);
  const [completedArticles, setCompletedArticles] = useState<ClientTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    loadData();
  }, [campaignId]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch campaign info and articles in parallel
      const [info, pending, completed] = await Promise.all([
        getCampaignInfo(campaignId),
        getCampaignPendingArticles(campaignId),
        getCampaignCompletedArticles(campaignId)
      ]);

      if (!info) {
        setError('Campaign not found. The link may be invalid or expired.');
        setIsLoading(false);
        return;
      }

      setCampaignInfo(info);
      setPendingArticles(pending);
      setCompletedArticles(completed);
    } catch (err) {
      console.error('Error loading campaign data:', err);
      setError('Failed to load campaign data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Group pending articles by type
  const titleReviews = pendingArticles.filter(a => a.type === TaskType.TITLE_REVIEW);
  const outlineReviews = pendingArticles.filter(a => a.type === TaskType.OUTLINE_REVIEW);
  const contentReviews = pendingArticles.filter(a => a.type === TaskType.CONTENT_REVIEW);

  const getTaskTypeIcon = (type: TaskType) => {
    switch (type) {
      case TaskType.TITLE_REVIEW:
        return <FileText size={18} />;
      case TaskType.OUTLINE_REVIEW:
        return <FileEdit size={18} />;
      case TaskType.CONTENT_REVIEW:
        return <FileCheck size={18} />;
    }
  };

  const getTaskTypeLabel = (type: TaskType) => {
    switch (type) {
      case TaskType.TITLE_REVIEW:
        return 'Title Review';
      case TaskType.OUTLINE_REVIEW:
        return 'Outline Review';
      case TaskType.CONTENT_REVIEW:
        return 'Content Review';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading campaign...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !campaignInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Campaign Not Found</h2>
          <p className="text-slate-500 mb-6">{error || 'The campaign you are looking for does not exist.'}</p>
          <button
            onClick={loadData}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Check if article is in revision state
  const isRevisionState = (article: ClientTask) => {
    return article.status === TaskStatus.CHANGES_REQUESTED;
  };

  // Render article list item
  const renderArticleItem = (article: ClientTask, isCompleted: boolean = false) => {
    const inRevision = isRevisionState(article);
    
    return (
      <div
        key={article.id}
        onClick={() => onSelectArticle(article.id, isCompleted)}
        className={`group flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
          inRevision
            ? 'bg-amber-50 border-amber-200 hover:border-amber-300 hover:bg-amber-100'
            : isCompleted
              ? 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
              : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md'
        }`}
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className={`p-2 rounded-lg ${
            inRevision 
              ? 'bg-amber-100 text-amber-600' 
              : isCompleted 
                ? 'bg-green-100 text-green-600' 
                : 'bg-indigo-100 text-indigo-600'
          }`}>
            {inRevision ? <MessageSquare size={18} /> : getTaskTypeIcon(article.type)}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className={`font-medium truncate ${
              inRevision ? 'text-amber-900' : isCompleted ? 'text-slate-500' : 'text-slate-900'
            }`}>
              {article.projectName}
            </h4>
            <div className="flex items-center gap-2 text-sm text-slate-400 mt-0.5">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                inRevision
                  ? 'bg-amber-200 text-amber-800'
                  : isCompleted 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-amber-100 text-amber-700'
              }`}>
                {inRevision ? 'Revision Requested' : getTaskTypeLabel(article.type)}
              </span>
              <span>•</span>
              <Clock size={12} />
              <span>{formatDate(article.dueDate)}</span>
            </div>
          </div>
        </div>

        {!isCompleted ? (
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg group-hover:bg-indigo-700 transition">
              Review
            </span>
            <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-600 transition" />
          </div>
        ) : inRevision ? (
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 bg-amber-500 text-white text-sm font-medium rounded-lg group-hover:bg-amber-600 transition">
              In Revision
            </span>
            <ChevronRight size={18} className="text-amber-300 group-hover:text-amber-600 transition" />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 bg-slate-200 text-slate-600 text-sm font-medium rounded-lg group-hover:bg-slate-300 transition">
              View
            </span>
            <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500 transition" />
          </div>
        )}
      </div>
    );
  };

  // Render article section
  const renderArticleSection = (
    title: string, 
    articles: ClientTask[], 
    icon: React.ReactNode,
    colorClass: string
  ) => {
    if (articles.length === 0) return null;

    return (
      <div className="mb-6">
        <div className={`flex items-center gap-2 mb-3 ${colorClass}`}>
          {icon}
          <h3 className="font-semibold text-sm uppercase tracking-wide">
            {title} ({articles.length})
          </h3>
        </div>
        <div className="space-y-3">
          {articles.map(article => renderArticleItem(article))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">
                {campaignInfo.name}
              </h1>
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <div className="flex items-center gap-1.5">
                  <User size={14} />
                  <span>{campaignInfo.clientName}</span>
                </div>
                {campaignInfo.strategyGoals && (
                  <div className="flex items-center gap-1.5">
                    <Target size={14} />
                    <span className="truncate max-w-xs">{campaignInfo.strategyGoals}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-full font-medium">
                {pendingArticles.length} Pending
              </span>
              <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-full font-medium">
                {completedArticles.length} Completed
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Pending Reviews Section */}
        {pendingArticles.length > 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                <Clock size={16} className="text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                Pending Reviews ({pendingArticles.length})
              </h2>
            </div>

            {renderArticleSection(
              'Title Review',
              titleReviews,
              <FileText size={16} />,
              'text-blue-600'
            )}

            {renderArticleSection(
              'Outline Review',
              outlineReviews,
              <FileEdit size={16} />,
              'text-purple-600'
            )}

            {renderArticleSection(
              'Content Review',
              contentReviews,
              <FileCheck size={16} />,
              'text-green-600'
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">All Caught Up!</h3>
            <p className="text-slate-500">No pending reviews at this time.</p>
          </div>
        )}

        {/* Completed Section */}
        {completedArticles.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle size={16} className="text-green-600" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  Completed ({completedArticles.length})
                </h2>
              </div>
              <ChevronRight 
                size={20} 
                className={`text-slate-400 transition-transform ${showCompleted ? 'rotate-90' : ''}`} 
              />
            </button>

            {showCompleted && (
              <div className="px-6 pb-6 border-t border-slate-100">
                <div className="space-y-3 mt-4">
                  {completedArticles.map(article => renderArticleItem(article, true))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignReviewDashboard;

