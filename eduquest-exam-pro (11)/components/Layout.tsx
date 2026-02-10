
import React from 'react';
import { LogoutIcon } from './Icons';

interface LayoutProps {
  children: React.ReactNode;
  user: { name: string; role: string } | null;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  return (
    <div className="min-h-screen flex flex-col bg-[#fcfdfe]">
      {user && (
        <nav className="bg-white/80 backdrop-blur-xl border-b border-slate-100 px-8 py-5 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-600 w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0z"></path></svg>
              </div>
              <div className="hidden sm:block">
                <span className="font-extrabold text-xl text-slate-900 tracking-tight block leading-none">EduQuest</span>
                <span className="text-indigo-500 text-[9px] font-black uppercase tracking-[0.2em] block mt-1">Global Exam Network</span>
              </div>
            </div>
            
            <div className="flex items-center gap-8">
              <div className="hidden md:flex flex-col items-end">
                <p className="text-sm font-black text-slate-800 leading-none">{user.name}</p>
                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1.5">{user.role}</p>
              </div>
              <div className="h-10 w-[1px] bg-slate-100 hidden md:block"></div>
              <button 
                onClick={onLogout}
                className="group flex items-center gap-3 bg-slate-50 hover:bg-rose-50 px-5 py-2.5 rounded-2xl border border-slate-200 transition-all"
              >
                <span className="text-[10px] font-black text-slate-500 group-hover:text-rose-600 transition-colors uppercase tracking-widest">Sign Out</span>
                <LogoutIcon className="w-5 h-5 text-slate-400 group-hover:text-rose-600 transition-colors" />
              </button>
            </div>
          </div>
        </nav>
      )}
      <main className="flex-1 w-full">
        {children}
      </main>
      <footer className="py-12 text-center border-t mt-12">
        <div className="flex justify-center gap-12 mb-6">
           <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
           <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
           <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
        </div>
        <p className="text-slate-300 font-bold text-[10px] uppercase tracking-[0.5em]">
          &copy; {new Date().getFullYear()} EduQuest Systems • Unified Examination Protocol
        </p>
      </footer>
    </div>
  );
};

export default Layout;
