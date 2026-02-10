// types.ts

export enum UserRole {
  ADMIN = 'ADMIN',
  STUDENT = 'STUDENT'
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

export interface AuthState {
  user: User | null;
}

export interface Student {
  id: string;
  name: string;
  studentId: string;
  email: string;
  isAuthorized: boolean;
  registeredExams: string[];
}

export type QuestionType = 'MCQ' | 'DESCRIPTIVE';

export interface MCQQuestion {
  id: string;
  text: string;
  type: 'MCQ';
  options: string[];
  correctAnswer: string;
  maxMarks: number;
}

export interface DescriptiveQuestion {
  id: string;
  text: string;
  type: 'DESCRIPTIVE';
  maxMarks: number;
}

export interface Exam {
  id: string;
  subject: string;
  durationMinutes: number;
  isLive: boolean;
  totalQuestions: number;
  mcqDisplayLimit: number;
  descriptiveDisplayLimit: number;
  mcqQuestions: MCQQuestion[];
  descriptiveQuestions: DescriptiveQuestion[];
  createdAt: number;
}

export type SubmissionStatus = 'SUBMITTED' | 'GRADED';

export interface Submission {
  id: string;
  examId: string;
  studentId: string;
  mcqAnswers: Record<string, string>;
  descriptiveAnswers: Record<string, string>;
  mcqScore: number;
  descriptiveScores: Record<string, number>;
  status: SubmissionStatus;
  submittedAt: number;
}
