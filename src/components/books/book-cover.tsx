"use client";

import { useState } from "react";

/**
 * 도서 표지. 외부 임의 URL 이므로 일반 img 를 쓰되, 로드 실패 시
 * 깨진 이미지 대신 깔끔한 자리표시(책 아이콘)를 보여준다.
 * referrerPolicy=no-referrer 로 일부 사이트의 핫링크 차단을 우회한다.
 */
export function BookCover({ url, title }: { url: string | null; title: string }) {
  const [failed, setFailed] = useState(false);
  const box = "flex h-20 w-14 flex-shrink-0 items-center justify-center rounded bg-stone-100 text-stone-400";

  if (!url || failed) {
    return (
      <div className={box} aria-hidden>
        <span className="text-xl">📖</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={`${title} 표지`}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-20 w-14 flex-shrink-0 rounded object-cover"
    />
  );
}
