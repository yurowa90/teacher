'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ACTIVITIES_SEED, MODULE_SEED } from '@/lib/seed';

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect('/teacher?error=' + encodeURIComponent(error.message));
  redirect('/teacher/dashboard');
}

export async function signUp(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) redirect('/teacher?error=' + encodeURIComponent(error.message));
  // 이메일 확인이 꺼져 있으면 세션이 바로 생기고, 켜져 있으면 확인 후 로그인.
  if (data.session) {
    await supabase.from('profiles').upsert({ id: data.user!.id, role: 'teacher' });
    redirect('/teacher/dashboard');
  }
  redirect('/teacher?info=' + encodeURIComponent('확인 이메일을 보냈습니다. 인증 후 로그인하세요.'));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/teacher');
}

// 반 생성 + 모듈/활동 시드
export async function createClass(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim() || '새 반';
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect('/teacher');

  await supabase.from('profiles').upsert({ id: user!.id, role: 'teacher' });

  const { data: cls, error: clsErr } = await supabase
    .from('classes')
    .insert({ teacher_id: user!.id, name })
    .select()
    .single();
  if (clsErr || !cls) redirect('/teacher/dashboard?error=' + encodeURIComponent(clsErr?.message ?? '반 생성 실패'));

  const { data: mod, error: modErr } = await supabase
    .from('modules')
    .insert({
      class_id: cls.id,
      subject: MODULE_SEED.subject,
      standard_code: MODULE_SEED.standardCode,
      title: MODULE_SEED.title
    })
    .select()
    .single();
  if (modErr || !mod) redirect('/teacher/dashboard?error=' + encodeURIComponent(modErr?.message ?? '모듈 생성 실패'));

  const rows = ACTIVITIES_SEED.map((a, i) => ({
    module_id: mod.id,
    code: a.code,
    level: a.level,
    type: a.type,
    title: a.title,
    prompt: a.prompt,
    sort_order: i
  }));
  await supabase.from('activities').insert(rows);

  revalidatePath('/teacher/dashboard');
  redirect('/teacher/dashboard');
}

// 리뷰 저장(루브릭/오개념/피드백). 교사가 최종 판단자.
export async function saveReview(formData: FormData) {
  const studentId = String(formData.get('student_id') ?? '');
  const activityId = String(formData.get('activity_id') ?? '');
  const feedback = String(formData.get('feedback') ?? '');
  const misconceptionIds = formData.getAll('misconception').map(String);

  const scores: Record<string, number> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith('score.')) {
      const n = Number(v);
      if (!Number.isNaN(n) && n >= 1 && n <= 4) scores[k.slice('score.'.length)] = n;
    }
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect('/teacher');

  const { error } = await supabase.from('reviews').upsert(
    {
      student_id: studentId,
      activity_id: activityId,
      teacher_id: user!.id,
      scores,
      misconception_ids: misconceptionIds,
      feedback
    },
    { onConflict: 'student_id,activity_id' }
  );

  const back = `/teacher/dashboard?review=${studentId}:${activityId}`;
  if (error) redirect(back + '&error=' + encodeURIComponent(error.message));
  revalidatePath('/teacher/dashboard');
  redirect(back + '&saved=1');
}
