import type { Evidence } from "./types";

const EVIDENCE_IMAGE_STYLE =
  "single detective evidence object, centered, dark neutral background, cinematic inventory render, highly readable, no people, no hands, no clutter";

const EVIDENCE_IMAGE_STORAGE_PREFIX = "casebreaker:evidence-image";

export interface EvidenceImageCacheEntry {
  caseId: string;
  evidenceId: string;
  imageUrl: string;
  prompt: string;
  cachedAt: number;
}

function trimPromptSegment(value: string, maxLength: number): string {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

export function buildEvidenceImagePrompt(
  evidence: Pick<Evidence, "title" | "category" | "description" | "whereFound">
): string {
  const visualDetail = trimPromptSegment(evidence.description, 220);
  const locationDetail = trimPromptSegment(evidence.whereFound, 80);

  return [
    EVIDENCE_IMAGE_STYLE,
    `primary object: ${evidence.title}`,
    `category: ${evidence.category}`,
    `forensic details: ${visualDetail}`,
    `context hint: recovered from ${locationDetail}`,
    "focus on one object only, realistic materials, dramatic but restrained lighting, no text, no labels, no watermark",
  ].join(", ");
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function buildEvidencePlaceholderImage(
  evidence: Pick<Evidence, "title" | "category" | "status">,
  options?: { variant?: "card" | "detail" }
): string {
  const variant = options?.variant ?? "card";
  const showTitleInArt = variant === "card";

  const badge =
    evidence.status === "Key Evidence"
      ? "KEY"
      : evidence.status === "Reviewed"
        ? "FILED"
        : "CLUE";

  const titleBlock =
    showTitleInArt
      ? `
      <text x="256" y="372" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="#E8ECF3">${evidence.title}</text>
      <text x="256" y="404" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" letter-spacing="3" fill="#7E8A99">${evidence.category.toUpperCase()}</text>`
      : `
      <text x="256" y="388" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" letter-spacing="3" fill="#7E8A99">${evidence.category.toUpperCase()}</text>`;

  return svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#172338" />
          <stop offset="100%" stop-color="#0B1526" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="36" fill="url(#bg)" />
      <rect x="34" y="34" width="444" height="444" rx="28" fill="none" stroke="rgba(255,255,255,0.12)" />
      <rect x="64" y="72" width="132" height="34" rx="17" fill="#2B2414" stroke="#5B4B25" />
      <text x="130" y="94" text-anchor="middle" font-family="Georgia, serif" font-size="15" fill="#D8BC79">${badge}</text>
      <circle cx="256" cy="220" r="78" fill="rgba(212,168,67,0.12)" stroke="rgba(212,168,67,0.28)" stroke-width="4" />
      <path d="M226 180h60c14 0 26 12 26 26v30c0 14-12 26-26 26h-60c-14 0-26-12-26-26v-30c0-14 12-26 26-26z" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)" stroke-width="4" />
      <path d="M214 302h84" stroke="rgba(255,255,255,0.22)" stroke-width="10" stroke-linecap="round" />
      ${titleBlock}
    </svg>
  `);
}

export function makeEvidenceImageCacheKey(caseId: string, evidenceId: string): string {
  return `${EVIDENCE_IMAGE_STORAGE_PREFIX}:${caseId}:${evidenceId}`;
}

export function readEvidenceImageCache(
  caseId: string,
  evidenceId: string
): EvidenceImageCacheEntry | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(makeEvidenceImageCacheKey(caseId, evidenceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EvidenceImageCacheEntry;
    if (!parsed?.imageUrl || !parsed?.prompt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeEvidenceImageCache(entry: EvidenceImageCacheEntry): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      makeEvidenceImageCacheKey(entry.caseId, entry.evidenceId),
      JSON.stringify(entry)
    );
  } catch (error) {
    console.warn("[evidence-images] failed to persist local cache", error);
  }
}

export async function requestEvidenceImageGeneration(input: {
  caseId: string;
  evidenceId: string;
  prompt: string;
}): Promise<{ imageUrl: string; cached: boolean }> {
  const response = await fetch("/api/evidence/generate-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as {
    error?: string;
    imageUrl?: string;
    cached?: boolean;
  };

  if (!response.ok || !payload.imageUrl) {
    throw new Error(payload.error || "Evidence image generation failed");
  }

  return {
    imageUrl: payload.imageUrl,
    cached: Boolean(payload.cached),
  };
}
