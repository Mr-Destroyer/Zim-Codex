import { BRAND } from "open-sse/config/brand.js";

// Agent Skills metadata — single source of truth for /dashboard/skills page.
// Each skill = 1 raw GitHub URL the user copies and pastes to any AI agent.

const REPO = BRAND.githubRepo;
const BRANCH = BRAND.branch;
const SKILL_PATH = "skills";

export const SKILLS_REPO_URL = `https://github.com/${REPO}`;
export const SKILLS_RAW_BASE = `https://raw.githubusercontent.com/${REPO}/refs/heads/${BRANCH}/${SKILL_PATH}`;
export const SKILLS_BLOB_BASE = `https://github.com/${REPO}/blob/${BRANCH}/${SKILL_PATH}`;

export const SKILLS = [
  {
    id: BRAND.slug,
    name: `${BRAND.name} (Entry)`,
    description: "Setup + index of all capabilities. Start here — covers base URL, auth, model discovery, and links to every capability skill.",
    endpoint: null,
    icon: "hub",
    isEntry: true,
  },
  {
    id: `${BRAND.slug}-chat`,
    name: "Chat",
    description: "Chat / code-gen via OpenAI or Anthropic format with streaming.",
    endpoint: "/v1/chat/completions",
    icon: "chat",
  },
  {
    id: `${BRAND.slug}-image`,
    name: "Image Generation",
    description: "Text-to-image via Cloudflare Workers AI, Hugging Face and fal.ai free tiers.",
    endpoint: "/v1/images/generations",
    icon: "image",
  },
  {
    id: `${BRAND.slug}-tts`,
    name: "Text-to-Speech",
    description: "Edge TTS and Google TTS voices (no signup), plus NVIDIA and self-hosted TTS.",
    endpoint: "/v1/audio/speech",
    icon: "record_voice_over",
  },
  {
    id: `${BRAND.slug}-stt`,
    name: "Speech-to-Text",
    description: "Transcribe audio via Groq, Hugging Face or a self-hosted Whisper server.",
    endpoint: "/v1/audio/transcriptions",
    icon: "mic",
  },
  {
    id: `${BRAND.slug}-embeddings`,
    name: "Embeddings",
    description: "Vectors for RAG / semantic search via NVIDIA, OpenRouter or self-hosted models.",
    endpoint: "/v1/embeddings",
    icon: "scatter_plot",
  },
  {
    id: `${BRAND.slug}-web-search`,
    name: "Web Search",
    description: "Web search via SearXNG (no key needed).",
    endpoint: "/v1/search",
    icon: "search",
  },
  {
    id: `${BRAND.slug}-web-fetch`,
    name: "Web Fetch",
    description: "URL → markdown / text via Ollama web fetch.",
    endpoint: "/v1/web/fetch",
    icon: "language",
  },
];

export function getSkillRawUrl(id) {
  return `${SKILLS_RAW_BASE}/${id}/SKILL.md`;
}

export function getSkillBlobUrl(id) {
  return `${SKILLS_BLOB_BASE}/${id}/SKILL.md`;
}
