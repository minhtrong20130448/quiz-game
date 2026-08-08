export interface Question {
  id: string;
  topic: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  answer: "A" | "B" | "C" | "D";
  source: string | null;
}

export interface TopicCount {
  topic: string;
  count: number;
}

export interface WrongDetail {
  id: string;
  question: string;
  chosen: string;
  correct: string;
  source: string | null;
}

export interface QuizResult {
  username: string;
  topic: string;
  score: number;
  correct_count: number;
  wrong_count: number;
  total_questions: number;
  wrong_details: WrongDetail[];
}

export interface LeaderboardEntry {
  username: string;
  topic: string;
  score: number;
  correct_count: number;
  total_questions: number;
  created_at: string;
}

export interface AdminScoreEntry {
  id: string;
  username: string;
  topic: string;
  score: number;
  correct_count: number;
  wrong_count: number;
  total_questions: number;
  wrong_details: WrongDetail[];
  created_at: string;
}
