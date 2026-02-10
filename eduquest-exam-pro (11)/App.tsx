
import React, { useState, useEffect, useCallback } from 'react';
import { UserRole, AuthState, Student, Exam, Submission } from './types';
import { storageService } from './services/storage';
import Layout from './components/Layout';
import StudentRegistrar from './components/Admin/StudentRegistrar';
import ExamUpload from './components/Admin/ExamUpload';
import SubmissionValuation from './components/Admin/SubmissionValuation';
import SecurityHub from './components/Admin/SecurityHub';
import ExamPortal from './components/Student/ExamPortal';
import ResultsPortal from './components/Student/ResultsPortal';
import { CheckIcon } from './components/Icons';

const DEFAULT_EXAM: Exam = {
  id: 'e1',
  subject: 'Management Principle & Business Environment',
  durationMinutes: 90,
  isLive: false,
  totalQuestions: 54,
  mcqDisplayLimit: 50,
  descriptiveDisplayLimit: 4,
  mcqQuestions: Array(5).fill(null).map((_, i) => ({ id: `mcq-${i}`, text: `Sample MCQ Question #${i+1}?`, type: 'MCQ', options: ['Option A', 'Option B', 'Option C', 'Option D'], correctAnswer: 'Option A', maxMarks: 1 })),
  descriptiveQuestions: Array(4).fill(null).map((_, i) => ({ id: `desc-${i}`, text: `Write a detailed explanation of business principle #${i+1}.`, type: 'DESCRIPTIVE', maxMarks: 5 })),
  createdAt: Date.now()
};

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({ user: null });
  const [loginMode, setLoginMode] = useState<UserRole>(UserRole.STUDENT);
  const [activeTab, setActiveTab] = useState<'CANDIDATES' | 'PAPERS' | 'HUB' | 'VALUATION'>('CANDIDATES');
  const [selectedExamForStudent, setSelectedExamForStudent] = useState<Exam | null>(null);
  const [viewingResult, setViewingResult] = useState<Submission | null>(null);
  
  const [allExams, setAllExams] = useState<Exam[]>(storageService.getExams().length > 0 ? storageService.getExams() : [DEFAULT_EXAM]);
  const [allStudents, setAllStudents] = useState<Student[]>(storageService.getStudents());
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>(storageService.getSubmissions());
  
  const [idInput, setIdInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginMode === UserRole.ADMIN) {
      if (idInput === 'Jainonline.july2025' && passwordInput === 'Passwordis11231997') {
        setAuth({ user: { role: UserRole.ADMIN, id: 'admin', name: 'Admin Control' } });
        setError('');
      } else {
        setError('Verification failed. Invalid staff credentials.');
      }
    } else {
      const student = allStudents.find(s => s.studentId === idInput || s.email === idInput);
      if (student && student.isAuthorized) {
        setAuth({ user: { role: UserRole.STUDENT, id: student.id, name: student.name } });
        setAllSubmissions(storageService.getSubmissions());
        setError('');
      } else {
        setError('Candidate record not found or access is currently restricted.');
      }
    }
  };

  const handleLogout = () => {
    setAuth({ user: null });
    setSelectedExamForStudent(null);
    setViewingResult(null);
  };

  const handleFinishExam = () => {
    updateAllData();
    setSelectedExamForStudent(null);
  };

  const updateAllData = useCallback(() => {
    setAllExams(storageService.getExams().length > 0 ? storageService.getExams() : [DEFAULT_EXAM]);
    setAllStudents(storageService.getStudents());
    setAllSubmissions(storageService.getSubmissions());
  }, []);

  if (selectedExamForStudent && auth.user) {
    return <ExamPortal exam={selectedExamForStudent} studentId={auth.user.id} onFinish={handleFinishExam} />;
  }

  if (viewingResult && auth.user) {
    return (
      <Layout user={auth.user as any} onLogout={handleLogout}>
        <ResultsPortal submission={viewingResult} exam={allExams.find(e => e.id === viewingResult.examId)} onClose={() => setViewingResult(null)} />
      </Layout>
    );
  }

  if (!auth.user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 mesh-gradient">
        <div className="bg-white rounded-[2.5rem] shadow-[0_40px_100px_-15px_rgba(0,0,0,0.5)] overflow-hidden w-full max-w-5xl flex min-h-[650px] animate-reveal border border-white/20">
          <div className={`hidden md:flex w-2/5 p-16 text-white flex-col justify-between transition-all duration-700 ${loginMode === UserRole.ADMIN ? 'bg-slate-950' : 'bg-indigo-800'}`}>
            <div className="space-y-12">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-700 font-black text-2xl shadow-lg">EQ</div>
                <span className="text-3xl font-black tracking-tight">EduQuest</span>
              </div>
              <div className="space-y-6">
                <h1 className="text-5xl font-extrabold leading-[1.1]">{loginMode === UserRole.ADMIN ? 'Secure Portal.' : 'Digital Exam.'}</h1>
                <p className="text-white/50 text-base font-medium leading-relaxed max-w-[280px]">High-integrity examination environment powered by AI-Proctoring.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
               <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></div>
               <div className="text-[9px] font-black uppercase tracking-[0.3em] opacity-40">System Version 4.2 Pro</div>
            </div>
          </div>
          <div className="w-full md:w-3/5 p-16 lg:p-24 flex flex-col justify-center bg-white relative overflow-hidden">
             <div className="absolute top-[-100px] right-[-100px] w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>
             
             <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit mb-12 shadow-inner">
                <button onClick={() => setLoginMode(UserRole.STUDENT)} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all duration-300 ${loginMode === UserRole.STUDENT ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>Candidate</button>
                <button onClick={() => setLoginMode(UserRole.ADMIN)} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all duration-300 ${loginMode === UserRole.ADMIN ? 'bg-white text-slate-800 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>Administrator</button>
             </div>
             
             <div className="mb-10">
               <h2 className="text-4xl font-black text-slate-900 mb-3 tracking-tight">System Login</h2>
               <p className="text-slate-400 font-semibold">Please authenticate to continue.</p>
             </div>

             {error && (
               <div className="mb-8 p-5 bg-rose-50 text-rose-600 rounded-2xl text-[11px] font-bold border border-rose-100 flex items-center gap-3 animate-reveal">
                 <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                 {error}
               </div>
             )}

             <form onSubmit={handleLogin} className="space-y-6 relative z-10">
               <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Identification</label>
                 <input type="text" placeholder="Roll Number / ID" className="w-full p-6 bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-2xl outline-none font-bold text-slate-700 transition-all shadow-inner" value={idInput} onChange={e => setIdInput(e.target.value)} required />
               </div>
               {loginMode === UserRole.ADMIN && (
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Passphrase</label>
                    <input type="password" placeholder="System Password" className="w-full p-6 bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-2xl outline-none font-bold text-slate-700 transition-all shadow-inner" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} required />
                 </div>
               )}
               <button type="submit" className={`w-full py-6 rounded-2xl font-black text-white shadow-2xl transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-3 tracking-widest uppercase text-xs ${loginMode === UserRole.ADMIN ? 'bg-slate-900 hover:bg-black shadow-slate-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'}`}>
                 Access Portal
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" strokeWidth="2.5"/></svg>
               </button>
             </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout 
      user={auth.user as any} 
      onLogout={handleLogout}
    >
      {auth.user.role === UserRole.ADMIN ? (
        <div className="space-y-12 max-w-7xl mx-auto py-8">
          <div className="flex bg-slate-100 p-1.5 rounded-[20px] shadow-inner border border-slate-200 w-fit mx-auto glass-card">
            {['CANDIDATES', 'PAPERS', 'HUB', 'VALUATION'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-10 py-3 rounded-2xl text-[11px] font-bold tracking-widest transition-all duration-300 ${
                  activeTab === tab 
                    ? 'bg-indigo-600 text-white shadow-2xl scale-[1.05]' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="animate-reveal">
            {activeTab === 'CANDIDATES' && (
              <StudentRegistrar 
                students={allStudents} 
                exams={allExams} 
                submissions={allSubmissions}
                onUpdate={updateAllData}
              />
            )}
            {activeTab === 'PAPERS' && (
              <ExamUpload 
                exams={allExams} 
                onUpdate={updateAllData}
              />
            )}
            {activeTab === 'HUB' && (
              <SecurityHub 
                submissions={allSubmissions}
                onUpdate={updateAllData}
              />
            )}
            {activeTab === 'VALUATION' && (
              <SubmissionValuation 
                exams={allExams} 
                submissions={allSubmissions} 
                onUpdate={updateAllData}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="animate-reveal max-w-7xl mx-auto py-12 px-4">
          <div className="bg-white p-16 rounded-[4rem] border border-slate-100 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.05)] mb-12 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-1000">
               <svg className="w-64 h-64" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z"/></svg>
            </div>
            <div className="relative z-10">
              <h2 className="text-5xl font-black text-slate-900 mb-4 tracking-tighter">Candidate Portal</h2>
              <p className="text-slate-400 font-semibold text-lg max-w-xl leading-relaxed">Access your active examinations or review your graded performance records.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {allExams.filter(e => e.isLive || allSubmissions.some(s => s.examId === e.id && s.studentId === auth.user?.id)).map(exam => {
              const studentId = auth.user?.id;
              const submission = allSubmissions.find(s => s.examId === exam.id && s.studentId === studentId);
              const hasSubmitted = !!submission;
              const isGraded = submission?.status === 'GRADED';
              
              return (
                <div 
                  key={exam.id} 
                  onClick={() => {
                    if (isGraded && submission) setViewingResult(submission);
                    else if (!hasSubmitted && exam.isLive) setSelectedExamForStudent(exam);
                  }} 
                  className={`bg-white p-12 rounded-[50px] border-2 transition-all duration-500 ease-in-out shadow-xl flex flex-col min-h-[420px] relative group overflow-hidden ${
                    hasSubmitted && !isGraded
                      ? 'border-slate-50 opacity-80 cursor-default' 
                      : 'border-white hover:border-indigo-200 hover:-translate-y-2 hover:scale-[1.02] cursor-pointer shadow-indigo-100/20 active:scale-[0.98]'
                  }`}
                >
                  <div className="flex justify-between items-start mb-12">
                    <div className="flex items-center gap-3">
                      <div className={hasSubmitted ? 'w-3 h-3 rounded-full bg-emerald-500' : (exam.isLive ? 'w-3 h-3 rounded-full bg-red-600 live-pulse' : 'w-3 h-3 rounded-full bg-slate-300')}></div>
                      <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isGraded ? 'text-emerald-600' : (hasSubmitted ? 'text-indigo-600' : (exam.isLive ? 'text-red-600 font-black bg-red-50 px-2 py-0.5 rounded' : 'text-slate-400'))}`}>
                        {isGraded ? 'Result Ready' : (hasSubmitted ? 'Under Review' : (exam.isLive ? 'Live Now' : 'Expired'))}
                      </span>
                    </div>
                    {isGraded && (
                      <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-2xl border border-emerald-100">
                        <CheckIcon className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                  
                  <div className="mb-10">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] block mb-2 opacity-60">Subject Assignment</span>
                    <h3 className="text-3xl font-black text-slate-900 leading-[1.15] group-hover:text-indigo-600 transition-colors">{exam.subject}</h3>
                  </div>
                  
                  <div className="mt-auto space-y-8">
                    <div className="flex gap-3">
                      <div className="bg-slate-50 px-5 py-2.5 rounded-2xl text-[10px] font-bold text-slate-500 uppercase border border-slate-100 group-hover:bg-white group-hover:border-indigo-100 transition-all">{exam.durationMinutes} Mins</div>
                      {isGraded && submission && <div className="bg-indigo-50 px-5 py-2.5 rounded-2xl text-[10px] font-black text-indigo-600 uppercase border border-indigo-100">Score: {submission.mcqScore + Object.values(submission.descriptiveScores).reduce((a: number, b: number) => a + b, 0)}</div>}
                    </div>
                    {isGraded ? (
                      <button className="w-full bg-indigo-600 text-white py-6 rounded-[28px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl transition-all group-hover:bg-indigo-700 group-hover:scale-[1.03] group-hover:shadow-indigo-200">
                        View Detailed Result
                      </button>
                    ) : (
                      hasSubmitted ? (
                        <div className="w-full bg-slate-100 text-slate-400 py-6 rounded-[28px] font-black text-xs uppercase tracking-[0.2em] text-center border border-slate-200/50">
                          Awaiting Evaluation
                        </div>
                      ) : (
                        exam.isLive ? (
                          <button className="w-full bg-slate-900 text-white py-6 rounded-[28px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl transition-all group-hover:bg-indigo-600 group-hover:scale-[1.03] group-hover:shadow-indigo-200">
                            Start Assessment
                          </button>
                        ) : (
                          <div className="w-full bg-slate-50 text-slate-300 py-6 rounded-[28px] font-black text-xs uppercase tracking-[0.2em] text-center">
                            Session Inactive
                          </div>
                        )
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Layout>
  );
}

export default App;
