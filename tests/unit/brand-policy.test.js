// Product layer: brand.json accessors, the free-only provider policy and public model renames.
// tests/setup/providerPolicy.js disables the policy for engine tests, so this file restores
// the real brand module before importing anything that reads it.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const BRAND_JSON = JSON.parse(fs.readFileSync(new URL("../../brand.json", import.meta.url), "utf8"));

let brand;
let policy;
let renames;
let registry;
let tempDir;
let originalDataDir;

beforeAll(async () => {
  originalDataDir = process.env.DATA_DIR;
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "brand-policy-"));
  process.env.DATA_DIR = tempDir;
  vi.doUnmock("../../open-sse/config/brand.js");
  vi.resetModules();
  brand = await import("../../open-sse/config/brand.js");
  policy = await import("../../open-sse/providers/policy.js");
  renames = await import("../../open-sse/services/modelRenames.js");
  registry = (await import("../../open-sse/providers/registry/index.js")).default;
});

afterAll(() => {
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("brand accessor", () => {
  it("exposes brand.json identity with derived names", () => {
    expect(brand.BRAND.name).toBe(BRAND_JSON.name);
    expect(brand.BRAND.slug).toBe(BRAND_JSON.slug);
    expect(brand.BRAND.modelPrefix).toBe(BRAND_JSON.modelPrefix || BRAND_JSON.slug);
    expect(brand.BRAND.npmPackage).toBe(BRAND_JSON.slug);
    expect(brand.BRAND.dataDirName).toBe(BRAND_JSON.dataDirName || BRAND_JSON.slug);
  });

  it("derives the raw GitHub base from the repository URL", () => {
    const [, owner, repo] = BRAND_JSON.repository.match(/github\.com\/([^/]+)\/([^/]+)/);
    expect(brand.BRAND.githubRepo).toBe(`${owner}/${repo}`);
    expect(brand.BRAND.rawBaseUrl).toBe(`https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/${BRAND_JSON.branch || "main"}`);
  });

  it("keeps the CLI accessor in sync with the ESM accessor", async () => {
    const cliBrand = (await import("../../cli/src/brand.js")).default;
    expect(cliBrand.name).toBe(brand.BRAND.name);
    expect(cliBrand.slug).toBe(brand.BRAND.slug);
    expect(cliBrand.modelPrefix).toBe(brand.BRAND.modelPrefix);
  });
});

describe("free-only provider policy", () => {
  it("is on in brand.json", () => {
    expect(brand.PROVIDER_POLICY.freeOnly).toBe(true);
  });

  it("allows free, free-tier and hasFree providers", () => {
    for (const id of ["kiro", "opencode", "openrouter", "groq", "ollama-local"]) {
      expect(policy.isProviderAllowed(id), id).toBe(true);
    }
  });

  it("blocks every provider listed in brand.json exclude", () => {
    for (const id of BRAND_JSON.providers.exclude) {
      expect(policy.isProviderAllowed(id), id).toBe(false);
      expect(policy.ALLOWED_REGISTRY.some((e) => e.id === id), id).toBe(false);
    }
  });

  it("blocks paid subscription and API-key providers, by id or alias", () => {
    for (const id of ["claude", "cc", "codex", "openai", "anthropic", "cursor", "xai"]) {
      expect(policy.isProviderAllowed(id), id).toBe(false);
    }
  });

  it("blocks custom compatible endpoints unless enabled", () => {
    expect(policy.isProviderAllowed("openai-compatible-abc")).toBe(brand.PROVIDER_POLICY.customEndpoints);
    expect(policy.isProviderAllowed("anthropic-compatible-abc")).toBe(brand.PROVIDER_POLICY.customEndpoints);
  });

  it("exposes only free entries in ALLOWED_REGISTRY", () => {
    const { categories } = brand.PROVIDER_POLICY;
    expect(policy.ALLOWED_REGISTRY.length).toBeGreaterThan(0);
    expect(policy.ALLOWED_REGISTRY.length).toBeLessThan(registry.length);
    for (const entry of policy.ALLOWED_REGISTRY) {
      expect(categories.includes(entry.category) || entry.hasFree === true, entry.id).toBe(true);
    }
  });

  it("refuses to store a connection for a non-free provider", async () => {
    const { createProviderConnection } = await import("../../src/lib/db/repos/connectionsRepo.js");
    await expect(createProviderConnection({ provider: "openai", authType: "apikey", name: "k", apiKey: "sk-test" }))
      .rejects.toMatchObject({ code: "PROVIDER_NOT_ALLOWED", status: 403 });
  });
});

describe("public model renames", () => {
  const rename = () => BRAND_JSON.models.renames[0];

  it("resolves the public id, display name and prefixed form to the upstream target", () => {
    const { id, name, target } = rename();
    for (const input of [id, name, name.toUpperCase(), `${brand.BRAND.modelPrefix}/${id}`]) {
      expect(renames.findModelRename(input)?.target, input).toBe(target);
      expect(renames.resolveRenamedModel(input)).toBe(target);
    }
    expect(renames.resolveRenamedModel("kr/claude-sonnet-4.5")).toBe("kr/claude-sonnet-4.5");
  });

  it("hides the upstream target under both its provider id and alias", () => {
    const [alias, model] = rename().target.split("/");
    const entry = registry.find((e) => (e.alias || e.id) === alias);
    expect(renames.isHiddenRenameTarget(alias, model)).toBe(true);
    expect(renames.isHiddenRenameTarget(entry.id, model)).toBe(true);
    expect(renames.isHiddenRenameTarget(entry.id, "some-other-model")).toBe(false);
  });

  it("rewrites JSON model fields and drops upstream personas, leaving content alone", async () => {
    const r = renames.findModelRename(rename().id);
    const upstreamModel = rename().target.split("/")[1];
    const body = {
      model: upstreamModel,
      choices: [{ message: { role: "assistant", name: "Space Bunny", content: `{"model":"${upstreamModel}"}` } }],
    };
    const res = await renames.presentResponseAsModel(
      new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } }), r, rename().name,
    );
    const out = await res.json();
    expect(out.model).toBe(rename().name);
    expect(out.choices[0].message.name).toBeUndefined();
    expect(out.choices[0].message.content).toBe(`{"model":"${upstreamModel}"}`);
  });

  it("rewrites SSE model fields even when a line is split across chunks", async () => {
    const r = renames.findModelRename(rename().id);
    const upstreamModel = rename().target.split("/")[1];
    const event = `data: {"object":"chat.completion.chunk","model":"${upstreamModel}","choices":[{"delta":{"content":"hi"}}]}\n\n`;
    const claude = `event: message_start\ndata: {"type":"message_start","message":{"model":"${upstreamModel}"}}\n\ndata: [DONE]\n\n`;
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(event.slice(0, 25)));
        controller.enqueue(encoder.encode(event.slice(25) + claude));
        controller.close();
      },
    });
    const res = await renames.presentResponseAsModel(
      new Response(stream, { headers: { "content-type": "text/event-stream" } }), r, rename().id,
    );
    const text = await res.text();
    expect(text).not.toContain(upstreamModel);
    expect(text).toContain(`"model":"${rename().id}"`);
    expect(text).toContain("data: [DONE]");
    expect(text).toContain("event: message_start");
  });

  it("scrubs the upstream model from error bodies", async () => {
    const r = renames.findModelRename(rename().id);
    const target = rename().target;
    const res = await renames.presentResponseAsModel(
      new Response(JSON.stringify({ error: { message: `[${target}] rate limited` } }), {
        status: 429,
        headers: { "content-type": "application/json" },
      }),
      r,
      rename().id,
    );
    expect(res.status).toBe(429);
    const text = await res.text();
    expect(text).not.toContain(target);
    expect(text).toContain(rename().id);
  });
});
