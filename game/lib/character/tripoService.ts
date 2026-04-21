"use server";

const DEFAULT_TRIPO_BASE_URL = "https://api.tripo3d.ai/v2/openapi";

const TERMINAL_SUCCESS = new Set(["success", "succeeded", "completed", "done", "finished"]);
const TERMINAL_FAILURE = new Set(["failed", "error", "cancelled", "canceled", "timeout"]);

export interface TripoTaskStatus {
  taskId: string;
  status: string;
  glbUrl: string | null;
  rawStatus: unknown;
}

export interface TripoGenerationResult extends TripoTaskStatus {
  prompt: string;
}

function isImageAsset(url: string) {
  return /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/i.test(url);
}

function isGltfAsset(url: string) {
  return /\.(glb|gltf)(\?|$)/i.test(url);
}

function isFbxAsset(url: string) {
  return /\.fbx(\?|$)/i.test(url);
}

function getTripoBaseUrl() {
  return (process.env.TRIPO_BASE_URL ?? DEFAULT_TRIPO_BASE_URL).replace(/\/+$/, "");
}

function getTripoApiKey() {
  const key = process.env.TRIPO_API_KEY;
  if (!key) {
    throw new Error("TRIPO_API_KEY is not configured.");
  }
  return key;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function pickTaskId(payload: unknown): string | null {
  const root = asRecord(payload);
  if (!root) return null;

  const direct =
    asString(root.taskId) ??
    asString(root.task_id) ??
    asString(root.id) ??
    asString(root.uuid);
  if (direct) return direct;

  const data = asRecord(root.data);
  if (!data) return null;

  return (
    asString(data.taskId) ??
    asString(data.task_id) ??
    asString(data.id) ??
    asString(data.uuid)
  );
}

function pickStatus(payload: unknown): string {
  const root = asRecord(payload);
  if (!root) return "unknown";
  const data = asRecord(root.data);

  return (
    asString(root.status) ??
    asString(root.state) ??
    asString(data?.status) ??
    asString(data?.state) ??
    "unknown"
  ).toLowerCase();
}

function pickGlbUrl(payload: unknown): string | null {
  const root = asRecord(payload);
  if (!root) return null;
  const data = asRecord(root.data);
  const output = asRecord(data?.output ?? root.output);
  const result = asRecord(data?.result ?? root.result);

  const candidates: unknown[] = [
    output?.pbr_model_url,
    output?.base_model_url,
    output?.raw_model_url,
    output?.glb_url,
    output?.glbUrl,
    output?.model_url,
    output?.modelUrl,
    output?.url,
    result?.pbr_model_url,
    result?.base_model_url,
    result?.raw_model_url,
    result?.glb_url,
    result?.glbUrl,
    result?.model_url,
    result?.modelUrl,
    result?.url,
    data?.pbr_model_url,
    data?.base_model_url,
    data?.raw_model_url,
    data?.glb_url,
    data?.glbUrl,
    data?.model_url,
    data?.modelUrl,
    root.pbr_model_url,
    root.base_model_url,
    root.raw_model_url,
    root.glb_url,
    root.glbUrl,
    root.model_url,
    root.modelUrl,
  ];

  const normalized = candidates
    .map((value) => asString(value))
    .filter((value): value is string => Boolean(value));

  const isModelAsset = (url: string) =>
    /\.(glb|gltf|fbx|obj|usdz)(\?|$)/i.test(url) || /\/(model|mesh|asset)[^/]*($|\?)/i.test(url);

  const directGlb = normalized.find((value) => isGltfAsset(value));
  if (directGlb) return directGlb;

  const directFbx = normalized.find((value) => isFbxAsset(value));
  if (directFbx) return directFbx;

  const directModelUrl = normalized.find(
    (value) => /^https?:\/\//i.test(value) && isModelAsset(value) && !isImageAsset(value)
  );
  if (directModelUrl) return directModelUrl;

  const directUrl = normalized.find(
    (value) => /^https?:\/\//i.test(value) && !isImageAsset(value)
  );
  if (directUrl) return directUrl;

  const arrays: unknown[] = [
    output?.results,
    output?.files,
    output?.assets,
    output?.models,
    result?.results,
    result?.files,
    result?.assets,
    result?.models,
    data?.results,
    data?.files,
    data?.assets,
    data?.models,
    root.results,
    root.files,
    root.assets,
    root.models,
  ];

  for (const list of arrays) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (typeof item === "string") {
        if (isGltfAsset(item) || isFbxAsset(item)) return item;
        if (/^https?:\/\//i.test(item) && isModelAsset(item) && !isImageAsset(item)) {
          return item;
        }
      }

      const record = asRecord(item);
      const nested =
        asString(record?.asset) ??
        asString(record?.download_url) ??
        asString(record?.downloadUrl) ??
        asString(record?.pbr_model_url) ??
        asString(record?.base_model_url) ??
        asString(record?.raw_model_url) ??
        asString(record?.url) ??
        asString(record?.glb_url) ??
        asString(record?.glbUrl) ??
        asString(record?.model_url) ??
        asString(record?.modelUrl);

      if (nested) {
        if (isGltfAsset(nested) || isFbxAsset(nested)) {
          return nested;
        }

        if (/^https?:\/\//i.test(nested) && isModelAsset(nested) && !isImageAsset(nested)) {
          return nested;
        }
      }
    }
  }

  const seen = new Set<unknown>();
  const queue: unknown[] = [root];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);

    if (typeof current === "string") {
      if (isGltfAsset(current) || isFbxAsset(current)) return current;
      if (/^https?:\/\//i.test(current) && isModelAsset(current) && !isImageAsset(current)) {
        return current;
      }
      continue;
    }

    if (Array.isArray(current)) {
      for (const item of current) queue.push(item);
      continue;
    }

    const record = asRecord(current);
    if (!record) continue;
    for (const value of Object.values(record)) queue.push(value);
  }

  return null;
}

async function tripoRequest<T = unknown>(
  routePath: string,
  init: RequestInit
): Promise<T> {
  const res = await fetch(`${getTripoBaseUrl()}${routePath}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getTripoApiKey()}`,
      ...(init.headers ?? {}),
    },
  });

  const bodyText = await res.text();
  let body: unknown = null;

  try {
    body = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    body = bodyText;
  }

  if (!res.ok) {
    const details =
      typeof body === "string" ? body : JSON.stringify(body ?? { error: "unknown" });
    throw new Error(`Tripo request failed (${res.status}): ${details}`);
  }

  return body as T;
}

export async function submitTextToModelTask(prompt: string) {
  const taskBody: Record<string, unknown> = {
    type: "text_to_model",
    model_version: "v3.0",
    prompt,
    texture: true,
    pbr: true,
    quad: true,
    face_rig: true,
    workflow: "animation",
  };

  const attempts: Array<Record<string, unknown>> = [
    { ...taskBody },
    (() => {
      const body = { ...taskBody };
      Reflect.deleteProperty(body, "workflow");
      return body;
    })(),
    (() => {
      const body = { ...taskBody };
      Reflect.deleteProperty(body, "workflow");
      Reflect.deleteProperty(body, "face_rig");
      return body;
    })(),
    (() => {
      const body = { ...taskBody };
      Reflect.deleteProperty(body, "workflow");
      Reflect.deleteProperty(body, "face_rig");
      Reflect.deleteProperty(body, "model_version");
      return body;
    })(),
  ];

  let payload: unknown = null;
  let lastError: unknown = null;

  for (const attempt of attempts) {
    try {
      payload = await tripoRequest("/task", {
        method: "POST",
        body: JSON.stringify(attempt),
      });
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
      const isParamError =
        message.includes("invalid") ||
        message.includes("unknown") ||
        message.includes("not allowed") ||
        message.includes("unsupported");
      if (!isParamError) throw error;
    }
  }

  if (lastError) throw lastError;

  const taskId = pickTaskId(payload);
  if (!taskId) {
    throw new Error("Tripo task submission succeeded but no task id was returned.");
  }

  console.log("[tripo-service] submitted task", {
    taskId,
    promptPreview: prompt.slice(0, 120),
  });

  return { taskId, rawStatus: payload };
}

async function submitConvertModelTask(originalTaskId: string) {
  const payload = await tripoRequest("/task", {
    method: "POST",
    body: JSON.stringify({
      type: "convert_model",
      original_model_task_id: originalTaskId,
      format: "GLTF",
      quad: true,
      bake: true,
      texture_format: "WEBP",
    }),
  });

  const taskId = pickTaskId(payload);
  if (!taskId) {
    throw new Error("Tripo convert_model submission succeeded but no task id was returned.");
  }

  return taskId;
}

async function fetchTaskStatus(taskId: string): Promise<TripoTaskStatus> {
  let payload: unknown;

  try {
    payload = await tripoRequest(`/task/${taskId}`, { method: "GET" });
  } catch {
    payload = await tripoRequest(`/tasks/${taskId}`, { method: "GET" });
  }

  return {
    taskId,
    status: pickStatus(payload),
    glbUrl: pickGlbUrl(payload),
    rawStatus: payload,
  };
}

export async function pollTripoTask(
  taskId: string,
  options?: { timeoutMs?: number; initialIntervalMs?: number; maxIntervalMs?: number }
): Promise<TripoTaskStatus> {
  const timeoutMs = options?.timeoutMs ?? 8 * 60 * 1000;
  let intervalMs = options?.initialIntervalMs ?? 2500;
  const maxIntervalMs = options?.maxIntervalMs ?? 10_000;
  const startedAt = Date.now();
  let lastCompletedWithoutUrl: TripoTaskStatus | null = null;

  while (Date.now() - startedAt < timeoutMs) {
    const status = await fetchTaskStatus(taskId);

    console.log("[tripo-service] polled task", {
      taskId,
      status: status.status,
      hasModelUrl: Boolean(status.glbUrl),
    });

    if (TERMINAL_SUCCESS.has(status.status)) {
      if (status.glbUrl) {
        return status;
      }

      lastCompletedWithoutUrl = status;
      await wait(intervalMs);
      intervalMs = Math.min(Math.round(intervalMs * 1.15), maxIntervalMs);
      continue;
    }

    if (TERMINAL_FAILURE.has(status.status)) {
      throw new Error(`Tripo task failed with status: ${status.status}`);
    }

    await wait(intervalMs);
    intervalMs = Math.min(Math.round(intervalMs * 1.25), maxIntervalMs);
  }

  if (lastCompletedWithoutUrl) {
    throw new Error(
      `Tripo task completed but did not return a model URL. Raw status: ${JSON.stringify(
        lastCompletedWithoutUrl.rawStatus
      )}`
    );
  }

  throw new Error(`Timed out waiting for Tripo task ${taskId}.`);
}

export async function generateCharacterModel(prompt: string): Promise<TripoGenerationResult> {
  const submitted = await submitTextToModelTask(prompt);
  let done = await pollTripoTask(submitted.taskId);

  if (done.glbUrl && isFbxAsset(done.glbUrl)) {
    const convertTaskId = await submitConvertModelTask(done.taskId);
    done = await pollTripoTask(convertTaskId);
  }

  if (!done.glbUrl || !isGltfAsset(done.glbUrl)) {
    throw new Error(`Tripo returned unsupported model URL format: ${done.glbUrl ?? "none"}`);
  }

  return {
    taskId: done.taskId,
    status: done.status,
    glbUrl: done.glbUrl,
    rawStatus: done.rawStatus,
    prompt,
  };
}
