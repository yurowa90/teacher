// 공용 도메인 타입 (DB 스키마와 일치)

export type Role = 'teacher' | 'student';

export interface ClassRow {
  id: string;
  teacher_id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

export interface ModuleRow {
  id: string;
  class_id: string;
  title: string;
  subject: string;
  standard_code: string;
  book_title: string;
  intro: string;
  created_at: string;
}

// 활동 보조 자료 (선택)
export type ActivityResource =
  | { type: 'table'; caption?: string; headers: string[]; rows: string[][] }
  | { type: 'text'; body: string }
  | null;

export interface ActivityRow {
  id: string;
  module_id: string;
  code: string;
  level: string;
  type: string;
  title: string;
  prompt: string;
  resource: ActivityResource;
  sort_order: number;
}

export interface RubricCriterionRow {
  id: string;
  module_id: string;
  label: string;
  description: string;
  sort_order: number;
}

export interface MisconceptionRow {
  id: string;
  module_id: string;
  label: string;
  feedback: string;
  sort_order: number;
}

export interface StudentRow {
  id: string;
  class_id: string;
  auth_user_id: string;
  anon_label: string;
  segment: string;
  created_at: string;
}

export interface ArtifactRow {
  id: string;
  student_id: string;
  activity_id: string;
  content: string;
  stage: 'initial' | 'revised' | 'final';
  updated_at: string;
}

export interface ReviewRow {
  id: string;
  student_id: string;
  activity_id: string;
  teacher_id: string;
  scores: Record<string, number>; // key = rubric_criteria.id
  misconception_ids: string[]; // misconceptions.id[]
  feedback: string;
  updated_at: string;
}
