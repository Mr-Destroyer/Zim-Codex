// Brand accessor (CommonJS) for the CLI launcher. Reads the same /brand.json the app uses:
// the published package ships a copy next to cli.js (see scripts/build-cli.js); a repo
// checkout falls back to the root file.
const fs = require("fs");
const path = require("path");

const CANDIDATES = [
  path.join(__dirname, "..", "brand.json"),
  path.join(__dirname, "..", "..", "brand.json"),
];

function loadBrand() {
  for (const file of CANDIDATES) {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  }
  throw new Error("brand.json not found next to the CLI or at the repo root");
}

const RAW = loadBrand();

module.exports = Object.freeze({
  name: RAW.name,
  slug: RAW.slug,
  modelPrefix: RAW.modelPrefix || RAW.slug,
  tagline: RAW.tagline || "",
  repository: (RAW.repository || "").replace(/\/+$/, ""),
  npmPackage: RAW.slug,
  cliCommand: RAW.slug,
  dataDirName: RAW.slug,
  updateCheck: RAW.updateCheck === true,
});
