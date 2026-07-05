import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { RUBRIC_CRITERIA, MISCONCEPTIONS } from '@/lib/seed';
import type { ActivityRow, StudentRow, ArtifactRow, ReviewRow, ClassRow } from '@/lib/types';
import { createClass, signOut, saveReview } from '../actions';

export default async function Dashboard({
  searchParams
}: {
  searchParams: Promise<{ review?: string; saved?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/teacher');

  const { data: classes } = await supabase.from('classes').select('*').order('created_at');
  const classList = (classes ?? []) as ClassRow[];

  // 첫 반 기준으로 표시(MVP). 여러 반은 이후 반 선택 UI로 확장.
  const cls = classList[0];

  let activities: ActivityRow[] = [];
  let students: StudentRow[] = [];
  let artifacts: ArtifactRow[] = [];
  let reviews: ReviewRow[] = [];

  if (cls) {
    const { data: mods } = await supabase.from('modules').select('id').eq('class_id', cls.id);
    const moduleIds = (mods ?? []).map((m) => m.id);
    if (moduleIds.length) {
      const { data: acts } = await supabase
        .from('activities')
        .select('*')
        .in('module_id', moduleIds)
        .order('sort_order');
      activities = (acts ?? []) as ActivityRow[];
    }
    const { data: studs } = await supabase.from('students').select('*').eq('class_id', cls.id).order('anon_label');
    students = (studs ?? []) as StudentRow[];
    const studentIds = students.map((s) => s.id);
    if (studentIds.length) {
      const { data: arts } = await supabase.from('artifacts').select('*').in('student_id', studentIds);
      artifacts = (arts ?? []) as ArtifactRow[];
      const { data: revs } = await supabase.from('reviews').select('*').in('student_id', studentIds);
      reviews = (revs ?? []) as ReviewRow[];
    }
  }

  const hasArtifact = (studentId: string, activityId: string) =>
    artifacts.some((a) => a.student_id === studentId && a.activity_id === activityId && a.content.trim().length > 0);

  // 리뷰 대상 선택
  let target: { student: StudentRow; activity: ActivityRow; artifact?: ArtifactRow; review?: ReviewRow } | null = null;
  if (sp.review) {
    const [sid, aid] = sp.review.split(':');
    const student = students.find((s) => s.id === sid);
    const activity = activities.find((a) => a.id === aid);
    if (student && activity) {
      target = {
        student,
        activity,
        artifact: artifacts.find((a) => a.student_id === sid && a.activity_id === aid),
        review: reviews.find((r) => r.student_id === sid && r.activity_id === aid)
      };
    }
  }

  return (
    <main className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h1>교사 대시보드</h1>
          <p className="muted">{userData.user.email}</p>
        </div>
        <form action={signOut}>
          <button className="btn btn--ghost">로그아웃</button>
        </form>
      </div>

      {sp.error && <p className="error">{sp.error}</p>}

      {!cls ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ marginTop: 0 }}>첫 반 만들기</h2>
          <p className="muted">반을 만들면 [10통과2-01-02] 진화 모듈의 활동 8종이 자동으로 배정됩니다.</p>
          <form action={createClass} className="row">
            <div style={{ flex: 1 }}>
              <label htmlFor="name">반 이름</label>
              <input id="name" name="name" placeholder="예: 2학년 3반" required />
            </div>
            <button className="btn">반 생성</button>
          </form>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginTop: 16 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <strong>{cls.name}</strong>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  초대 코드 <span className="pill">{cls.invite_code}</span> · 학생 {students.length}명
                </p>
              </div>
              <span className="pill">학생 참여 링크: /student</span>
            </div>
          </div>

          <h2>학생별 진행 현황</h2>
          {students.length === 0 ? (
            <p className="muted">아직 참여한 학생이 없습니다. 초대 코드를 학생에게 알려주세요.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>학생</th>
                    {activities.map((a) => (
                      <th key={a.id}>{a.code}</th>
                    ))}
                    <th>진행률</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const done = activities.filter((a) => hasArtifact(s.id, a.id)).length;
                    return (
                      <tr key={s.id}>
                        <td style={{ textAlign: 'left', fontWeight: 600 }}>{s.anon_label}</td>
                        {activities.map((a) => {
                          const filled = hasArtifact(s.id, a.id);
                          return (
                            <td key={a.id} className={filled ? 'cell-done' : ''}>
                              {filled ? (
                                <Link href={`/teacher/dashboard?review=${s.id}:${a.id}`}>●</Link>
                              ) : (
                                <Link href={`/teacher/dashboard?review=${s.id}:${a.id}`} className="muted">·</Link>
                              )}
                            </td>
                          );
                        })}
                        <td>
                          {done}/{activities.length}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {target && (
            <>
              <h2>
                답안 검토 · {target.student.anon_label} · {target.activity.code} {target.activity.title}
              </h2>
              {sp.saved && <p className="notice" style={{ margin: '0 0 12px' }}>저장되었습니다.</p>}
              <div className="card">
                <label>학생 답안</label>
                <div
                  style={{
                    background: 'var(--surface-alt)',
                    borderRadius: 8,
                    padding: 14,
                    whiteSpace: 'pre-wrap',
                    minHeight: 48,
                    marginBottom: 16
                  }}
                >
                  {target.artifact?.content?.trim() ? target.artifact.content : '아직 제출된 답안이 없습니다.'}
                </div>

                <form action={saveReview}>
                  <input type="hidden" name="student_id" value={target.student.id} />
                  <input type="hidden" name="activity_id" value={target.activity.id} />

                  <label>루브릭 채점 (기준별 1~4점)</label>
                  <div className="grid" style={{ marginBottom: 16 }}>
                    {RUBRIC_CRITERIA.map((c) => {
                      const cur = target!.review?.scores?.[c.id];
                      return (
                        <div key={c.id} style={{ borderBottom: '1px dashed var(--border)', paddingBottom: 8 }}>
                          <strong>{c.label}</strong>
                          <div className="muted" style={{ fontSize: 13 }}>{c.description}</div>
                          <div className="row" style={{ marginTop: 6, gap: 16 }}>
                            {[1, 2, 3, 4].map((n) => (
                              <label key={n} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', margin: 0 }}>
                                <input type="radio" name={`score.${c.id}`} value={n} defaultChecked={cur === n} style={{ width: 'auto' }} />
                                {n}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <label>오개념 태그</label>
                  <div style={{ marginBottom: 16 }}>
                    {MISCONCEPTIONS.map((m) => {
                      const on = target!.review?.misconception_ids?.includes(m.id);
                      return (
                        <label key={m.id} style={{ display: 'block', margin: '4px 0' }}>
                          <input type="checkbox" name="misconception" value={m.id} defaultChecked={on} style={{ width: 'auto', marginRight: 8 }} />
                          {m.label}
                        </label>
                      );
                    })}
                  </div>

                  <div className="field">
                    <label htmlFor="feedback">교사 피드백</label>
                    <textarea id="feedback" name="feedback" defaultValue={target.review?.feedback ?? ''} />
                  </div>

                  <button className="btn">리뷰 저장</button>
                </form>
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
