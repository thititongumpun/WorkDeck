import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent } from "@tauri-apps/plugin-updater";

export type UpdateCheckResult =
  | { status: "unsupported"; currentVersion: string }
  | { status: "current"; currentVersion: string }
  | { status: "available"; currentVersion: string; version: string; body?: string };

export async function getInstalledAppVersion() {
  if (!isTauri()) {
    return "dev";
  }

  return getVersion();
}

export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  const currentVersion = await getInstalledAppVersion();

  if (!isTauri()) {
    return { status: "unsupported", currentVersion };
  }

  const target = getUpdaterTarget();
  const update = await check(target ? { target } : undefined);

  if (!update) {
    return { status: "current", currentVersion };
  }

  return {
    status: "available",
    currentVersion,
    version: update.version,
    body: update.body,
  };
}

export async function installAppUpdate(onProgress: (message: string) => void) {
  const target = getUpdaterTarget();
  const update = await check(target ? { target } : undefined);

  if (!update) {
    return { installed: false };
  }

  let downloaded = 0;
  let total = 0;

  await update.downloadAndInstall((event: DownloadEvent) => {
    if (event.event === "Started") {
      total = event.data.contentLength ?? 0;
      downloaded = 0;
      onProgress(total ? `Downloading 0%` : "Downloading update");
      return;
    }

    if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
      onProgress(total ? `Downloading ${Math.round((downloaded / total) * 100)}%` : "Downloading update");
      return;
    }

    onProgress("Installing update");
  });

  await relaunch();
  return { installed: true };
}

function getUpdaterTarget() {
  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes("windows")) {
    return "windows-x86_64";
  }

  if (userAgent.includes("linux")) {
    return "linux-x86_64";
  }

  return undefined;
}
