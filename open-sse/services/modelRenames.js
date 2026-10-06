// Public model renames (brand.json → models.renames).
// A client lists and calls the public id (e.g. "gpt-6-astra" or "GPT-6 Astra"); the router
// forwards the request to `target` (e.g. "oc/big-pickle") and rewrites every model field in
// the response back to the public name, so the upstream model never reaches the client.
import REGISTRY from "../providers/registry/index.js";
import { BRAND, MODEL_RENAMES } from "../config/brand.js";

const normalizeKey = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, "-");

// provider id / alias / extra aliases → canonical alias used in "alias/model" strings
const ALIAS_BY_KEY = new Map();
for (const entry of REGISTRY) {
  const alias = entry.alias || entry.id;
  for (const key of [entry.id, entry.alias, entry.uiAlias, ...(entry.aliases || [])]) {
    if (key && !ALIAS_BY_KEY.has(key)) ALIAS_BY_KEY.set(key, alias);
  }
}

function splitTarget(target) {
  const slash = target.indexOf("/");
  return { provider: target.slice(0, slash), model: target.slice(slash + 1) };
}

function canonicalTarget(provider, model) {
  return `${ALIAS_BY_KEY.get(provider) || provider}/${model}`;
}

const RENAME_BY_PUBLIC_KEY = new Map();
const RENAME_BY_TARGET = new Map();
for (const rename of MODEL_RENAMES) {
  for (const key of [rename.id, rename.name, `${BRAND.modelPrefix}/${rename.id}`, `${BRAND.modelPrefix}/${rename.name}`]) {
    RENAME_BY_PUBLIC_KEY.set(normalizeKey(key), rename);
  }
  const { provider, model } = splitTarget(rename.target);
  RENAME_BY_TARGET.set(canonicalTarget(provider, model), rename);
}

export function listModelRenames() {
  return MODEL_RENAMES.map((rename) => ({ ...rename, ...splitTarget(rename.target) }));
}

/** Rename entry for a client-supplied model string, or null. */
export function findModelRename(modelStr) {
  if (typeof modelStr !== "string" || !modelStr.trim()) return null;
  return RENAME_BY_PUBLIC_KEY.get(normalizeKey(modelStr)) || null;
}

/** Upstream "alias/model" for a public name; other model strings pass through unchanged. */
export function resolveRenamedModel(modelStr) {
  return findModelRename(modelStr)?.target || modelStr;
}

/** Rename entry whose target is this provider (id or alias) + model, or null. */
export function findRenameForTarget(provider, model) {
  if (!provider || !model) return null;
  return RENAME_BY_TARGET.get(canonicalTarget(provider, model)) || null;
}

/** True when a rename hides this upstream model from listings. */
export function isHiddenRenameTarget(provider, model) {
  return findRenameForTarget(provider, model)?.hideTarget === true;
}

// ── Response rewriting ─────────────────────────────────────────────────────
// Only the protocol's own model fields are touched (never message content or tool
// arguments): OpenAI chat `model`, Claude `message.model`, Responses API
// `response.model`, Gemini `modelVersion`.
function rewriteModelFields(payload, publicModel) {
  if (Array.isArray(payload)) return payload.reduce((changed, item) => rewriteModelFields(item, publicModel) || changed, false);
  if (!payload || typeof payload !== "object") return false;
  let changed = false;
  if (typeof payload.model === "string") { payload.model = publicModel; changed = true; }
  if (typeof payload.modelVersion === "string") { payload.modelVersion = publicModel; changed = true; }
  if (payload.message && typeof payload.message.model === "string") { payload.message.model = publicModel; changed = true; }
  if (payload.response && typeof payload.response.model === "string") { payload.response.model = publicModel; changed = true; }
  // Some upstreams tag assistant turns with their own persona (`name`); drop it so the
  // public model is the only identity the client sees.
  if (Array.isArray(payload.choices)) {
    for (const choice of payload.choices) {
      for (const part of [choice?.delta, choice?.message]) {
        if (part && typeof part.name === "string") { delete part.name; changed = true; }
      }
    }
  }
  return changed;
}

function rewriteSseLine(line, publicModel) {
  const match = /^(data:\s?)(.*)$/.exec(line);
  if (!match || !match[2] || match[2] === "[DONE]") return line;
  const trailingCr = match[2].endsWith("\r") ? "\r" : "";
  const json = trailingCr ? match[2].slice(0, -1) : match[2];
  try {
    const payload = JSON.parse(json);
    return rewriteModelFields(payload, publicModel) ? `${match[1]}${JSON.stringify(payload)}${trailingCr}` : line;
  } catch {
    return line;
  }
}

function hideUpstreamNames(text, rename, publicModel) {
  const { provider, model } = splitTarget(rename.target);
  const names = new Set([rename.target, `${provider}/${model}`, model]);
  for (const entry of REGISTRY) {
    if ((entry.alias || entry.id) === (ALIAS_BY_KEY.get(provider) || provider)) names.add(`${entry.id}/${model}`);
  }
  let out = text;
  for (const name of [...names].sort((a, b) => b.length - a.length)) out = out.split(name).join(publicModel);
  return out;
}

function copyHeaders(response) {
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return headers;
}

/**
 * Present an upstream response as the public model: rewrites model fields in JSON and SSE
 * bodies, and scrubs the upstream model name from error bodies.
 */
export async function presentResponseAsModel(response, rename, publicModel = rename?.id) {
  if (!response || !rename || !response.body) return response;
  const contentType = response.headers.get("content-type") || "";
  const init = { status: response.status, statusText: response.statusText, headers: copyHeaders(response) };

  if (contentType.includes("text/event-stream")) {
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffered = "";
    const transform = new TransformStream({
      transform(chunk, controller) {
        buffered += decoder.decode(chunk, { stream: true });
        const lines = buffered.split("\n");
        buffered = lines.pop();
        if (lines.length) controller.enqueue(encoder.encode(lines.map((l) => rewriteSseLine(l, publicModel)).join("\n") + "\n"));
      },
      flush(controller) {
        buffered += decoder.decode();
        if (buffered) controller.enqueue(encoder.encode(rewriteSseLine(buffered, publicModel)));
      },
    });
    return new Response(response.body.pipeThrough(transform), init);
  }

  if (contentType.includes("json")) {
    const text = await response.text();
    let out = text;
    try {
      const payload = JSON.parse(text);
      rewriteModelFields(payload, publicModel);
      out = JSON.stringify(payload);
    } catch { /* not JSON after all — pass the text through */ }
    if (response.status >= 400) out = hideUpstreamNames(out, rename, publicModel);
    return new Response(out, init);
  }

  if (response.status >= 400) {
    const text = await response.text();
    return new Response(hideUpstreamNames(text, rename, publicModel), init);
  }
  return response;
}
