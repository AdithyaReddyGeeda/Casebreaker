import type { EvidenceId } from "@/lib/cases/harlow-manor";

export interface Evidence {
  id: string;
  caseEvidenceId?: EvidenceId;
  title: string;
  category: string;
  isKey: boolean;
  contradicts: string[];
  supports: string[];
  selectedForAccusation: boolean;
  importance: "low" | "medium" | "high";
  status: "New" | "Lead" | "Reviewed" | "Key Evidence";
  description: string;
  whereFound: string;
  whenFound: string;
  relatedSuspect: string;
  whyItMatters: string;
  contradictionNotes: string;
  source?: string;
  imageUrl?: string;
  imagePrompt?: string;
  imageStatus?: "idle" | "generating" | "ready" | "failed";
}

export interface EvidenceItem extends Evidence {
  relatedSuspects: string[];
  source: string;
}
