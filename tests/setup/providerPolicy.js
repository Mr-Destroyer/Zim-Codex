// Upstream engine tests exercise every provider in the registry, so they run with the
// brand.json free-only policy (and its exclude list) switched off. The product policy itself is covered by
// unit/brand-policy.test.js, which restores the real policy for its own imports.
import { vi } from "vitest";

vi.mock("../../open-sse/config/brand.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    PROVIDER_POLICY: Object.freeze({ ...actual.PROVIDER_POLICY, freeOnly: false, exclude: Object.freeze([]), customEndpoints: true }),
  };
});
