import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();
    const tripoApiKey = process.env.NEXT_PUBLIC_TRIPO_API_KEY;

    if (!tripoApiKey) {
      console.error("❌ Tripo API key not configured");
      return NextResponse.json({ error: "Tripo API key not configured" }, { status: 500 });
    }

    console.log("🎬 Calling Tripo API...");
    console.log("   Key preview:", tripoApiKey.substring(0, 10) + "...");
    console.log("   Prompt:", prompt.substring(0, 100) + "...");

    // Try multiple endpoints in case API structure changed
    const endpoints = [
      "https://api.tripo3d.ai/v1/posts/text-to-model",  // Async generation
      "https://api.tripo3d.ai/v1/generate",              // Alternative endpoint
      "https://api.tripo3d.ai/v1/models/generate",       // Another variant
    ];

    let response = null;
    let lastError = null;

    for (const endpoint of endpoints) {
      try {
        console.log(`   Trying endpoint: ${endpoint}`);
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tripoApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: prompt,
            negative_prompt: "",
          }),
        });

        if (response.ok) {
          console.log(`   ✅ Success with endpoint: ${endpoint}`);
          break;
        } else {
          lastError = `${endpoint}: ${response.status}`;
          console.log(`   ❌ Failed: ${lastError}`);
        }
      } catch (error) {
        lastError = `${endpoint}: ${String(error)}`;
        console.log(`   ❌ Error: ${lastError}`);
      }
    }

    if (!response) {
      throw new Error(`All Tripo endpoints failed. Last error: ${lastError}`);
    }

    const responseText = await response.text();
    console.log(`   Status: ${response.status}`);
    console.log(`   Response: ${responseText.substring(0, 200)}`);

    if (!response.ok) {
      console.error(`❌ Tripo API error ${response.status}:`, responseText);
      return NextResponse.json(
        { error: `Tripo API error: ${response.status} - ${responseText}` },
        { status: response.status }
      );
    }

    let result;
    try {
      result = JSON.parse(responseText);
      console.log("   Response:", JSON.stringify(result).substring(0, 200));
    } catch {
      // If not JSON, might be HTML error page
      console.error("❌ Tripo API returned non-JSON response:", responseText.substring(0, 200));
      return NextResponse.json(
        { error: `Tripo API error: Invalid response format` },
        { status: 500 }
      );
    }

    // Try multiple response field names
    const modelUrl =
      result.modelUrl ||
      result.url ||
      result.data?.modelUrl ||
      result.data?.url ||
      result.model_url ||
      result.downloadUrl ||
      result.download_url;

    if (!modelUrl) {
      console.error("❌ No model URL in response. Full response:", result);
      console.error("   Available keys:", Object.keys(result).join(", "));

      // If it's an async task, return the task ID for polling
      if (result.task_id || result.taskId) {
        console.log("   Note: Response contains task ID (async generation):", result.task_id || result.taskId);
        return NextResponse.json(
          { error: "Tripo uses async generation. Task ID returned but polling not implemented yet." },
          { status: 501 }
        );
      }

      return NextResponse.json(
        { error: `Tripo API error: No model URL in response. Got: ${JSON.stringify(result)}` },
        { status: 500 }
      );
    }

    console.log("✅ Tripo API success, model URL:", modelUrl);
    return NextResponse.json({ modelUrl });
  } catch (error) {
    console.error("❌ Tripo endpoint error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
