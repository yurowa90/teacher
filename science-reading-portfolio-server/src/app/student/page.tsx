'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function StudentJoin() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();

    // 익명 로그인(세션이 없으면)
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) {
      const { error: anonErr } = await supabase.auth.signInAnonymously();
      if (anonErr) {
        setError('익명 로그인 실패: ' + anonErr.message);
        setBusy(false);
        return;
      }
    }

    // 초대 코드로 반 합류 (security definer RPC)
    const { error: rpcErr } = await supabase.rpc('join_class', {
      p_code: code.trim(),
      p_label: label.trim()
    });
    if (rpcErr) {
      setError(rpcErr.message);
      setBusy(false);
      return;
    }
    router.push('/student/work');
  }

  return (
    <main className="container" style={{ maxWidth: 460 }}>
      <p className="muted"><Link href="/">← 처음으로</Link></p>
      <h1>학생 참여</h1>
      <p className="muted">교사가 알려준 초대 코드와 익명 라벨(예: S-001)로 참여합니다. 실명·학번은 입력하지 않습니다.</p>

      {error && <p className="error">{error}</p>}

      <form className="card" style={{ marginTop: 16 }} onSubmit={join}>
        <div className="field">
          <label htmlFor="code">초대 코드</label>
          <input id="code" value={code} onChange={(e) => setCode(e.target.value)} required placeholder="예: ABCD1234" />
        </div>
        <div className="field">
          <label htmlFor="label">익명 라벨</label>
          <input id="label" value={label} onChange={(e) => setLabel(e.target.value)} required placeholder="예: S-001" />
        </div>
        <button className="btn" disabled={busy}>{busy ? '참여 중…' : '참여하기'}</button>
      </form>
    </main>
  );
}
