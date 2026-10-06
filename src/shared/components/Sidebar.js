"use client";

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/utils/cn";
import { APP_CONFIG, UPDATER_CONFIG } from "@/shared/constants/config";
import { MEDIA_PROVIDER_KINDS } from "@/shared/constants/providers";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { useLocationPart } from "@/shared/hooks/useLocationPart";
import useSettingsStore from "@/store/settingsStore";
import { BRAND } from "open-sse/config/brand.js";
import Button from "./Button";
import BrandMark from "./BrandMark";
import { ConfirmModal } from "./Modal";

const VISIBLE_MEDIA_KINDS = ["embedding", "image", "video", "tts", "stt", "systemone"];
// webSearch + webFetch share one page at /dashboard/media-providers/web
const COMBINED_WEB_ITEM = { id: "web", label: "Web Fetch & Search", icon: "travel_explore", href: "/dashboard/media-providers/web" };
const HEALTH_POLL_MS = 20000;

// "Models" replaces the upstream provider list; provider detail pages live under it.
const NAV_GROUPS = [
  {
    label: "Route",
    items: [
      { href: "/dashboard/endpoint", label: "Endpoint & Key", icon: "api" },
      { href: "/dashboard/models", label: "Models", icon: "neurology", match: ["/dashboard/models", "/dashboard/providers"] },
      { href: "/dashboard/combos", label: "Combos & Vision", icon: "layers" },
      { href: "/dashboard/token-saver", label: "Token Saver", icon: "savings" },
    ],
  },
  {
    label: "Integrate",
    items: [
      { href: "/dashboard/cli-tools", label: "CLI Tools", icon: "terminal" },
      { id: "media", label: "Media Models", icon: "perm_media" },
      { href: "/dashboard/skills", label: "Agent Skills", icon: "extension" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/dashboard/proxy-pools", label: "Proxy Pools", icon: "lan" },
      { href: "/dashboard/console-log", label: "Console Log", icon: "receipt_long" },
      { href: "/dashboard/translator", label: "Translator", icon: "translate", requiresTranslator: true },
      { href: "/dashboard/profile", label: "Settings", icon: "settings" },
    ],
  },
];

function RailLink({ href, icon, label, active, onClick, badge, indent = false }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-[7px] text-[13px] font-medium transition-colors",
        indent && "pl-9 text-[12.5px]",
        active ? "bg-rail-active text-white" : "text-rail-text/85 hover:bg-white/[0.05] hover:text-white",
      )}
    >
      {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-brand-gradient" aria-hidden="true" />}
      <span
        className={cn(
          "material-symbols-outlined text-[18px]",
          active ? "fill-1 text-brand-300" : "text-rail-muted group-hover:text-brand-300",
        )}
      >
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {badge}
    </Link>
  );
}

RailLink.propTypes = {
  href: PropTypes.string.isRequired,
  icon: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  active: PropTypes.bool,
  onClick: PropTypes.func,
  badge: PropTypes.node,
  indent: PropTypes.bool,
};

function ServerStatus({ online }) {
  const origin = useLocationPart("host");
  return (
    <div className="mx-3 mb-3 rounded-xl border border-rail-border bg-rail-2 px-3.5 py-3">
      <div className="flex items-center gap-2">
        <span className="relative flex size-2">
          {online && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
          <span className={cn("relative inline-flex size-2 rounded-full", online ? "bg-emerald-400" : "bg-red-400")} />
        </span>
        <span className="text-[12px] font-semibold text-white">{online ? "Router online" : "Router offline"}</span>
        <span className="ml-auto text-[11px] text-rail-muted">v{APP_CONFIG.version}</span>
      </div>
      {origin && <p className="mt-1 truncate font-mono text-[11px] text-rail-muted">{origin}/v1</p>}
    </div>
  );
}

ServerStatus.propTypes = { online: PropTypes.bool };

export default function Sidebar({ onClose }) {
  const pathname = usePathname();
  const [mediaOpen, setMediaOpen] = useState(() => pathname?.startsWith("/dashboard/media-providers") || false);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [online, setOnline] = useState(true);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [shutdownCountdown, setShutdownCountdown] = useState(0);
  const [enableTranslator, setEnableTranslator] = useState(false);
  const { copied, copy } = useCopyToClipboard(2000);

  const INSTALL_CMD = UPDATER_CONFIG.installCmdLatest;

  useEffect(() => {
    useSettingsStore.getState().fetchSettings().then((data) => {
      if (data?.enableTranslator) setEnableTranslator(true);
    });
  }, []);

  // Live router status for the rail footer.
  useEffect(() => {
    let stopped = false;
    const check = () => fetch("/api/health", { cache: "no-store" })
      .then((res) => { if (!stopped) setOnline(res.ok); })
      .catch(() => { if (!stopped) setOnline(false); });
    check();
    const timer = setInterval(check, HEALTH_POLL_MS);
    return () => { stopped = true; clearInterval(timer); };
  }, []);

  // Update check only when enabled in brand.json (updateCheck) — see /api/version.
  useEffect(() => {
    if (!BRAND.updateCheck) return undefined;
    const timer = setTimeout(() => {
      fetch("/api/version")
        .then(res => res.json())
        .then(data => { if (data.hasUpdate) setUpdateInfo(data); })
        .catch(() => {});
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  const isActive = (item) => {
    if (item.href === "/dashboard/endpoint") {
      return pathname === "/dashboard" || pathname.startsWith("/dashboard/endpoint");
    }
    const prefixes = item.match || [item.href];
    return prefixes.some((prefix) => pathname.startsWith(prefix));
  };

  const handleUpdate = () => {
    setShowUpdateModal(false);
    setIsUpdating(true);
  };

  // Copy install command, count down, then stop the server so the user can reinstall.
  const handleCopyAndShutdown = async () => {
    try { await navigator.clipboard.writeText(INSTALL_CMD); } catch { /* clipboard blocked */ }
    copy(INSTALL_CMD);
    let remaining = UPDATER_CONFIG.shutdownCountdownSec;
    setShutdownCountdown(remaining);
    const timer = setInterval(() => {
      remaining -= 1;
      setShutdownCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        fetch("/api/version/shutdown", { method: "POST" }).catch(() => {});
        setIsDisconnected(true);
      }
    }, 1000);
  };

  const handleCancelUpdate = () => {
    setIsUpdating(false);
    setShutdownCountdown(0);
  };

  const mediaActive = pathname.startsWith("/dashboard/media-providers");

  return (
    <>
      <aside className="flex min-h-full w-[264px] flex-col border-r border-rail-border bg-rail text-rail-text">
        {/* Brand */}
        <div className="px-5 pb-5 pt-6">
          <Link href="/dashboard" onClick={onClose} className="flex items-center gap-3">
            <BrandMark className="size-9 shrink-0 drop-shadow-[0_6px_16px_rgba(79,107,255,0.45)]" />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold tracking-tight text-white">{BRAND.name}</p>
              <p className="truncate text-[11px] text-rail-muted">Free models router</p>
            </div>
          </Link>
          {updateInfo && (
            <div className="mt-4 rounded-lg border border-brand-400/30 bg-brand-500/10 p-2.5">
              <p className="text-[11px] font-semibold text-brand-200">New version v{updateInfo.latestVersion}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <button
                  onClick={() => setShowUpdateModal(true)}
                  className="rounded-md bg-brand-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-brand-600"
                >
                  Update
                </button>
                <button onClick={() => copy(INSTALL_CMD)} title="Copy install command" className="min-w-0 flex-1 text-left">
                  <code className="block truncate font-mono text-[10px] text-brand-200/80">{copied ? "✓ copied!" : INSTALL_CMD}</code>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="custom-scrollbar flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-rail-muted/80">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  if (item.requiresTranslator && !enableTranslator) return null;
                  if (item.id === "media") {
                    return (
                      <div key={item.id}>
                        <button
                          type="button"
                          onClick={() => setMediaOpen((v) => !v)}
                          className={cn(
                            "group flex w-full items-center gap-3 rounded-lg px-3 py-[7px] text-[13px] font-medium transition-colors",
                            mediaActive ? "text-white" : "text-rail-text/85 hover:bg-white/[0.05] hover:text-white",
                          )}
                        >
                          <span className={cn("material-symbols-outlined text-[18px]", mediaActive ? "text-brand-300" : "text-rail-muted group-hover:text-brand-300")}>
                            {item.icon}
                          </span>
                          <span className="flex-1 text-left">{item.label}</span>
                          <span className="material-symbols-outlined text-[16px] text-rail-muted transition-transform" style={{ transform: mediaOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                            expand_more
                          </span>
                        </button>
                        {mediaOpen && (
                          <div className="mt-0.5 space-y-0.5">
                            {MEDIA_PROVIDER_KINDS.filter((k) => VISIBLE_MEDIA_KINDS.includes(k.id)).map((kind) => (
                              <RailLink
                                key={kind.id}
                                href={`/dashboard/media-providers/${kind.id}`}
                                icon={kind.icon}
                                label={kind.label}
                                indent
                                onClick={onClose}
                                active={pathname.startsWith(`/dashboard/media-providers/${kind.id}`)}
                              />
                            ))}
                            <RailLink
                              href={COMBINED_WEB_ITEM.href}
                              icon={COMBINED_WEB_ITEM.icon}
                              label={COMBINED_WEB_ITEM.label}
                              indent
                              onClick={onClose}
                              active={pathname.startsWith(COMBINED_WEB_ITEM.href)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  }
                  return (
                    <RailLink
                      key={item.href}
                      href={item.href}
                      icon={item.icon}
                      label={item.label}
                      onClick={onClose}
                      active={isActive(item)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <ServerStatus online={online && !isDisconnected} />
      </aside>

      <ConfirmModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        onConfirm={handleUpdate}
        title={`Update ${BRAND.name}`}
        message={`Show install command for v${updateInfo?.latestVersion || ""}? You can copy it and shutdown to install manually.`}
        confirmText="Show Command"
        cancelText="Cancel"
        variant="primary"
      />

      {/* Disconnected / Updating Overlay */}
      {(isDisconnected || isUpdating) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm">
          {isUpdating ? (
            <ManualUpdatePanel
              latestVersion={updateInfo?.latestVersion}
              installCmd={INSTALL_CMD}
              copied={copied}
              onCopyAndShutdown={handleCopyAndShutdown}
              onCancel={handleCancelUpdate}
              countdown={shutdownCountdown}
              isDisconnected={isDisconnected}
            />
          ) : (
            <div className="p-8 text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-red-500/20 text-red-500">
                <span className="material-symbols-outlined text-[32px]">power_off</span>
              </div>
              <h2 className="mb-2 text-xl font-semibold text-white">Server Disconnected</h2>
              <p className="mb-6 text-text-muted">The router has been stopped.</p>
              <Button variant="secondary" onClick={() => globalThis.location.reload()}>
                Reload Page
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

Sidebar.propTypes = {
  onClose: PropTypes.func,
};

function ManualUpdatePanel({ latestVersion, installCmd, copied, onCopyAndShutdown, onCancel, countdown, isDisconnected }) {
  const isCountingDown = countdown > 0;
  return (
    <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0B1226]/95 p-6 text-white">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-full bg-brand-500/20 text-brand-300">
          <span className="material-symbols-outlined text-[24px]">content_copy</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold">Update {BRAND.name}{latestVersion ? ` to v${latestVersion}` : ""}</h2>
          <p className="text-xs text-white/60">
            {isDisconnected
              ? "Server stopped. Paste the command into a terminal to install."
              : isCountingDown
                ? `Command copied. Server will stop in ${countdown}s...`
                : "Click the button below to copy the install command and shutdown."}
          </p>
        </div>
      </div>

      <p className="mb-2 text-sm text-white/80">Install command:</p>
      <div className="mb-4 w-full rounded bg-white/5 px-3 py-2">
        <code className="break-all font-mono text-xs text-brand-200">{installCmd}</code>
      </div>

      <ol className="mb-4 list-inside list-decimal space-y-1 text-xs text-white/70">
        <li>Click <strong>Copy & Shutdown</strong> below.</li>
        <li>Paste the command into your terminal and press Enter.</li>
        <li>Run <code className="rounded bg-white/10 px-1 text-emerald-300">{BRAND.cliCommand}</code> again after install.</li>
      </ol>

      {isDisconnected ? (
        <Button variant="secondary" fullWidth onClick={() => globalThis.location.reload()}>
          Reload Page
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={isCountingDown}>
            Cancel
          </Button>
          <Button variant="primary" fullWidth onClick={onCopyAndShutdown} disabled={isCountingDown}>
            {copied ? "✓ Copied — shutting down..." : isCountingDown ? `Shutting down in ${countdown}s` : "Copy & Shutdown"}
          </Button>
        </div>
      )}
    </div>
  );
}

ManualUpdatePanel.propTypes = {
  latestVersion: PropTypes.string,
  installCmd: PropTypes.string.isRequired,
  copied: PropTypes.bool,
  onCopyAndShutdown: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  countdown: PropTypes.number,
  isDisconnected: PropTypes.bool,
};
