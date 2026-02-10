
import React from 'react';
import { Submission, Exam } from '../../types';
import { CheckIcon } from '../Icons';

interface ResultsPortalProps {
  submission: Submission;
  exam?: Exam;
  onClose: () => void;
}

const ResultsPortal: React.FC<ResultsPortalProps> = ({ submission, exam, onClose }) => {
  // Fixed TypeScript error by adding explicit types to reduce callback parameters
  const totalDescMarks = Object.values(submission.descriptiveScores).reduce((a: number, b: number) => a + b, 0);
  const totalScore = submission.mcqScore + totalDescMarks;
  const maxMarks = (exam?.mcqQuestions.length || 0) * 1 + (exam?.descriptiveQuestions.length || 0) * 5; // Estimating structure

  return (
    <div className="min-h-screen bg-slate-50 py-16 px-6 animate-reveal">
      <div className="max-w-5xl mx-auto space-y-12 pb-24">
        <header className="flex justify-between items-center bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-xl">
           <div className="flex items-center gap-8">
              <div className="w-16 h-16 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white text-3xl font-black shadow-2xl shadow-indigo-100">R</div>
              <div>
                 <p className="text-[11px] font-black text-indigo-500 uppercase tracking-widest mb-1">Module Performance Report</p>
                 <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase leading-none">{submission.examSubject}</h1>
              </div>
           </div>
           <button onClick={onClose} className="bg-slate-100 hover:bg-slate-200 px-10 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all">Exit Report</button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           <div className="md:col-span-2 bg-indigo-600 p-12 rounded-[4rem] text-white shadow-2xl shadow-indigo-200 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-110 transition-transform duration-1000">
                <svg className="w-64 h-64" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z"/></svg>
              </div>
              <div className="relative z-10">
                 <h2 className="text-5xl font-black mb-1 tracking-tighter">Level Achieved</h2>
                 <p className="text-indigo-200 font-bold mb-12 text-lg">Overall competency rating calculated.</p>
                 <div className="flex items-end gap-10">
                    <div className="space-y-1">
                       <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 opacity-60">Aggregate Score</p>
                       <p className="text-7xl font-black tracking-tighter">{totalScore} <span className="text-3xl opacity-40">/ PT</span></p>
                    </div>
                    <div className="h-16 w-[1px] bg-white/20"></div>
                    <div className="space-y-1">
                       <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 opacity-60">Result Status</p>
                       <p className="text-4xl font-black tracking-tight">{totalScore > 35 ? 'PASS' : 'FAIL'}</p>
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-xl flex flex-col justify-between">
              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-8">Performance Mix</p>
                <div className="space-y-10">
                   <div className="space-y-3">
                      <div className="flex justify-between items-end">
                         <span className="text-[10px] font-black text-slate-700 uppercase">Part A (Objective)</span>
                         <span className="text-xs font-black text-indigo-600">{submission.mcqScore}pt</span>
                      </div>
                      <div className="h-2 bg-slate-50 rounded-full border border-slate-100"><div className="h-full bg-indigo-500 rounded-full" style={{ width: '80%' }}></div></div>
                   </div>
                   <div className="space-y-3">
                      <div className="flex justify-between items-end">
                         <span className="text-[10px] font-black text-slate-700 uppercase">Part B (Subjective)</span>
                         <span className="text-xs font-black text-indigo-600">{totalDescMarks}pt</span>
                      </div>
                      <div className="h-2 bg-slate-50 rounded-full border border-slate-100"><div className="h-full bg-indigo-500 rounded-full" style={{ width: '65%' }}></div></div>
                   </div>
                </div>
              </div>
              <div className="pt-10 border-t border-slate-50 mt-10">
                 <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Integrity Rating: {submission.trustScore}%</p>
              </div>
           </div>
        </div>

        <div className="space-y-8">
           <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-4">
             <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
             Descriptive Feedback Analysis
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {exam?.descriptiveQuestions.map((q, i) => (
                <div key={q.id} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl">
                   <div className="flex justify-between items-start mb-6">
                      <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">Item #{i+1}</span>
                      <span className="text-lg font-black text-slate-900 leading-none">{submission.descriptiveScores[q.id] || 0} <span className="text-[10px] text-slate-300">/ {q.maxMarks}</span></span>
                   </div>
                   <h4 className="text-sm font-black text-slate-800 mb-6 leading-snug line-clamp-2">{q.text}</h4>
                   <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100">
                      <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2">Evaluator Comments</p>
                      <p className="text-xs font-bold text-indigo-900 leading-relaxed italic">"{submission.aiFeedback?.[q.id] || "Consistent performance displayed in this segment."}"</p>
                   </div>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsPortal;
