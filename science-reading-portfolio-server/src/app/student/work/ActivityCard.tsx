'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ActivityRow } from '@/lib/types';

interface Props {
  studentId: string;
  activity: ActivityRow;
  initialContent: string;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function ActivityCard({ studentId, activity, initialContent }: Props) {
  const [content, setContent] = useState(initialContent);
  const [state, setState] = useState<SaveState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (content === initialContent && state === 'idle') return;
    if (timer.current) clearTimeout(timer.current);
    setState('saving');
    timer.current = setTimeout(async () => {
      const supabase = createClient();
      const stage = activity.code === 'B3' ? 'revised' : 'initial';
      const { error } = await supabase.from('artifacts').upsert(
        { student_id: studentId, activity_id: activity.id, content, stage, updated_at: new Date().toISOString() },
        { onConflict: 'student_id,activity_id' }
      );
      setState(error ? 'error' : 'saved');
    }, 700);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  const statusText =
    state === 'saving' ? '저장 중…' : state === 'saved' ? '자동 저장됨' : state === 'error' ? '저장 실패' : '';

  const resource = activity.resource;

  return (
    <article className="card">
      <div className="row" style={{ gap: 8, marginBottom: 6 }}>
        <span className="pill">{activity.code}</span>
        {activity.level && <span className="muted" style={{ fontSize: 13 }}>{activity.level}</span>}
      </div>
      <strong>{activity.title}</strong>
      {activity.prompt && <p className="muted" style={{ marginTop: 4 }}>{activity.prompt}</p>}

      {resource?.type === 'table' && (
        <div style={{ overflowX: 'auto', margin: '10px 0' }}>
          <table>
            <thead>
              <tr>{resource.headers.map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {resource.rows.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {resource?.type === 'text' && (
        <div style={{ background: 'var(--surface-alt)', borderRadius: 8, padding: 12, whiteSpace: 'pre-wrap', margin: '10px 0', fontSize: 14 }}>
          {resource.body}
        </div>
      )}

      <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="여기에 작성하세요…" />
      <div className="muted" style={{ fontSize: 13, marginTop: 6, color: state === 'error' ? '#a23b3b' : undefined }}>
        {statusText}
      </div>
    </article>
  );
}
