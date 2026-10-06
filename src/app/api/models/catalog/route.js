import { NextResponse } from "next/server";
import { ALLOWED_REGISTRY } from "open-sse/providers/policy.js";
import { PROVIDER_MODELS } from "open-sse/config/providerModels.js";
import { getCapabilitiesForModel } from "open-sse/providers/capabilities.js";
import { listModelRenames, isHiddenRenameTarget } from "open-sse/services/modelRenames.js";
import { BRAND } from "open-sse/config/brand.js";
import { getProviderConnections } from "@/lib/localDb";
import { getDisabledModels } from "@/lib/disabledModelsDb";
import { FILTERS } from "../../providers/suggested-models/filters.js";

export const dynamic = "force-dynamic";

// GET /api/models/catalog — every model offered by the free providers (brand.json policy),
// with public renames applied. Feeds the dashboard Models screen.

const LIVE_TTL_MS = 10 * 60 * 1000;
const LIVE_TIMEOUT_MS = 6000;
const liveCache = new Map(); // providerId → { at, models }

// Media configs carry their own model lists; map each to the kind it serves.
const MEDIA_CONFIG_KINDS = {
  ttsConfig: "tts",
  sttConfig: "stt",
  embeddingConfig: "embedding",
  imageConfig: "image",
  imageToTextConfig: "imageToText",
  videoConfig: "video",
  musicConfig: "music",
};

function modelKind(model) {
  const kind = model?.kind || model?.type;
  return typeof kind === "string" && kind ? kind : "llm";
}

// Live lists come only from registry-declared fetcher URLs, never from request input.
async function fetchLiveModels(entry) {
  const fetcher = entry.modelsFetcher;
  const filter = fetcher?.url && FILTERS[fetcher.type];
  if (!filter) return [];
  const cached = liveCache.get(entry.id);
  if (cached && Date.now() - cached.at < LIVE_TTL_MS) return cached.models;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS);
  try {
    const res = await fetch(fetcher.url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const raw = json?.data ?? json?.models ?? json;
    const models = filter(Array.isArray(raw) ? raw : []);
    liveCache.set(entry.id, { at: Date.now(), models });
    return models;
  } catch {
    return cached?.models || [];
  } finally {
    clearTimeout(timer);
  }
}

function capsFor(alias, modelId, kind) {
  if (kind !== "llm") return {};
  const c = getCapabilitiesForModel(alias, modelId) || {};
  return {
    vision: !!c.vision,
    reasoning: !!c.reasoning,
    tools: c.tools !== false,
    contextWindow: Number.isFinite(c.contextWindow) ? c.contextWindow : null,
    maxOutput: Number.isFinite(c.maxOutput) ? c.maxOutput : null,
  };
}

function providerSummary(entry, connectedCount) {
  const display = entry.display || {};
  return {
    id: entry.id,
    alias: entry.alias || entry.id,
    name: display.name || entry.id,
    category: entry.category,
    noAuth: !!entry.noAuth,
    authType: entry.authType || (entry.oauth ? "oauth" : "apikey"),
    color: display.color || null,
    textIcon: display.textIcon || null,
    website: display.website || null,
    connected: connectedCount,
    ready: !!entry.noAuth || connectedCount > 0,
    hidden: !!entry.hidden,
  };
}

export async function GET() {
  try {
    const [connections, disabledByAlias] = await Promise.all([
      getProviderConnections().catch(() => []),
      getDisabledModels().catch(() => ({})),
    ]);

    const connectedByProvider = new Map();
    for (const conn of connections) {
      if (conn.isActive === false) continue;
      connectedByProvider.set(conn.provider, (connectedByProvider.get(conn.provider) || 0) + 1);
    }

    const entries = ALLOWED_REGISTRY.filter((entry) => !entry.hidden);
    const providers = [];
    const models = [];
    const seen = new Set();

    const liveLists = await Promise.all(entries.map((entry) => fetchLiveModels(entry)));

    entries.forEach((entry, index) => {
      const alias = entry.alias || entry.id;
      const provider = providerSummary(entry, connectedByProvider.get(entry.id) || 0);
      const disabled = new Set([...(disabledByAlias[alias] || []), ...(disabledByAlias[entry.id] || [])]);
      let count = 0;

      const add = (model, kind, source) => {
        const modelId = typeof model?.id === "string" ? model.id.trim() : "";
        if (!modelId || disabled.has(modelId)) return;
        if (isHiddenRenameTarget(entry.id, modelId)) return;
        const key = `${alias}/${modelId}`;
        if (seen.has(key)) return;
        seen.add(key);
        count += 1;
        const caps = capsFor(alias, modelId, kind);
        if (!caps.contextWindow && Number.isFinite(model.contextLength)) caps.contextWindow = model.contextLength;
        models.push({
          id: key,
          name: model.name && model.name !== modelId ? model.name : modelId,
          modelId,
          providerId: entry.id,
          providerAlias: alias,
          kind,
          caps,
          source,
          ready: provider.ready,
        });
      };

      for (const model of PROVIDER_MODELS[alias] || []) add(model, modelKind(model), "registry");
      for (const [configKey, kind] of Object.entries(MEDIA_CONFIG_KINDS)) {
        for (const model of entry[configKey]?.models || entry.media?.[configKey]?.models || []) add(model, kind, "registry");
      }
      for (const model of liveLists[index]) add(model, "llm", "live");

      providers.push({ ...provider, models: count });
    });

    // Public renames sit at the top of the catalog under their public id.
    const renamed = [];
    for (const rename of listModelRenames()) {
      const entry = ALLOWED_REGISTRY.find((e) => e.id === rename.provider || e.alias === rename.provider);
      if (!entry) continue;
      const alias = entry.alias || entry.id;
      const ready = !!entry.noAuth || (connectedByProvider.get(entry.id) || 0) > 0;
      // The upstream provider stays server-side; renamed models present as the router's own.
      renamed.push({
        id: rename.id,
        name: rename.name,
        modelId: rename.id,
        providerId: BRAND.slug,
        providerAlias: BRAND.slug,
        kind: "llm",
        caps: capsFor(alias, rename.model, "llm"),
        source: "rename",
        ready,
      });
    }

    return NextResponse.json({
      brand: { name: BRAND.name, modelPrefix: BRAND.modelPrefix },
      providers,
      models: [...renamed, ...models],
    });
  } catch (error) {
    console.log("Error building model catalog:", error);
    return NextResponse.json({ error: "Failed to build model catalog" }, { status: 500 });
  }
}
