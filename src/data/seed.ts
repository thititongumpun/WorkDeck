import type { Project, ResourceType } from "../domain/workspace";

export const seedProjects: Project[] = [
  {
    id: "ops-migration",
    name: "Ops Migration",
    description: "Cutover checklist, server inventory, and runbooks.",
    status: "active",
    accent: "bg-emerald-500",
    updatedAt: "Today",
    resources: [
      resource("r1", "ops-migration", "Migration Runbook", "~/work/ops/runbook.md", "file"),
      resource("r2", "ops-migration", "Grafana Dashboard", "https://grafana.internal/migration", "url"),
      resource("r3", "ops-migration", "Primary DB", "postgres://prod-main:5432", "database"),
      resource("r4", "ops-migration", "Restart Worker", "systemctl restart worker", "command"),
    ],
  },
  {
    id: "analytics-lake",
    name: "Analytics Lake",
    description: "Warehouse access, notebooks, and daily load commands.",
    status: "active",
    accent: "bg-sky-500",
    updatedAt: "Yesterday",
    resources: [
      resource("r5", "analytics-lake", "Daily Loads", "make warehouse-load", "command"),
      resource("r6", "analytics-lake", "Data Contracts", "~/warehouse/contracts", "file"),
      resource("r7", "analytics-lake", "Warehouse", "snowflake://analytics", "database"),
    ],
  },
  {
    id: "incident-kit",
    name: "Incident Kit",
    description: "Reusable response links, logs, and shell commands.",
    status: "paused",
    accent: "bg-amber-500",
    updatedAt: "May 24",
    resources: [
      resource("r8", "incident-kit", "Pager Console", "https://pager.internal", "url"),
      resource("r9", "incident-kit", "Log Host", "ssh logs-01.internal", "server"),
      resource("r10", "incident-kit", "Postmortem Notes", "Template and active drafts", "note"),
    ],
  },
];

function resource(id: string, projectId: string, name: string, detail: string, type: ResourceType) {
  return {
    id,
    projectId,
    name,
    target: type === "command" || type === "note" ? "" : detail,
    detail: type === "command" || type === "note" ? detail : "",
    type,
    pinned: ["r1", "r4", "r9", "r10"].includes(id),
    authType: "none" as const,
    username: "",
    keyPath: "",
    encryptedSecret: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}
