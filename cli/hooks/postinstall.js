#!/usr/bin/env node

// Postinstall: warm-up SQLite deps into ~/.flagshiprouter/runtime so the first
// `flagshiprouter` start doesn't need network. Failure here is non-fatal —
// cli.js will retry at runtime if anything is missing.
const { ensureSqliteRuntime } = require("./sqliteRuntime");
const { ensureTrayRuntime } = require("./trayRuntime");
const BRAND = require("../src/brand");

try {
  ensureSqliteRuntime({ silent: false });
  console.log(`[${BRAND.slug}] runtime SQLite deps ready`);
} catch (e) {
  console.warn(`[${BRAND.slug}] runtime warm-up skipped: ${e.message}`);
}

try {
  ensureTrayRuntime({ silent: false });
} catch (e) {
  console.warn(`[${BRAND.slug}] tray runtime skipped: ${e.message}`);
}

process.exit(0);
