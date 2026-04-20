import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import {
  buildInterrogationSystemPrompt,
  calculateQuestionStressImpact,
  parseInterrogationPostBody,
  resolveInterrogationMaxOutputTokens,
  type InterrogationPostBody,
} from "@/lib/investigation";
import { resolveInterrogationLlmProvider } from "@/lib/investigation/interrogationLlmProvider";

export const runtime = "nodejs";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
} as const;

function sseMetaAndOpenAIStream(
  systemPrompt: string,
  stressImpact: number,
  body: InterrogationPostBody,
  maxOutputTokens: number
): ReadableStream<Uint8Array> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const model =
    process.env.OPENAI_INTERROGATION_MODEL?.trim() || "gpt-4o-mini";

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...body.history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: body.question },
  ];

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "meta", stressImpact })}\n\n`)
        );

        const stream = await openai.chat.completions.create({
          model,
          messages,
          max_tokens: maxOutputTokens,
          temperature: 0.85,
          stream: true,
        });

        let sentToken = false;
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content ?? "";
          if (content.length > 0) {
            sentToken = true;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "token", text: content })}\n\n`)
            );
          }
        }

        if (!sentToken) {
          const completion = await openai.chat.completions.create({
            model,
            messages,
            max_tokens: maxOutputTokens,
            temperature: 0.85,
          });
          const text = completion.choices[0]?.message?.content?.trim() ?? "";
          if (text) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "token", text })}\n\n`)
            );
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Stream error";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", text: `[${msg}]` })}\n\n`)
        );
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

function sseMetaAndAnthropicStream(
  systemPrompt: string,
  stressImpact: number,
  body: InterrogationPostBody,
  maxOutputTokens: number
): ReadableStream<Uint8Array> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const messages = [
    ...body.history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: body.question },
  ];

  const stream = anthropic.messages.stream({
    model: "claude-haiku-4-5-20251001",
    system: systemPrompt,
    messages,
    max_tokens: maxOutputTokens,
    temperature: 0.85,
  });

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "meta", stressImpact })}\n\n`)
        );

        let sentToken = false;
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta" &&
            typeof event.delta.text === "string" &&
            event.delta.text.length > 0
          ) {
            sentToken = true;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "token", text: event.delta.text })}\n\n`)
            );
          }
        }
        if (!sentToken) {
          try {
            const text = await stream.finalText();
            if (text.trim()) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "token", text })}\n\n`)
              );
            }
          } catch {
            /* ignore */
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Stream error";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", text: `[${msg}]` })}\n\n`)
        );
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

export async function POST(req: Request) {
  try {
    const raw = await req.json();
    const parsed = parseInterrogationPostBody(raw);
    if (!parsed.ok) {
      return new Response(JSON.stringify({ error: parsed.error }), {
        status: parsed.status,
      });
    }

    const {
      suspectId,
      question,
      history,
      discoveredEvidence,
      stressLevel,
      maxOutputTokens: clientMaxTokens,
    } = parsed.body;

    const systemPrompt = buildInterrogationSystemPrompt(
      suspectId,
      discoveredEvidence,
      stressLevel
    );
    const stressImpact = calculateQuestionStressImpact(suspectId, question);
    const maxOutputTokens = resolveInterrogationMaxOutputTokens({
      stressLevel,
      question,
      clientMaxTokens,
    });

    const body: InterrogationPostBody = {
      suspectId,
      question,
      history,
      discoveredEvidence,
      stressLevel,
      ...(clientMaxTokens !== undefined ? { maxOutputTokens: clientMaxTokens } : {}),
    };

    const resolved = resolveInterrogationLlmProvider();
    if (!resolved.ok) {
      return new Response(JSON.stringify({ error: resolved.error }), {
        status: resolved.status,
      });
    }

    const stream =
      resolved.provider === "openai"
        ? sseMetaAndOpenAIStream(systemPrompt, stressImpact, body, maxOutputTokens)
        : sseMetaAndAnthropicStream(systemPrompt, stressImpact, body, maxOutputTokens);

    return new Response(stream, { headers: SSE_HEADERS });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}
