"use client";

import { useMemo, useState } from "react";
import {
  buildEvidencePlaceholderImage,
} from "@/lib/evidence/images";
import { useGameStore } from "@/lib/store";
import { getDiscoveredEvidence } from "@/lib/evidence/sampleEvidence";
import type { Evidence } from "@/lib/evidence/types";

const STATUS_STYLES: Record<Evidence["status"], string> = {
  New: "bg-[#1B2940] text-[#8FB2D8] border border-white/10",
  Lead: "bg-[#17202F] text-[#93A4BA] border border-white/10",
  Reviewed: "bg-white/5 text-[#B3BECF] border border-white/10",
  "Key Evidence": "bg-[#2B2414] text-[#D8BC79] border border-[#5B4B25]",
};

const IMPORTANCE_STYLES: Record<Evidence["importance"], string> = {
  low: "text-[#7E8A99]",
  medium: "text-[#AAB7C8]",
  high: "text-[#D4A843]",
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/10 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[2px] text-[#6E7C92]">{label}</div>
      <div
        className="mt-1 text-sm leading-relaxed text-[#D6DCE7]"
        style={{ fontFamily: "Georgia, serif" }}
      >
        {value}
      </div>
    </div>
  );
}

function EvidenceImageFrame({
  evidence,
  size,
}: {
  evidence: Evidence;
  size: "card" | "detail";
}) {
  const isDetail = size === "detail";
  const placeholder = buildEvidencePlaceholderImage(
    {
      title: evidence.title,
      category: evidence.category,
      status: evidence.status,
    },
    { variant: isDetail ? "detail" : "card" }
  );
  const imageSrc = evidence.imageUrl || placeholder;
  const showLoading = evidence.imageStatus === "generating";

  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-white/10 bg-black/20 ${
        isDetail ? "aspect-square w-full" : "h-16 w-16 shrink-0"
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

export default function EvidenceBoard() {
  const {
    evidence,
    discoveredEvidence,
    selectedEvidenceIds,
    selectedSuspect,
    interrogationHistories,
    toggleEvidenceSelection,
    markEvidenceReviewed,
    setEvidenceForAccusation,
  } = useGameStore();
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);

  const evidenceItems = useMemo(
    () => getDiscoveredEvidence(evidence, discoveredEvidence),
    [discoveredEvidence, evidence]
  );

  const displayedEvidence = selectedEvidence
    ? evidenceItems.find((item) => item.id === selectedEvidence.id) ?? null
    : null;

  const hasInterrogationMessages =
    selectedSuspect != null &&
    (interrogationHistories[selectedSuspect]?.length ?? 0) > 0;

  const contradictionActive =
    displayedEvidence && selectedSuspect
      ? displayedEvidence.contradicts.includes(selectedSuspect)
      : false;

  return (
    <aside className="flex h-full w-[42%] min-w-[200px] max-w-[300px] flex-shrink-0 flex-col overflow-hidden rounded-none border-l border-white/10 bg-[#0B1526] text-white md:w-[34%] md:min-w-[240px] md:max-w-[360px]">
      <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0B1526]/95 px-4 py-4 backdrop-blur">
        <div className="text-sm uppercase tracking-[3px] text-[#D4A843]">Evidence Board</div>
        <div className="mt-1 text-xs text-[#6E7C92]">Collected Clues</div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!displayedEvidence ? (
          <div className="space-y-3 px-4 py-4">
            {evidenceItems.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm italic text-[#6E7C92]">
                Search the manor to collect evidence for interrogation and accusation.
              </div>
            ) : null}

            {evidenceItems.map((item) => {
              const selected = selectedEvidenceIds.includes(item.id);
              const reviewed = item.status === "Reviewed" || item.status === "Key Evidence";
              const open = selectedEvidence?.id === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedEvidence(item);
                    markEvidenceReviewed(item.id);
                  }}
                  className="w-full rounded-lg border p-3 text-left transition-all duration-200 hover:border-white/20 hover:bg-white/[0.05]"
                  style={{
                    background:
                      open
                        ? "rgba(255,255,255,.05)"
                        : selected
                          ? "rgba(212,168,67,.08)"
                          : "rgba(255,255,255,.03)",
                    borderColor: item.isKey
                      ? "rgba(212,168,67,.18)"
                      : selected
                        ? "rgba(212,168,67,.28)"
                        : "rgba(255,255,255,.1)",
                    boxShadow:
                      selected || open
                        ? "0 0 0 1px rgba(212,168,67,.1) inset"
                        : "none",
                  }}
                >
                  <div className="flex items-start gap-3">
                    <EvidenceImageFrame evidence={item} size="card" />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div
                            className="text-sm font-semibold leading-snug text-[#E8ECF3]"
                            style={{ fontFamily: "Georgia, serif" }}
                          >
                            {item.title}
                          </div>
                          <div className="mt-1 text-[11px] uppercase tracking-[2px] text-[#6E7C92]">
                            {item.category}
                          </div>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[10px] uppercase tracking-[1.8px] ${STATUS_STYLES[item.status]}`}
                        >
                          {item.status === "Key Evidence" ? "Key" : item.status}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-3 text-[11px]">
                        <span className={IMPORTANCE_STYLES[item.importance]}>
                          {item.importance} importance
                        </span>
                        <div className="flex items-center gap-2">
                          {reviewed ? (
                            <span className="text-[#8FA1B8]">Reviewed</span>
                          ) : null}
                          {selected ? (
                            <span className="rounded-full border border-[#5B4B25] bg-[#2B2414] px-2 py-0.5 text-[10px] uppercase tracking-[1.5px] text-[#D8BC79]">
                              Selected
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-4">
            <button
              onClick={() => setSelectedEvidence(null)}
              className="mb-4 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] uppercase tracking-[2px] text-[#B7C2D3] transition-colors hover:bg-white/[0.06]"
            >
              Back
            </button>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-all duration-200">
              <EvidenceImageFrame evidence={displayedEvidence} size="detail" />

              <div className="flex items-start justify-between gap-3">
                <div className="mt-4">
                  <div
                    className="text-lg font-semibold text-[#F1F3F7]"
                    style={{ fontFamily: "Georgia, serif" }}
                  >
                    {displayedEvidence.title}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-[2px] text-[#6E7C92]">
                    {displayedEvidence.category}
                  </div>
                </div>

                <span
                  className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[1.8px] ${STATUS_STYLES[displayedEvidence.status]}`}
                >
                  {displayedEvidence.status === "Key Evidence" ? "Key" : displayedEvidence.status}
                </span>
              </div>

              {contradictionActive ? (
                <div className="mt-4 rounded-md border border-[#5B3B30] bg-[#2A1715] px-3 py-2 text-[11px] leading-snug tracking-[0.02em] text-[#D9A08E]">
                  {hasInterrogationMessages
                    ? "This evidence contradicts what they’ve said in this interview."
                    : "This exhibit cuts against this suspect’s account in the case file — not necessarily something they’ve said aloud yet."}
                </div>
              ) : null}

              {displayedEvidence.imageStatus === "failed" ? (
                <div className="mt-3 rounded-md border border-white/10 bg-black/10 px-3 py-2 text-[10px] uppercase tracking-[1.8px] text-[#8FA1B8]">
                  Image unavailable. Using placeholder exhibit card.
                </div>
              ) : null}

              <div className="mt-4 grid gap-3">
                <DetailRow label="Description" value={displayedEvidence.description} />
                <DetailRow label="Where Found" value={displayedEvidence.whereFound} />
                <DetailRow label="When Found" value={displayedEvidence.whenFound} />
                <DetailRow label="Related Suspect" value={displayedEvidence.relatedSuspect} />
                <DetailRow label="Why It Matters" value={displayedEvidence.whyItMatters} />
                <DetailRow
                  label="Contradiction Notes"
                  value={displayedEvidence.contradictionNotes}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => toggleEvidenceSelection(displayedEvidence.id)}
                  className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] uppercase tracking-[2px] transition-colors hover:bg-white/[0.06]"
                  style={{
                    color: selectedEvidenceIds.includes(displayedEvidence.id) ? "#D4A843" : "#B7C2D3",
                  }}
                >
                  {selectedEvidenceIds.includes(displayedEvidence.id)
                    ? "Selected for Interrogation"
                    : "Select Evidence"}
                </button>

                <button
                  onClick={() =>
                    setEvidenceForAccusation(
                      displayedEvidence.id,
                      !displayedEvidence.selectedForAccusation
                    )
                  }
                  className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] uppercase tracking-[2px] transition-colors hover:bg-white/[0.06]"
                  style={{
                    color: displayedEvidence.selectedForAccusation ? "#D4A843" : "#B7C2D3",
                  }}
                >
                  {displayedEvidence.selectedForAccusation
                    ? "Remove from Accusation"
                    : "Use in Accusation"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
