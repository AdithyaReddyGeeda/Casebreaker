import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { text, voiceId } = await request.json();
    const elevenLabsApiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;

    if (!elevenLabsApiKey) {
      console.error("❌ ElevenLabs API key not configured");
      return NextResponse.json({ error: "ElevenLabs API key not configured" }, { status: 500 });
    }

    if (!voiceId || !text) {
      console.error("❌ Missing required fields:", { voiceId, textLength: text?.length });
      return NextResponse.json(
        { error: "Missing required fields: text, voiceId" },
        { status: 400 }
      );
    }

    console.log("🎤 Calling ElevenLabs API...");
    console.log("   Key preview:", elevenLabsApiKey.substring(0, 10) + "...");
    console.log("   Voice ID:", voiceId);
    console.log("   Text length:", text.length);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": elevenLabsApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    console.log(`   Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ ElevenLabs API error ${response.status}:`, errorText);
      return NextResponse.json(
        { error: `ElevenLabs API error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    // Only read as arrayBuffer for successful responses
    const audioBlob = await response.arrayBuffer();
    console.log("✅ ElevenLabs API success, audio size:", audioBlob.byteLength);
    return new NextResponse(audioBlob, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBlob.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("❌ ElevenLabs endpoint error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
