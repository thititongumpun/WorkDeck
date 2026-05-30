import type { AuthType, EncryptedSecret, Resource, ResourceType } from "./workspace";

export type ResourceFormInput = {
  type: ResourceType;
  name: string;
  target: string;
  detail: string;
  authType?: AuthType;
  username?: string;
  keyPath?: string;
  encryptedSecret?: EncryptedSecret | null;
};

export type ResourceQuickView = {
  projectName?: string;
  resource: Resource;
};

export const resourceTypes: ResourceType[] = ["file", "url", "server", "database", "command", "note"];

export function shouldShowCredentialFields(type: ResourceType) {
  return type === "server" || type === "database";
}

export function getResourceSummary(resource: Resource) {
  return [resource.target, resource.detail].filter(Boolean).join(" / ") || "No detail";
}

export function getResourceTargetLabel(type: ResourceType) {
  return type === "server" ? "IP address" : "Target";
}

export function getResourceTargetPlaceholder(type: ResourceType) {
  if (type === "server") {
    return "192.168.1.10 or server.internal";
  }

  if (type === "command") {
    return "Optional command target or working directory";
  }

  return "https://dashboard.internal or ~/project/docs";
}
