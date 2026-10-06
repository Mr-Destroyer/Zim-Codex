// Product provider policy (brand.json → "providers"). The routing engine keeps the full
// registry so executors and translators stay intact; the dashboard, the management APIs and
// the connection store only expose providers that pass isProviderAllowed().
import REGISTRY from "./registry/index.js";
import { PROVIDER_POLICY } from "../config/brand.js";

const CUSTOM_ENDPOINT_PREFIXES = ["openai-compatible-", "anthropic-compatible-", "custom-embedding-"];

// id, alias, uiAlias and extra aliases all resolve to the same entry.
const ENTRY_BY_KEY = new Map();
for (const entry of REGISTRY) {
  for (const key of [entry.id, entry.alias, entry.uiAlias, ...(entry.aliases || [])]) {
    if (key && !ENTRY_BY_KEY.has(key)) ENTRY_BY_KEY.set(key, entry);
  }
}

export function isFreeRegistryEntry(entry) {
  if (!entry) return false;
  if (PROVIDER_POLICY.include.includes(entry.id)) return true;
  if (PROVIDER_POLICY.categories.includes(entry.category)) return true;
  return PROVIDER_POLICY.includeHasFree && entry.hasFree === true;
}

// `exclude` always wins, even with freeOnly off.
export function isRegistryEntryAllowed(entry) {
  if (!entry) return false;
  if (PROVIDER_POLICY.exclude.includes(entry.id)) return false;
  return PROVIDER_POLICY.freeOnly ? isFreeRegistryEntry(entry) : true;
}

export function isCustomEndpointProvider(providerId) {
  return typeof providerId === "string" && CUSTOM_ENDPOINT_PREFIXES.some((p) => providerId.startsWith(p));
}

export function areCustomEndpointsAllowed() {
  return PROVIDER_POLICY.customEndpoints || !PROVIDER_POLICY.freeOnly;
}

// Accepts a provider id or any of its aliases.
export function isProviderAllowed(providerId) {
  if (!providerId || typeof providerId !== "string") return false;
  if (isCustomEndpointProvider(providerId)) return areCustomEndpointsAllowed();
  const entry = ENTRY_BY_KEY.get(providerId);
  if (entry) return isRegistryEntryAllowed(entry);
  return !PROVIDER_POLICY.freeOnly;
}

export const ALLOWED_REGISTRY = PROVIDER_POLICY.freeOnly || PROVIDER_POLICY.exclude.length
  ? REGISTRY.filter(isRegistryEntryAllowed)
  : REGISTRY;

export { PROVIDER_POLICY };
