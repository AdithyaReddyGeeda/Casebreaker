"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { Evidence } from "@/lib/evidence/types";
import EvidenceCard from "./EvidenceCard";
import EvidenceDetailPanel from "./EvidenceDetailPanel";

interface EvidenceBoardProps {
  evidence: Evidence[];
}

export default function EvidenceBoard({ evidence }: EvidenceBoardProps) {
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);

  const selectedEvidence = useMemo(
    () => evidence.find((item) => item.id === selectedEvidenceId) ?? null,
    [evidence, selectedEvidenceId]
  );

  useEffect(() => {
    if (!selectedEvidenceId) return;
    const stillVisible = evidence.some((item) => item.id === selectedEvidenceId);
    if (!stillVisible) {
      setSelectedEvidenceId(null);
    }
  }, [evidence, selectedEvidenceId]);

  return (
    <div className="relative flex h-full w-[32%] min-w-[280px] max-w-[360px] flex-shrink-0 flex-col border-l border-white/5 bg-black/10">
      <div className="border-b border-white/5 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] tracking-[3px] uppercase text-[#D4A843]">Evidence Board</div>
            <div className="mt-1 text-[9px] text-[#556677]">{evidence.length} logged exhibits</div>
          </div>
          <div className="text-[8px] tracking-[2px] uppercase text-[#445566]">Case file</div>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {evidence.length === 0 ? (
          <div className="rounded-md border border-white/5 px-3 py-4 text-center text-[10px] italic text-[#556677]">
            No evidence has been logged yet. Search the rooms to populate the board.
          </div>
        ) : (
          evidence.map((item) => (
            <EvidenceCard
              key={item.id}
              evidence={item}
              selected={selectedEvidenceId === item.id}
              onClick={() =>
                setSelectedEvidenceId((current) => (current === item.id ? null : item.id))
              }
            />
          ))
        )}
      </div>

      <AnimatePresence>
        {selectedEvidence ? (
          <EvidenceDetailPanel
            evidence={selectedEvidence}
            onClose={() => setSelectedEvidenceId(null)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
