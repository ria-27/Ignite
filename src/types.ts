export type CognitiveWeight = 'Low' | 'Medium' | 'High';
export type TargetChannel = 'Call' | 'WhatsApp';
export type TaskStatus = 'Pending' | 'Completed' | 'InProgress' | 'Delayed';

export interface StudyCard {
  front: string;
  back: string;
}

export interface Task {
  id: string;
  title: string;
  urgency: number; // 1-10
  cognitiveWeight: CognitiveWeight;
  deadline: string; // ISO string or short relative date
  context: string;
  channel: TargetChannel;
  whyImportant?: string;
  obstacle?: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  workspaceDraft?: string; // Auto-generated communication draft or summary
  workspaceType?: 'communication' | 'cognitive';
  studyCards?: StudyCard[]; // Generated flashcards for cognitive tasks
  frameworkPoints?: string[]; // 3-bullet core outline
  motivationNudge?: string; // Custom AI productivity reminder
  lastPostponedAt?: string;
  postponeCount: number;
}

export interface Habit {
  id: string;
  title: string;
  completedToday: boolean;
  streak: number;
  history: Record<string, boolean>; // e.g. { '2026-06-26': true }
}

export type MotivationStyle =
  | 'encouraging'
  | 'logical'
  | 'urgency'
  | 'progress'
  | 'humorous'
  | 'challenge'
  | 'empathetic'
  | 'achievement';

export interface MotivationState {
  currentStyle: MotivationStyle;
  history: Array<{
    style: MotivationStyle;
    action: 'ignored' | 'started' | 'completed' | 'postponed';
    timestamp: string;
  }>;
}

export interface ChatMessage {
  id: string;
  sender: 'system' | 'user' | 'assistant' | 'pilot';
  text: string;
  timestamp: string;
  quickActions?: string[];
  payload?: any;
}

export interface DatabaseSchema {
  tasks: Task[];
  habits: Habit[];
  motivationState: MotivationState;
  whatsappMessages: ChatMessage[];
  lastVocalSyncAt?: string;
}
