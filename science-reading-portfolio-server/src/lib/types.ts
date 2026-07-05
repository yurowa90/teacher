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
  subject: string;
  standard_code: string;
  title: string;
  created_at: string;
}

export interface ActivityRow {
  id: string;
  module_id: string;
  code: string;
  level: string;
  type: string;
  title: string;
  prompt: string;
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
  scores: Record<string, number>;
  misconception_ids: string[];
  feedback: string;
  updated_at: string;
}

export interface RubricCriterion {
  id: string;
  label: string;
  description: string;
}

export interface Misconception {
  id: string;
  label: string;
  feedback: string;
}
