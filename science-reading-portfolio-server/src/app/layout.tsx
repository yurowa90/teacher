import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '과학 독서·논술 포트폴리오 (서버형)',
  description: '성취기준 기반 과학 독서·논술 포트폴리오 — Stage 3 서버형 MVP'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
