import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// 요청마다 Supabase 세션을 갱신하고 쿠키를 이어줍니다.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        }
      }
    }
  );

  // getUser() 호출로 만료 토큰을 갱신합니다.
  await supabase.auth.getUser();

  return response;
}
