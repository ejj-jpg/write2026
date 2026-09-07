export interface ClassInfo {
  id: string; // e.g. "2026-4-2"
  year: number;
  grade: number;
  classNum: number;
  classPasswordHash: string;
  studentCount?: number;
  createdAt: number;
}

export interface Student {
  id: string; // studentKey: `${year}-${grade}-${classNum}-${studentNum}`
  studentKey: string;
  classId: string;
  year: number;
  grade: number;
  classNum: number;
  studentNum: number;
  name: string;
  personalPasswordHash: string;
  isPasswordInitialized: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DailyTopic {
  id: string;
  title: string;
  category: string;
  targetGrade: number;
  description: string;
  guideQuestions: string[];
  isPreset?: boolean;
  createdAt: number;
}

export interface StoryFramework {
  firstSentence: string; // 첫 문장: 책의 시작을 여는 첫 문장
  character: string;     // 1. 주인공
  goal: string;          // 2. 하고 싶은 일
  obstacle: string;      // 3. 주인공을 방해하는 것
  helper: string;        // 4. 주인공을 돕는 것
  resolution: string;    // 5. 해결과정
  ending: string;        // 6. 결말
  completedAt?: number;
}

export interface StoryIdeaSuggestion {
  id: string;
  title: string;
  description: string;
  preview: string;
}

export interface WritingPlanning {
  title: string;
  genre: string;
  purpose: string;
  audience: string;
  ideas: string[];
  outline: {
    beginning: string;
    middle: string;
    ending: string;
    exposition?: string;   // 1. 발단 (시작)
    development?: string;  // 2. 전개 (사건)
    climax?: string;       // 3. 절정 (위기)
    resolution?: string;   // 4. 결말 (마무리)
  };
  storyFramework?: StoryFramework;
}

export interface AiFeedbackData {
  strengths: string[];
  improvements: string[];
  reasoning: string;
  topPriority: string;
  selfReflectQuestions: string[];
  rawText?: string;
}

export interface SelfAssessment {
  rubric1Score: number; // 내용의 독창성과 생생함 (1~5)
  rubric2Score: number; // 문장의 자연스러운 흐름 (1~5)
  rubric3Score: number; // 고쳐쓰기 목표 달성도 (1~5)
  selfThoughts: string;
}

export interface ProofreadSuggestion {
  id: string;
  original: string;
  corrected: string;
  type: string; // "맞춤법" | "띄어쓰기" | "문장부호" | "오타"
  reason: string;
  applied?: boolean;
}

export interface WritingRecord {
  recordId: string;
  studentKey: string;
  classId: string;
  topicId: string;
  topicTitle: string;
  planning: WritingPlanning;
  draft: string;
  aiFeedback: AiFeedbackData | null;
  revisionGoal: string;
  revisedWriting: string;
  selfAssessment: SelfAssessment | null;
  beforeProofreading: string;
  afterProofreading: string;
  proofreadSuggestions: ProofreadSuggestion[];
  finalWriting: string;
  currentStep: number; // 1: 주제, 2: 계획, 3: 초고, 4: 피드백, 5: 수정목표, 6: 고쳐쓰기, 7: 자기평가, 8: 맞춤법, 9: 최종제출
  status: 'drafting' | 'submitted';
  favorite: boolean;
  xpGranted: number;
  createdAt: number;
  updatedAt: number;
  submittedAt: number | null;
  // 과정중심평가 (교사용)
  aiAssessmentDraft?: string;
  teacherAssessment?: string;
  teacherAssessmentApproved?: boolean;
  teacherMemo?: string;
  teacherChecked?: boolean;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: number;
}

export interface StudentGrowth {
  id?: string; // studentKey
  studentKey: string;
  studentName?: string;
  xp: number;
  level: number;
  levelTitle?: string;
  completedCount: number;
  badges?: (Badge | string)[];
  equippedAvatar?: string;
  unlockedAvatars?: string[];
  equippedBadge?: string;
  updatedAt: number;
}

export interface StudentBook {
  id: string;
  studentKey: string;
  studentName: string;
  bookTitle: string;
  subtitle?: string;
  coverTheme: string;
  authorNote: string;
  selectedRecordIds: string[];
  createdAt: number;
}

export interface SystemSettings {
  id: string; // 'admin_config'
  adminPasswordHash: string;
  studentNameDisplay: 'full' | 'masked' | 'numOnly';
  updatedAt: number;
}
