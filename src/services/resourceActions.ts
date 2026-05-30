import { isTauri } from "@tauri-apps/api/core";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import type { Resource } from "../domain/workspace";
import { copyText } from "./appSettings";

export async function activateResource(resource: Resource) {
  const target = resource.target || resource.detail;

  if (resource.type === "url") {
    await openResourceUrl(target);
    return;
  }

  if (resource.type === "file") {
    await openResourcePath(target);
    return;
  }

  await copyResourceDetail(resource);
}

async function openResourceUrl(value: string) {
  if (isTauri()) {
    await openUrl(value);
    return;
  }

  window.open(value, "_blank", "noopener,noreferrer");
}

async function openResourcePath(value: string) {
  if (isTauri()) {
    await openPath(value);
    return;
  }

  await copyText(value);
}

async function copyResourceDetail(resource: Resource) {
  await copyText(resource.detail || resource.target || resource.name);
}
