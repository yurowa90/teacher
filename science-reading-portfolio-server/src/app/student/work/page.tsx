import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ActivityRow, StudentRow, ArtifactRow, ModuleRow } from '@/lib/types';
import ActivityCard from './ActivityCard';

export default async function StudentWork() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/student');

  // 내 학생 멤버십(여러 반 가능). RLS: 본인 행만.
  const { data: studs } = await supabase.from('students').select('*').order('created_at');
  const students = (studs ?? []) as StudentRow[];
  if (students.length === 0) redirect('/student');

  const classIds = [...new Set(students.map((s) => s.class_id))];
  const classToStudent = new Map(students.map((s) => [s.class_id, s.id]));

  const { data: mods } = await supabase.from('modules').select('*').in('class_id', classIds).order('created_at');
  const modules = (mods ?? []) as ModuleRow[];
  const moduleIds = modules.map((m) => m.id);

  let activities: ActivityRow[] = [];
  let artifacts: ArtifactRow[] = [];
  if (moduleIds.length) {
    const { data: acts } = await supabase.from('activities').select('*').in('module_id', moduleIds).order('sort_order');
    activities = (acts ?? []) as ActivityRow[];
  }
  const studentIds = students.map((s) => s.id);
  const { data: arts } = await supabase.from('artifacts').select('*').in('student_id', studentIds);
  artifacts = (arts ?? []) as ArtifactRow[];

  const label = students[0].anon_label;

  return (
    <main className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h1>과학 독서·논술 활동</h1>
          <p className="muted">{label}</p>
        </div>
        <Link className="btn btn--ghost" href="/">나가기</Link>
      </div>

      <div className="notice" style={{ margin: '12px 0' }}>
        입력하는 내용은 자동 저장되며, 본인 답안만 보입니다. 실명·학번은 저장하지 않습니다.
      </div>

      {modules.length === 0 && <p className="muted">아직 배정된 단원이 없습니다. 교사가 단원을 만들면 표시됩니다.</p>}

      {modules.map((m) => {
        const studentId = classToStudent.get(m.class_id)!;
        const modActs = activities.filter((a) => a.module_id === m.id);
        const byActivity = new Map(artifacts.map((a) => [a.activity_id, a]));
        const done = modActs.filter((a) => (byActivity.get(a.id)?.content ?? '').trim().length > 0).length;
        return (
          <section key={m.id} style={{ marginTop: 24 }}>
            <h2>{m.title}</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              {m.book_title && <>📖 {m.book_title} · </>}
              {m.standard_code} · 진행률 {done}/{modActs.length}
            </p>
            {m.intro && <p className="muted">{m.intro}</p>}
            <div className="grid">
              {modActs.map((a) => (
                <ActivityCard
                  key={a.id}
                  studentId={studentId}
                  activity={a}
                  initialContent={byActivity.get(a.id)?.content ?? ''}
                />
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
