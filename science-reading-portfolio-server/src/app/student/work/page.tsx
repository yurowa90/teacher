import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ActivityRow, StudentRow, ArtifactRow } from '@/lib/types';
import { DATA_TABLE } from '@/lib/seed';
import ActivityCard from './ActivityCard';

export default async function StudentWork() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/student');

  // 내 학생 행 (RLS: 본인만)
  const { data: studs } = await supabase.from('students').select('*').limit(1);
  const student = (studs?.[0] as StudentRow | undefined) ?? null;
  if (!student) redirect('/student');

  const { data: mods } = await supabase.from('modules').select('id').eq('class_id', student.class_id);
  const moduleIds = (mods ?? []).map((m) => m.id);

  let activities: ActivityRow[] = [];
  if (moduleIds.length) {
    const { data: acts } = await supabase
      .from('activities')
      .select('*')
      .in('module_id', moduleIds)
      .order('sort_order');
    activities = (acts ?? []) as ActivityRow[];
  }

  const { data: arts } = await supabase.from('artifacts').select('*').eq('student_id', student.id);
  const artifacts = (arts ?? []) as ArtifactRow[];
  const byActivity = new Map(artifacts.map((a) => [a.activity_id, a]));

  const done = activities.filter((a) => (byActivity.get(a.id)?.content ?? '').trim().length > 0).length;

  return (
    <main className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h1>과학 독서·논술 활동</h1>
          <p className="muted">{student.anon_label} · 진행률 {done}/{activities.length}</p>
        </div>
        <Link className="btn btn--ghost" href="/">나가기</Link>
      </div>

      <div className="notice" style={{ margin: '12px 0' }}>
        입력하는 내용은 자동 저장되며, 본인 답안만 보입니다. 실명·학번은 저장하지 않습니다.
      </div>

      <div className="grid">
        {activities.map((a) => (
          <ActivityCard
            key={a.id}
            studentId={student.id}
            activity={a}
            initialContent={byActivity.get(a.id)?.content ?? ''}
            dataTable={a.type === 'data' ? DATA_TABLE : null}
          />
        ))}
      </div>
    </main>
  );
}
