import { isTauri } from "@tauri-apps/api/core";
import type { ProjectRepository } from "../domain/workspace";
import { getActiveDatabaseKind, getActiveDatabaseUrl } from "../services/databaseConfig";
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
  return getActiveDatabaseUrl();
}

export function getConfiguredDatabaseKind() {
  return isTauri() ? getActiveDatabaseKind() : "Memory";
}

export function resetProjectRepository() {
  repository = null;
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
