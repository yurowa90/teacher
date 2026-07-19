'use client';

import { createBrowserClient } from '@supabase/ssr';

// 브라우저(클라이언트 컴포넌트)용 Supabase 클라이언트.
// anon 키만 사용하며, 실제 접근 제어는 DB의 RLS 정책이 담당합니다.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
