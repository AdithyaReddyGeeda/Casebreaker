import { access, copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import type { SuspectId } from "@/lib/cases/harlow-manor";
import { buildCharacterPromptForSuspect } from "@/lib/character/character";
import { getCharacterDefinition } from "@/lib/character/character-catalog";
import { getCharacterMotionMode, validateModelRig } from "@/lib/character/rig-validator";
import { generateCharacterModel } from "@/lib/character/tripoService";
import type { ResolvedCharacterModel } from "@/lib/character/character-pipeline";

export const runtime = "nodejs";

type TripoGenerateBody = {
  suspectId?: SuspectId;
  prompt?: string;
  regenerate?: boolean;
  cacheKey?: string;
  fallbackModelPath?: string;
};

const DEFAULT_SUSPECT_ID: SuspectId = "fenn";
const modelCache = new Map<SuspectId, ResolvedCharacterModel>();
const inflightGeneration = new Map<SuspectId, Promise<ResolvedCharacterModel>>();
type DynamicResolvedModel = {
  cacheKey: string;
  modelPath: string;
  source: "fallback" | "local-cache" | "tripo";
  motionMode: ResolvedCharacterModel["motionMode"];
  rigReport: ResolvedCharacterModel["rigReport"];
  prompt?: string;
  generatedAtIso?: string;
  taskId?: string;
};

const dynamicModelCache = new Map<string, DynamicResolvedModel>();
const inflightDynamicGeneration = new Map<string, Promise<DynamicResolvedModel>>();

function matchesCurrentCharacterVersion(
  cached: ResolvedCharacterModel,
  definition: ReturnType<typeof getCharacterDefinition>
) {
  if (!cached.modelPath) return true;
  if (/^https?:\/\//i.test(cached.modelPath)) return true;
  return (
    cached.modelPath === definition.generatedModelPath ||
    cached.modelPath === definition.fallbackModelPath
  );
}

function sanitizeCacheKey(cacheKey: string) {
  return cacheKey
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function getDynamicGeneratedModelPath(cacheKey: string) {
  return `/models/generated/dynamic/${sanitizeCacheKey(cacheKey) || "case-model"}.glb`;
}

function matchesDynamicVersion(
  cached: DynamicResolvedModel,
  generatedModelPath: string,
  fallbackModelPath?: string
) {
  if (!cached.modelPath) return true;
  if (/^https?:\/\//i.test(cached.modelPath)) return true;
  return (
    cached.modelPath === generatedModelPath ||
    (!!fallbackModelPath && cached.modelPath === fallbackModelPath)
  );
}

function getPublicAssetAbsPath(publicModelPath: string) {
  return path.join(process.cwd(), "public", publicModelPath.replace(/^\//, ""));
}

function getLegacyGeneratedModelPaths(
  suspectId: SuspectId,
  definition: ReturnType<typeof getCharacterDefinition>
) {
  const candidates = new Set<string>([
    definition.generatedModelPath,
    `/models/generated/${suspectId}.glb`,
  ]);

  return Array.from(candidates);
}

async function localGeneratedModelExists(publicModelPath: string) {
  try {
    await access(getPublicAssetAbsPath(publicModelPath), fsConstants.F_OK | fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function isUsableGlbModel(modelPath: string): Promise<boolean> {
  if (!modelPath.startsWith("/")) return false;

  const fullPath = path.join(process.cwd(), "public", modelPath.replace(/^\//, ""));

  try {
    const buffer = await readFile(fullPath);
    return buffer.toString("utf8", 0, 4) === "glTF";
  } catch {
    return false;
  }
}

async function persistModelToLocalFile(remoteUrl: string, publicModelPath: string, suspectId: SuspectId) {
  const response = await fetch(remoteUrl);
  if (!response.ok) {
    throw new Error(`Failed to download generated model (${response.status}).`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const targetPath = getPublicAssetAbsPath(publicModelPath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, buffer);
  const fileStats = await stat(targetPath);

  console.log("[tripo-route] cached generated model", {
    suspectId,
    targetPath,
    bytes: fileStats.size,
  });

  return {
    targetPath,
    bytes: fileStats.size,
  };
}

async function persistDynamicModelToLocalFile(remoteUrl: string, publicModelPath: string, cacheKey: string) {
  const response = await fetch(remoteUrl);
  if (!response.ok) {
    throw new Error(`Failed to download generated model (${response.status}).`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const targetPath = getPublicAssetAbsPath(publicModelPath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, buffer);
  const fileStats = await stat(targetPath);

  console.log("[tripo-route] cached dynamic generated model", {
    cacheKey,
    targetPath,
    bytes: fileStats.size,
  });

  return {
    targetPath,
    bytes: fileStats.size,
  };
}

function createFallbackResult(suspectId: SuspectId, error?: string): ResolvedCharacterModel {
  return {
    suspectId,
    modelPath: "",
    source: "fallback",
    motionMode: "rigid",
    rigReport: null,
    prompt: buildCharacterPromptForSuspect(suspectId),
    generatedAtIso: new Date().toISOString(),
    taskId: error ? `fallback:${error}` : "fallback",
  };
}

async function buildLocalCacheResult(suspectId: SuspectId): Promise<ResolvedCharacterModel> {
  const definition = getCharacterDefinition(suspectId);
  if (!(await isUsableGlbModel(definition.generatedModelPath))) {
    throw new Error(`Generated model file is not a valid GLB: ${definition.generatedModelPath}`);
  }
  const rigReport = await validateModelRig(definition.generatedModelPath);

  return {
    suspectId,
    modelPath: definition.generatedModelPath,
    source: "local-cache",
    motionMode: getCharacterMotionMode(rigReport),
    rigReport,
    prompt: buildCharacterPromptForSuspect(suspectId),
    generatedAtIso: new Date().toISOString(),
    taskId: "local-file",
  };
}

async function promoteLegacyGeneratedModelIfNeeded(suspectId: SuspectId) {
  const definition = getCharacterDefinition(suspectId);

  if (await isUsableGlbModel(definition.generatedModelPath)) {
    return definition.generatedModelPath;
  }

  for (const candidate of getLegacyGeneratedModelPaths(suspectId, definition)) {
    if (candidate === definition.generatedModelPath) continue;
    if (!(await isUsableGlbModel(candidate))) continue;

    const sourceAbs = getPublicAssetAbsPath(candidate);
    const targetAbs = getPublicAssetAbsPath(definition.generatedModelPath);
    await mkdir(path.dirname(targetAbs), { recursive: true });
    await copyFile(sourceAbs, targetAbs);

    console.log("[tripo-route] promoted legacy generated model", {
      suspectId,
      from: candidate,
      to: definition.generatedModelPath,
    });

    return definition.generatedModelPath;
  }

  return null;
}

async function generateAndCacheModel(
  suspectId: SuspectId,
  prompt: string
): Promise<ResolvedCharacterModel> {
  const definition = getCharacterDefinition(suspectId);

  console.log("[tripo-route] generating", {
    suspectId,
    target: definition.generatedModelPath,
    cwd: process.cwd(),
  });
  const result = await generateCharacterModel(prompt);
  console.log("[tripo-route] generation completed", {
    suspectId,
    taskId: result.taskId,
    remoteUrl: result.glbUrl,
  });

  if (!result.glbUrl) {
    throw new Error("Tripo generation completed without a GLB URL.");
  }

  let resolvedModelPath = result.glbUrl;

  try {
    await persistModelToLocalFile(result.glbUrl, definition.generatedModelPath, suspectId);
    resolvedModelPath = definition.generatedModelPath;
  } catch (error) {
    console.warn("[tripo-route] local cache write failed, using remote model URL", {
      suspectId,
      error: error instanceof Error ? error.message : String(error),
      remoteUrl: result.glbUrl,
    });
  }

  const rigReport = await validateModelRig(resolvedModelPath);
  const resolved: ResolvedCharacterModel = {
    suspectId,
    modelPath: resolvedModelPath,
    source: "tripo",
    motionMode: getCharacterMotionMode(rigReport),
    rigReport,
    prompt: result.prompt,
    generatedAtIso: new Date().toISOString(),
    taskId: result.taskId,
  };

  modelCache.set(suspectId, resolved);
  return resolved;
}

async function buildDynamicLocalCacheResult(
  cacheKey: string,
  prompt: string
): Promise<DynamicResolvedModel> {
  const generatedModelPath = getDynamicGeneratedModelPath(cacheKey);

  if (!(await isUsableGlbModel(generatedModelPath))) {
    throw new Error(`Generated model file is not a valid GLB: ${generatedModelPath}`);
  }

  const rigReport = await validateModelRig(generatedModelPath);

  return {
    cacheKey,
    modelPath: generatedModelPath,
    source: "local-cache",
    motionMode: getCharacterMotionMode(rigReport),
    rigReport,
    prompt,
    generatedAtIso: new Date().toISOString(),
    taskId: "dynamic-local-file",
  };
}

async function generateAndCacheDynamicModel(
  cacheKey: string,
  prompt: string
): Promise<DynamicResolvedModel> {
  const generatedModelPath = getDynamicGeneratedModelPath(cacheKey);

  console.log("[tripo-route] generating dynamic model", {
    cacheKey,
    target: generatedModelPath,
    cwd: process.cwd(),
  });

  const result = await generateCharacterModel(prompt);
  console.log("[tripo-route] dynamic generation completed", {
    cacheKey,
    taskId: result.taskId,
    remoteUrl: result.glbUrl,
  });

  if (!result.glbUrl) {
    throw new Error("Tripo generation completed without a GLB URL.");
  }

  let resolvedModelPath = result.glbUrl;

  try {
    await persistDynamicModelToLocalFile(result.glbUrl, generatedModelPath, cacheKey);
    resolvedModelPath = generatedModelPath;
  } catch (error) {
    console.warn("[tripo-route] dynamic local cache write failed, using remote model URL", {
      cacheKey,
      error: error instanceof Error ? error.message : String(error),
      remoteUrl: result.glbUrl,
    });
  }

  const rigReport = await validateModelRig(resolvedModelPath);
  const resolved: DynamicResolvedModel = {
    cacheKey,
    modelPath: resolvedModelPath,
    source: "tripo",
    motionMode: getCharacterMotionMode(rigReport),
    rigReport,
    prompt: result.prompt,
    generatedAtIso: new Date().toISOString(),
    taskId: result.taskId,
  };

  dynamicModelCache.set(cacheKey, resolved);
  return resolved;
}

async function handleDynamicRequest({
  cacheKey,
  prompt,
  regenerate,
  fallbackModelPath,
}: {
  cacheKey: string;
  prompt: string;
  regenerate: boolean;
  fallbackModelPath?: string;
}) {
  const normalizedCacheKey = sanitizeCacheKey(cacheKey) || "case-model";
  const generatedModelPath = getDynamicGeneratedModelPath(normalizedCacheKey);

  if (!regenerate && dynamicModelCache.has(normalizedCacheKey)) {
    const cached = dynamicModelCache.get(normalizedCacheKey)!;
    if (matchesDynamicVersion(cached, generatedModelPath, fallbackModelPath)) {
      return Response.json({
        ...cached,
        modelUrl: cached.modelPath,
      });
    }

    dynamicModelCache.delete(normalizedCacheKey);
  }

  if (!regenerate && (await localGeneratedModelExists(generatedModelPath))) {
    const local = await buildDynamicLocalCacheResult(normalizedCacheKey, prompt);
    console.log("[tripo-route] reusing saved dynamic local model", {
      cacheKey: normalizedCacheKey,
      modelPath: local.modelPath,
    });
    dynamicModelCache.set(normalizedCacheKey, local);
    return Response.json({
      ...local,
      modelUrl: local.modelPath,
    });
  }

  try {
    if (!inflightDynamicGeneration.has(normalizedCacheKey)) {
      inflightDynamicGeneration.set(
        normalizedCacheKey,
        generateAndCacheDynamicModel(normalizedCacheKey, prompt).finally(() => {
          inflightDynamicGeneration.delete(normalizedCacheKey);
        })
      );
    }

    const generated = await inflightDynamicGeneration.get(normalizedCacheKey)!;
    console.log("[tripo-route] resolved dynamic model response", {
      cacheKey: normalizedCacheKey,
      source: generated.source,
      modelPath: generated.modelPath,
      motionMode: generated.motionMode,
    });

    return Response.json({
      ...generated,
      modelUrl: generated.modelPath,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Tripo error";
    console.warn("[tripo-route] dynamic fallback", {
      cacheKey: normalizedCacheKey,
      error: message,
      fallbackModelPath,
    });

    let rigReport: ResolvedCharacterModel["rigReport"] = null;

    if (fallbackModelPath && (await isUsableGlbModel(fallbackModelPath))) {
      rigReport = await validateModelRig(fallbackModelPath);
    }

    const fallback: DynamicResolvedModel = {
      cacheKey: normalizedCacheKey,
      modelPath: fallbackModelPath ?? "",
      source: "fallback",
      motionMode: getCharacterMotionMode(rigReport),
      rigReport,
      prompt,
      generatedAtIso: new Date().toISOString(),
      taskId: `dynamic-fallback:${message}`,
    };

    dynamicModelCache.set(normalizedCacheKey, fallback);

    return Response.json(
      {
        ...fallback,
        error: message,
        modelUrl: fallback.modelPath,
      },
      { status: 200 }
    );
  }
}

export async function POST(request: Request) {
  let body: TripoGenerateBody;

  try {
    body = (await request.json()) as TripoGenerateBody;
  } catch {
    body = {};
  }

  const suspectId = body.suspectId ?? DEFAULT_SUSPECT_ID;
  const prompt = body.prompt?.trim() || buildCharacterPromptForSuspect(suspectId);
  const regenerate = body.regenerate === true;
  const dynamicCacheKey = body.cacheKey?.trim();

  if (dynamicCacheKey && !body.suspectId) {
    return handleDynamicRequest({
      cacheKey: dynamicCacheKey,
      prompt,
      regenerate,
      fallbackModelPath: body.fallbackModelPath?.trim() || undefined,
    });
  }

  try {
    const definition = getCharacterDefinition(suspectId);

    if (!regenerate && modelCache.has(suspectId)) {
      const cached = modelCache.get(suspectId)!;
      if (matchesCurrentCharacterVersion(cached, definition)) {
        return Response.json({
          ...cached,
          modelUrl: cached.modelPath,
        });
      }

      modelCache.delete(suspectId);
    }

    if (!regenerate && (await localGeneratedModelExists(definition.generatedModelPath))) {
      const local = await buildLocalCacheResult(suspectId);
      console.log("[tripo-route] reusing saved local model", {
        suspectId,
        modelPath: local.modelPath,
      });
      modelCache.set(suspectId, local);
      return Response.json({
        ...local,
        modelUrl: local.modelPath,
      });
    }

    if (!regenerate) {
      const promotedModelPath = await promoteLegacyGeneratedModelIfNeeded(suspectId);
      if (promotedModelPath) {
        const local = await buildLocalCacheResult(suspectId);
        console.log("[tripo-route] reusing promoted local model", {
          suspectId,
          modelPath: local.modelPath,
        });
        modelCache.set(suspectId, local);
        return Response.json({
          ...local,
          modelUrl: local.modelPath,
        });
      }
    }

    if (!regenerate && (await isUsableGlbModel(definition.fallbackModelPath))) {
      const rigReport = await validateModelRig(definition.fallbackModelPath);
      const fallbackLocal: ResolvedCharacterModel = {
        suspectId,
        modelPath: definition.fallbackModelPath,
        source: "local-cache",
        motionMode: getCharacterMotionMode(rigReport),
        rigReport,
        prompt,
        generatedAtIso: new Date().toISOString(),
        taskId: "curated-local",
      };
      modelCache.set(suspectId, fallbackLocal);
      return Response.json({
        ...fallbackLocal,
        modelUrl: fallbackLocal.modelPath,
      });
    }

    if (!inflightGeneration.has(suspectId)) {
      inflightGeneration.set(
        suspectId,
        generateAndCacheModel(suspectId, prompt).finally(() => {
          inflightGeneration.delete(suspectId);
        })
      );
    }

    const generated = await inflightGeneration.get(suspectId)!;
    console.log("[tripo-route] resolved model response", {
      suspectId,
      source: generated.source,
      modelPath: generated.modelPath,
      motionMode: generated.motionMode,
    });
    return Response.json({
      ...generated,
      modelUrl: generated.modelPath,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Tripo error";
    console.warn("[tripo-route] fallback", { suspectId, error: message });
    const fallback = createFallbackResult(suspectId, message);
    return Response.json(
      {
        ...fallback,
        error: message,
        modelUrl: fallback.modelPath,
      },
      { status: 200 }
    );
  }
}
