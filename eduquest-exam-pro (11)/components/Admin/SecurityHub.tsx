
import React, { useMemo, useState, useEffect } from 'react';
import { Submission, ProctoringLog } from '../../types';

interface SecurityHubProps {
  submissions: Submission[];
  onUpdate: () => void;
}

interface AlertItem {
  submissionId: string;
  studentName: string;
  reason: string;
  timestamp: number;
  status: 'CRITICAL' | 'WARNING';
}

const STORAGE_KEY_DISMISSED = 'eduquest_dismissed_alerts';

const SecurityHub: React.FC<SecurityHubProps> = ({ submissions }) => {
  // Persistence for dismissed alerts
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_DISMISSED);
    if (!saved) return new Set();
    try {
      return new Set(JSON.parse(saved));
    } catch {
      return new Set();
    }
  });

  // Filtering and Sorting State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING'>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name-asc' | 'name-desc'>('newest');

  // Save dismissal state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DISMISSED, JSON.stringify(Array.from(dismissedAlerts)));
  }, [dismissedAlerts]);

  const stats = useMemo(() => {
    const safeSub = Array.isArray(submissions) ? submissions : [];
    const highRisk = safeSub.filter(s => s.trustScore < 60);
    const criticalViolations = safeSub.reduce((acc, s) => acc + (s.proctoringLogs?.filter(l => l.status === 'CRITICAL').length || 0), 0);
    const warningViolations = safeSub.reduce((acc, s) => acc + (s.proctoringLogs?.filter(l => l.status === 'WARNING').length || 0), 0);
    
    return {
      total: safeSub.length,
      highRiskCount: highRisk.length,
      criticalTotal: criticalViolations,
      warningTotal: warningViolations,
      avgTrust: Math.round(safeSub.reduce((a,b)=>a+b.trustScore, 0) / (safeSub.length || 1))
    };
  }, [submissions]);

  const filteredAlerts = useMemo(() => {
    const alerts: AlertItem[] = [];
    submissions.forEach(sub => {
      const relevantLogs = (sub.proctoringLogs || []).filter(l => 
        (l.status === 'CRITICAL' || l.status === 'WARNING')
      );
      
      if (relevantLogs.length > 0 && !dismissedAlerts.has(sub.id)) {
        relevantLogs.forEach(log => {
          // Status filter
          if (statusFilter !== 'ALL' && log.status !== statusFilter) return;

          // Search filter
          if (searchQuery && !sub.studentName.toLowerCase().includes(searchQuery.toLowerCase())) return;

          // Date filters
          if (startDate && log.timestamp < new Date(startDate).getTime()) return;
          if (endDate && log.timestamp > new Date(endDate).getTime() + 86400000) return; // End of selected day

          alerts.push({
            submissionId: sub.id,
            studentName: sub.studentName,
            reason: log.reason,
            timestamp: log.timestamp,
            status: log.status as 'CRITICAL' | 'WARNING'
          });
        });
      }
    });

    // Handle Sorting
    return alerts.sort((a, b) => {
      switch (sortOrder) {
        case 'newest': return b.timestamp - a.timestamp;
        case 'oldest': return a.timestamp - b.timestamp;
        case 'name-asc': return a.studentName.localeCompare(b.studentName);
        case 'name-desc': return b.studentName.localeCompare(a.studentName);
        default: return 0;
      }
    });
  }, [submissions, dismissedAlerts, searchQuery, statusFilter, startDate, endDate, sortOrder]);

  const dismissAlert = (id: string) => {
    setDismissedAlerts(prev => new Set([...prev, id]));
  };

  const dismissAllVisible = () => {
    const visibleIds = filteredAlerts.map(a => a.submissionId);
    setDismissedAlerts(prev => new Set([...prev, ...visibleIds]));
  };

  return (
    <div className="space-y-12 animate-reveal">
      {/* Security Control Center - Filtering UI */}
      <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl space-y-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
             </div>
             <div>
               <h3 className="text-xl font-black text-slate-900 tracking-tight">Security Intel Filter</h3>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocol Audit & Surveillance Settings</p>
             </div>
          </div>

          <div className="flex flex-wrap gap-3">
             <select 
               value={sortOrder}
               onChange={e => setSortOrder(e.target.value as any)}
               className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:border-indigo-500 transition-all"
             >
               <option value="newest">Newest First</option>
               <option value="oldest">Oldest First</option>
               <option value="name-asc">Name (A-Z)</option>
               <option value="name-desc">Name (Z-A)</option>
             </select>
             <button 
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                  setStartDate('');
                  setEndDate('');
                }}
                className="px-5 py-3 bg-slate-100 text-slate-400 hover:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Reset Engine
              </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Candidate Search</label>
            <input 
              type="text"
              placeholder="Filter by name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:bg-white focus:border-indigo-200 transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Violation Severity</label>
            <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100">
               {['ALL', 'CRITICAL', 'WARNING'].map(status => (
                 <button 
                  key={status}
                  onClick={() => setStatusFilter(status as any)}
                  className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${statusFilter === status ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                 >
                   {status}
                 </button>
               ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Period Start</label>
            <input 
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black outline-none focus:bg-white focus:border-indigo-200 transition-all uppercase"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Period End</label>
            <input 
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black outline-none focus:bg-white focus:border-indigo-200 transition-all uppercase"
            />
          </div>
        </div>
      </div>

      {/* Real-time Critical Alerts Section */}
      <div className="space-y-5 animate-reveal">
        <div className="flex items-center justify-between px-3">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${filteredAlerts.some(a => a.status === 'CRITICAL') ? 'bg-rose-500 animate-pulse' : 'bg-amber-500 animate-pulse'} shadow-xl`}></div>
            <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">Active Security Breach Protocols</h4>
          </div>
          {filteredAlerts.length > 0 && (
            <button 
              /* Corrected typo: changed dismissAllAllVisible to dismissAllVisible */
              onClick={dismissAllVisible}
              className="text-[9px] font-black text-slate-400 hover:text-rose-600 uppercase tracking-widest transition-all flex items-center gap-2 group"
            >
              Archive Visible Logs ({filteredAlerts.length})
              <svg className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 gap-5">
          {filteredAlerts.map((alert, idx) => (
            <div 
              key={`${alert.submissionId}-${idx}`} 
              className={`${alert.status === 'CRITICAL' ? 'bg-rose-600 border-rose-700 shadow-rose-100' : 'bg-amber-500 border-amber-600 shadow-amber-100'} text-white p-7 rounded-[2.5rem] shadow-2xl flex items-center justify-between animate-reveal border-b-4 group relative overflow-hidden`}
            >
              <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:scale-150 transition-transform duration-[2000ms]">
                <svg className="w-64 h-64" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
              </div>
              
              <div className="flex items-center gap-10 relative z-10">
                <div className="w-16 h-16 bg-white/10 backdrop-blur-2xl rounded-3xl flex items-center justify-center border border-white/20 shadow-inner group-hover:bg-white/20 transition-colors">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] mb-1.5">Active Protocol Log</p>
                  <h5 className="font-black text-2xl tracking-tighter leading-none mb-2">{alert.studentName}</h5>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-white">Status: {alert.status}</span>
                    </div>
                    <span className="h-3 w-[1px] bg-white/20"></span>
                    <p className="text-white text-xs font-bold bg-white/10 px-3 py-1 rounded-lg border border-white/10">"{alert.reason}"</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-8 relative z-10">
                <div className="text-right hidden md:block">
                  <p className="text-[9px] font-black text-white/50 uppercase tracking-widest opacity-60 mb-1">Detection Time</p>
                  <p className="text-lg font-black tabular-nums">{new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                  <p className="text-[8px] font-black opacity-30 uppercase tracking-widest">{new Date(alert.timestamp).toLocaleDateString()}</p>
                </div>
                <button 
                  onClick={() => dismissAlert(alert.submissionId)}
                  className="w-14 h-14 bg-white/10 hover:bg-white text-white hover:text-slate-900 rounded-3xl transition-all flex items-center justify-center border border-white/10 hover:shadow-xl active:scale-[0.92]"
                  title="Archive Violation"
                >
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M6 18L18 6M6 6l12 12" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
          {filteredAlerts.length === 0 && (
            <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-[3rem] text-slate-200 font-black uppercase text-[10px] tracking-[0.4em] bg-white">
               No violations match the current engine parameters
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {[
          { label: 'Active Sessions', val: stats.total, color: 'indigo' },
          { label: 'High Risk Alert', val: stats.highRiskCount, color: 'rose' },
          { label: 'Avg Integrity', val: `${stats.avgTrust}%`, color: 'emerald' },
          { label: 'Total Violations', val: stats.criticalTotal + stats.warningTotal, color: 'slate' }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl relative overflow-hidden group hover:-translate-y-1 transition-all">
             <div className={`absolute top-0 right-0 p-10 opacity-5 pointer-events-none text-${stat.color === 'rose' ? 'rose-600' : 'indigo-600'} group-hover:scale-110 transition-transform`}>
               <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z"/></svg>
             </div>
             <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${stat.color === 'rose' ? 'text-rose-600' : 'text-slate-400'} mb-2`}>{stat.label}</p>
             <p className="text-5xl font-black text-slate-900 tracking-tighter">{stat.val}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[4rem] border border-slate-100 shadow-2xl overflow-hidden">
        <div className="p-10 border-b border-slate-50 flex justify-between items-center">
          <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
            Security Audit Logs
          </h3>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Real-time Analysis Engine 4.2</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Candidate</th>
                <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Integrity Pulse</th>
                <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Detection</th>
                <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Flag Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {submissions.map(sub => {
                const logs = sub.proctoringLogs || [];
                const latest = logs[logs.length - 1];
                return (
                  <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-8">
                       <p className="font-black text-slate-800 text-base">{sub.studentName}</p>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{sub.examSubject}</p>
                    </td>
                    <td className="p-8">
                       <div className="w-48 h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                          <div className={`h-full transition-all duration-1000 ${sub.trustScore < 60 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${sub.trustScore}%` }}></div>
                       </div>
                       <p className="text-[9px] font-black text-slate-400 mt-2 uppercase tracking-widest">Trust Rating: {sub.trustScore}%</p>
                    </td>
                    <td className="p-8">
                       {latest ? (
                         <div className="flex flex-col">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${latest.status === 'CRITICAL' ? 'text-rose-600' : 'text-amber-600'}`}>{latest.status}</span>
                            <p className="text-xs font-bold text-slate-500 max-w-[200px] truncate">"{latest.reason}"</p>
                         </div>
                       ) : <span className="text-[10px] font-black text-slate-200 uppercase tracking-widest">No Alerts</span>}
                    </td>
                    <td className="p-8 text-right">
                       <div className={`inline-flex px-6 py-2 rounded-2xl font-black text-[9px] uppercase tracking-widest ${sub.trustScore < 60 ? 'bg-rose-100 text-rose-700' : 'bg-slate-50 text-slate-400'}`}>
                         {sub.trustScore < 60 ? 'High Risk' : 'Protected'}
                       </div>
                    </td>
                  </tr>
                );
              })}
              {submissions.length === 0 && (
                <tr><td colSpan={4} className="p-32 text-center text-slate-200 font-black uppercase tracking-[1em]">No active security traffic</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SecurityHub;
