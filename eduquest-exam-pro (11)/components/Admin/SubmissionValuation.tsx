
import React, { useState, useMemo } from 'react';
import { Submission, Exam, Question } from '../../types';
import { storageService } from '../../services/storage';
import { CheckIcon, PencilIcon } from '../Icons';
import { GoogleGenAI } from "@google/genai";

interface SubmissionsManagerProps {
  exams: Exam[];
  submissions: Submission[];
  onUpdate: () => void;
}

const SubmissionsManager: React.FC<SubmissionsManagerProps> = ({ exams, submissions, onUpdate }) => {
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [viewingStudentId, setViewingStudentId] = useState<string | null>(null);
  const [gradingScores, setGradingScores] = useState<Record<string, number>>({});
  const [aiFeedback, setAiFeedback] = useState<Record<string, string>>({});
  const [activeReviewSection, setActiveReviewSection] = useState<'MCQ' | 'DESC'>('MCQ');
  const [isAiLoading, setIsAiLoading] = useState<string | null>(null);

  const studentsWithSubmissions = useMemo(() => {
    const map = new Map<string, { id: string, name: string, submissions: Submission[] }>();
    const safeSubmissions = Array.isArray(submissions) ? submissions : [];
    
    safeSubmissions.forEach(sub => {
      if (!map.has(sub.studentId)) {
        map.set(sub.studentId, { id: sub.studentId, name: sub.studentName, submissions: [] });
      }
      map.get(sub.studentId)!.submissions.push(sub);
    });
    return Array.from(map.values());
  }, [submissions]);

  const handleGrade = (sub: Submission) => {
    setSelectedSub(sub);
    setGradingScores(sub.descriptiveScores || {});
    setAiFeedback(sub.aiFeedback || {});
    setActiveReviewSection('MCQ');
  };

  const getAiSuggestion = async (question: Question, answer: string) => {
    if (!answer || answer.length < 5) return;
    setIsAiLoading(question.id);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Act as an academic examiner. Evaluate this student response for the question.
      Question: "${question.text}"
      Maximum Marks: ${question.maxMarks}
      Student Answer: "${answer}"
      
      Return ONLY a JSON object: 
      { "suggestedScore": number, "justification": "short 1-sentence feedback" }`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      const resText = response.text;
      if (resText) {
        const result = JSON.parse(resText.replace(/```json/g, '').replace(/```/g, '').trim());
        setGradingScores(prev => ({ ...prev, [question.id]: result.suggestedScore }));
        setAiFeedback(prev => ({ ...prev, [question.id]: result.justification }));
      }
    } catch (err) {
      console.error("AI Valuation Error", err);
    } finally {
      setIsAiLoading(null);
    }
  };

  const calculateTotalScore = (sub: Submission, currentGrading?: Record<string, number>) => {
    const descSum = Object.values(currentGrading || sub.descriptiveScores || {}).reduce((a, b) => a + b, 0);
    return (sub.mcqScore || 0) + descSum;
  };

  const isMcqCorrect = (studentAns: string, question: Question) => {
    if (!studentAns || !question.correctAnswer) return false;
    const cleanStudent = studentAns.trim().toLowerCase();
    const cleanCorrect = question.correctAnswer.trim().toLowerCase();
    if (cleanStudent === cleanCorrect) return true;
    const studentOptIndex = question.options?.findIndex(opt => opt.trim().toLowerCase() === cleanStudent);
    if (studentOptIndex === -1 || studentOptIndex === undefined) return false;
    const labels = ['a', 'b', 'c', 'd', 'e'];
    const selectedLetter = labels[studentOptIndex];
    if (cleanCorrect === selectedLetter || cleanCorrect === `option ${selectedLetter}` || cleanCorrect === `${selectedLetter}.`) return true;
    return false;
  };

  const saveGrades = () => {
    if (!selectedSub) return;
    const updatedSub: Submission = { 
      ...selectedSub, 
      descriptiveScores: gradingScores, 
      aiFeedback: aiFeedback,
      status: 'GRADED' 
    };
    const allSubs = storageService.getSubmissions();
    const index = allSubs.findIndex(s => s.id === updatedSub.id);
    if (index >= 0) {
      allSubs[index] = updatedSub;
      storageService.saveSubmissions(allSubs);
      onUpdate();
      setSelectedSub(null);
    }
  };

  if (selectedSub) {
    const exam = exams.find(e => e.id === selectedSub.examId);
    const assignedMCQs = (exam?.mcqQuestions || []).filter(q => selectedSub.mcqQuestionIds?.includes(q.id) || selectedSub.answers.hasOwnProperty(q.id));
    const assignedDescs = (exam?.descriptiveQuestions || []).filter(q => selectedSub.descriptiveQuestionIds?.includes(q.id) || true).slice(0, exam?.descriptiveDisplayLimit || 6);
    const totalScore = calculateTotalScore(selectedSub, gradingScores);

    return (
      <div className="space-y-6 animate-reveal">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl gap-6">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg shadow-indigo-100">{selectedSub.studentName.charAt(0)}</div>
            <div>
              <h3 className="text-xl font-black text-slate-900">{selectedSub.studentName}</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedSub.examSubject} • Evaluation Phase</p>
            </div>
          </div>
          
          <div className="flex items-center gap-10 bg-slate-50 px-8 py-4 rounded-3xl border border-slate-100">
            <div className="text-center">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Objective</p>
              <p className="text-sm font-black text-slate-700">{selectedSub.mcqScore}/{selectedSub.totalMcqMarks}</p>
            </div>
            <div className="w-[1px] h-8 bg-slate-200"></div>
            <div className="text-center">
              <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-1">Total Mark</p>
              <p className="text-2xl font-black text-slate-900 leading-none">{totalScore}</p>
            </div>
            <div className="w-[1px] h-8 bg-slate-200"></div>
            <div className="text-center">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Integrity</p>
              <p className={`text-sm font-black ${selectedSub.trustScore < 50 ? 'text-rose-600' : 'text-emerald-600'}`}>{selectedSub.trustScore}%</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={saveGrades} className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl shadow-indigo-100 transition-all">Submit Evaluation</button>
            <button onClick={() => setSelectedSub(null)} className="p-4 bg-slate-100 text-slate-400 hover:text-slate-900 rounded-2xl transition-all">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5"/></svg>
            </button>
          </div>
        </div>

        <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit mb-4">
          <button onClick={() => setActiveReviewSection('MCQ')} className={`px-8 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeReviewSection === 'MCQ' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}>Part A: Objective</button>
          <button onClick={() => setActiveReviewSection('DESC')} className={`px-8 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeReviewSection === 'DESC' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}>Part B: Subjective</button>
        </div>

        {activeReviewSection === 'MCQ' ? (
          <div className="grid gap-4">
            {assignedMCQs.map((q, idx) => {
              const studentAnswer = selectedSub.answers[q.id];
              const isCorrect = isMcqCorrect(studentAnswer, q);
              return (
                <div key={q.id} className="p-6 rounded-3xl border-2 border-slate-50 bg-white hover:border-indigo-100 transition-all shadow-sm">
                  <div className="flex items-start gap-4 mb-5">
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-[10px] shadow-sm ${!studentAnswer ? 'bg-slate-100 text-slate-300' : isCorrect ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                      {idx + 1}
                    </span>
                    <p className="text-sm font-bold text-slate-800 leading-relaxed">{q.text}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {q.options?.map((opt, i) => {
                      const optLabel = String.fromCharCode(65 + i);
                      const isOptionCorrect = isMcqCorrect(opt, q);
                      const isStudentOption = studentAnswer === opt;
                      return (
                        <div key={i} className={`p-3.5 rounded-2xl border-2 text-[10px] font-bold transition-all ${isStudentOption ? (isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800') : (isOptionCorrect ? 'bg-indigo-50 border-indigo-200 text-indigo-800' : 'bg-slate-50 text-slate-300 border-transparent')}`}>
                          <span className="mr-3 opacity-40 font-black">{optLabel}</span>{opt}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-6">
            {assignedDescs.map((q, idx) => {
              const textAns = selectedSub.answers[q.id];
              const imgs: string[] = [];
              for(let i=0; i<3; i++) if(selectedSub.answers[`img_${q.id}_${i}`]) imgs.push(selectedSub.answers[`img_${q.id}_${i}`]);
              return (
                <div key={q.id} className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-50 shadow-sm relative overflow-hidden group">
                  <div className="flex flex-col lg:flex-row gap-8">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">Item #{idx+1}</span>
                        <h5 className="text-lg font-black text-slate-900 tracking-tight">{q.text}</h5>
                      </div>
                      <div className="bg-slate-50 p-6 rounded-3xl text-sm font-medium text-slate-600 mb-6 whitespace-pre-wrap leading-relaxed shadow-inner border border-slate-100 min-h-[150px]">
                        {textAns || <span className="text-slate-300 italic">No text response provided.</span>}
                      </div>
                      <div className="flex gap-4">
                        {imgs.map((img, i) => (
                          <a key={i} href={img} target="_blank" rel="noreferrer" className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-white shadow-lg hover:scale-105 transition-transform">
                            <img src={img} className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    </div>
                    
                    <div className="w-full lg:w-72 space-y-4">
                      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                        <div className="flex justify-between items-end mb-4">
                           <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Assign Score</label>
                           <span className="text-[9px] font-black text-indigo-400">MAX: {q.maxMarks} PT</span>
                        </div>
                        <div className="flex items-center gap-3">
                           <input 
                            type="number" 
                            max={q.maxMarks} 
                            className="w-full p-4 bg-white border-2 border-transparent focus:border-indigo-500 rounded-2xl text-center font-black text-2xl outline-none shadow-sm transition-all"
                            value={gradingScores[q.id] || 0} 
                            onChange={e => setGradingScores({...gradingScores, [q.id]: Math.min(q.maxMarks, parseInt(e.target.value) || 0)})} 
                          />
                        </div>
                      </div>

                      <button 
                        disabled={!!isAiLoading}
                        onClick={() => getAiSuggestion(q, textAns || '')}
                        className={`w-full py-4 rounded-2xl font-black text-[9px] uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all ${isAiLoading === q.id ? 'bg-slate-200 text-slate-400' : 'bg-slate-900 text-white hover:bg-black active:scale-[0.98]'}`}
                      >
                        {isAiLoading === q.id ? (
                          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1a1 1 0 112 0v1a1 1 0 11-2 0zM13.536 15.657a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM10 14a4 4 0 100-8 4 4 0 000 8z" /></svg>
                        )}
                        {isAiLoading === q.id ? 'AI Analyzing...' : 'AI Evaluation'}
                      </button>

                      {aiFeedback[q.id] && (
                        <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl animate-reveal">
                           <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-1">AI Suggestion</p>
                           <p className="text-[10px] font-bold text-indigo-800 leading-tight italic">"{aiFeedback[q.id]}"</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (viewingStudentId) {
    const student = studentsWithSubmissions.find(s => s.id === viewingStudentId);
    return (
      <div className="space-y-8 animate-reveal">
        <div className="flex justify-between items-center bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg">{student?.name.charAt(0) || 'C'}</div>
            <div>
               <h2 className="text-2xl font-black text-slate-900 tracking-tight">{student?.name}</h2>
               <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Candidate Profile • {student?.submissions.length} Submissions</p>
            </div>
          </div>
          <button onClick={() => setViewingStudentId(null)} className="bg-slate-100 hover:bg-slate-200 px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">Back to List</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {(student?.submissions || []).map(sub => {
            const totalScore = calculateTotalScore(sub);
            return (
              <div key={sub.id} className="bg-white p-10 rounded-[3.5rem] border-2 border-transparent hover:border-indigo-600 transition-all shadow-xl group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8">
                   <div className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${sub.status === 'GRADED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>{sub.status}</div>
                </div>
                <div className="mb-10">
                   <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1 opacity-60">Assignment</p>
                   <h4 className="text-xl font-black text-slate-900 leading-tight line-clamp-2">{sub.examSubject}</h4>
                </div>
                <div className="flex justify-between items-end mb-10 pt-10 border-t border-slate-50">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Trust Score</p>
                    <p className={`text-lg font-black ${sub.trustScore < 50 ? 'text-rose-600' : 'text-emerald-600'}`}>{sub.trustScore}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Result</p>
                    <p className="text-3xl font-black text-slate-900 leading-none">{totalScore}</p>
                  </div>
                </div>
                <button onClick={() => handleGrade(sub)} className="w-full bg-slate-900 group-hover:bg-indigo-600 text-white py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest shadow-2xl transition-all active:scale-[0.98]">
                  Open Valuation
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[3.5rem] border border-slate-100 overflow-hidden shadow-2xl animate-reveal">
      <table className="w-full text-left">
        <thead className="bg-slate-50 border-b border-slate-100">
          <tr>
            <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Candidate Identification</th>
            <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Module History</th>
            <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] text-center">Avg Integrity</th>
            <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {studentsWithSubmissions.map(student => {
            const subs = student.submissions || [];
            const avgTrust = Math.round(subs.reduce((a,b)=>a+b.trustScore, 0) / (subs.length || 1));
            return (
              <tr key={student.id} className="hover:bg-slate-50/50 transition-all group">
                <td className="p-8">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-700 rounded-2xl flex items-center justify-center font-black text-lg uppercase shadow-inner border border-indigo-100">{student.name.charAt(0)}</div>
                    <div>
                       <span className="font-black text-slate-800 text-base block tracking-tight">{student.name}</span>
                       <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">ID: {student.id.toUpperCase()}</span>
                    </div>
                  </div>
                </td>
                <td className="p-8">
                  <div className="flex flex-wrap gap-2">
                    {subs.map(sub => (
                      <span key={sub.id} className={`text-[8px] px-3 py-1.5 rounded-full font-black uppercase border transition-all ${sub.status === 'GRADED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>{sub.examSubject}</span>
                    ))}
                  </div>
                </td>
                <td className="p-8 text-center">
                   <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-black text-[10px] shadow-sm ${avgTrust < 60 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                     <div className={`w-1.5 h-1.5 rounded-full ${avgTrust < 60 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                     {avgTrust}%
                   </div>
                </td>
                <td className="p-8 text-right">
                  <button onClick={() => setViewingStudentId(student.id)} className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] shadow-lg hover:bg-indigo-600 transition-all active:scale-[0.98]">Review Papers</button>
                </td>
              </tr>
            );
          })}
          {studentsWithSubmissions.length === 0 && (
            <tr><td colSpan={4} className="p-32 text-center text-slate-300 font-black uppercase text-sm tracking-[0.5em] italic">No candidate submissions recorded.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default SubmissionsManager;
