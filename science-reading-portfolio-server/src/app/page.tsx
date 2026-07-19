import Link from 'next/link';

export default function Home() {
  return (
    <main className="container">
      <h1>과학 독서·논술 포트폴리오</h1>
      <p className="muted">성취기준 기반 · 서버형 MVP (Next.js + Supabase)</p>

      <div className="notice" style={{ margin: '16px 0' }}>
        실명·학번은 수집하지 않습니다. AI 자동채점·세특 자동 작성은 없으며, 교사가 최종 평가자입니다.
      </div>

      <div className="grid grid-2" style={{ marginTop: 24 }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>교사</h2>
          <p className="muted">반을 만들고 모듈을 배정하며, 학생 응답을 확인하고 루브릭·오개념·피드백을 기록합니다.</p>
          <Link className="btn" href="/teacher">교사로 시작</Link>
        </div>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>학생</h2>
          <p className="muted">반 초대 코드와 익명 라벨로 참여해 활동을 작성합니다. (익명 로그인)</p>
          <Link className="btn" href="/student">학생으로 시작</Link>
        </div>
      </div>
    </main>
  );
}
