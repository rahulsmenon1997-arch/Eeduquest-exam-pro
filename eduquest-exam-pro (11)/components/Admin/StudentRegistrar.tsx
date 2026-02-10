
import React, { useState, useMemo, useEffect } from 'react';
import { Student, Exam, Submission } from '../../types';
import { storageService } from '../../services/storage';
import { UsersIcon, PencilIcon, CheckIcon, UploadIcon } from '../Icons';

declare const XLSX: any;

interface StudentManagerProps {
  students: Student[];
  exams: Exam[];
  submissions: Submission[];
  onUpdate: () => void;
}

const StudentManager: React.FC<StudentManagerProps> = ({ students, exams, submissions, onUpdate }) => {
  const [newStudent, setNewStudent] = useState({ name: '', email: '', studentId: '' });
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showHistoryId, setShowHistoryId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', studentId: '', subjects: [] as string[] });
  const [showFormatGuide, setShowFormatGuide] = useState(false);
  
  // Setting for auto-authorization
  const [autoAuthorize, setAutoAuthorize] = useState(() => {
    const saved = localStorage.getItem('eduquest_auto_auth');
    return saved === null ? true : saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('eduquest_auto_auth', String(autoAuthorize));
  }, [autoAuthorize]);

  const availableSubjects = useMemo(() => {
    const subs = exams.map(e => e.subject);
    return Array.from(new Set(subs)).sort();
  }, [exams]);

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];

        const importedStudents: Student[] = jsonData.map((row: any) => ({
          id: Math.random().toString(36).substr(2, 9),
          name: String(row.Name || row.name || row['Student Name'] || '').trim(),
          email: String(row.Email || row.email || '').trim(),
          studentId: String(row.StudentID || row.ID || row.RollNo || row['Roll Number'] || '').trim(),
          registeredSubjects: String(row.Subjects || row.Courses || '').split(',').map(s => s.trim()).filter(Boolean),
          isAuthorized: autoAuthorize 
        })).filter(s => s.name && s.studentId);

        const current = storageService.getStudents();
        storageService.saveStudents([...current, ...importedStudents]);
        onUpdate();
        alert(`Successfully imported ${importedStudents.length} students. Auto-authorization: ${autoAuthorize ? 'ENABLED' : 'DISABLED'}`);
      } catch (err) {
        alert("Failed to parse student list. Please check Excel format.");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleResetSystem = () => {
    if (window.confirm("CRITICAL ACTION: This will delete ALL exams, ALL students, and ALL submissions. This cannot be undone. Do you want to wipe all sample data?")) {
      storageService.resetAll();
      onUpdate();
      window.location.reload();
    }
  };

  const handleAddSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.name || !newStudent.studentId) return alert("Name and ID are required.");

    const student: Student = {
      id: Math.random().toString(36).substr(2, 9),
      name: newStudent.name.trim(),
      email: newStudent.email.trim(),
      studentId: newStudent.studentId.trim(),
      registeredSubjects: selectedSubjects,
      isAuthorized: autoAuthorize 
    };

    storageService.saveStudents([...storageService.getStudents(), student]);
    setNewStudent({ name: '', email: '', studentId: '' });
    setSelectedSubjects([]);
    onUpdate();
    alert(`Student registered. Status: ${autoAuthorize ? 'Authorized' : 'Pending Authorization'}`);
  };

  const toggleSubjectSelection = (subject: string) => {
    setSelectedSubjects(prev => 
      prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]
    );
  };

  const toggleEditSubjectSelection = (subject: string) => {
    setEditForm(prev => ({
      ...prev,
      subjects: prev.subjects.includes(subject) 
        ? prev.subjects.filter(s => s !== subject) 
        : [...prev.subjects, subject]
    }));
  };

  const startEditing = (student: Student) => {
    setEditingId(student.id);
    setEditForm({
      name: student.name,
      email: student.email,
      studentId: student.studentId,
      subjects: student.registeredSubjects
    });
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    const current = storageService.getStudents();
    const updated = current.map(s => s.id === editingId ? {
      ...s,
      name: editForm.name,
      email: editForm.email,
      studentId: editForm.studentId,
      registeredSubjects: editForm.subjects
    } : s);
    storageService.saveStudents(updated);
    setEditingId(null);
    onUpdate();
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Permanently delete this student?")) {
      const filtered = storageService.getStudents().filter(s => s.id !== id);
      storageService.saveStudents(filtered);
      onUpdate();
    }
  };

  const toggleAuth = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = storageService.getStudents().map(s => s.id === id ? { ...s, isAuthorized: !s.isAuthorized } : s);
    storageService.saveStudents(updated);
    onUpdate();
  };

  const getStudentHistory = (studentId: string) => {
    return submissions
      .filter(s => s.studentId === studentId)
      .sort((a, b) => (b.endTime || 0) - (a.endTime || 0));
  };

  const calculateSubmissionScore = (sub: Submission) => {
    const descSum = Object.values(sub.descriptiveScores || {}).reduce((a, b) => a + b, 0);
    return (sub.mcqScore || 0) + descSum;
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <UsersIcon className="w-10 h-10 text-indigo-600" />
            Candidate Registrar
          </h2>
          <p className="text-slate-400 font-medium mt-1">Enroll students and map them to their course list.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-white border border-slate-200 px-5 py-2.5 rounded-xl flex items-center gap-3 shadow-sm mr-2">
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Entry Policy</span>
              <span className={`text-[10px] font-black uppercase ${autoAuthorize ? 'text-emerald-600' : 'text-amber-600'}`}>
                {autoAuthorize ? 'Auto-Authorize' : 'Manual Approval'}
              </span>
            </div>
            <button 
              onClick={() => setAutoAuthorize(!autoAuthorize)}
              className={`w-12 h-6 rounded-full transition-all relative ${autoAuthorize ? 'bg-emerald-500' : 'bg-slate-200'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${autoAuthorize ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          <button onClick={() => setShowFormatGuide(!showFormatGuide)} className="bg-slate-100 text-slate-600 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition">
            {showFormatGuide ? 'Hide Format' : 'Show Excel Format'}
          </button>
          <button onClick={handleResetSystem} className="bg-rose-50 text-rose-600 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-rose-100 transition">
            Reset System
          </button>
          <input type="file" id="bulk-stu" className="hidden" accept=".xlsx,.xls" onChange={handleBulkUpload} />
          <label htmlFor="bulk-stu" className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest cursor-pointer hover:bg-indigo-700 transition flex items-center gap-2 shadow-lg shadow-indigo-100">
            <UploadIcon className="w-4 h-4" /> Bulk Import Candidates
          </label>
        </div>
      </div>

      {showFormatGuide && (
        <div className="bg-amber-50 border-2 border-amber-100 p-8 rounded-[2rem] animate-in fade-in slide-in-from-top-2 duration-300">
          <h3 className="text-amber-800 font-black text-sm uppercase tracking-widest mb-4">Correct Excel Format for Candidates</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <p className="text-xs text-amber-700 leading-relaxed font-medium">Your Excel sheet must contain the following column headers (case-insensitive):</p>
              <ul className="text-xs text-amber-900 space-y-2 font-black">
                <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4" /> Student Name</li>
                <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4" /> Roll Number (Used as Login ID)</li>
                <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4" /> Email</li>
                <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4" /> Courses (Comma separated names)</li>
              </ul>
            </div>
            <div className="bg-white p-4 rounded-xl border border-amber-200 overflow-x-auto">
               <table className="w-full text-[10px] font-mono">
                 <thead><tr className="border-b">
                   <th className="p-2 text-left">Student Name</th><th className="p-2 text-left">Roll Number</th><th className="p-2 text-left">Courses</th>
                 </tr></thead>
                 <tbody>
                   <tr className="border-b"><td className="p-2">Rahul Jain</td><td className="p-2">Jain-001</td><td className="p-2">Physics, Chemistry, Maths</td></tr>
                   <tr><td className="p-2">Priya Sharma</td><td className="p-2">Jain-002</td><td className="p-2">Business, Economics</td></tr>
                 </tbody>
               </table>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Manual Course Mapping</h3>
        <form onSubmit={handleAddSingle} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input type="text" placeholder="Full Name" className="p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none font-bold" value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} />
            <input type="text" placeholder="Roll/ID Number" className="p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none font-bold" value={newStudent.studentId} onChange={e => setNewStudent({...newStudent, studentId: e.target.value})} />
            <input type="email" placeholder="Email Address" className="p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none font-bold" value={newStudent.email} onChange={e => setNewStudent({...newStudent, email: e.target.value})} />
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Select Courses for this Student</label>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {availableSubjects.map(sub => (
                <button key={sub} type="button" onClick={() => toggleSubjectSelection(sub)} className={`p-3 rounded-xl border-2 text-[10px] font-black uppercase tracking-tight transition-all text-center flex items-center justify-center gap-2 ${selectedSubjects.includes(sub) ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200'}`}>
                  {selectedSubjects.includes(sub) && <CheckIcon className="w-3 h-3" />}
                  {sub}
                </button>
              ))}
              {availableSubjects.length === 0 && <p className="col-span-full text-xs text-slate-300 italic">No exams found. Create exams first.</p>}
            </div>
          </div>

          <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition">Register and Map {selectedSubjects.length} Exams</button>
        </form>
      </div>

      <div className="bg-white rounded-[2rem] border overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Candidate Profile</th>
              <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">ID / Mapped Courses</th>
              <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Status</th>
              <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {students.map(s => (
              <React.Fragment key={s.id}>
                <tr className={`hover:bg-slate-50/50 transition-colors group ${editingId === s.id ? 'bg-indigo-50/50' : ''}`}>
                  <td className="p-6">
                    {editingId === s.id ? (
                      <div className="space-y-2">
                        <input className="w-full p-2 border rounded-lg font-bold" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                        <input className="w-full p-2 border rounded-lg text-xs" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} />
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-black text-sm uppercase">{s.name.charAt(0)}</div>
                        <div>
                          <p className="font-black text-slate-800">{s.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{s.email}</p>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="p-6">
                    {editingId === s.id ? (
                      <div className="space-y-4">
                        <input className="w-full p-2 border rounded-lg font-mono text-xs" value={editForm.studentId} onChange={e => setEditForm({...editForm, studentId: e.target.value})} />
                        <div className="flex flex-wrap gap-1">
                          {availableSubjects.map(sub => (
                            <button key={sub} onClick={() => toggleEditSubjectSelection(sub)} className={`px-2 py-1 rounded text-[8px] font-black uppercase border ${editForm.subjects.includes(sub) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400'}`}>{sub}</button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded w-fit">{s.studentId}</span>
                        <div className="flex flex-wrap gap-1">
                          {s.registeredSubjects.map(sub => (
                            <span key={sub} className="bg-indigo-50 text-indigo-600 text-[9px] px-2 py-0.5 rounded-full font-black uppercase border border-indigo-100">{sub}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="p-6 text-center">
                    <button type="button" onClick={(e) => toggleAuth(e, s.id)} className={`px-4 py-1 rounded-full text-[10px] font-black uppercase ${s.isAuthorized ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {s.isAuthorized ? 'Active' : 'Locked'}
                    </button>
                  </td>
                  <td className="p-6 text-right flex justify-end gap-2">
                      <button 
                        onClick={() => setShowHistoryId(showHistoryId === s.id ? null : s.id)} 
                        className={`p-2 rounded-xl transition-all ${showHistoryId === s.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-indigo-600 hover:bg-white'}`}
                        title="View Performance History"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                      {editingId === s.id ? (
                        <button onClick={handleSaveEdit} className="p-2 bg-indigo-600 text-white rounded-xl shadow-md"><CheckIcon className="w-5 h-5" /></button>
                      ) : (
                        <button onClick={() => startEditing(s)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all"><PencilIcon className="w-5 h-5" /></button>
                      )}
                      <button type="button" onClick={(e) => handleDelete(e, s.id)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-xl transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                  </td>
                </tr>
                {showHistoryId === s.id && (
                  <tr className="bg-indigo-50/30 animate-reveal">
                    <td colSpan={4} className="p-8 border-b border-indigo-100">
                       <div className="flex flex-col gap-6">
                         <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em]">Performance Dossier: {s.name}</h4>
                            <span className="text-[9px] font-bold text-indigo-400 uppercase">{getStudentHistory(s.id).length} Submissions Logged</span>
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {getStudentHistory(s.id).map(sub => (
                              <div key={sub.id} className="bg-white p-6 rounded-3xl border border-indigo-100 shadow-sm flex flex-col justify-between group hover:shadow-md transition-shadow">
                                <div className="mb-4">
                                  <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Session Attempt</span>
                                  <h5 className="font-black text-slate-800 text-sm leading-tight line-clamp-1">{sub.examSubject}</h5>
                                  <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">{new Date(sub.endTime || sub.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                </div>
                                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                                   <div className="flex flex-col">
                                      <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest">Trust Index</span>
                                      <span className={`text-[10px] font-black ${sub.trustScore < 60 ? 'text-rose-500' : 'text-emerald-500'}`}>{sub.trustScore}%</span>
                                   </div>
                                   <div className="text-right">
                                      <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest">Calculated Score</span>
                                      <p className="text-lg font-black text-indigo-600 leading-none">{calculateSubmissionScore(sub)} <span className="text-[10px] text-slate-300">PTS</span></p>
                                   </div>
                                </div>
                              </div>
                            ))}
                            {getStudentHistory(s.id).length === 0 && (
                              <div className="col-span-full py-10 text-center border border-dashed border-indigo-200 rounded-3xl">
                                <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">No examination records found for this candidate</p>
                              </div>
                            )}
                         </div>
                       </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {students.length === 0 && <tr><td colSpan={4} className="p-20 text-center text-slate-300 font-black uppercase text-xs tracking-widest">Registry Empty</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StudentManager;
