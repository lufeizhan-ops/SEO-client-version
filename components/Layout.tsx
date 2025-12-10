import React from 'react';
import { Layers } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">T</span>
          </div>
          <span className="text-lg font-bold text-slate-900 tracking-tight">TaxFlow</span>
          <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-md uppercase tracking-wide font-medium">Client Portal</span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500">
            <Layers className="w-4 h-4" />
            <span>Connected as Tax Client Manager</span>
          </div>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-6 overflow-hidden">
        {children}
      </main>
    </div>
  );
};

export default Layout;
