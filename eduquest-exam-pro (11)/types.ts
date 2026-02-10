
export enum UserRole {
  ADMIN = 'ADMIN',
  STUDENT = 'STUDENT'
}

export type QuestionType = 'MCQ' | 'DESCRIPTIVE';

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options?: string[];
  correctAnswer?: string;
  maxMarks: number;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  studentId: string;
  registeredSubjects: string[];
  isAuthorized: boolean;
}

export interface Exam {
  id: string;
  subject: string;
  durationMinutes: number;
  totalQuestions: number;
  mcqQuestions: Question[];
  descriptiveQuestions: Question[];
  mcqDisplayLimit: number;
  descriptiveDisplayLimit: number;
  isLive: boolean;
  createdAt: number;
}

export interface ProctoringLog {
  timestamp: number;
  status: 'CLEAR' | 'WARNING' | 'CRITICAL';
  reason: string;
}

export interface Submission {
  id: string;
  studentId: string;
  studentName: string;
  examId: string;
  examSubject: string;
  answers: Record<string, string>;
  mcqScore: number;
  descriptiveScores: Record<string, number>; 
  totalMcqMarks: number;
  startTime: number;
  endTime?: number;
  status: 'STARTED' | 'SUBMITTED' | 'GRADED';
  proctoringLogs: ProctoringLog[];
  trustScore: number; // 0-100
  mcqQuestionIds?: string[]; // IDs of randomized MCQs shown
  descriptiveQuestionIds?: string[]; // IDs of descriptive questions shown
  aiFeedback?: Record<string, string>; // AI-generated feedback for descriptive answers
  identityCard?: string; // Base64 ID card photo
  candidatePhoto?: string; // Base64 face photo captured at start
}

export interface AuthState {
  user: {
    role: UserRole;
    id: string;
    name: string;
  } | null;
}
