# ZimRouter

**Free AI models for every coding tool.** ZimRouter is a local AI gateway that connects Claude Code, Codex, Cursor, Cline, OpenCode and other coding tools to free AI models through one OpenAI-compatible endpoint.

- **Free providers only.** The dashboard, management APIs and routing only expose providers with a free offer (Kiro, OpenCode Free, OpenRouter free models, NVIDIA NIM, Groq, Cloudflare Workers AI, Ollama, self-hosted servers and more).
- **A Models screen instead of a provider list.** Every model from every free provider in one searchable table, with a ready/connect status and a one-click test.
- **One place to rename.** Product name, CLI command, data folder, the prefix your tools show on models, and the provider policy all live in [`brand.json`](brand.json).
- **Starts with one command.** Running `zimrouter` starts the server and opens the browser UI.

## Quick start

Requires Node.js 20.9 or newer (22 recommended).

```bash
git clone https://github.com/mr-destroyer/Zim-Codex.git
cd Zim-Codex
npm run launch
```

`npm run launch` installs the dependencies, builds the app (a few minutes, first run only), and starts the CLI. The server runs on port `20128` and the dashboard opens in your browser; the terminal keeps a small menu (open browser UI, terminal UI, hide to tray, exit). Later runs start in seconds and rebuild automatically when the sources or `brand.json` change.

Pass CLI options after `--`, for example `npm run launch -- --host 127.0.0.1` (local only), `-- -p 20130` (another port) or `-- --no-browser`.

To use the `zimrouter` command anywhere, link the CLI package once:

```bash
cd cli && npm link
```

For development with hot reload:

```bash
npx next dev --port 20128
```

The dashboard's default password is `123456`; change it under **Settings** before exposing the router beyond localhost.

## Connect a coding tool

1. Open **Endpoint & Key** and create an API key.
2. Open **Models**, pick a model marked **Ready** (OpenCode Free models need no signup) or connect a provider to unlock more.
3. Point your tool at `http://localhost:20128/v1` with that key, or use **CLI Tools** to write the config for Claude Code, Codex, OpenCode, Cline, Copilot and others. Models appear in those tools as `zimrouter/<model>`.

```bash
curl http://localhost:20128/v1/chat/completions \
  -H "Authorization: Bearer $FLAGSHIPROUTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-6-astra", "messages": [{"role": "user", "content": "Hello"}]}'
```

## Rename everything from `brand.json`

| Field | Controls |
| --- | --- |
| `name` | Product name in the dashboard, terminal UI, tray, page titles, translations |
| `slug` | npm package, CLI command, data folder (`~/.<slug>`), headers, MITM certificate names |
| `modelPrefix` | Provider key written into CLI tool configs, so models show as `<modelPrefix>/<model>` |
| `tagline`, `description` | Page title, web app manifest |
| `repository`, `branch` | Links, changelog and agent-skill URLs |
| `updateCheck` | npm update notices (keep `false` until the package is published under `slug`) |
| `providers` | Free-provider policy (see below) |

After editing `brand.json`, run `npm run brand:sync` to update the two `package.json` files (package name, CLI bin). Everything else reads `brand.json` at runtime or build time.


## Free-provider policy

```json
"providers": {
  "freeOnly": true,
  "categories": ["free", "freeTier"],
  "includeHasFree": true,
  "include": [],
  "exclude": ["antigravity", "gemini", "gemini-cli"],
  "customEndpoints": false
}
```

A provider is available when its registry entry (`open-sse/providers/registry/<id>.js`) has a listed `category`, or is flagged `hasFree` and `includeHasFree` is on. `include` and `exclude` take provider ids. The policy is enforced in the dashboard, the management APIs, the connection store and at routing time. `customEndpoints` enables user-defined OpenAI/Anthropic-compatible endpoints; setting `freeOnly` to `false` restores the full upstream provider list.

## Screens

Endpoint & Key · Models · Combos & Vision · Token Saver · CLI Tools · Media Models (embedding, image, video, speech, transcription, System One, web fetch & search) · Agent Skills · Proxy Pools · Console Log · Translator · Settings. Usage and Quota Tracker pages are still available at `/dashboard/usage` and `/dashboard/quota`.

## Project layout

| Path | What it is |
| --- | --- |
| `brand.json` | Single source for brand and provider policy |
| `open-sse/` | Routing and translation engine (`config/brand.js`, `providers/policy.js`) |
| `src/app/` | Next.js dashboard and API routes (`/v1/*` gateway, `/api/models/catalog` for the Models screen) |
| `cli/` | The `zimrouter` launcher: starts the server, opens the browser UI, terminal UI, tray |
| `tests/` | Vitest suite (`tests/unit/brand-policy.test.js` covers the brand layer) |
| `docs/ARCHITECTURE.md` | Request lifecycle and data model |

## Tests

```bash
npm install --prefix /tmp/vitest-runner --legacy-peer-deps vitest@4
ln -sfn /tmp/vitest-runner/node_modules tests/node_modules
cd tests && npx vitest run
```

The suite carries known failures (live-provider tests, a missing `cloud/` worker, timing-sensitive DB tests); compare against a run on the previous commit rather than expecting all green. Engine tests run with the free-only policy disabled by `tests/setup/providerPolicy.js`.

## License

Released under the [MIT License](LICENSE).
