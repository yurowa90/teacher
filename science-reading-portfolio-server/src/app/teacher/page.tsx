import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { signIn, signUp } from './actions';

export default async function TeacherAuthPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; info?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect('/teacher/dashboard');

  return (
    <main className="container" style={{ maxWidth: 460 }}>
      <p className="muted"><Link href="/">← 처음으로</Link></p>
      <h1>교사 로그인</h1>
      <p className="muted">이메일 계정으로 로그인하거나 새로 가입하세요.</p>

      {sp.error && <p className="error">{sp.error}</p>}
      {sp.info && <p className="notice" style={{ margin: '12px 0' }}>{sp.info}</p>}

      <form className="card" style={{ marginTop: 16 }}>
        <div className="field">
          <label htmlFor="email">이메일</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="password">비밀번호</label>
          <input id="password" name="password" type="password" required minLength={6} autoComplete="current-password" />
        </div>
        <div className="row">
          <button className="btn" formAction={signIn}>로그인</button>
          <button className="btn btn--ghost" formAction={signUp}>가입</button>
        </div>
      </form>
    </main>
  );
}
