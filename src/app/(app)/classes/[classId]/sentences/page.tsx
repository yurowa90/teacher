import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader, LinkButton, EmptyState } from "@/components/ui";
import { SentenceCardView } from "@/components/sentences/sentence-card-view";
import { requireProfile } from "@/lib/auth/session";
import { getClass } from "@/features/classes/queries";
import { getClassBooks } from "@/features/books/queries";
import {
  getMySentences,
  getClassSentencesForTeacher,
} from "@/features/sentences/queries";

export const metadata: Metadata = { title: "문장 수집" };

export default async function SentencesPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ bookId?: string }>;
}) {
  const { classId } = await params;
  const { bookId } = await searchParams;
  const { userId } = await requireProfile();

  const klass = await getClass(classId);
  if (!klass) notFound();
  const isOwnerTeacher = klass.teacher_id === userId;

  const books = await getClassBooks(classId);

  return (
    <div>
      <PageHeader
        title={isOwnerTeacher ? "학급 문장 기록" : "내 문장 카드"}
        description={klass.name}
        action={<LinkButton href={`/classes/${classId}/sentences/new`}>문장 수집</LinkButton>}
      />

      {books.length > 1 ? (
        <nav className="mb-4 flex flex-wrap gap-2 text-sm">
          <FilterLink classId={classId} active={!bookId} label="전체" />
          {books.map((b) => (
            <FilterLink
              key={b.id}
              classId={classId}
              bookId={b.id}
              active={bookId === b.id}
              label={b.title}
            />
          ))}
        </nav>
      ) : null}

      {isOwnerTeacher ? (
        <TeacherList classId={classId} viewerId={userId} />
      ) : (
        <StudentList classId={classId} bookId={bookId} />
      )}
    </div>
  );
}

function FilterLink({
  classId,
  bookId,
  active,
  label,
}: {
  classId: string;
  bookId?: string;
  active: boolean;
  label: string;
}) {
  const href = bookId
    ? `/classes/${classId}/sentences?bookId=${bookId}`
    : `/classes/${classId}/sentences`;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-full border px-3 py-1 ${
        active ? "border-brand bg-brand-soft font-semibold text-emerald-900" : "border-stone-300 text-stone-600"
      }`}
    >
      {label}
    </Link>
  );
}

async function StudentList({ classId, bookId }: { classId: string; bookId?: string }) {
  const sentences = await getMySentences(classId, bookId);
  if (sentences.length === 0) {
    return (
      <EmptyState
        title="아직 수집한 문장이 없습니다"
        description="‘문장 수집’ 버튼으로 첫 문장을 기록해 보세요."
      />
    );
  }
  return (
    <ul className="space-y-3">
      {sentences.map((s) => (
        <li key={s.id}>
          <SentenceCardView sentence={s} editable />
        </li>
      ))}
    </ul>
  );
}

async function TeacherList({ classId, viewerId }: { classId: string; viewerId: string }) {
  const sentences = await getClassSentencesForTeacher(classId);
  if (sentences.length === 0) {
    return <EmptyState title="아직 수집한 문장이 없습니다" />;
  }
  return (
    <ul className="space-y-3">
      {sentences.map((s) => (
        <li key={s.id}>
          {/* 교사 본인이 수집한 문장은 수정·삭제할 수 있다. */}
          <SentenceCardView
            sentence={s}
            authorName={s.authorName}
            editable={s.user_id === viewerId}
          />
        </li>
      ))}
    </ul>
  );
}
