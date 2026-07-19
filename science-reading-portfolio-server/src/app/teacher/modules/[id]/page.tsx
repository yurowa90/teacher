import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type {
  ModuleRow, ActivityRow, RubricCriterionRow, MisconceptionRow,
  StudentRow, ArtifactRow, ReviewRow
} from '@/lib/types';
import {
  updateModule, deleteModule,
  addActivity, updateActivity, deleteActivity,
  addCriterion, deleteCriterion,
  addMisconception, deleteMisconception,
  saveReview
} from '../../actions';

export default async function ModulePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ review?: string; saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/teacher');

  const { data: mod } = await supabase.from('modules').select('*').eq('id', id).single();
  if (!mod) notFound();
  const module_ = mod as ModuleRow;

  const [{ data: acts }, { data: crits }, { data: miscs }, { data: studs }] = await Promise.all([
    supabase.from('activities').select('*').eq('module_id', id).order('sort_order'),
    supabase.from('rubric_criteria').select('*').eq('module_id', id).order('sort_order'),
    supabase.from('misconceptions').select('*').eq('module_id', id).order('sort_order'),
    supabase.from('students').select('*').eq('class_id', module_.class_id).order('anon_label')
  ]);
  const activities = (acts ?? []) as ActivityRow[];
  const criteria = (crits ?? []) as RubricCriterionRow[];
  const misconceptions = (miscs ?? []) as MisconceptionRow[];
  const students = (studs ?? []) as StudentRow[];

  const activityIds = activities.map((a) => a.id);
  const studentIds = students.map((s) => s.id);
  let artifacts: ArtifactRow[] = [];
  let reviews: ReviewRow[] = [];
  if (studentIds.length && activityIds.length) {
    const [{ data: arts }, { data: revs }] = await Promise.all([
      supabase.from('artifacts').select('*').in('student_id', studentIds).in('activity_id', activityIds),
      supabase.from('reviews').select('*').in('student_id', studentIds).in('activity_id', activityIds)
    ]);
    artifacts = (arts ?? []) as ArtifactRow[];
    reviews = (revs ?? []) as ReviewRow[];
  }

  const hasArtifact = (sid: string, aid: string) =>
    artifacts.some((a) => a.student_id === sid && a.activity_id === aid && a.content.trim().length > 0);

  // 리뷰 대상
  let target: { student: StudentRow; activity: ActivityRow; artifact?: ArtifactRow; review?: ReviewRow } | null = null;
  if (sp.review) {
    const [sid, aid] = sp.review.split(':');
    const student = students.find((s) => s.id === sid);
    const activity = activities.find((a) => a.id === aid);
    if (student && activity) {
      target = {
        student, activity,
        artifact: artifacts.find((a) => a.student_id === sid && a.activity_id === aid),
        review: reviews.find((r) => r.student_id === sid && r.activity_id === aid)
      };
    }
  }

  return (
    <main className="container">
      <p className="muted"><Link href={`/teacher/dashboard?class=${module_.class_id}`}>← 대시보드</Link></p>
      <h1>{module_.title || '(제목 없음)'}</h1>
      {sp.error && <p className="error">{sp.error}</p>}
      {sp.saved && <p className="notice" style={{ margin: '8px 0' }}>저장되었습니다.</p>}

      {/* 모듈 정보 */}
      <h2>단원 정보</h2>
      <form action={updateModule} className="card">
        <input type="hidden" name="module_id" value={module_.id} />
        <div className="grid grid-2">
          <div className="field"><label>단원 제목</label><input name="title" defaultValue={module_.title} required /></div>
          <div className="field"><label>들어갈 책</label><input name="book_title" defaultValue={module_.book_title} placeholder="예: 원하는 도서명" /></div>
          <div className="field"><label>과목</label><input name="subject" defaultValue={module_.subject} placeholder="예: 통합과학2" /></div>
          <div className="field"><label>성취기준 코드</label><input name="standard_code" defaultValue={module_.standard_code} placeholder="예: [10통과2-01-02]" /></div>
        </div>
        <div className="field"><label>단원/도서 맥락 안내</label><textarea name="intro" defaultValue={module_.intro} style={{ minHeight: 70 }} /></div>
        <div className="row">
          <button className="btn">단원 정보 저장</button>
        </div>
      </form>
      <form action={deleteModule} style={{ marginTop: 8 }}>
        <input type="hidden" name="module_id" value={module_.id} />
        <input type="hidden" name="class_id" value={module_.class_id} />
        <button className="btn btn--ghost" style={{ color: '#a23b3b' }}>단원 삭제</button>
      </form>

      {/* 활동 */}
      <h2 id="activities">활동 ({activities.length})</h2>
      {activities.map((a) => (
        <form key={a.id} action={updateActivity} className="card" style={{ marginBottom: 10 }}>
          <input type="hidden" name="activity_id" value={a.id} />
          <input type="hidden" name="module_id" value={module_.id} />
          <div className="row">
            <div className="field" style={{ width: 90 }}><label>코드</label><input name="code" defaultValue={a.code} /></div>
            <div className="field" style={{ width: 130 }}><label>수준</label><input name="level" defaultValue={a.level} placeholder="예: B형 표준" /></div>
            <div className="field" style={{ width: 120 }}><label>유형</label><input name="type" defaultValue={a.type} placeholder="essay 등" /></div>
            <div className="field" style={{ flex: 1, minWidth: 160 }}><label>제목</label><input name="title" defaultValue={a.title} /></div>
          </div>
          <div className="field"><label>발문(prompt)</label><textarea name="prompt" defaultValue={a.prompt} style={{ minHeight: 70 }} /></div>
          <div className="field">
            <label>보조 자료(선택, 텍스트)</label>
            <textarea name="resource_text" placeholder={a.resource?.type === 'table' ? '표 자료가 이미 있습니다. 텍스트를 입력하면 표를 텍스트로 교체합니다.' : '표·자료 등 참고 내용'} defaultValue={a.resource?.type === 'text' ? a.resource.body : ''} style={{ minHeight: 50 }} />
            <label style={{ marginTop: 6, fontWeight: 400 }}>
              <input type="checkbox" name="clear_resource" style={{ width: 'auto', marginRight: 6 }} />보조 자료 지우기
              {a.resource?.type === 'table' && <span className="muted"> (현재: 표 자료 있음)</span>}
            </label>
          </div>
          <div className="row">
            <button className="btn">활동 저장</button>
            <button className="btn btn--ghost" style={{ color: '#a23b3b' }} formAction={deleteActivity}>삭제</button>
          </div>
        </form>
      ))}
      <form action={addActivity} className="card">
        <input type="hidden" name="module_id" value={module_.id} />
        <strong>활동 추가</strong>
        <div className="row" style={{ marginTop: 8 }}>
          <div className="field" style={{ width: 90 }}><label>코드</label><input name="code" placeholder="A1" /></div>
          <div className="field" style={{ width: 130 }}><label>수준</label><input name="level" placeholder="B형 표준" /></div>
          <div className="field" style={{ flex: 1, minWidth: 160 }}><label>제목</label><input name="title" placeholder="활동 제목" required /></div>
        </div>
        <div className="field"><label>발문</label><textarea name="prompt" style={{ minHeight: 50 }} /></div>
        <button className="btn btn--ghost">활동 추가</button>
      </form>

      {/* 루브릭 */}
      <h2 id="rubric">루브릭 기준 ({criteria.length})</h2>
      {criteria.map((c) => (
        <div key={c.id} className="card" style={{ marginBottom: 8 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <strong>{c.label}</strong>
              <div className="muted" style={{ fontSize: 14 }}>{c.description}</div>
            </div>
            <form action={deleteCriterion}>
              <input type="hidden" name="criterion_id" value={c.id} />
              <input type="hidden" name="module_id" value={module_.id} />
              <button className="btn btn--ghost" style={{ color: '#a23b3b' }}>삭제</button>
            </form>
          </div>
        </div>
      ))}
      <form action={addCriterion} className="card">
        <input type="hidden" name="module_id" value={module_.id} />
        <div className="row">
          <div className="field" style={{ width: 200 }}><label>기준명</label><input name="label" placeholder="예: 논증 구조" required /></div>
          <div className="field" style={{ flex: 1, minWidth: 200 }}><label>설명</label><input name="description" placeholder="채점 관점 설명" /></div>
          <button className="btn btn--ghost">기준 추가</button>
        </div>
      </form>

      {/* 오개념 */}
      <h2 id="misc">오개념 태그 ({misconceptions.length})</h2>
      {misconceptions.map((m) => (
        <div key={m.id} className="card" style={{ marginBottom: 8 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <strong>{m.label}</strong>
              <div className="muted" style={{ fontSize: 14 }}>{m.feedback}</div>
            </div>
            <form action={deleteMisconception}>
              <input type="hidden" name="misconception_id" value={m.id} />
              <input type="hidden" name="module_id" value={module_.id} />
              <button className="btn btn--ghost" style={{ color: '#a23b3b' }}>삭제</button>
            </form>
          </div>
        </div>
      ))}
      <form action={addMisconception} className="card">
        <input type="hidden" name="module_id" value={module_.id} />
        <div className="row">
          <div className="field" style={{ width: 200 }}><label>오개념</label><input name="label" placeholder="예: 목적론" required /></div>
          <div className="field" style={{ flex: 1, minWidth: 200 }}><label>참고 피드백</label><input name="feedback" placeholder="교사 판단 보조 문구" /></div>
          <button className="btn btn--ghost">오개념 추가</button>
        </div>
      </form>

      {/* 진행 + 검토 */}
      <h2 id="review">학생 진행 · 답안 검토</h2>
      {students.length === 0 ? (
        <p className="muted">아직 참여한 학생이 없습니다.</p>
      ) : activities.length === 0 ? (
        <p className="muted">활동을 먼저 추가하세요.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>학생</th>
                {activities.map((a) => <th key={a.id}>{a.code}</th>)}
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td style={{ textAlign: 'left', fontWeight: 600 }}>{s.anon_label}</td>
                  {activities.map((a) => (
                    <td key={a.id} className={hasArtifact(s.id, a.id) ? 'cell-done' : ''}>
                      <Link href={`/teacher/modules/${module_.id}?review=${s.id}:${a.id}#review`} className={hasArtifact(s.id, a.id) ? '' : 'muted'}>
                        {hasArtifact(s.id, a.id) ? '●' : '·'}
                      </Link>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {target && (
        <div className="card" style={{ marginTop: 16 }}>
          <strong>{target.student.anon_label} · {target.activity.code} {target.activity.title}</strong>
          <label style={{ marginTop: 12 }}>학생 답안</label>
          <div style={{ background: 'var(--surface-alt)', borderRadius: 8, padding: 14, whiteSpace: 'pre-wrap', minHeight: 48, marginBottom: 16 }}>
            {target.artifact?.content?.trim() ? target.artifact.content : '아직 제출된 답안이 없습니다.'}
          </div>

          <form action={saveReview}>
            <input type="hidden" name="student_id" value={target.student.id} />
            <input type="hidden" name="activity_id" value={target.activity.id} />
            <input type="hidden" name="module_id" value={module_.id} />

            <label>루브릭 채점 (기준별 1~4점)</label>
            {criteria.length === 0 && <p className="muted">루브릭 기준이 없습니다. 위에서 추가하세요.</p>}
            <div className="grid" style={{ marginBottom: 16 }}>
              {criteria.map((c) => {
                const cur = target!.review?.scores?.[c.id];
                return (
                  <div key={c.id} style={{ borderBottom: '1px dashed var(--border)', paddingBottom: 8 }}>
                    <strong>{c.label}</strong>
                    <div className="muted" style={{ fontSize: 13 }}>{c.description}</div>
                    <div className="row" style={{ marginTop: 6, gap: 16 }}>
                      {[1, 2, 3, 4].map((n) => (
                        <label key={n} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', margin: 0, fontWeight: 400 }}>
                          <input type="radio" name={`score.${c.id}`} value={n} defaultChecked={cur === n} style={{ width: 'auto' }} />{n}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <label>오개념 태그</label>
            <div style={{ marginBottom: 16 }}>
              {misconceptions.length === 0 && <p className="muted">오개념 태그가 없습니다.</p>}
              {misconceptions.map((m) => {
                const on = target!.review?.misconception_ids?.includes(m.id);
                return (
                  <label key={m.id} style={{ display: 'block', margin: '4px 0', fontWeight: 400 }}>
                    <input type="checkbox" name="misconception" value={m.id} defaultChecked={on} style={{ width: 'auto', marginRight: 8 }} />{m.label}
                  </label>
                );
              })}
            </div>

            <div className="field">
              <label>교사 피드백</label>
              <textarea name="feedback" defaultValue={target.review?.feedback ?? ''} />
            </div>
            <button className="btn">리뷰 저장</button>
          </form>
        </div>
      )}
    </main>
  );
}
