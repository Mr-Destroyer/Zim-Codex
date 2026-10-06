"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useHeaderSearchStore } from "@/store/headerSearchStore";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import ProviderIcon from "@/shared/components/ProviderIcon";
import BrandMark from "@/shared/components/BrandMark";
import { SegmentedControl, CardSkeleton } from "@/shared/components";
import { BRAND } from "open-sse/config/brand.js";
import { cn } from "@/shared/utils/cn";

const PAGE_SIZE = 60;

const KIND_TABS = [
  { value: "llm", label: "Chat & code", icon: "forum" },
  { value: "image", label: "Image", icon: "brush" },
  { value: "tts", label: "Speech", icon: "record_voice_over" },
  { value: "stt", label: "Transcribe", icon: "mic" },
  { value: "embedding", label: "Embedding", icon: "data_array" },
  { value: "video", label: "Video", icon: "movie" },
  { value: "all", label: "All", icon: "apps" },
];

const KIND_LABELS = {
  llm: "Chat",
  image: "Image",
  imageToText: "Vision",
  tts: "Speech",
  stt: "Transcribe",
  embedding: "Embedding",
  video: "Video",
  music: "Music",
  systemone: "System One",
};

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "ready", label: "Ready now" },
  { value: "connect", label: "Needs connect" },
];

const CATEGORY_LABELS = { free: "Free", freeTier: "Free tier", apikey: "Free tier" };

function Stat({ label, value, accent = false }) {
  return (
    <div className="rounded-xl border border-border bg-surface/80 px-3.5 py-3">
      <p className={cn("text-2xl font-bold tracking-tight tabular-nums", accent ? "text-brand-gradient" : "text-text-main")}>{value}</p>
      <p className="text-[11px] font-medium uppercase tracking-wider text-text-subtle">{label}</p>
    </div>
  );
}

function KindTag({ children }) {
  return (
    <span className="shrink-0 rounded-md border border-border-subtle bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
      {children}
    </span>
  );
}

function ModelRow({ model, provider, copied, onCopy, test, onTest }) {
  const isRename = model.source === "rename";
  const providerHref = `/dashboard/providers/${model.providerId}`;

  return (
    <li
      className={cn(
        "grid grid-cols-1 items-center gap-3 px-4 py-3.5 transition-colors sm:px-5 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_auto] md:gap-4",
        "hover:bg-surface-2/60",
        isRename && "bg-brand-500/[0.05]",
      )}
    >
      {/* Model */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-semibold text-text-main">{model.name}</span>
          {isRename && (
            <span className="shrink-0 rounded-full bg-brand-gradient px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              {BRAND.name}
            </span>
          )}
          {model.kind !== "llm" && <KindTag>{KIND_LABELS[model.kind] || model.kind}</KindTag>}
          {model.source === "live" && (
            <span title="Listed live by the provider" className="shrink-0 rounded-full bg-signal/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-600 dark:text-cyan-300">
              LIVE
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onCopy(model.id)}
          title="Copy model ID"
          className="group mt-0.5 inline-flex max-w-full items-center gap-1 font-mono text-[12px] text-text-muted hover:text-primary"
        >
          <span className="truncate">{model.id}</span>
          <span className="material-symbols-outlined text-[13px] opacity-60 group-hover:opacity-100">
            {copied === model.id ? "check" : "content_copy"}
          </span>
        </button>
      </div>

      {/* Provider */}
      {isRename ? (
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandMark className="size-[26px] shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-text-main">{BRAND.name}</p>
            <p className="truncate text-[11px] text-text-subtle">via {BRAND.name}</p>
          </div>
        </div>
      ) : (
        <Link href={providerHref} className="flex min-w-0 items-center gap-2.5 hover:opacity-80">
          <span className="flex size-[26px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-2">
            <ProviderIcon
              providerId={model.providerId}
              alt={provider?.name || model.providerId}
              size={26}
              className="rounded-md object-contain"
              fallbackText={provider?.textIcon || model.providerAlias.slice(0, 2).toUpperCase()}
              fallbackColor={provider?.color || undefined}
            />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-text-main">{provider?.name || model.providerId}</p>
            <p className="truncate text-[11px] text-text-subtle">
              {CATEGORY_LABELS[provider?.category] || "Free"}
              {provider?.noAuth ? " · no signup" : ""}
            </p>
          </div>
        </Link>
      )}

      {/* Status */}
      <div className="flex items-center gap-2 md:justify-end">
        {model.ready ? (
          <>
            {model.kind === "llm" && (
              <button
                type="button"
                onClick={() => onTest(model)}
                disabled={test?.state === "running"}
                className="inline-flex h-7 items-center gap-1 rounded-lg border border-border px-2.5 text-[12px] font-medium text-text-muted transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-60"
              >
                <span className={cn("material-symbols-outlined text-[14px]", test?.state === "running" && "animate-spin")}>
                  {test?.state === "running" ? "progress_activity" : "bolt"}
                </span>
                Test
              </button>
            )}
            {test?.state === "done" ? (
              <span
                title={test.error || undefined}
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold",
                  test.ok ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400",
                )}
              >
                <span className="material-symbols-outlined text-[14px]">{test.ok ? "check_circle" : "error"}</span>
                {test.ok ? `${test.latencyMs} ms` : "Failed"}
              </span>
            ) : (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Ready
              </span>
            )}
          </>
        ) : (
          <Link
            href={providerHref}
            className="inline-flex h-7 items-center gap-1 rounded-lg bg-primary px-3 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover"
          >
            <span className="material-symbols-outlined text-[14px]">link</span>
            Connect
          </Link>
        )}
      </div>
    </li>
  );
}

export default function ModelsPage() {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState(null);
  const [kind, setKind] = useState("llm");
  const [status, setStatus] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [tests, setTests] = useState({});
  const { copied, copy } = useCopyToClipboard(1500);
  const query = useHeaderSearchStore((s) => s.query);

  useEffect(() => {
    const { register, unregister } = useHeaderSearchStore.getState();
    register("Search models or providers…");
    return () => unregister();
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/models/catalog", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setCatalog(data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setLimit(PAGE_SIZE); }, [kind, status, providerFilter, query]);

  const providersById = useMemo(
    () => Object.fromEntries((catalog?.providers || []).map((p) => [p.id, p])),
    [catalog],
  );

  const kindCounts = useMemo(() => {
    const counts = { all: 0 };
    for (const m of catalog?.models || []) {
      counts[m.kind] = (counts[m.kind] || 0) + 1;
      counts.all += 1;
    }
    return counts;
  }, [catalog]);

  const sorted = useMemo(() => {
    const rank = (m) => (m.source === "rename" ? 0 : m.ready ? 1 : 2);
    return [...(catalog?.models || [])].sort((a, b) => {
      const byRank = rank(a) - rank(b);
      if (byRank) return byRank;
      const pa = providersById[a.providerId]?.name || a.providerId;
      const pb = providersById[b.providerId]?.name || b.providerId;
      return pa === pb ? 0 : pa.localeCompare(pb);
    });
  }, [catalog, providersById]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter((m) => {
      if (kind !== "all" && m.kind !== kind) return false;
      if (status === "ready" && !m.ready) return false;
      if (status === "connect" && m.ready) return false;
      // Renamed models present as the router's own, so they never surface under an upstream provider.
      const isRename = m.source === "rename";
      if (providerFilter !== "all" && (isRename || m.providerId !== providerFilter)) return false;
      if (!q) return true;
      const providerName = isRename ? BRAND.name : providersById[m.providerId]?.name;
      return [m.name, m.id, providerName].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [sorted, kind, status, providerFilter, query, providersById]);

  const providerOptions = useMemo(
    () => (catalog?.providers || [])
      .filter((p) => p.models > 0)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [catalog],
  );

  const handleTest = useCallback(async (model) => {
    setTests((prev) => ({ ...prev, [model.id]: { state: "running" } }));
    try {
      const res = await fetch("/api/models/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: model.id, kind: model.kind }),
      });
      const data = await res.json();
      setTests((prev) => ({ ...prev, [model.id]: { state: "done", ok: !!data.ok, latencyMs: data.latencyMs, error: data.error } }));
    } catch (err) {
      setTests((prev) => ({ ...prev, [model.id]: { state: "done", ok: false, error: err.message } }));
    }
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <span className="material-symbols-outlined text-[32px] text-text-muted">cloud_off</span>
        <p className="mt-2 text-sm text-text-muted">Could not load the model catalog: {error}</p>
        <button type="button" onClick={load} className="mt-4 text-sm font-semibold text-primary hover:underline">Try again</button>
      </div>
    );
  }

  if (!catalog) {
    return (
      <div className="flex flex-col gap-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const readyCount = catalog.models.filter((m) => m.ready).length;
  const freeProviderCount = catalog.providers.filter((p) => p.models > 0).length;
  const visible = filtered.slice(0, limit);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* Summary */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6 sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-brand-gradient opacity-[0.07]" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-signal/20 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Free model catalog</p>
            <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-text-main sm:text-[28px]">
              {kindCounts.llm || 0} chat models. Zero cost.
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
              Every model {BRAND.name} routes to comes from a free or free-tier provider. Copy an ID into
              your coding tool, or connect a provider once to unlock its models.
            </p>
          </div>
          <div className="grid shrink-0 grid-cols-3 gap-2.5 sm:w-[360px]">
            <Stat label="Models" value={catalog.models.length} />
            <Stat label="Ready now" value={readyCount} accent />
            <Stat label="Providers" value={freeProviderCount} />
          </div>
        </div>
      </section>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <SegmentedControl
          size="sm"
          value={kind}
          onChange={setKind}
          className="max-w-full"
          options={KIND_TABS.filter((t) => t.value === "all" || kindCounts[t.value]).map((t) => ({
            value: t.value,
            label: `${t.label} · ${kindCounts[t.value] || 0}`,
          }))}
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            aria-label="Filter by provider"
            className="h-8 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-text-main outline-none transition-colors hover:border-primary/40 focus:border-primary"
          >
            <option value="all">All free providers</option>
            {providerOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.models})</option>
            ))}
          </select>
          <SegmentedControl size="sm" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        </div>
      </div>

      {/* Model list */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)]">
        <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_auto] gap-4 border-b border-border bg-surface-2/60 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-subtle md:grid">
          <span>Model</span>
          <span>Provider</span>
          <span className="text-right">Status</span>
        </div>
        {visible.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="material-symbols-outlined text-[32px] text-text-muted">search_off</span>
            <p className="mt-2 text-sm text-text-muted">No models match these filters.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {visible.map((model) => (
              <ModelRow
                key={model.id}
                model={model}
                provider={providersById[model.providerId]}
                copied={copied}
                onCopy={copy}
                test={tests[model.id]}
                onTest={handleTest}
              />
            ))}
          </ul>
        )}
        {filtered.length > visible.length && (
          <div className="border-t border-border-subtle p-3 text-center">
            <button
              type="button"
              onClick={() => setLimit((n) => n + PAGE_SIZE)}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/10"
            >
              Show {Math.min(PAGE_SIZE, filtered.length - visible.length)} more
              <span className="text-text-muted font-normal">({filtered.length - visible.length} left)</span>
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-text-subtle">
        Use any ID above as the <code className="rounded bg-surface-2 px-1 font-mono">model</code> in your tool — the
        endpoint lives on the <Link href="/dashboard/endpoint" className="font-semibold text-primary hover:underline">Endpoint &amp; Key</Link> page.
      </p>
    </div>
  );
}
