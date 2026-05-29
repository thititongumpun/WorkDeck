# WorkDeck

WorkDeck is a lightweight desktop workspace manager for developers, data engineers, DBAs, and IT professionals.

It helps you keep project resources in one place: files, folders, URLs, servers, databases, commands, and notes. The app is offline-first by default and runs as a native desktop app with Tauri.

## Features

- Organize projects with active, paused, and archived states
- Store project resources such as files, URLs, servers, databases, commands, and notes
- Pin important resources for quick access
- Search across projects and resources
- Open files, folders, URLs, and runnable resource actions from the app
- Copy resource details and database paths
- Store secrets encrypted with a user-provided master password
- Export and import workspace backups as JSON
- Switch between light and dark themes
- Use local SQLite storage by default
- Configure PostgreSQL later from Settings
- Check for app updates from Settings on installed desktop builds

## Screenshots

Screenshots are welcome. Add them under a docs or assets folder and link them here.

## Install

Download the latest release from:

```text
https://github.com/thititongumpun/WorkDeck/releases
```

Choose the package for your operating system:

- Windows: `.exe` installer or `.msi`
- Linux: `.AppImage`, `.deb`, or `.rpm`
- macOS: `.dmg`

## Database

WorkDeck uses SQLite by default. The SQLite database is stored in the app config directory as `workdeck.db`.

PostgreSQL can be configured after installation:

1. Open Settings
2. Go to Database
3. Select PostgreSQL
4. Enter a connection URL
5. Save database

Example:

```text
postgres://workdeck:password@localhost:5432/workdeck
```

The app creates the required PostgreSQL tables on first connection. Use a restricted database user for normal app usage.

## Updates

Installed desktop builds include an update checker in Settings.

Open Settings, check the app version, then use **Check** to look for a newer release. If an update is available, install it from the app.

## Development

Prerequisites:

- Node.js
- Rust
- Tauri system dependencies for your platform

Install dependencies:

```bash
npm install
```

Run the frontend only:

```bash
npm run dev
```

Run the desktop app in development:

```bash
npm run tauri:dev
```

On Linux, if WebKit/GPU rendering has issues:

```bash
npm run tauri:dev:safe
```

Build the frontend:

```bash
npm run build
```

Check the Tauri backend:

```bash
cd src-tauri
cargo check
```

Build desktop bundles:

```bash
npm run tauri -- build
```

## Project Structure

```text
src/                  React/TypeScript frontend
src/domain/           Shared domain types
src/hooks/            TanStack Query hooks
src/repositories/     SQLite, PostgreSQL, and memory repositories
src/services/         App services
src-tauri/            Rust/Tauri backend
src-tauri/migrations/ SQLite migrations
```

## Contributing

WorkDeck is open for contributions.

Good contribution areas:

- Bug fixes
- UI polish
- Tests for services and repositories
- Database improvements
- Packaging and release workflow improvements
- Documentation
- Accessibility improvements

Before submitting changes, run:

```bash
npm run build
cd src-tauri && cargo check
```

For UI changes, include screenshots when possible. For database changes, document migrations and any compatibility notes.

## Security Notes

Resource secrets are encrypted with a master password before storage. The master password is not stored by the app. If the password is forgotten, encrypted secrets cannot be recovered.

PostgreSQL connection URLs saved in Settings should use a restricted database account.

## License

No license file is currently included. Add a license before distributing or accepting broad external contributions.
