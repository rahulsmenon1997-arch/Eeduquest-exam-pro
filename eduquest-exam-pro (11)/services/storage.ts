
import { Student, Exam, Submission } from '../types';

const STORAGE_KEYS = {
  STUDENTS: 'eduquest_students',
  EXAMS: 'eduquest_exams',
  SUBMISSIONS: 'eduquest_submissions',
};

const safeParse = <T>(data: string | null, fallback: T): T => {
  if (!data) return fallback;
  try {
    const parsed = JSON.parse(data);
    return parsed === null ? fallback : parsed;
  } catch {
    return fallback;
  }
};

export const storageService = {
  getStudents: (): Student[] => {
    const data = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    const students = safeParse(data, []);
    return Array.isArray(students) ? students : [];
  },
  saveStudents: (students: Student[]) => {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  },
  getExams: (): Exam[] => {
    const data = localStorage.getItem(STORAGE_KEYS.EXAMS);
    const exams = safeParse(data, []);
    return Array.isArray(exams) ? exams : [];
  },
  saveExams: (exams: Exam[]) => {
    localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(exams));
  },
  getSubmissions: (): Submission[] => {
    const data = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS);
    const submissions = safeParse(data, []);
    return Array.isArray(submissions) ? submissions : [];
  },
  saveSubmissions: (submissions: Submission[]) => {
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(submissions));
  },
  saveSubmission: (submission: Submission) => {
    const current = storageService.getSubmissions();
    const index = current.findIndex(s => s.id === submission.id);
    if (index >= 0) {
      current[index] = submission;
    } else {
      current.push(submission);
    }
    storageService.saveSubmissions(current);
  },
  resetAll: () => {
    localStorage.clear();
  }
};
