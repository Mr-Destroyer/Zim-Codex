#!/usr/bin/env node
// Stamp brand.json into the static files that cannot read it at runtime:
// the root and CLI package.json (package name, bin command, description, keywords).
// Everything else — UI text, data dir, CLI-tool provider keys, model renames — reads
// brand.json directly. Run after editing brand.json:  npm run brand:sync
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brand = JSON.parse(fs.readFileSync(path.join(root, "brand.json"), "utf8"));
const { name, slug } = brand;

if (!name || !slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
  console.error("brand.json needs a display `name` and a lowercase npm-safe `slug` (a-z, 0-9, -).");
  process.exit(1);
}

function updateJson(file, mutate) {
  const full = path.join(root, file);
  const before = fs.readFileSync(full, "utf8");
  const data = JSON.parse(before);
  mutate(data);
  const after = `${JSON.stringify(data, null, 2)}\n`;
  if (after !== before) {
    fs.writeFileSync(full, after);
    console.log(`updated ${file}`);
  } else {
    console.log(`unchanged ${file}`);
  }
}

// Package names/bins/keywords may hold the previous slug; swap any stale entry for the current one.
const withSlug = (list = []) => [slug, ...list.filter((k) => k !== slug && !/router$/i.test(k))];

updateJson("package.json", (pkg) => {
  pkg.name = `${slug}-app`;
  pkg.description = `${name} web dashboard`;
});

updateJson("cli/package.json", (pkg) => {
  pkg.name = slug;
  pkg.description = `${name} CLI - Start and manage the ${name} server`;
  pkg.bin = { [slug]: "./cli.js" };
  pkg.keywords = withSlug(pkg.keywords);
  if (Array.isArray(pkg.files) && !pkg.files.includes("brand.json")) pkg.files.push("brand.json");
  if (brand.repository) pkg.repository = { type: "git", url: `git+${brand.repository}.git` };
  for (const key of Object.keys(pkg)) {
    if (key.startsWith("comment_") && typeof pkg[key] === "string") {
      pkg[key] = pkg[key].replace(/~\/\.[a-z0-9-]+\/runtime/g, `~/.${slug}/runtime`);
    }
  }
});

console.log(`brand: ${name} (${slug})`);
