import { isTauri } from "@tauri-apps/api/core";
import type { ProjectRepository } from "../domain/workspace";
import { MemoryProjectRepository } from "./memoryProjectRepository";
import { PostgresProjectRepository } from "./postgresProjectRepository";
import { SQLiteProjectRepository } from "./sqliteProjectRepository";

let repository: ProjectRepository | null = null;

export function getProjectRepository(): ProjectRepository {
  if (!repository) {
    repository = createProjectRepository();
  }

  return repository;
}

export function getConfiguredDatabaseUrl() {
  return import.meta.env.VITE_WORKDECK_DATABASE_URL as string | undefined;
}

export function getConfiguredDatabaseKind() {
  const databaseUrl = getConfiguredDatabaseUrl();

  if (databaseUrl?.startsWith("postgres://") || databaseUrl?.startsWith("postgresql://")) {
    return "PostgreSQL";
  }

  return isTauri() ? "SQLite" : "Memory";
}

function createProjectRepository(): ProjectRepository {
  if (!isTauri()) {
    return new MemoryProjectRepository();
  }

  const databaseUrl = getConfiguredDatabaseUrl();

  if (databaseUrl?.startsWith("postgres://") || databaseUrl?.startsWith("postgresql://")) {
    return new PostgresProjectRepository(databaseUrl);
  }

  return new SQLiteProjectRepository();
}
