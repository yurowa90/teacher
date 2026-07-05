'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SAMPLE_MODULE } from '@/lib/seed';

// ---------- 인증 ----------
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

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/teacher');
  return { supabase, user: data.user! };
}

// ---------- 반 ----------
export async function createClass(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim() || '새 반';
  const { supabase, user } = await requireUser();
  await supabase.from('profiles').upsert({ id: user.id, role: 'teacher' });
  const { data: cls, error } = await supabase
    .from('classes')
    .insert({ teacher_id: user.id, name })
    .select()
    .single();
  if (error || !cls) redirect('/teacher/dashboard?error=' + encodeURIComponent(error?.message ?? '반 생성 실패'));
  revalidatePath('/teacher/dashboard');
  redirect('/teacher/dashboard?class=' + cls.id);
}

// ---------- 모듈 ----------
export async function createModule(formData: FormData) {
  const classId = String(formData.get('class_id') ?? '');
  const title = String(formData.get('title') ?? '').trim() || '새 단원';
  const { supabase } = await requireUser();
  const { data: mod, error } = await supabase
    .from('modules')
    .insert({ class_id: classId, title })
    .select()
    .single();
  if (error || !mod) redirect('/teacher/dashboard?class=' + classId + '&error=' + encodeURIComponent(error?.message ?? '단원 생성 실패'));
  redirect('/teacher/modules/' + mod.id);
}

// 샘플(예시) 모듈 통째로 생성
export async function addSampleModule(formData: FormData) {
  const classId = String(formData.get('class_id') ?? '');
  const { supabase } = await requireUser();
  const s = SAMPLE_MODULE;

  const { data: mod, error } = await supabase
    .from('modules')
    .insert({
      class_id: classId,
      title: s.title,
      subject: s.subject,
      standard_code: s.standardCode,
      book_title: s.bookTitle,
      intro: s.intro
    })
    .select()
    .single();
  if (error || !mod) redirect('/teacher/dashboard?class=' + classId + '&error=' + encodeURIComponent(error?.message ?? '샘플 생성 실패'));

  await supabase.from('activities').insert(
    s.activities.map((a, i) => ({
      module_id: mod.id,
      code: a.code,
      level: a.level,
      type: a.type,
      title: a.title,
      prompt: a.prompt,
      resource: a.resource ?? null,
      sort_order: i
    }))
  );
  await supabase.from('rubric_criteria').insert(
    s.rubric.map((r, i) => ({ module_id: mod.id, label: r.label, description: r.description, sort_order: i }))
  );
  await supabase.from('misconceptions').insert(
    s.misconceptions.map((m, i) => ({ module_id: mod.id, label: m.label, feedback: m.feedback, sort_order: i }))
  );

  redirect('/teacher/modules/' + mod.id);
}

export async function updateModule(formData: FormData) {
  const id = String(formData.get('module_id') ?? '');
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from('modules')
    .update({
      title: String(formData.get('title') ?? '').trim(),
      subject: String(formData.get('subject') ?? '').trim(),
      standard_code: String(formData.get('standard_code') ?? '').trim(),
      book_title: String(formData.get('book_title') ?? '').trim(),
      intro: String(formData.get('intro') ?? '').trim()
    })
    .eq('id', id);
  redirect('/teacher/modules/' + id + (error ? '?error=' + encodeURIComponent(error.message) : '?saved=1'));
}

export async function deleteModule(formData: FormData) {
  const id = String(formData.get('module_id') ?? '');
  const classId = String(formData.get('class_id') ?? '');
  const { supabase } = await requireUser();
  await supabase.from('modules').delete().eq('id', id);
  redirect('/teacher/dashboard?class=' + classId);
}

// ---------- 활동 ----------
export async function addActivity(formData: FormData) {
  const moduleId = String(formData.get('module_id') ?? '');
  const { supabase } = await requireUser();
  const { count } = await supabase
    .from('activities')
    .select('id', { count: 'exact', head: true })
    .eq('module_id', moduleId);
  const { error } = await supabase.from('activities').insert({
    module_id: moduleId,
    code: String(formData.get('code') ?? '').trim() || `Q${(count ?? 0) + 1}`,
    level: String(formData.get('level') ?? '').trim(),
    type: String(formData.get('type') ?? 'essay').trim() || 'essay',
    title: String(formData.get('title') ?? '').trim() || '새 활동',
    prompt: String(formData.get('prompt') ?? '').trim(),
    sort_order: count ?? 0
  });
  redirect('/teacher/modules/' + moduleId + (error ? '?error=' + encodeURIComponent(error.message) : '#activities'));
}

export async function updateActivity(formData: FormData) {
  const id = String(formData.get('activity_id') ?? '');
  const moduleId = String(formData.get('module_id') ?? '');
  const resourceText = String(formData.get('resource_text') ?? '').trim();
  const clearResource = formData.get('clear_resource') != null;
  const { supabase } = await requireUser();

  const patch: Record<string, unknown> = {
    code: String(formData.get('code') ?? '').trim(),
    level: String(formData.get('level') ?? '').trim(),
    type: String(formData.get('type') ?? 'essay').trim() || 'essay',
    title: String(formData.get('title') ?? '').trim(),
    prompt: String(formData.get('prompt') ?? '').trim()
  };
  // 보조 자료: 지우기 체크 시 제거, 텍스트 입력 시 교체, 둘 다 없으면 기존 유지(표 보존).
  if (clearResource) patch.resource = null;
  else if (resourceText) patch.resource = { type: 'text', body: resourceText };

  const { error } = await supabase.from('activities').update(patch).eq('id', id);
  redirect('/teacher/modules/' + moduleId + (error ? '?error=' + encodeURIComponent(error.message) : '#activities'));
}

export async function deleteActivity(formData: FormData) {
  const id = String(formData.get('activity_id') ?? '');
  const moduleId = String(formData.get('module_id') ?? '');
  const { supabase } = await requireUser();
  await supabase.from('activities').delete().eq('id', id);
  redirect('/teacher/modules/' + moduleId + '#activities');
}

// ---------- 루브릭 ----------
export async function addCriterion(formData: FormData) {
  const moduleId = String(formData.get('module_id') ?? '');
  const { supabase } = await requireUser();
  const { count } = await supabase
    .from('rubric_criteria')
    .select('id', { count: 'exact', head: true })
    .eq('module_id', moduleId);
  await supabase.from('rubric_criteria').insert({
    module_id: moduleId,
    label: String(formData.get('label') ?? '').trim() || '새 기준',
    description: String(formData.get('description') ?? '').trim(),
    sort_order: count ?? 0
  });
  redirect('/teacher/modules/' + moduleId + '#rubric');
}

export async function deleteCriterion(formData: FormData) {
  const id = String(formData.get('criterion_id') ?? '');
  const moduleId = String(formData.get('module_id') ?? '');
  const { supabase } = await requireUser();
  await supabase.from('rubric_criteria').delete().eq('id', id);
  redirect('/teacher/modules/' + moduleId + '#rubric');
}

// ---------- 오개념 ----------
export async function addMisconception(formData: FormData) {
  const moduleId = String(formData.get('module_id') ?? '');
  const { supabase } = await requireUser();
  const { count } = await supabase
    .from('misconceptions')
    .select('id', { count: 'exact', head: true })
    .eq('module_id', moduleId);
  await supabase.from('misconceptions').insert({
    module_id: moduleId,
    label: String(formData.get('label') ?? '').trim() || '새 오개념',
    feedback: String(formData.get('feedback') ?? '').trim(),
    sort_order: count ?? 0
  });
  redirect('/teacher/modules/' + moduleId + '#misc');
}

export async function deleteMisconception(formData: FormData) {
  const id = String(formData.get('misconception_id') ?? '');
  const moduleId = String(formData.get('module_id') ?? '');
  const { supabase } = await requireUser();
  await supabase.from('misconceptions').delete().eq('id', id);
  redirect('/teacher/modules/' + moduleId + '#misc');
}

// ---------- 리뷰(교사 최종 판단) ----------
export async function saveReview(formData: FormData) {
  const studentId = String(formData.get('student_id') ?? '');
  const activityId = String(formData.get('activity_id') ?? '');
  const moduleId = String(formData.get('module_id') ?? '');
  const feedback = String(formData.get('feedback') ?? '');
  const misconceptionIds = formData.getAll('misconception').map(String);

  const scores: Record<string, number> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith('score.')) {
      const n = Number(v);
      if (!Number.isNaN(n) && n >= 1 && n <= 4) scores[k.slice('score.'.length)] = n;
    }
  }

  const { supabase, user } = await requireUser();
  const { error } = await supabase.from('reviews').upsert(
    { student_id: studentId, activity_id: activityId, teacher_id: user.id, scores, misconception_ids: misconceptionIds, feedback },
    { onConflict: 'student_id,activity_id' }
  );

  const back = `/teacher/modules/${moduleId}?review=${studentId}:${activityId}`;
  if (error) redirect(back + '&error=' + encodeURIComponent(error.message));
  revalidatePath('/teacher/modules/' + moduleId);
  redirect(back + '&saved=1#review');
}
