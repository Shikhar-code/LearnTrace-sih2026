// Academic Hierarchy Types
export interface AcademicClass {
  id: number;
  class_level: number;
}

export interface Subject {
  id: number;
  name: string;
  class_level: number;
}

export interface Chapter {
  id: number;
  title: string;
  subject_id: number;
}

export interface Topic {
  id: number;
  title: string;
  chapter_id: number;
}

export interface CreateTopicPayload {
  chapter_id: number;
  title: string;
}

// Documents & Content Ingestion Types
export interface SourceDocument {
  id: number;
  title: string;
  source_name: string;
  source_type: string;
  file_type: string;
  language: string;
  class_level: number;
  subject: string;
  source_url: string;
  status: string;
}

export interface DocumentUploadResponse {
  status: string;
  document_id: number;
  filename: string;
  class_level: number;
  subject: string;
  chapter: string | null;
  pages_extracted: number;
  chunks_created: number;
}

export interface DocumentChunk {
  id: number;
  document_id: number;
  chunk_index: number;
  page_number: number;
  topic_id: number | null;
  content: string;
}

export interface BulkChunkTopicUpdatePayload {
  chunk_ids: number[];
  topic_id: number;
}

export interface BulkChunkTopicUpdateResponse {
  status: string;
  topic_id: number;
  topic: string;
  chunks_updated: number;
}

// Question & Quiz Runner Types
export interface QuestionOption {
  id: number;
  option_text: string;
  is_correct?: boolean;
}

export interface Question {
  id: number;
  question_text: string;
  question_type: string;
  difficulty: string;
  topic_id: number;
  source_document_id?: number | null;
  explanation?: string | null;
  options: QuestionOption[];
}

export interface AssessmentQuestion {
  assessment_question_id: number;
  question_id: number;
  question_order: number;
  question_text: string;
  difficulty: string;
  topic_id: number;
  options: {
    id: number;
    option_text: string;
    is_correct?: boolean;
  }[];
}

export interface Assessment {
  id: number;
  title: string;
  description: string | null;
  class_level: number;
  subject_id: number;
  duration_minutes: number | null;
  questions: AssessmentQuestion[];
}

// AI Quiz Generation Types
export interface GenerateQuizRequest {
  topic_id: number;
  number_of_questions?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  duration_minutes?: number;
}

export interface GenerateQuizResponse {
  status: string;
  assessment_id: number;
  title: string;
  class_level: number;
  subject_id: number;
  duration_minutes: number;
  questions_created: number;
}

export interface StartAttemptPayload {
  user_id: number;
  assessment_id: number;
}

export interface StartAttemptResponse {
  status: string;
  attempt_id: number;
  user_id: number;
  assessment_id: number;
  started_at: string;
}

export interface SubmitResponsePayload {
  question_id: number;
  selected_option_id?: number | null;
  answer_text?: string | null;
  response_time_seconds?: number | null;
}

export interface SubmitResponseResult {
  status: string;
  response_id: number;
  attempt_id: number;
  question_id: number;
  is_correct: boolean | null;
}

export interface FinishAttemptResponse {
  status: string;
  attempt_id: number;
  answered?: number;
  correct?: number;
  score: number;
  completed: boolean;
}

// Mastery Types
export interface MasteryResponseItem {
  response_id: number;
  question_id: number;
  selected_option_id?: number | null;
  topic_id: number;
  topic: string;
  chapter_id: number | null;
  chapter: string | null;
  subject_id: number | null;
  subject: string | null;
  class_level: number | null;
  is_correct: boolean | null;
  response_time_seconds: number | null;
}

export interface MasteryInputResponse {
  attempt_id: number;
  user_id: number;
  assessment_id: number;
  completed: boolean;
  score: number;
  responses: MasteryResponseItem[];
}

// Aggregated Topic Mastery for Analytics UI
export interface TopicMasteryAgg {
  topic_id: number;
  topic_name: string;
  chapter_name: string;
  subject_name: string;
  total_questions: number;
  correct_count: number;
  accuracy: number;
  avg_time_seconds: number;
  status: "Mastered" | "Developing" | "Needs Review";
}

// AI Tutor Types
export interface TutorCompetency {
  id: string;
  name: string;
}

export interface TutorQuestion {
  id: string;
  text: string;
  options: string[];
}

export interface TutorDetectedGap {
  description: string;
}

export interface TutorContext {
  competency: TutorCompetency;
  question: TutorQuestion;
  learner_answer: string;
  correct_answer: string;
  detected_gap?: TutorDetectedGap | null;
}

export interface TutorPracticeQuestion {
  question: string;
  options: string[];
  correct_option: string;
  explanation: string;
}

export interface TutorResponse {
  explanation: string;
  simple_explanation: string;
  worked_example: string;
  practice_question: TutorPracticeQuestion;
}

// Re-export Intelligence Engine Types and Schemas
export * from "./intelligence";
