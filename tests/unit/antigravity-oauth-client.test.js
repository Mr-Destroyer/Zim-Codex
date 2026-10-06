// Google OAuth clients (Gemini CLI sign-in, Antigravity) are not shipped in the repository:
// shared.js reads them from the environment and every consumer reuses the shared constants.
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ENV = {
  ANTIGRAVITY_OAUTH_CLIENT_ID: "test-antigravity-client-id",
  ANTIGRAVITY_OAUTH_CLIENT_SECRET: "test-antigravity-client-secret",
  GEMINI_CLI_OAUTH_CLIENT_ID: "test-gemini-cli-client-id",
  GEMINI_CLI_OAUTH_CLIENT_SECRET: "test-gemini-cli-client-secret",
};
const here = dirname(fileURLToPath(import.meta.url));
const readSource = (rel) => readFileSync(join(here, "../..", rel), "utf8");

function freshEnv(env = {}) {
  vi.resetModules();
  for (const key of Object.keys(ENV)) delete process.env[key];
  Object.assign(process.env, env);
}

afterEach(() => {
  for (const key of Object.keys(ENV)) delete process.env[key];
  vi.resetModules();
});

describe("google oauth clients", () => {
  it("are empty when the environment does not provide them", async () => {
    freshEnv();
    const { ANTIGRAVITY_OAUTH_CLIENT, GOOGLE_OAUTH_CLIENT } = await import("../../open-sse/providers/shared.js");
    expect(ANTIGRAVITY_OAUTH_CLIENT).toEqual({ clientId: "", clientSecret: "" });
    expect(GOOGLE_OAUTH_CLIENT).toEqual({ clientId: "", clientSecret: "" });
  });

  it("read the Antigravity and Gemini CLI env vars", async () => {
    freshEnv(ENV);
    const { ANTIGRAVITY_OAUTH_CLIENT, GOOGLE_OAUTH_CLIENT } = await import("../../open-sse/providers/shared.js");
    expect(ANTIGRAVITY_OAUTH_CLIENT).toEqual({ clientId: ENV.ANTIGRAVITY_OAUTH_CLIENT_ID, clientSecret: ENV.ANTIGRAVITY_OAUTH_CLIENT_SECRET });
    expect(GOOGLE_OAUTH_CLIENT).toEqual({ clientId: ENV.GEMINI_CLI_OAUTH_CLIENT_ID, clientSecret: ENV.GEMINI_CLI_OAUTH_CLIENT_SECRET });
  });

  it("registry transports reuse the shared clients", async () => {
    freshEnv(ENV);
    const ag = (await import("../../open-sse/providers/registry/antigravity.js")).default;
    expect(ag.transport.clientId).toBe(ENV.ANTIGRAVITY_OAUTH_CLIENT_ID);
    expect(ag.transport.clientSecret).toBe(ENV.ANTIGRAVITY_OAUTH_CLIENT_SECRET);
    const gemini = (await import("../../open-sse/providers/registry/gemini.js")).default;
    const gc = (await import("../../open-sse/providers/registry/gemini-cli.js")).default;
    expect(gemini.transport.clientSecret).toBe(ENV.GEMINI_CLI_OAUTH_CLIENT_SECRET);
    expect(gc.transport.clientSecret).toBe(ENV.GEMINI_CLI_OAUTH_CLIENT_SECRET);
  });

  it("src oauth.js spreads the shared clients and derives the rest from the registry", () => {
    const src = readSource("src/lib/oauth/constants/oauth.js");
    expect(src).toContain('import { ANTIGRAVITY_OAUTH_CLIENT, GOOGLE_OAUTH_CLIENT } from "open-sse/providers/shared.js"');
    expect(src).toContain("...ANTIGRAVITY_OAUTH_CLIENT");
    expect(src).toContain("...GOOGLE_OAUTH_CLIENT");
    expect(src).toContain('PROVIDER_OAUTH["antigravity"]');
    expect(src).toContain('PROVIDER_OAUTH["gemini-cli"]');
  });

  it("no Google OAuth client values are hardcoded in source", () => {
    const files = [
      "open-sse/providers/shared.js",
      "open-sse/providers/registry/antigravity.js",
      "open-sse/providers/registry/gemini.js",
      "open-sse/providers/registry/gemini-cli.js",
      "src/lib/oauth/constants/oauth.js",
    ];
    for (const file of files) {
      const src = readSource(file);
      expect(src, file).not.toMatch(/apps\.googleusercontent\.com/);
      expect(src, file).not.toMatch(/GOCSPX-/);
    }
  });
});
