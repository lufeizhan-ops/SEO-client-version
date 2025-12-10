import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import TitleReview from './components/TitleReview';
import OutlineReview from './components/OutlineReview';
import ContentReview from './components/ContentReview';
import { TaskType, TaskStatus, ClientTask, TitleOption, OutlineSection, ContentBlock } from './types';
import { Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';

// --- MOCK DATA ---
const MOCK_TITLES: TitleOption[] = [
  {
    id: 't1',
    text: 'Small Business Tax Strategies: Maximize Deductions Before Year-End',
    keywords: ['Tax deductions', 'Year-end planning', 'Small business tips'],
    strategyGoal: 'Drive urgent consultation bookings for Q4.',
    isSelected: true
  },
  {
    id: 't2',
    text: 'The Essential Guide to 2024 Tax Changes for Entrepreneurs',
    keywords: ['2024 tax changes', 'Entrepreneur tax guide'],
    strategyGoal: 'Establish authority on upcoming legislation.',
    isSelected: false
  },
  {
    id: 't3',
    text: 'Unlock Hidden Savings: Proactive Tax Planning for Your Business',
    keywords: ['Tax planning', 'Business savings'],
    strategyGoal: 'Promote long-term advisory retainers.',
    isSelected: true
  }
];

const MOCK_OUTLINE: OutlineSection[] = [
  { id: 'h1', level: 'H1', title: 'Small Business Tax Strategies: Maximize Deductions', wordCountEstimate: 50 },
  { id: 'h2-1', level: 'H2', title: '1. Filing Status and Key Deadlines', description: 'Overview of critical dates to create urgency.', wordCountEstimate: 150 },
  { id: 'h3-1', level: 'H3', title: '1.1. Understanding Your Entity Type', wordCountEstimate: 100 },
  { id: 'h2-2', level: 'H2', title: '2. Major Tax Code Changes for 2024', description: 'Highlighting Section 179 updates.', wordCountEstimate: 200 },
  { id: 'h3-2', level: 'H3', title: 'The Standard Deduction Increase', wordCountEstimate: 80 },
  { id: 'h2-3', level: 'H2', title: '3. Maximizing Deductions and Credits', wordCountEstimate: 250 },
];

const MOCK_CONTENT: ContentBlock[] = [
  { id: 'b1', type: 'header', content: 'Crypto Regulation Push 2024' },
  { id: 'b2', type: 'paragraph', content: 'As global markets continue to evolve, the regulatory landscape for cryptocurrency is undergoing significant transformation. Startups in the fintech sector must navigate these changes carefully to ensure compliance and maintain operational integrity.' },
  { id: 'b3', type: 'quote', content: 'Establish authority in crypto compliance for startups by leveraging automated tax reporting tools.' },
  { id: 'b4', type: 'paragraph', content: 'The Securities and Exchange Commission (SEC) has signaled a shift towards stricter enforcement actions, focusing on unregistered securities offerings. This pivotal moment requires a proactive approach to legal strategy.' },
  { id: 'b5', type: 'header', content: 'The Impact on DeFi Protocols' },
  { id: 'b6', type: 'paragraph', content: 'Decentralized Finance (DeFi) protocols are not immune to scrutiny. The question of whether governance tokens constitute securities remains a heated debate within legal circles. ' },
];

const TASKS: ClientTask[] = [
  {
    id: 'task-1',
    type: TaskType.TITLE_REVIEW,
    projectName: 'Q3 Tax Planning Guide',
    dueDate: 'Due Today',
    status: TaskStatus.PENDING,
    titles: MOCK_TITLES
  },
  {
    id: 'task-2',
    type: TaskType.OUTLINE_REVIEW,
    projectName: '2024 Tax Compliance Guide',
    dueDate: 'Due Tomorrow',
    status: TaskStatus.PENDING,
    outline: MOCK_OUTLINE
  },
  {
    id: 'task-3',
    type: TaskType.CONTENT_REVIEW,
    projectName: 'Crypto Regulation Article',
    dueDate: 'Due in 2 days',
    status: TaskStatus.PENDING,
    content: MOCK_CONTENT
  }
];

// --- APP COMPONENT ---

const App: React.FC = () => {
  const [view, setView] = useState<'LANDING' | 'TASK' | 'SUCCESS'>('LANDING');
  const [currentTask, setCurrentTask] = useState<ClientTask | null>(null);
  const [loading, setLoading] = useState(false);

  // Simulate Magic Link Validation
  useEffect(() => {
    // In a real app, we'd check URL params here
    setTimeout(() => {
      // Auto-load landing after "validating token"
      setLoading(false); 
    }, 800);
  }, []);

  const handleTaskSelect = (task: ClientTask) => {
    setLoading(true);
    setTimeout(() => {
      setCurrentTask(task);
      setView('TASK');
      setLoading(false);
    }, 600);
  };

  const handleSubmit = (success: boolean) => {
    setLoading(true);
    // Simulate API Sync
    setTimeout(() => {
      setLoading(false);
      setView('SUCCESS');
    }, 1500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium animate-pulse">Synchronizing secure workspace...</p>
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
          Your feedback has been securely synchronized with the TaxFlow Agency team. We will notify you when the next stage is ready.
        </p>
        <button 
          onClick={() => { setView('LANDING'); setCurrentTask(null); }}
          className="px-6 py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // View: Specific Task Logic
  if (view === 'TASK' && currentTask) {
    return (
      <Layout>
        {currentTask.type === TaskType.TITLE_REVIEW && (
          <TitleReview 
            data={currentTask.titles!} 
            projectName={currentTask.projectName}
            onSubmit={(titles, rejected, reason) => {
              console.log('Submitted Titles:', titles, rejected, reason);
              handleSubmit(true);
            }} 
          />
        )}
        {currentTask.type === TaskType.OUTLINE_REVIEW && (
          <OutlineReview 
            data={currentTask.outline!}
            projectName={currentTask.projectName}
            onSubmit={(approved, comments) => {
              console.log('Submitted Outline:', approved, comments);
              handleSubmit(true);
            }}
          />
        )}
        {currentTask.type === TaskType.CONTENT_REVIEW && (
          <ContentReview
            data={currentTask.content!}
            projectName={currentTask.projectName}
            onSubmit={(approved, comments) => {
               console.log('Submitted Content:', approved, comments);
               handleSubmit(true);
            }}
          />
        )}
      </Layout>
    );
  }

  // View: Landing (Magic Link Destination)
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-md mx-auto pt-20 px-6">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 text-white font-bold text-xl mb-4 shadow-lg shadow-indigo-200">
            T
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome, John</h1>
          <p className="text-slate-500 mt-2">You have <span className="font-bold text-indigo-600">3 pending items</span> for review.</p>
        </div>

        <div className="space-y-4">
          {TASKS.map((task) => (
            <div 
              key={task.id}
              onClick={() => handleTaskSelect(task)}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  task.type === TaskType.TITLE_REVIEW ? 'bg-blue-50 text-blue-700' :
                  task.type === TaskType.OUTLINE_REVIEW ? 'bg-purple-50 text-purple-700' :
                  'bg-emerald-50 text-emerald-700'
                }`}>
                  {task.type.replace('_', ' ')}
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
        
        <p className="text-center text-xs text-slate-400 mt-12">
          Secure link expires in 24 hours.
        </p>
      </div>
    </div>
  );
};

export default App;
