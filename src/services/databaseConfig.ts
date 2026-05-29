export type DatabaseConfig = {
  kind: "sqlite" | "postgres";
  postgresUrl: string;
};

const DATABASE_CONFIG_KEY = "workdeck-database-config";

export function readDatabaseConfig(): DatabaseConfig {
  const fallbackUrl = getBuildTimeDatabaseUrl();

  if (typeof localStorage === "undefined") {
    return fallbackUrl ? { kind: "postgres", postgresUrl: fallbackUrl } : { kind: "sqlite", postgresUrl: "" };
  }

  const storedConfig = readStoredDatabaseConfig();

  if (storedConfig) {
    return storedConfig;
  }

  return fallbackUrl ? { kind: "postgres", postgresUrl: fallbackUrl } : { kind: "sqlite", postgresUrl: "" };
}

export function saveDatabaseConfig(config: DatabaseConfig) {
  localStorage.setItem(DATABASE_CONFIG_KEY, JSON.stringify(config));
}

export function getActiveDatabaseUrl() {
  const config = readDatabaseConfig();

  if (config.kind === "postgres" && isPostgresUrl(config.postgresUrl)) {
    return config.postgresUrl;
  }

  return undefined;
}

export function getActiveDatabaseKind() {
  return getActiveDatabaseUrl() ? "PostgreSQL" : "SQLite";
}

export function isPostgresUrl(value: string) {
  return value.startsWith("postgres://") || value.startsWith("postgresql://");
}

export function redactDatabaseUrl(value: string) {
  try {
    const url = new URL(value);

    if (url.password) {
      url.password = "****";
    }

    return url.toString();
  } catch {
    return value;
  }
}

function readStoredDatabaseConfig(): DatabaseConfig | null {
  const rawValue = localStorage.getItem(DATABASE_CONFIG_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<DatabaseConfig>;

    if (parsed.kind === "postgres" && typeof parsed.postgresUrl === "string") {
      return { kind: "postgres", postgresUrl: parsed.postgresUrl };
    }

    if (parsed.kind === "sqlite") {
      return { kind: "sqlite", postgresUrl: "" };
    }
  } catch {
    return null;
  }

  return null;
}

function getBuildTimeDatabaseUrl() {
  return import.meta.env.VITE_WORKDECK_DATABASE_URL as string | undefined;
}
