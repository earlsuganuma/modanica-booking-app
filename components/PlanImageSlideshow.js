"use client";

import { useEffect, useState } from "react";

// プラン詳細ページ用のフェード切替スライドショー。
// 画像が1枚も無い場合は何も表示しない（呼び出し側でも images.length チェックしているが、念のためここでも判定する）。
export default function PlanImageSlideshow({ images }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!images || images.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [images]);

  if (!images || images.length === 0) return null;

  return (
    <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden bg-black/5">
      {images.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out"
          style={{ opacity: i === index ? 1 : 0 }}
        />
      ))}
      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`${i + 1}枚目を表示`}
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: i === index ? "#fff" : "rgba(255,255,255,0.5)" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
