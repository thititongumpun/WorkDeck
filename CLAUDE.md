# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                    # Vite frontend only (browser at localhost:5173)
npm run build                  # Type-check + build frontend
npm run tauri:dev              # Desktop app in dev mode
npm run tauri:dev:safe         # Same, but with software rendering (use on Linux/WSL if WebKit/GPU issues)
npm run tauri -- build         # Build installable bundles
cd src-tauri && cargo check    # Verify Rust/Tauri compiles
```

Minimum verification before any change: `npm run build` + `cargo check`. No test suite exists yet.

## Architecture

WorkDeck is a **Tauri v2** desktop app: React/TypeScript frontend + minimal Rust backend.

The Rust backend (`src-tauri/src/lib.rs`) only registers Tauri plugins and runs SQLite migrations embedded from `src-tauri/migrations/`. No custom Rust commands exist — all logic lives in the frontend.

### Data flow

```
App.tsx (UI / dialogs)
  ↓
src/hooks/useProjects.ts  (TanStack Query — queryKey: ["projects"])
  ↓
src/repositories/projectRepository.ts  (factory: picks impl based on env + config)
  ↓
SQLiteProjectRepository | PostgresProjectRepository | MemoryProjectRepository
```

### Repository selection at runtime

`getProjectRepository()` in `src/repositories/projectRepository.ts` is a singleton factory:
- Non-Tauri environment (browser dev) → `MemoryProjectRepository`
- Tauri + postgres URL in localStorage → `PostgresProjectRepository`
- Tauri + no postgres URL → `SQLiteProjectRepository` (default)

Database config persists in `localStorage` under key `workdeck-database-config` and can be seeded at build time via `VITE_WORKDECK_DATABASE_URL`.

Call `resetProjectRepository()` after changing database config so the next read picks up the new implementation.

### Domain types

All shared types and the `ProjectRepository` interface are in `src/domain/workspace.ts`. Every repository implementation must satisfy this interface. Business logic belongs in `src/services/`, not in React components.

### Secrets

Resource credentials are encrypted client-side using **AES-GCM** with a PBKDF2-derived key (250k iterations, SHA-256). The master password is never stored — `src/services/masterSecret.ts` handles encrypt/decrypt entirely in the browser's Web Crypto API.

### SQLite migrations

Migrations are numbered SQL files in `src-tauri/migrations/` and are registered in version order in `lib.rs` via `tauri_plugin_sql`. To add a migration: create the next numbered `.sql` file and add a `Migration` entry in `lib.rs`.

## Key conventions

- All TanStack Query mutations invalidate `["projects"]` on success — no manual cache updates needed.
- `isTauri()` from `@tauri-apps/api/core` guards any Tauri plugin call; the app must work in plain browser mode for frontend-only dev.
- Use `camelCase` for functions/variables, `PascalCase` for components/classes.
- Keep UI in `App.tsx`; logic in `src/services/` or `src/repositories/`.
