
import React, { useState, useEffect } from 'react';
import { storageService } from '../../services/storage';
import { Exam, Question, QuestionType } from '../../types';
import { BookIcon, PencilIcon, CheckIcon, TrashIcon } from '../Icons';

declare const XLSX: any;

interface ExamUploaderProps {
  exams: Exam[];
  onUpdate: () => void;
}

const ExamUploader: React.FC<ExamUploaderProps> = ({ exams, onUpdate }) => {
  const [mcqPool, setMcqPool] = useState<Question[]>([]);
  const [descriptivePool, setDescriptivePool] = useState<Question[]>([]);
  const [subject, setSubject] = useState('');
  const [duration, setDuration] = useState(60);
  const [mcqLimit, setMcqLimit] = useState(50);
  const [descLimit, setDescLimit] = useState(6);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);

  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: QuestionType) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];

        const parsed: Question[] = jsonData.map((row: any, index: number) => {
          const keys = Object.keys(row);
          const textKey = keys.find(k => ['question', 'que', 'text', 'statement'].includes(k.toLowerCase().trim()));
          
          let options: string[] | undefined = undefined;
          if (type === 'MCQ') {
            options = [
              row['Option A'] || row['A'] || row['option1'], 
              row['Option B'] || row['B'] || row['option2'], 
              row['Option C'] || row['C'] || row['option3'], 
              row['Option D'] || row['D'] || row['option4']
            ].map(v => v !== undefined && v !== null ? String(v).trim() : "");
          }

          const ansKey = keys.find(k => k.toLowerCase().includes('correct') || k.toLowerCase().includes('answer') || k.toLowerCase() === 'ans');
          
          return {
            id: `${type.toLowerCase()}-${index}-${Math.random().toString(36).substr(2, 5)}`,
            type: type,
            text: textKey ? String(row[textKey]).trim() : 'Missing Question Text',
            options,
            correctAnswer: ansKey ? String(row[ansKey]).trim() : undefined,
            maxMarks: type === 'MCQ' ? 1 : 5
          };
        }).filter(q => q.text !== 'Missing Question Text');

        if (type === 'MCQ') setMcqPool(parsed);
        else setDescriptivePool(parsed);
        
        alert(`Parsed ${parsed.length} questions successfully.`);
      } catch (err) { alert('Excel parse error.'); }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleUpdateQuestion = (updated: Question) => {
    if (updated.type === 'MCQ') setMcqPool(prev => prev.map(q => q.id === updated.id ? updated : q));
    else setDescriptivePool(prev => prev.map(q => q.id === updated.id ? updated : q));
    setEditingQuestion(null);
  };

  const saveExam = () => {
    if (!subject.trim()) return alert("Subject name is required.");
    const examData: Exam = {
      id: editingExamId || Math.random().toString(36).substr(2, 9),
      subject: subject.trim(),
      durationMinutes: duration,
      mcqDisplayLimit: mcqLimit,
      descriptiveDisplayLimit: descLimit,
      totalQuestions: mcqLimit + descLimit,
      mcqQuestions: mcqPool,
      descriptiveQuestions: descriptivePool,
      isLive: editingExamId ? exams.find(e => e.id === editingExamId)?.isLive || false : false,
      createdAt: editingExamId ? exams.find(e => e.id === editingExamId)?.createdAt || Date.now() : Date.now()
    };

    const currentExams = storageService.getExams();
    if (editingExamId) storageService.saveExams(currentExams.map(ex => ex.id === editingExamId ? examData : ex));
    else storageService.saveExams([examData, ...currentExams]);

    resetForm();
    onUpdate();
  };

  const resetForm = () => {
    setEditingExamId(null); setMcqPool([]); setDescriptivePool([]); setSubject(''); setDuration(60); setMcqLimit(50); setDescLimit(6);
  };

  const startEdit = (ex: Exam) => {
    setEditingExamId(ex.id); setSubject(ex.subject); setDuration(ex.durationMinutes);
    setMcqLimit(ex.mcqDisplayLimit); setDescLimit(ex.descriptiveDisplayLimit);
    setMcqPool(ex.mcqQuestions); setDescriptivePool(ex.descriptiveQuestions);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteExam = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("PERMANENT ACTION: Deleting this paper will also ERASE ALL candidate submissions and results for this subject. Do you wish to continue?")) {
      storageService.saveExams(storageService.getExams().filter(ex => ex.id !== id));
      storageService.saveSubmissions(storageService.getSubmissions().filter(sub => sub.examId !== id));
      onUpdate();
    }
  };

  const toggleLive = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    storageService.saveExams(storageService.getExams().map(ex => ex.id === id ? { ...ex, isLive: !ex.isLive } : ex));
    onUpdate();
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-20">
      {editingQuestion && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-reveal">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-10 shadow-2xl relative">
             <div className="flex justify-between items-center mb-8">
               <h4 className="text-xl font-black text-slate-900 uppercase">Edit Question</h4>
               <button onClick={() => setEditingQuestion(null)} className="p-2 text-slate-400"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5"/></svg></button>
             </div>
             <div className="space-y-6">
               <textarea className="w-full p-5 bg-slate-50 rounded-2xl font-bold text-slate-800 outline-none min-h-[120px]" value={editingQuestion.text} onChange={e => setEditingQuestion({...editingQuestion, text: e.target.value})} />
               <button onClick={() => handleUpdateQuestion(editingQuestion)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest">Save Changes</button>
             </div>
          </div>
        </div>
      )}

      {/* Editor UI */}
      <div className={`p-10 rounded-[4rem] border transition-all shadow-2xl ${editingExamId ? 'bg-indigo-50/20 border-indigo-100' : 'bg-white border-slate-100'}`}>
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-6">
            <div className={`w-16 h-16 rounded-[2rem] flex items-center justify-center text-white shadow-xl ${editingExamId ? 'bg-indigo-600' : 'bg-slate-900'}`}>
              <BookIcon className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">{editingExamId ? 'Edit Configuration' : 'Paper Designer'}</h3>
              <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Unified Examination Protocol v4.2</p>
            </div>
          </div>
          {editingExamId && <button onClick={resetForm} className="bg-white border border-indigo-100 px-6 py-2.5 rounded-full text-[10px] font-black uppercase text-indigo-600 tracking-widest shadow-sm">Discard Edit</button>}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-3">Subject Identification</label>
              <input type="text" placeholder="e.g., Financial Accounting" className="w-full p-6 bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-[2rem] outline-none font-black text-slate-800 transition-all shadow-inner" value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-3">Timer (Min)</label>
                <input type="number" className="w-full p-6 bg-slate-50 rounded-[1.8rem] font-black text-slate-800 shadow-inner outline-none focus:bg-white" value={duration} onChange={e => setDuration(parseInt(e.target.value))} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-3">MCQ Target</label>
                <input type="number" className="w-full p-6 bg-slate-50 rounded-[1.8rem] font-black text-slate-800 shadow-inner outline-none focus:bg-white" value={mcqLimit} onChange={e => setMcqLimit(parseInt(e.target.value))} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-3">Desc Target</label>
                <input type="number" className="w-full p-6 bg-slate-50 rounded-[1.8rem] font-black text-slate-800 shadow-inner outline-none focus:bg-white" value={descLimit} onChange={e => setDescLimit(parseInt(e.target.value))} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className={`border-2 border-dashed p-10 rounded-[3rem] text-center ${mcqPool.length ? 'bg-emerald-50/30 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
              <input type="file" id="mcq-up" className="hidden" accept=".xlsx" onChange={e => handleFileUpload(e, 'MCQ')} />
              <label htmlFor="mcq-up" className="cursor-pointer flex flex-col items-center justify-center">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mb-5 shadow-xl text-indigo-600">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeWidth="2.5"/></svg>
                </div>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-900 mb-1">Objective Pool</p>
                <p className="text-[11px] font-bold text-slate-400">{mcqPool.length || 0} Ready</p>
              </label>
            </div>
            <div className={`border-2 border-dashed p-10 rounded-[3rem] text-center ${descriptivePool.length ? 'bg-emerald-50/30 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
              <input type="file" id="desc-up" className="hidden" accept=".xlsx" onChange={e => handleFileUpload(e, 'DESCRIPTIVE')} />
              <label htmlFor="desc-up" className="cursor-pointer flex flex-col items-center justify-center">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mb-5 shadow-xl text-indigo-600">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeWidth="2.5"/></svg>
                </div>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-900 mb-1">Subjective Pool</p>
                <p className="text-[11px] font-bold text-slate-400">{descriptivePool.length || 0} Ready</p>
              </label>
            </div>
          </div>
        </div>
        <button onClick={saveExam} className="w-full mt-10 py-7 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase tracking-[0.3em] text-[11px] hover:bg-black transition-all shadow-2xl">
          {editingExamId ? 'Commit Update' : 'Publish Examination Session'}
        </button>
      </div>

      {/* Registry Section with Detailed Stats and Deletion */}
      <div className="space-y-10">
        <div className="flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="w-3 h-3 rounded-full bg-slate-300"></div>
            <h4 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.4em]">Published Registry</h4>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {exams.map(ex => {
            const totalMarks = (ex.mcqDisplayLimit * 1) + (ex.descriptiveDisplayLimit * 5);
            return (
              <div key={ex.id} className={`group bg-white p-12 rounded-[4.5rem] border-2 transition-all duration-700 shadow-2xl flex flex-col min-h-[620px] relative overflow-hidden ${ex.isLive ? 'border-emerald-200 ring-8 ring-emerald-50/50 ring-inset shadow-emerald-100' : 'border-white hover:border-indigo-100 shadow-slate-100'}`}>
                <div className="flex justify-between items-start mb-10">
                  <div className={`px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border flex items-center gap-2 ${ex.isLive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${ex.isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                    {ex.isLive ? 'Live' : 'Offline'}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">#{ex.id.slice(0,5)}</span>
                    {/* Top-Right Trash Action */}
                    <button 
                      onClick={(e) => deleteExam(e, ex.id)}
                      className="p-3 bg-white text-slate-200 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-2xl transition-all shadow-sm"
                      title="Permanently Delete Paper"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mb-10 flex-1">
                  <h4 className="text-3xl font-black text-slate-900 leading-[1.1] uppercase tracking-tighter group-hover:text-indigo-600 transition-colors line-clamp-2">
                    {ex.subject}
                  </h4>
                </div>

                {/* Configuration Matrix */}
                <div className="space-y-4 mb-10 bg-slate-50/50 p-4 rounded-[2.5rem] border border-slate-100">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2.5"/></svg>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Duration</span>
                      </div>
                      <span className="text-xl font-black text-slate-900">{ex.durationMinutes}<span className="text-[10px] text-slate-300 ml-1">M</span></span>
                    </div>
                    <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2.5"/></svg>
                        <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Weightage</span>
                      </div>
                      <span className="text-xl font-black text-indigo-800">{totalMarks}<span className="text-[10px] text-indigo-300 ml-1">PTS</span></span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                         <span className="text-[9px] font-black text-slate-800 uppercase tracking-widest">Part A: Objective</span>
                      </div>
                      <div className="text-right">
                         <span className="text-sm font-black text-slate-900">Show {ex.mcqDisplayLimit}</span>
                         <span className="text-[8px] font-bold text-slate-300 ml-1 uppercase">/ Pool {ex.mcqQuestions.length}</span>
                      </div>
                    </div>
                    <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                         <span className="text-[9px] font-black text-slate-800 uppercase tracking-widest">Part B: Written</span>
                      </div>
                      <div className="text-right">
                         <span className="text-sm font-black text-slate-900">Show {ex.descriptiveDisplayLimit}</span>
                         <span className="text-[8px] font-bold text-slate-300 ml-1 uppercase">/ Pool {ex.descriptiveQuestions.length}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-8 border-t border-slate-50">
                  <div className="flex gap-3">
                    <button onClick={(e) => toggleLive(e, ex.id)} className={`flex-1 py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-widest transition-all ${ex.isLive ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white'}`}>
                      {ex.isLive ? 'End Session' : 'Go Live'}
                    </button>
                    <button onClick={() => startEdit(ex)} className="p-5 bg-white text-slate-400 border border-slate-100 rounded-[2rem] hover:text-indigo-600 transition-all shadow-sm"><PencilIcon className="w-5 h-5" /></button>
                  </div>
                  <button onClick={(e) => deleteExam(e, ex.id)} className="w-full py-4 text-slate-300 hover:text-rose-600 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all">Delete Paper Registry</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ExamUploader;
