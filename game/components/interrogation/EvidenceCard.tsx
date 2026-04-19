"use client";

import type { Evidence } from "@/lib/evidence/types";

interface EvidenceCardProps {
  evidence: Evidence;
  selected: boolean;
  onClick: () => void;
}

export default function EvidenceCard({ evidence, selected, onClick }: EvidenceCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-md border p-3 text-left transition-all"
      style={{
        background: selected ? "rgba(212,168,67,.08)" : "rgba(255,255,255,.02)",
        borderColor: selected ? "rgba(212,168,67,.24)" : "rgba(255,255,255,.06)",
        boxShadow: selected ? "0 6px 16px rgba(0,0,0,.2)" : "none",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className="text-[11px] font-semibold leading-snug text-[#E8E0D0]"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {evidence.title}
          </div>
          <div className="mt-1 text-[8px] tracking-[2px] uppercase text-[#667788]">
            {evidence.category}
          </div>
        </div>
        <span
          className="rounded px-1.5 py-0.5 text-[8px] tracking-[1.8px] uppercase"
          style={{
            background: "rgba(212,168,67,.08)",
            border: "1px solid rgba(212,168,67,.18)",
            color: "#D4A843",
          }}
        >
          {evidence.status}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 text-[9px] text-[#7D8B98]">
        <span>{evidence.relatedSuspect || "No suspect link"}</span>
        <span>{evidence.whereFound}</span>
      </div>
    </button>
  );
}
