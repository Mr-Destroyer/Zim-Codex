// Brand accessor (ESM). Every product name, data-dir, CLI-tool provider key and model prefix
// is read from /brand.json — rename the product there, never by editing strings in code.
// CommonJS callers (cli/, src/mitm/) read the same file through cli/src/brand.js or require().
import RAW from "../../brand.json" with { type: "json" };

const slug = RAW.slug;
const branch = RAW.branch || "main";
const repository = (RAW.repository || "").replace(/\/+$/, "");
const github = repository.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/);

export const BRAND = Object.freeze({
  name: RAW.name,
  slug,
  // Provider key written into CLI tool configs, so models show up as `${modelPrefix}/<model>`.
  modelPrefix: RAW.modelPrefix || slug,
  tagline: RAW.tagline || "",
  description: RAW.description || "",
  repository,
  branch,
  githubRepo: github ? `${github[1]}/${github[2]}` : "",
  rawBaseUrl: github ? `https://raw.githubusercontent.com/${github[1]}/${github[2]}/refs/heads/${branch}` : "",
  npmPackage: slug,
  cliCommand: slug,
  // ~/.{dataDirName} on macOS/Linux, %APPDATA%/{dataDirName} on Windows.
  // Overridable so a rename can keep reading an existing data folder instead of orphaning it.
  dataDirName: RAW.dataDirName || slug,
  updateCheck: RAW.updateCheck === true,
});

// Public model renames: clients see `id`/`name`, the router calls `target` ("alias/model").
export const MODEL_RENAMES = Object.freeze(
  (RAW.models?.renames || [])
    .filter((r) => r && typeof r.id === "string" && typeof r.target === "string" && r.target.includes("/"))
    .map((r) => Object.freeze({
      id: r.id.trim(),
      name: (r.name || r.id).trim(),
      target: r.target.trim(),
      hideTarget: r.hideTarget !== false,
    })),
);

// Which registry entries the product exposes. Categories and the hasFree flag come from each
// open-sse/providers/registry/{id}.js entry; the rule itself lives in providers/policy.js.
const policy = RAW.providers || {};
export const PROVIDER_POLICY = Object.freeze({
  freeOnly: policy.freeOnly !== false,
  categories: Object.freeze([...(policy.categories || ["free", "freeTier"])]),
  includeHasFree: policy.includeHasFree !== false,
  include: Object.freeze([...(policy.include || [])]),
  exclude: Object.freeze([...(policy.exclude || [])]),
  customEndpoints: policy.customEndpoints === true,
});
