import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ClassRow, ModuleRow, StudentRow } from '@/lib/types';
import { createClass, createModule, addSampleModule, signOut } from '../actions';

export default async function Dashboard({
  searchParams
}: {
  searchParams: Promise<{ class?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/teacher');

  const { data: classesData } = await supabase.from('classes').select('*').order('created_at');
  const classes = (classesData ?? []) as ClassRow[];
  const cls = classes.find((c) => c.id === sp.class) ?? classes[0];

  let modules: ModuleRow[] = [];
  let students: StudentRow[] = [];
  if (cls) {
    const { data: mods } = await supabase.from('modules').select('*').eq('class_id', cls.id).order('created_at');
    modules = (mods ?? []) as ModuleRow[];
    const { data: studs } = await supabase.from('students').select('*').eq('class_id', cls.id).order('anon_label');
    students = (studs ?? []) as StudentRow[];
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

      {/* 반 선택 / 생성 */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="row" style={{ gap: 8 }}>
            {classes.map((c) => (
              <Link
                key={c.id}
                href={`/teacher/dashboard?class=${c.id}`}
                className={c.id === cls?.id ? 'btn' : 'btn btn--ghost'}
              >
                {c.name}
              </Link>
            ))}
          </div>
          <form action={createClass} className="row" style={{ gap: 8 }}>
            <input name="name" placeholder="새 반 이름" required style={{ width: 160 }} />
            <button className="btn btn--ghost">반 추가</button>
          </form>
        </div>
      </div>

      {!cls ? (
        <p className="muted" style={{ marginTop: 16 }}>먼저 반을 만드세요.</p>
      ) : (
        <>
          <div className="card" style={{ marginTop: 16 }}>
            <strong>{cls.name}</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              초대 코드 <span className="pill">{cls.invite_code}</span> · 학생 {students.length}명 · 학생 참여: <code>/student</code>
            </p>
          </div>

          <h2>단원(모듈)</h2>
          <p className="muted">교사가 임의의 책·성취기준으로 단원을 만들고 활동·루브릭·오개념을 저작합니다.</p>

          {modules.length === 0 ? (
            <p className="muted">아직 단원이 없습니다. 빈 단원을 만들거나 예시(샘플)를 불러오세요.</p>
          ) : (
            <div className="grid grid-2">
              {modules.map((m) => (
                <Link key={m.id} href={`/teacher/modules/${m.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <strong>{m.title}</strong>
                  <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>
                    {m.book_title || '책 미지정'} {m.standard_code && `· ${m.standard_code}`}
                  </p>
                </Link>
              ))}
            </div>
          )}

          <div className="row" style={{ marginTop: 16, gap: 8 }}>
            <form action={createModule} className="row" style={{ gap: 8 }}>
              <input type="hidden" name="class_id" value={cls.id} />
              <input name="title" placeholder="새 단원 제목" required style={{ width: 220 }} />
              <button className="btn">빈 단원 만들기</button>
            </form>
            <form action={addSampleModule}>
              <input type="hidden" name="class_id" value={cls.id} />
              <button className="btn btn--ghost">샘플(예시) 단원 불러오기</button>
            </form>
          </div>
        </>
      )}
    </main>
  );
}
