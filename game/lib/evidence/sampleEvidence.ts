import type { EvidenceId } from "@/lib/cases/harlow-manor";
import { buildEvidenceImagePrompt } from "./images";
import type { Evidence } from "./types";

const MOCK_EVIDENCE: Evidence[] = [
  {
    id: "ev_brandy",
    caseEvidenceId: "ev_brandy",
    title: "Brandy Glass",
    category: "Toxicology",
    isKey: true,
    contradicts: ["victoria"],
    supports: [],
    selectedForAccusation: false,
    importance: "high",
    status: "Key Evidence",
    description:
      "A crystal glass recovered from Edmund's desk. Trace residue suggests the poison was delivered through the victim's drink.",
    whereFound: "The Library",
    whenFound: "Logged during the room search",
    relatedSuspect: "Victoria Harlow",
    whyItMatters: "It ties the murder method to a handled object at the crime scene.",
    contradictionNotes:
      "Victoria claims she did not handle Edmund's last drink, but the timing of her library visit clashes with that story.",
    source: "Case file recovery log",
  },
  {
    id: "ev_bag",
    caseEvidenceId: "ev_bag",
    title: "Dr. Fenn's Medical Bag",
    category: "Medical",
    isKey: false,
    contradicts: [],
    supports: ["fenn"],
    selectedForAccusation: false,
    importance: "medium",
    status: "Lead",
    description:
      "A physician's bag with an empty slot where a strychnine vial should have been stored.",
    whereFound: "Guest Room",
    whenFound: "Logged during the room search",
    relatedSuspect: "Dr. James Fenn",
    whyItMatters: "It explains where the poison could have come from and who had access to it.",
    contradictionNotes:
      "Fenn insists the vial was present earlier that evening, but the bag now suggests a theft or false account.",
    source: "Guest wing evidence sweep",
  },
  {
    id: "ev_will",
    caseEvidenceId: "ev_will",
    title: "Amended Will",
    category: "Document",
    isKey: true,
    contradicts: ["victoria"],
    supports: [],
    selectedForAccusation: false,
    importance: "high",
    status: "Key Evidence",
    description:
      "A recently amended legal document that cuts Victoria Harlow out of Edmund's estate.",
    whereFound: "The Study",
    whenFound: "Logged during the room search",
    relatedSuspect: "Victoria Harlow",
    whyItMatters: "It provides the clearest financial motive in the case.",
    contradictionNotes:
      "Victoria says she knew nothing about the document, but it directly undermines her claim of security.",
    source: "Private document archive",
  },
  {
    id: "ev_gloves",
    caseEvidenceId: "ev_gloves",
    title: "Muddy Gardening Gloves",
    category: "Trace",
    isKey: false,
    contradicts: ["victoria"],
    supports: ["fenn", "oliver"],
    selectedForAccusation: false,
    importance: "medium",
    status: "Lead",
    description:
      "A damp pair of gloves hidden in the greenhouse with Victoria's monogram stitched into the cuff.",
    whereFound: "The Greenhouse",
    whenFound: "Logged during the room search",
    relatedSuspect: "Victoria Harlow",
    whyItMatters: "They place Victoria in a suspicious location after the murder window.",
    contradictionNotes:
      "The hidden gloves challenge Victoria's claim that she spent the evening calmly indoors.",
    source: "Greenhouse search notes",
  },
  {
    id: "ev_diary",
    caseEvidenceId: "ev_diary",
    title: "Victoria's Diary",
    category: "Personal",
    isKey: true,
    contradicts: ["victoria"],
    supports: [],
    selectedForAccusation: false,
    importance: "high",
    status: "Key Evidence",
    description:
      "A diary entry suggests anger, desperation, and a premeditated decision to act.",
    whereFound: "Master Bedroom",
    whenFound: "Logged during the room search",
    relatedSuspect: "Victoria Harlow",
    whyItMatters: "It strengthens the motive and suggests planning rather than panic.",
    contradictionNotes:
      "The entry conflicts with Victoria's composed claim that she had accepted Edmund's decisions.",
    source: "Bedroom drawer recovery",
  },
  {
    id: "ev_debt",
    caseEvidenceId: "ev_debt",
    title: "Debt Collection Letter",
    category: "Financial",
    isKey: false,
    contradicts: ["oliver"],
    supports: ["oliver"],
    selectedForAccusation: false,
    importance: "low",
    status: "New",
    description:
      "A threatening letter outlining Oliver Harlow's unpaid gambling debts.",
    whereFound: "Oliver's Room",
    whenFound: "Logged during the room search",
    relatedSuspect: "Oliver Harlow",
    whyItMatters: "It creates pressure on Oliver, though it may still be a red herring.",
    contradictionNotes:
      "Oliver minimizes the scale of the debt, but the amount in the letter is severe and immediate.",
    source: "Personal correspondence stack",
  },
];

export function createMockEvidence(): Evidence[] {
  return MOCK_EVIDENCE.map((item) => ({
    ...item,
    imagePrompt: buildEvidenceImagePrompt(item),
    imageStatus: "idle",
  }));
}

export function getDiscoveredEvidence(
  evidence: readonly Evidence[],
  discoveredEvidenceIds: readonly EvidenceId[]
): Evidence[] {
  const discovered = new Set(discoveredEvidenceIds);
  return evidence.filter((item) =>
    item.caseEvidenceId ? discovered.has(item.caseEvidenceId) : true
  );
}
