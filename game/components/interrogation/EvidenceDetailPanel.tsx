"use client";

import { motion } from "framer-motion";
import type { Evidence } from "@/lib/evidence/types";

interface EvidenceDetailPanelProps {
  evidence: Evidence;
  onClose: () => void;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[8px] tracking-[2.2px] uppercase text-[#667788]">{label}</div>
      <div
        className="mt-1 text-[11px] leading-relaxed text-[#C8D0DC]"
        style={{ fontFamily: "Georgia, serif" }}
      >
        {value}
      </div>
    </div>
  );
}

export default function EvidenceDetailPanel({
  evidence,
  onClose,
}: EvidenceDetailPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 14 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#09121E]/95 px-4 py-4 backdrop-blur"
      style={{ boxShadow: "0 -10px 24px rgba(0,0,0,.35)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] tracking-[3px] uppercase text-[#D4A843]">
            Evidence Detail
          </div>
          <div
            className="mt-1 text-sm font-semibold text-[#E8E0D0]"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {evidence.title}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-[10px] tracking-[2px] uppercase text-[#556677] transition-colors hover:text-[#C8D0DC]"
        >
          Close
        </button>
      </div>

      <div className="mt-3 grid gap-3">
        <DetailRow label="Category" value={evidence.category} />
        <DetailRow label="Description" value={evidence.description} />
        <DetailRow label="Where Found" value={evidence.whereFound} />
        <DetailRow label="When Found" value={evidence.whenFound} />
        <DetailRow label="Related Suspects" value={evidence.relatedSuspect} />
        <DetailRow label="Why It Matters" value={evidence.whyItMatters} />
        <DetailRow label="Source" value={evidence.source ?? "Case notes"} />
      </div>
    </motion.div>
  );
}
