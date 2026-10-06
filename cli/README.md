# flagshiprouter (CLI)

Launcher for [FlagshipRouter](https://github.com/theRizwan/FlagshipRouter) — a local AI gateway that routes Claude Code, Codex, Cursor, Cline, OpenCode and other coding tools to free AI models.

```bash
flagshiprouter
```

Starts the router on `http://localhost:20128`, opens the browser UI, and keeps a terminal menu for the terminal UI, tray mode and exit.

| Option | Description |
| --- | --- |
| `-p, --port <port>` | Port to run the server (default `20128`) |
| `-H, --host <host>` | Host to bind (default `0.0.0.0`; use `127.0.0.1` for local-only) |
| `-n, --no-browser` | Don't open the browser UI on start |
| `-l, --log` | Show server logs |
| `-t, --tray` | Run in the system tray (background) |
| `-v, --version` | Show version |

Data lives in `~/.flagshiprouter/` (macOS/Linux) or `%APPDATA%\flagshiprouter\` (Windows); set `DATA_DIR` to move it.

The product name, command name and data folder come from `brand.json` in the repository.
