#!/usr/bin/env node
// One command from a fresh clone:  npm run launch
// Installs dependencies, builds the CLI bundle when it is missing or older than the
// sources (including brand.json), then starts the CLI, which opens the browser UI.
// CLI options pass through after `--`, e.g.  npm run launch -- --host 127.0.0.1 -p 20130
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliDir = path.join(root, "cli");
const appDir = path.join(cliDir, "app");
const stampFile = path.join(appDir, ".launch-stamp");
const { name } = JSON.parse(fs.readFileSync(path.join(root, "brand.json"), "utf8"));
const isWindows = process.platform === "win32";
const npm = isWindows ? "npm.cmd" : "npm";

// Everything baked into the CLI bundle. A file newer than the last build triggers a rebuild;
// cli/cli.js, cli/src and cli/hooks run from source and never need one.
const BUILD_INPUTS = [
  "src", "open-sse", "public", "brand.json", "package.json",
  "next.config.mjs", "postcss.config.mjs", "jsconfig.json", "custom-server.js",
  "scripts", "cli/scripts",
];

// Next.js 16 (the dashboard and gateway) needs Node.js 20.9+.
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 20 || (major === 20 && minor < 9)) {
  console.error(`✖ ${name} needs Node.js 20.9 or newer — found ${process.versions.node}.`);
  process.exit(1);
}

function newestMtime(relPath) {
  const full = path.join(root, relPath);
  let stat;
  try { stat = fs.statSync(full); } catch { return 0; }
  if (!stat.isDirectory()) return stat.mtimeMs;
  // A directory's own mtime moves when files are added or removed.
  let newest = stat.mtimeMs;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    newest = Math.max(newest, newestMtime(path.join(relPath, entry.name)));
  }
  return newest;
}

// npm writes node_modules/.package-lock.json on every install; lockfiles are gitignored here,
// so package.json is the only input to compare against.
function needsInstall(dir) {
  const marker = path.join(dir, "node_modules", ".package-lock.json");
  if (!fs.existsSync(marker)) return true;
  return fs.statSync(path.join(dir, "package.json")).mtimeMs > fs.statSync(marker).mtimeMs;
}

function needsBuild() {
  if (!fs.existsSync(path.join(appDir, "custom-server.js"))) return true;
  let builtAt = 0;
  try { builtAt = Number(fs.readFileSync(stampFile, "utf8").trim()) || 0; } catch { /* no stamp yet */ }
  return BUILD_INPUTS.some((input) => newestMtime(input) > builtAt);
}

function step(label, args, cwd = root) {
  console.log(`\n▶ ${label}`);
  const res = spawnSync(npm, args, { cwd, stdio: "inherit", shell: isWindows });
  if (res.status !== 0) {
    console.error(`\n✖ ${label} failed${res.status == null ? "" : ` (exit ${res.status})`}.`);
    process.exit(res.status || 1);
  }
}

// Stamp brand.json into the package.json files first, so the build that follows finds them
// already in sync and doesn't rewrite them (which would trigger another rebuild next launch).
const sync = spawnSync(process.execPath, [path.join(root, "scripts", "brand-sync.mjs")], { cwd: root, encoding: "utf8" });
if (sync.status !== 0) {
  process.stderr.write(sync.stderr || sync.stdout || "brand-sync failed\n");
  process.exit(sync.status || 1);
}
if (/^updated /m.test(sync.stdout)) process.stdout.write(sync.stdout);

if (needsInstall(root)) step("Installing dependencies", ["install", "--no-audit", "--no-fund"]);
if (needsInstall(cliDir)) step("Installing CLI dependencies", ["install", "--no-audit", "--no-fund"], cliDir);

if (needsBuild()) {
  console.log(`\n${name}: building the app (first run or sources changed) — this takes a few minutes.`);
  // Recorded before building, so files edited while the build runs still trigger the next one.
  const startedAt = Date.now();
  step("Building", ["run", "build"], cliDir);
  fs.writeFileSync(stampFile, String(startedAt));
}

console.log(`\n▶ Starting ${name}\n`);
const cli = spawn(process.execPath, [path.join(cliDir, "cli.js"), ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
});
// The CLI handles Ctrl-C, terminal close and tray mode itself; this wrapper just waits for it.
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => {});
cli.on("exit", (code, signal) => process.exit(signal ? 1 : code ?? 0));
