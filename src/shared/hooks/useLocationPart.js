"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** A `window.location` field (e.g. "origin", "host"); empty during SSR and hydration. */
export function useLocationPart(part) {
  return useSyncExternalStore(subscribe, () => globalThis.location?.[part] || "", () => "");
}
