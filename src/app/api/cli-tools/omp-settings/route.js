"use server";

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { BRAND } from "open-sse/config/brand.js";

const execAsync = promisify(exec);

const PROVIDER_ID = BRAND.modelPrefix;
const getOmpDir = () => path.join(os.homedir(), ".omp", "agent");
const getOmpDbPath = () => path.join(getOmpDir(), "agent.db");
const getOmpModelsYmlPath = () => path.join(getOmpDir(), "models.yml");

const checkOmpInstalled = async () => {
  const isWindows = os.platform() === "win32";
  try {
    const command = isWindows ? "where omp" : "which omp";
    await execAsync(command, { windowsHide: true });
    return true;
  } catch {
    try {
      await fs.access(getOmpDbPath());
      return true;
    } catch {
      try {
        await fs.access(getOmpModelsYmlPath());
        return true;
      } catch {
        return false;
      }
    }
  }
};

const readModelsYml = async () => {
  try {
    return await fs.readFile(getOmpModelsYmlPath(), "utf-8");
  } catch {
    return "";
  }
};

const hasRouterInYml = (content) => {
  if (!content) return false;
  return content.includes(`${BRAND.modelPrefix}:`) || content.includes("localhost:20128");
};

// Build standard ZimRouter provider block for models.yml
const buildOmpProviderYaml = (baseUrl, apiKey) => {
  const normalizedBaseUrl = baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
  const key = apiKey || `sk_${BRAND.modelPrefix}`;
  return `  ${PROVIDER_ID}:
    baseUrl: ${normalizedBaseUrl}
    apiKey: ${key}
    api: openai-completions
    authHeader: true
    disableStrictTools: true
    discovery:
      type: proxy`;
};

export async function GET() {
  try {
    const installed = await checkOmpInstalled();
    if (!installed) {
      return NextResponse.json({
        installed: false,
        config: null,
        message: "Oh My Pi is not installed",
      });
    }

    const ymlContent = await readModelsYml();
    const hasRouter = hasRouterInYml(ymlContent);

    return NextResponse.json({
      installed: true,
      hasRouter,
      configPath: getOmpModelsYmlPath(),
    });
  } catch (err) {
    return NextResponse.json({ error: { message: err.message } }, { status: 500 });
  }
}

export async function POST(request) {
  let rawBody;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON body" } }, { status: 400 });
  }

  try {
    const { baseUrl, apiKey } = rawBody || {};
    if (!baseUrl) {
      return NextResponse.json({ error: { message: "baseUrl is required" } }, { status: 400 });
    }

    await fs.mkdir(getOmpDir(), { recursive: true });

    let ymlContent = await readModelsYml();
    const providerBlock = buildOmpProviderYaml(baseUrl, apiKey);

    // Remove existing zimrouter provider if present
    const regex = new RegExp(`\\s*${PROVIDER_ID}:[\\s\\S]*?(?=\\n\\s*\\w+:|$)`, "g");
    ymlContent = ymlContent.replace(regex, "");

    if (!ymlContent.trim()) {
      ymlContent = `providers:\n${providerBlock}\n`;
    } else if (ymlContent.includes("providers:")) {
      ymlContent = ymlContent.replace(/providers:/, `providers:\n${providerBlock}`);
    } else {
      ymlContent = `${ymlContent.trim()}\n\nproviders:\n${providerBlock}\n`;
    }

    await fs.writeFile(getOmpModelsYmlPath(), ymlContent, "utf-8");

    // Best-effort update to agent.db if better-sqlite3 or node:sqlite is present
    try {
      let Database;
      try {
        const mod = await import("better-sqlite3");
        Database = mod.default || mod;
      } catch {
        // fallback ignored
      }
      if (Database) {
        const dbPath = getOmpDbPath();
        const db = new Database(dbPath);
        db.prepare("DELETE FROM auth_credentials WHERE provider = ?").run(PROVIDER_ID);
        db.prepare(
          "INSERT INTO auth_credentials (provider, credential_type, data, disabled_cause, identity_key, created_at, updated_at) VALUES (?, ?, ?, NULL, NULL, ?, ?)"
        ).run(
          PROVIDER_ID,
          "api_key",
          JSON.stringify({ apiKey: apiKey || `sk_${BRAND.modelPrefix}`, baseUrl }),
          Math.floor(Date.now() / 1000),
          Math.floor(Date.now() / 1000)
        );
        db.close();
      }
    } catch {
      // Non-critical: models.yml is primary
    }

    return NextResponse.json({
      success: true,
      message: `Oh My Pi settings applied! Run 'omp' and all ${BRAND.name} models appear under ${BRAND.modelPrefix} in /model.`,
      configPath: getOmpModelsYmlPath(),
    });
  } catch (err) {
    return NextResponse.json({ error: { message: err.message } }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    let ymlContent = await readModelsYml();
    const regex = new RegExp(`\\s*${PROVIDER_ID}:[\\s\\S]*?(?=\\n\\s*\\w+:|$)`, "g");
    ymlContent = ymlContent.replace(regex, "");

    if (ymlContent.trim() === "providers:") {
      await fs.rm(getOmpModelsYmlPath(), { force: true });
    } else {
      await fs.writeFile(getOmpModelsYmlPath(), ymlContent, "utf-8");
    }

    return NextResponse.json({
      success: true,
      message: `${BRAND.name} removed from Oh My Pi`,
    });
  } catch (err) {
    return NextResponse.json({ error: { message: err.message } }, { status: 500 });
  }
}
