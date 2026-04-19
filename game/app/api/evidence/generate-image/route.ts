import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const responseCache = new Map<
  string,
  {
    imageUrl: string;
    prompt: string;
    generatedAt: number;
  }
>();

export async function POST(request: NextRequest) {
  try {
    const { caseId, evidenceId, prompt } = (await request.json()) as {
      caseId?: string;
      evidenceId?: string;
      prompt?: string;
    };

    if (!caseId || !evidenceId || !prompt?.trim()) {
      return NextResponse.json(
        { error: "caseId, evidenceId, and prompt are required" },
        { status: 400 }
      );
    }

    const cacheKey = `${caseId}:${evidenceId}`;
    const cached = responseCache.get(cacheKey);
    if (cached) {
      console.log("[evidence-images/api] cache hit", { caseId, evidenceId });
      return NextResponse.json({
        imageUrl: cached.imageUrl,
        cached: true,
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn("[evidence-images/api] OPENAI_API_KEY missing", { caseId, evidenceId });
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 503 }
      );
    }

    const model = process.env.OPENAI_EVIDENCE_IMAGE_MODEL?.trim() || "gpt-image-1-mini";
    const client = new OpenAI({ apiKey });

    console.log("[evidence-images/api] generating", {
      caseId,
      evidenceId,
      model,
    });

    const result = await client.images.generate({
      model,
      prompt,
      size: "1024x1024",
      quality: "low",
      output_format: "jpeg",
      output_compression: 60,
      background: "opaque",
      moderation: "auto",
      user: `${caseId}:${evidenceId}`,
    });

    const image = result.data?.[0];
    const imageUrl = image?.b64_json
      ? `data:image/jpeg;base64,${image.b64_json}`
      : image?.url;

    if (!imageUrl) {
      console.error("[evidence-images/api] no image in response", { caseId, evidenceId });
      return NextResponse.json(
        { error: "Image provider returned no image data" },
        { status: 502 }
      );
    }

    responseCache.set(cacheKey, {
      imageUrl,
      prompt,
      generatedAt: Date.now(),
    });

    console.log("[evidence-images/api] generated", {
      caseId,
      evidenceId,
      cached: false,
    });

    return NextResponse.json({
      imageUrl,
      cached: false,
    });
  } catch (error) {
    console.error("[evidence-images/api] failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
