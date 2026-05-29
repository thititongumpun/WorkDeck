import { appConfigDir } from "@tauri-apps/api/path";
import { isTauri } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { getConfiguredDatabaseKind, getConfiguredDatabaseUrl } from "../repositories/projectRepository";
import { redactDatabaseUrl } from "./databaseConfig";

export async function getDatabasePath() {
  const configuredUrl = getConfiguredDatabaseUrl();

  if (configuredUrl) {
    return redactDatabaseUrl(configuredUrl);
  }

  if (!isTauri()) {
    return "Browser preview uses in-memory sample data";
  }

  return `${await appConfigDir()}workdeck.db`;
}

export function getDatabaseKind() {
  return getConfiguredDatabaseKind();
}

export async function copyText(value: string) {
  if (isTauri()) {
    await writeText(value);
    return;
  }

  await navigator.clipboard.writeText(value);
}
