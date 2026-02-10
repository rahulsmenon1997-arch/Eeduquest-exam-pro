import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Exam, Question, Submission, ProctoringLog } from '../../types';
import { storageService } from '../../services/storage';
import { CheckIcon } from '../Icons';
import { GoogleGenAI } from "@google/genai";

interface ExamPortalProps {
  exam: Exam;
  studentId: string;
  onFinish: () => void;
}

type OnboardingStep = 'VERIFY_ID' | 'CAPTURE_FACE' | 'INSTRUCTIONS' | 'NONE';

const ExamPortal: React.FC<ExamPortalProps> = ({ exam, studentId, onFinish }) => {
  // --- Verification/Onboarding States ---
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>('VERIFY_ID');
  const [idCardPhoto, setIdCardPhoto] = useState<string | null>(null);
  const [candidateFacePhoto, setCandidateFacePhoto] = useState<string | null>(null);

  // --- Core Exam States ---
  const [currentSession, setCurrentSession] = useState<'A' | 'B'>('A');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [imageAnswers, setImageAnswers] = useState<Record<string, string[]>>({});
  const totalDurationSeconds = exam.durationMinutes * 60;
  const [timeLeft, setTimeLeft] = useState(totalDurationSeconds);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [showPaletteMobile, setShowPaletteMobile] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  
  const [proctoringLogs, setProctoringLogs] = useState<ProctoringLog[]>([]);
  const [lastViolation, setLastViolation] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onboardingIdInputRef = useRef<HTMLInputElement>(null);
  const faceUploadInputRef = useRef<HTMLInputElement>(null);

  // --- Randomized Question Logic ---
  const shuffle = <T,>(array: T[]): T[] => {
    const pool = [...array];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
  };

  const randomizedMCQs = useMemo(() => {
    const shuffled = shuffle(exam.mcqQuestions || []);
    const limit = exam.mcqDisplayLimit || 50;
    return shuffled.slice(0, limit);
  }, [exam.id, exam.mcqQuestions, exam.mcqDisplayLimit]);

  const randomizedDescriptive = useMemo(() => {
    const shuffled = shuffle(exam.descriptiveQuestions || []);
    const limit = exam.descriptiveDisplayLimit || 6;
    return shuffled.slice(0, limit);
  }, [exam.id, exam.descriptiveQuestions, exam.descriptiveDisplayLimit]);

  const questions = currentSession === 'A' ? randomizedMCQs : randomizedDescriptive;
  const currentQuestion = questions[currentIdx];

  const mcqAnsweredCount = useMemo(() => {
    return randomizedMCQs.filter(q => !!answers[q.id]).length;
  }, [answers, randomizedMCQs]);

  const descAnsweredCount = useMemo(() => {
    return randomizedDescriptive.filter(q => !!answers[q.id] || (imageAnswers[q.id] && imageAnswers[q.id].length > 0)).length;
  }, [answers, imageAnswers, randomizedDescriptive]);

  // --- Handlers ---
  const handleIdUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setIdCardPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleFaceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setCandidateFacePhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handlePaletteClick = (session: 'A' | 'B', index: number) => {
    setCurrentSession(session);
    setCurrentIdx(index);
    setShowPaletteMobile(false);
  };

  const performSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    let mcqScore = 0;
    randomizedMCQs.forEach(q => {
      const studentAns = answers[q.id];
      if (studentAns && q.correctAnswer && studentAns.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) {
        mcqScore += (q.maxMarks || 1);
      }
    });

    const finalAnswers = { ...answers };
    Object.keys(imageAnswers).forEach(qid => {
      const images = imageAnswers[qid];
      if (Array.isArray(images)) {
        images.forEach((data, idx) => {
          finalAnswers[`img_${qid}_${idx}`] = data;
        });
      }
    });

    const safeLogs = Array.isArray(proctoringLogs) ? proctoringLogs : [];
    const penalty = safeLogs.filter(l => l.status === 'CRITICAL').length * 15 + safeLogs.filter(l => l.status === 'WARNING').length * 5;
    const trustScore = Math.max(0, 100 - penalty);

    const submission: Submission = {
      id: Math.random().toString(36).substr(2, 9),
      studentId,
      studentName: storageService.getStudents().find(s => s.id === studentId)?.name || 'Candidate',
      examId: exam.id,
      examSubject: exam.subject,
      answers: finalAnswers,
      mcqScore,
      totalMcqMarks: (randomizedMCQs || []).reduce((acc, q) => acc + (q.maxMarks || 1), 0),
      descriptiveScores: {},
      startTime: Date.now() - (totalDurationSeconds - timeLeft) * 1000,
      endTime: Date.now(),
      status: 'SUBMITTED',
      proctoringLogs: safeLogs,
      trustScore,
      mcqQuestionIds: randomizedMCQs.map(q => q.id),
      descriptiveQuestionIds: randomizedDescriptive.map(q => q.id),
      identityCard: idCardPhoto || undefined,
      candidatePhoto: candidateFacePhoto || undefined
    };

    storageService.saveSubmission(submission);
    setIsSubmitting(false);
    setIsFinished(true);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // --- Security: Keyboard/Context Lock ---
  useEffect(() => {
    if (onboardingStep !== 'NONE') return;
    const preventActions = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', preventActions);
    document.addEventListener('copy', preventActions);
    document.addEventListener('paste', preventActions);
    return () => {
      document.removeEventListener('contextmenu', preventActions);
      document.removeEventListener('copy', preventActions);
      document.removeEventListener('paste', preventActions);
    };
  }, [onboardingStep]);

  // --- Proctoring Camera & Integrity Engine ---
  useEffect(() => {
    let stream: MediaStream | null = null;
    let proctorInterval: any = null;

    const startCamera = async () => {
      // Camera only initializes when the exam officially starts (Step: NONE)
      if (onboardingStep !== 'NONE') return;

      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 360 } });
        if (videoRef.current) videoRef.current.srcObject = stream;

        proctorInterval = setInterval(async () => {
          if (!videoRef.current || !canvasRef.current) return;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const base64Data = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
          try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
              model: 'gemini-3-flash-lite-preview',
              contents: {
                parts: [
                  { text: "Analyze frame for exam integrity. Detect phones/faces/looking away. Return ONLY JSON: { \"status\": \"CLEAR\" | \"WARNING\" | \"CRITICAL\", \"reason\": \"string\" }" },
                  { inlineData: { data: base64Data, mimeType: 'image/jpeg' } }
                ]
              },
              config: { responseMimeType: 'application/json' }
            });
            const rawText = response.text;
            if (rawText) {
              const result = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());
              if (result.status !== 'CLEAR') {
                setProctoringLogs(prev => [...prev, { timestamp: Date.now(), status: result.status, reason: result.reason }]);
                setLastViolation(result.reason);
                setTimeout(() => setLastViolation(null), 5000);
              }
            }
          } catch (err) {}
        }, 45000);
      } catch (err) { console.error("Integrity Camera Error:", err); }
    };

    startCamera();
    return () => {
      if (proctorInterval) clearInterval(proctorInterval);
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [onboardingStep]);

  // --- Countdown Timer ---
  useEffect(() => {
    if (onboardingStep !== 'NONE') return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timer); performSubmit(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onboardingStep]);

  const paletteView = (
    <div className="space-y-10">
      <div className="space-y-4">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Part A: Objective</h4>
        <div className="grid grid-cols-5 gap-2">
          {randomizedMCQs.map((q, idx) => (
            <button key={q.id} onClick={() => handlePaletteClick('A', idx)} className={`w-full aspect-square rounded-xl flex items-center justify-center text-[10px] font-black border-2 transition-all ${currentSession === 'A' && currentIdx === idx ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg scale-105' : answers[q.id] ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-indigo-200'}`}>
              {idx + 1}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Part B: Subjective</h4>
        <div className="grid grid-cols-5 gap-2">
          {randomizedDescriptive.map((q, idx) => {
            const isDone = answers[q.id] || (imageAnswers[q.id] && imageAnswers[q.id].length > 0);
            return (
              <button key={q.id} onClick={() => handlePaletteClick('B', idx)} className={`w-full aspect-square rounded-xl flex items-center justify-center text-[10px] font-black border-2 transition-all ${currentSession === 'B' && currentIdx === idx ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg scale-105' : isDone ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-indigo-200'}`}>
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (isFinished) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center p-8 text-center z-[100] mesh-gradient">
        <div className="w-24 h-24 bg-emerald-100 rounded-[30px] flex items-center justify-center mb-10 shadow-emerald-100 shadow-2xl animate-reveal"><CheckIcon className="w-12 h-12 text-emerald-600" /></div>
        <h2 className="text-5xl font-black text-slate-900 mb-4 tracking-tighter">Assessment Sealed</h2>
        <p className="text-slate-500 mb-12 max-w-sm text-lg font-medium leading-relaxed">Your paper for <b>{exam.subject}</b> has been securely uploaded for evaluation.</p>
        <button onClick={onFinish} className="bg-slate-900 text-white px-16 py-5 rounded-3xl font-black shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] hover:bg-black transition-all active:scale-[0.98] uppercase tracking-widest text-xs">Return to dashboard</button>
      </div>
    );
  }

  // --- Onboarding Flow (Identity Verification) ---
  if (onboardingStep !== 'NONE') {
    return (
      <div className="fixed inset-0 bg-slate-950 flex items-center justify-center p-6 z-[500] mesh-gradient overflow-y-auto">
        <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col md:flex-row min-h-[600px] animate-reveal">
          <div className="md:w-72 bg-slate-900 p-12 text-white flex flex-col justify-between">
            <div className="space-y-10">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-slate-900 font-black text-xs">EQ</div>
                 <span className="font-black text-lg tracking-tight">Identity Portal</span>
              </div>
              <div className="space-y-6">
                 {[
                   { step: 'VERIFY_ID', label: 'Identity Token' },
                   { step: 'CAPTURE_FACE', label: 'Biometric Enrollment' },
                   { step: 'INSTRUCTIONS', label: 'Protocol Briefing' }
                 ].map((s, i) => (
                   <div key={s.step} className="flex items-center gap-4">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-black transition-all ${
                        onboardingStep === s.step ? 'bg-white border-white text-slate-900 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'border-white/20 text-white/40'
                      }`}>
                        {i + 1}
                      </div>
                      <span className={`text-[11px] font-black uppercase tracking-widest ${onboardingStep === s.step ? 'text-white' : 'text-white/30'}`}>{s.label}</span>
                   </div>
                 ))}
              </div>
            </div>
          </div>

          <div className="flex-1 p-12 md:p-20 bg-white flex flex-col justify-center">
            {onboardingStep === 'VERIFY_ID' && (
              <div className="animate-reveal space-y-8">
                <div>
                   <h2 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">Identify Yourself</h2>
                   <p className="text-slate-400 font-bold">Upload a clear photo of your Student or Government ID card.</p>
                </div>
                <div onClick={() => onboardingIdInputRef.current?.click()} className={`w-full aspect-video rounded-[2.5rem] border-4 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden group ${idCardPhoto ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-100 bg-slate-50 hover:border-indigo-200 hover:bg-indigo-50/10'}`}>
                  {idCardPhoto ? <img src={idCardPhoto} className="w-full h-full object-cover" /> : (
                    <>
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-300 shadow-sm border border-slate-100 group-hover:scale-110 transition-transform mb-4">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" strokeWidth="2.5"/></svg>
                      </div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tap to upload Document</p>
                    </>
                  )}
                </div>
                <input type="file" accept="image/*" className="hidden" ref={onboardingIdInputRef} onChange={handleIdUpload} />
                <button disabled={!idCardPhoto} onClick={() => setOnboardingStep('CAPTURE_FACE')} className="w-full py-6 bg-slate-900 text-white rounded-3xl font-black uppercase text-[10px] tracking-[0.3em] shadow-xl hover:bg-black disabled:opacity-20 transition-all">Proceed to Face Enrollment</button>
              </div>
            )}

            {onboardingStep === 'CAPTURE_FACE' && (
              <div className="animate-reveal space-y-8">
                <div>
                   <h2 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">Biometric Profile</h2>
                   <p className="text-slate-400 font-bold">Upload a pre-captured portrait of yourself for security matching.</p>
                </div>

                <div className="relative w-full aspect-video rounded-[2.5rem] overflow-hidden bg-slate-50 border-4 border-white shadow-2xl">
                  {candidateFacePhoto ? (
                    <div className="relative w-full h-full">
                      <img src={candidateFacePhoto} className="w-full h-full object-cover" />
                      <div className="absolute top-6 left-6 px-4 py-1.5 bg-indigo-600 text-white rounded-full text-[9px] font-black uppercase tracking-widest shadow-xl">Profile Snapshot Ready</div>
                      <button onClick={() => setCandidateFacePhoto(null)} className="absolute bottom-6 right-6 px-6 py-2 bg-white/20 backdrop-blur-md text-white rounded-full text-[9px] font-black uppercase tracking-widest border border-white/20 hover:bg-white/40 transition-all">Replace Photo</button>
                    </div>
                  ) : (
                    <div onClick={() => faceUploadInputRef.current?.click()} className="w-full h-full flex flex-col items-center justify-center cursor-pointer bg-slate-50 group">
                       <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-300 shadow-sm border border-slate-100 group-hover:scale-110 transition-transform mb-4">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeWidth="2.5"/></svg>
                       </div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Portrait from Device</p>
                    </div>
                  )}
                </div>
                
                <input type="file" accept="image/*" className="hidden" ref={faceUploadInputRef} onChange={handleFaceUpload} />
                <button 
                  disabled={!candidateFacePhoto} 
                  onClick={() => setOnboardingStep('INSTRUCTIONS')} 
                  className="w-full py-6 bg-slate-900 text-white rounded-3xl font-black uppercase text-[10px] tracking-[0.3em] shadow-xl hover:bg-black disabled:opacity-20 transition-all"
                >
                  Verify & Continue
                </button>
              </div>
            )}

            {onboardingStep === 'INSTRUCTIONS' && (
              <div className="animate-reveal space-y-10">
                <div>
                   <h2 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">Exam Protocol</h2>
                   <p className="text-slate-400 font-bold">By proceeding, you agree to follow the rigorous integrity guidelines.</p>
                </div>
                <div className="space-y-4">
                  {[
                    { icon: '🔒', text: 'AI surveillance is active. Stay focused on the screen.' },
                    { icon: '🚫', text: 'Window switching will trigger an immediate security alert.' },
                    { icon: '📸', text: 'Continuous video capture is enabled for administrative audit.' },
                    { icon: '⏳', text: 'The clock starts immediately upon initialization.' }
                  ].map((inst, i) => (
                    <div key={i} className="flex gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 items-center">
                       <span className="text-2xl">{inst.icon}</span>
                       <p className="text-[11px] font-bold text-slate-600 leading-relaxed">{inst.text}</p>
                    </div>
                  ))}
                </div>
                <button onClick={() => setOnboardingStep('NONE')} className="w-full py-7 bg-indigo-600 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.4em] shadow-2xl hover:bg-indigo-700 transition-all">Accept & Start Examination</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const timePercentage = (timeLeft / totalDurationSeconds) * 100;
  const isUrgent = timeLeft < 300;

  return (
    <div className="fixed inset-0 bg-slate-50 flex flex-col z-[90] text-slate-900 overflow-hidden select-none animate-reveal">
      <div className="fixed top-0 left-0 w-full h-1.5 bg-slate-100 z-[300]">
        <div className={`h-full transition-all duration-1000 ${isUrgent ? 'bg-rose-500' : 'bg-indigo-600'}`} style={{ width: `${timePercentage}%` }} />
      </div>

      {lastViolation && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[250] animate-in slide-in-from-top-4 duration-300">
          <div className="bg-rose-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
            <p className="text-[10px] font-black uppercase tracking-widest">{lastViolation}</p>
          </div>
        </div>
      )}

      {/* Floating Proctoring Camera Preview */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] pointer-events-none">
        <div className="relative w-44 h-28 rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl bg-black">
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover grayscale opacity-90 scale-x-[-1]" />
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-2 py-0.5 rounded-full z-20">
             <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
             <span className="text-[7px] text-white font-black uppercase tracking-widest">Active Audit</span>
          </div>
        </div>
      </div>

      <header className="bg-white/80 backdrop-blur-xl border-b px-10 py-5 flex justify-between items-center relative z-10">
        <div className="flex items-center gap-6">
          <div className="bg-slate-900 text-white w-12 h-12 flex items-center justify-center rounded-2xl font-black text-xl shadow-lg">EQ</div>
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none mb-1.5">{exam.subject}</h1>
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.15em]">{currentSession === 'A' ? 'Part A: Objective' : 'Part B: Written'}</span>
          </div>
        </div>

        <div className="flex items-center gap-10">
          <button onClick={() => setShowPaletteMobile(true)} className="lg:hidden p-4 bg-slate-100 rounded-2xl font-black text-[10px] uppercase tracking-widest">Navigator</button>
          <div className="flex items-center gap-4 bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 shadow-inner">
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Allotted Time</span>
              <span className={`font-mono text-2xl font-black tabular-nums tracking-tighter leading-none ${isUrgent ? 'text-rose-600' : 'text-slate-900'}`}>{formatTime(timeLeft)}</span>
            </div>
          </div>
          <button onClick={() => setShowSummaryModal(true)} className="bg-rose-600 text-white px-10 py-4 rounded-2xl font-black hover:bg-rose-700 transition shadow-xl text-[10px] uppercase tracking-[0.2em]">Final Submit</button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <aside className="w-80 bg-white border-r p-10 overflow-y-auto hidden lg:block custom-scrollbar">
           {paletteView}
        </aside>

        <section className="flex-1 p-10 lg:p-20 overflow-y-auto bg-white custom-scrollbar relative">
          <div className="max-w-4xl mx-auto">
            {currentQuestion ? (
              <div className="animate-reveal">
                <div className="mb-14">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="bg-slate-100 text-slate-500 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">Item #{currentIdx + 1}</span>
                    <span className="text-indigo-600 text-[10px] font-black uppercase tracking-widest">Value: {currentQuestion.maxMarks}pt</span>
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 leading-[1.3] tracking-tight">{currentQuestion.text}</h2>
                </div>

                {currentSession === 'A' ? (
                  <div className="grid gap-4">
                    {currentQuestion.options?.map((opt, i) => (
                      <button key={i} onClick={() => setAnswers({...answers, [currentQuestion.id]: opt})} className={`w-full text-left p-7 rounded-[2rem] border-2 transition-all flex items-center gap-6 group relative overflow-hidden ${answers[currentQuestion.id] === opt ? 'border-indigo-600 bg-indigo-50/50 shadow-lg' : 'border-slate-50 hover:border-indigo-100 bg-slate-50/50 hover:bg-white'}`}>
                        <div className={`w-10 h-10 rounded-2xl border-2 flex items-center justify-center font-black text-sm transition-all ${answers[currentQuestion.id] === opt ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-100 text-slate-300'}`}>{String.fromCharCode(65+i)}</div>
                        <span className={`text-lg font-bold transition-colors ${answers[currentQuestion.id] === opt ? 'text-indigo-900' : 'text-slate-600'}`}>{opt}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-12">
                    <textarea className="w-full h-80 p-10 rounded-[3rem] border-2 border-slate-50 focus:border-indigo-500 focus:bg-white outline-none transition-all text-xl bg-slate-50 font-medium leading-relaxed shadow-inner" placeholder="Enter your subjective response here..." value={answers[currentQuestion.id] || ''} onChange={e => setAnswers({...answers, [currentQuestion.id]: e.target.value})} />
                    <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100">
                      <div className="flex justify-between items-center mb-8">
                         <label className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em]">Evidence Attachments</label>
                         <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Limit: {(imageAnswers[currentQuestion.id] || []).length} / 3</span>
                      </div>
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                        {(imageAnswers[currentQuestion.id] || []).map((img, i) => (
                          <div key={i} className="relative aspect-square rounded-[2rem] overflow-hidden border-4 border-white shadow-xl"><img src={img} className="w-full h-full object-cover" /></div>
                        ))}
                        {(imageAnswers[currentQuestion.id] || []).length < 3 && (
                          <button onClick={() => fileInputRef.current?.click()} className="aspect-square border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center text-slate-300 hover:text-indigo-600 transition-all"><svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2.5"/></svg></button>
                        )}
                      </div>
                      <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileInputRef} onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setImageAnswers(prev => ({ ...prev, [currentQuestion.id]: [...(prev[currentQuestion.id] || []), reader.result as string].slice(0, 3) }));
                          reader.readAsDataURL(file);
                        }
                      }} />
                    </div>
                  </div>
                )}
              </div>
            ) : <div className="py-20 text-center text-slate-200 font-black tracking-[1em] uppercase">Session Locked</div>}
            
            <div className="mt-24 flex justify-between items-center border-t border-slate-100 pt-12">
              <button disabled={currentIdx === 0} onClick={() => setCurrentIdx(prev => prev - 1)} className="px-10 py-5 text-slate-400 font-black hover:text-slate-900 transition disabled:opacity-0 uppercase text-[10px] tracking-widest">Back</button>
              <div className="flex gap-5">
                {currentIdx < questions.length - 1 ? (
                  <button onClick={() => setCurrentIdx(prev => prev + 1)} className="px-14 py-5 bg-slate-900 text-white font-black rounded-3xl shadow-2xl uppercase text-[10px] tracking-[0.2em] hover:bg-black transition-all">Next Task</button>
                ) : (
                  currentSession === 'A' ? (
                    <button onClick={() => { setCurrentSession('B'); setCurrentIdx(0); }} className="px-14 py-5 bg-indigo-600 text-white font-black rounded-3xl shadow-2xl uppercase text-[10px] tracking-[0.2em] hover:bg-indigo-700 transition-all">Unlock Part B</button>
                  ) : (
                    <button onClick={() => setShowSummaryModal(true)} className="px-14 py-5 bg-rose-600 text-white font-black rounded-3xl shadow-2xl uppercase text-[10px] tracking-[0.2em] hover:bg-rose-700 transition-all">Submit Final</button>
                  )
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {showPaletteMobile && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[400] lg:hidden flex items-end animate-in slide-in-from-bottom-full duration-500">
           <div className="bg-white w-full rounded-t-[3rem] p-10 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-10">
                 <h3 className="text-xl font-black text-slate-900 uppercase">Navigator</h3>
                 <button onClick={() => setShowPaletteMobile(false)} className="p-2 text-slate-400 hover:text-slate-900"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5"/></svg></button>
              </div>
              {paletteView}
           </div>
        </div>
      )}

      {showSummaryModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[400] flex items-center justify-center p-8 animate-reveal">
          <div className="bg-white rounded-[4rem] p-16 max-w-lg w-full text-center shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] border border-white/20">
             <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-10"><CheckIcon className="w-10 h-10 text-indigo-600" /></div>
             <h3 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter">Seal Assessment?</h3>
             <p className="text-slate-400 font-semibold mb-10 text-lg">Confirmed responses will be uploaded for evaluation. Changes are not permitted after submission.</p>
             <div className="grid grid-cols-2 gap-4 mb-12">
               <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Part A progress</p>
                 <p className="text-3xl font-black text-indigo-600 tracking-tight">{mcqAnsweredCount} <span className="text-sm text-slate-300">/ {randomizedMCQs.length}</span></p>
               </div>
               <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Part B progress</p>
                 <p className="text-3xl font-black text-indigo-600 tracking-tight">{descAnsweredCount} <span className="text-sm text-slate-300">/ {randomizedDescriptive.length}</span></p>
               </div>
             </div>
             <div className="flex flex-col gap-3">
               <button onClick={performSubmit} disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 rounded-3xl font-black shadow-2xl shadow-indigo-100 tracking-widest uppercase text-xs transition-all">
                 {isSubmitting ? 'Uploading Data...' : 'Submit & Seal'}
               </button>
               <button onClick={() => setShowSummaryModal(false)} className="w-full py-4 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] hover:text-slate-900 transition-colors">Return</button>
             </div>
          </div>
        </div>
      )}
      <canvas ref={canvasRef} width="480" height="360" className="hidden" />
    </div>
  );
};

export default ExamPortal;