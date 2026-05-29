# Repository Guidelines

## Project Structure & Module Organization

WorkDeck is a Tauri v2 desktop app with a React/TypeScript frontend.

- `src/`: frontend application code.
- `src/App.tsx`: main UI shell and dialogs.
- `src/domain/`: shared domain types and repository interfaces.
- `src/repositories/`: memory, SQLite, and PostgreSQL repository implementations.
- `src/hooks/`: TanStack Query hooks for repository operations.
- `src/services/`: app services such as encryption, file picking, settings, and resource actions.
- `src-tauri/`: Rust/Tauri desktop backend, config, capabilities, and migrations.
- `src-tauri/migrations/`: SQLite migrations embedded into the Tauri SQL plugin.
- `dist/` and `src-tauri/target/`: generated build output; do not edit directly.

## Build, Test, and Development Commands

- `npm run dev`: run the Vite frontend only.
- `npm run build`: type-check and build the frontend.
- `npm run tauri:dev`: run the desktop app in development mode.
- `npm run tauri:dev:safe`: run Tauri with software rendering fallbacks for Linux/WebKit GPU issues.
- `npm run tauri -- build`: build installable desktop bundles.
- `cd src-tauri && cargo check`: verify Rust/Tauri code compiles.

There is no test suite yet. Use `npm run build` and `cargo check` as the minimum verification before submitting changes.

## Coding Style & Naming Conventions

Use TypeScript with strict types. Prefer repository interfaces and domain types from `src/domain/` over ad hoc objects. Keep business logic out of React components when it belongs in `src/services/` or `src/repositories/`.

Use PascalCase for React components and classes, camelCase for functions and variables, and kebab/camel descriptive filenames that match nearby patterns. Keep UI components practical and desktop-app oriented.

## Testing Guidelines

No formal testing framework is configured yet. When adding tests, prefer focused unit tests for services/repositories and integration tests for core workflows such as create/edit/delete/search. Name tests after the behavior under test, for example `masterSecret.test.ts`.

## Commit & Pull Request Guidelines

This repository currently has no established Git history conventions. Use short imperative commit messages, for example:

- `Add PostgreSQL repository backend`
- `Fix resource form layout`

Pull requests should include a concise summary, verification commands run, screenshots for UI changes, and notes for schema/configuration changes.

## Security & Configuration Tips

SQLite is the default local backend. Set `VITE_WORKDECK_DATABASE_URL=postgres://...` to use PostgreSQL in Tauri. Do not commit `.env` files or real credentials.

Resource secrets are encrypted with a user-provided master password before storage. The master password is never stored; forgotten passwords cannot be recovered.
