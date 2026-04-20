"use client";

import { buildEvidencePlaceholderImage } from "@/lib/evidence/images";
import type { Evidence } from "@/lib/evidence/types";

type Size = "card" | "detail" | "room";

export function EvidenceImageFrame({
  evidence,
  size,
}: {
  evidence: Pick<Evidence, "title" | "category" | "status" | "imageUrl" | "imageStatus">;
  size: Size;
}) {
  const isDetail = size === "detail";
  const isRoom = size === "room";
  const placeholder = buildEvidencePlaceholderImage(
    {
      title: evidence.title,
      category: evidence.category,
      status: evidence.status,
    },
    { variant: isDetail || isRoom ? "detail" : "card" }
  );
  const imageSrc = evidence.imageUrl || placeholder;
  const showLoading = evidence.imageStatus === "generating";

  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-white/10 bg-black/20 ${
        isDetail
          ? "aspect-square w-full"
          : isRoom
            ? "h-40 w-40 shrink-0 sm:h-44 sm:w-44"
            : "h-16 w-16 shrink-0"
      }`}
    >
      <img
        src={imageSrc}
        alt={evidence.title}
        className="h-full w-full object-cover"
      />
      {showLoading ? (
        <>
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/5 via-transparent to-white/10" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 py-2">
            <div className="text-[10px] uppercase tracking-[2px] text-[#E8ECF3]">
              Generating image…
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
