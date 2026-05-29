import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export async function pickFilePath() {
  if (!isTauri()) {
    return null;
  }

  const selected = await open({
    directory: false,
    multiple: false,
    title: "Choose file",
  });

  return typeof selected === "string" ? selected : null;
}

export async function pickFolderPath() {
  if (!isTauri()) {
    return null;
  }

  const selected = await open({
    directory: true,
    multiple: false,
    title: "Choose folder",
  });

  return typeof selected === "string" ? selected : null;
}
