import { Exam, Student, Submission } from '../types';

const EXAMS_KEY = 'eduquest_exams';
const STUDENTS_KEY = 'eduquest_students';
const SUBMISSIONS_KEY = 'eduquest_submissions';

export const storageService = {
  getExams(): Exam[] {
    const data = localStorage.getItem(EXAMS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveExams(exams: Exam[]) {
    localStorage.setItem(EXAMS_KEY, JSON.stringify(exams));
  },

  getStudents(): Student[] {
    const data = localStorage.getItem(STUDENTS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveStudents(students: Student[]) {
    localStorage.setItem(STUDENTS_KEY, JSON.stringify(students));
  },

  getSubmissions(): Submission[] {
    const data = localStorage.getItem(SUBMISSIONS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveSubmissions(submissions: Submission[]) {
    localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(submissions));
  },
};
