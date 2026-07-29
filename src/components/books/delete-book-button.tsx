"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteBookAction } from "@/actions/books";

export function DeleteBookButton({
  bookId,
  classId,
  title,
}: {
  bookId: string;
  classId: string;
  title: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    const ok = window.confirm(
      `‘${title}’ 도서를 삭제할까요?\n이 도서로 수집한 문장·작성한 서평도 함께 삭제됩니다. 되돌릴 수 없습니다.`,
    );
    if (!ok) return;
    setError(null);
    const fd = new FormData();
    fd.set("bookId", bookId);
    fd.set("classId", classId);
    startTransition(async () => {
      const result = await deleteBookAction(fd);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
      >
        {pending ? "삭제 중…" : "삭제"}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      ) : null}
    </span>
  );
}
