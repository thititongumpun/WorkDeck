# WorkDeck Implementation Plan

Build a lightweight desktop workspace manager for developers, data engineers, DBAs, and IT professionals.

WorkDeck helps users organize and quickly access project-related resources such as files, folders, URLs, servers, databases, commands, and notes from a single interface.

## Tech Stack

### Desktop
- Tauri v2

### Frontend
- React
- TypeScript
- Tailwind CSS v4
- DaisyUI

### State Management
- Zustand

### Data Fetching

- TanStack Query

### Database

Default:
- SQLite

Future Support:
- PostgreSQL

The application must be designed with a repository abstraction layer so PostgreSQL can be introduced later without changing business logic.

### Search

SQLite:
- SQLite FTS5

PostgreSQL (future):
- PostgreSQL Full Text Search (GIN + TSVECTOR)

### Tauri Plugins

- SQL Plugin
- Opener Plugin
- Clipboard Plugin
- Dialog Plugin
- Shell Plugin (optional)

## Architecture Principles

### Offline First

WorkDock must function completely offline.

SQLite is the primary storage engine for MVP.

### Database Agnostic

Business logic must not depend on a specific database engine.

Use:

```text
UI
 ↓
Services
 ↓
Repositories
 ↓
Database Provider
```

```ts
interface ProjectRepository {
  getAll(): Promise<Project[]>;
  getById(id: string): Promise<Project>;
  create(project: Project): Promise<void>;
  update(project: Project): Promise<void>;
  delete(id: string): Promise<void>;
}
```
Implementations:
```ts
SQLiteProjectRepository
PostgresProjectRepository (future)
```

### Fast Search

Global search should return results instantly across:

Projects
Files
URLs
Servers
Commands
Databases
Notes

Search performance is a core feature of the application.

### MVP Goals
Lightweight
Offline-first
Fast startup
Fast search
Minimal memory usage
No cloud dependency
No AI dependency
No account/login requirement
