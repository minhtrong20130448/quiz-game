export interface Subject {
  id: string;
  name: string;
  description: string | null;
  topicCount: number;
}

export interface Topic {
  id: string;
  name: string;
  price: number | null;
  /** Giá thực tế phải trả ngay lúc này (đã áp giảm giá nếu đang trong khoảng áp dụng). */
  finalPrice: number | null;
  /** % đang giảm — chỉ khác null khi giảm giá ĐANG hiệu lực (không phải giảm giá đã đặt nhưng chưa/hết hạn). */
  discountPercent: number | null;
  questionCount: number;
  sellable: boolean;
}

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
  topicId: string;
  orderId: string;
  memoCode: string;
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
