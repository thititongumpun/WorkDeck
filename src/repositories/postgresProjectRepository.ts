import Database from "@tauri-apps/plugin-sql";
import type {
  CreateProjectInput,
  CreateResourceInput,
  Project,
  ProjectRepository,
  ProjectStatus,
  Resource,
  ResourceType,
  SearchResult,
  UpdateProjectInput,
  UpdateResourceInput,
} from "../domain/workspace";
import { normalizeProjectAccent, rowCount } from "./projectAccent";

type ProjectRow = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  accent: string;
  updated_at: string;
};

type ResourceRow = {
  id: string;
  project_id: string;
  name: string;
  target: string;
  detail: string;
  type: ResourceType;
  pinned: boolean;
  auth_type: Resource["authType"];
  username: string;
  key_path: string;
  encrypted_secret: string | null;
  secret_iv: string | null;
  secret_salt: string | null;
  secret_kdf_iterations: number | null;
  created_at: string;
  updated_at: string;
};

type CountRow = {
  project_count: number | string;
};

const RESOURCE_COLUMNS =
  "id, project_id, name, target, detail, type, pinned, auth_type, username, key_path, encrypted_secret, secret_iv, secret_salt, secret_kdf_iterations, created_at, updated_at";

const INSERT_RESOURCE_SQL = `
  INSERT INTO resources (
    id, project_id, type, name, target, detail, pinned, auth_type, username, key_path,
    encrypted_secret, secret_iv, secret_salt, secret_kdf_iterations, created_at, updated_at
  )
  VALUES (
    $1::text, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text::integer, $8::text,
    $9::text, $10::text, $11::text, $12::text, $13::text, $14::text::integer, $15::text, $16::text
  )
`;

const UPDATE_RESOURCE_SQL = `
  UPDATE resources
  SET type = $1::text,
      name = $2::text,
      target = $3::text,
      detail = $4::text,
      pinned = COALESCE($5::text::integer, pinned),
      auth_type = $6::text,
      username = $7::text,
      key_path = $8::text,
      encrypted_secret = $9::text,
      secret_iv = $10::text,
      secret_salt = $11::text,
      secret_kdf_iterations = $12::text::integer,
      updated_at = $13::text
  WHERE id = $14::text
`;

const CREATE_PROJECTS_SQL = `
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
    accent TEXT NOT NULL DEFAULT 'bg-emerald-500',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

const CREATE_RESOURCES_SQL = `
  CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('file', 'url', 'server', 'database', 'command', 'note')),
    name TEXT NOT NULL,
    target TEXT NOT NULL DEFAULT '',
    detail TEXT NOT NULL DEFAULT '',
    pinned INTEGER NOT NULL DEFAULT 0,
    auth_type TEXT NOT NULL DEFAULT 'none' CHECK (auth_type IN ('none', 'agent', 'password', 'key')),
    username TEXT NOT NULL DEFAULT '',
    key_path TEXT NOT NULL DEFAULT '',
    encrypted_secret TEXT,
    secret_iv TEXT,
    secret_salt TEXT,
    secret_kdf_iterations INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

const POSTGRES_RESOURCE_MIGRATIONS = [
  "ALTER TABLE resources ADD COLUMN IF NOT EXISTS pinned INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE resources ADD COLUMN IF NOT EXISTS target TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE resources ALTER COLUMN target DROP DEFAULT",
  "ALTER TABLE resources ALTER COLUMN target TYPE TEXT USING trim(both '\"' from target::text)",
  "ALTER TABLE resources ALTER COLUMN target SET DEFAULT ''",
  "ALTER TABLE resources ALTER COLUMN target SET NOT NULL",
  "UPDATE resources SET target = detail, detail = '' WHERE target = '' AND type IN ('file', 'url', 'server', 'database')",
  "CREATE INDEX IF NOT EXISTS resources_project_id_idx ON resources(project_id)",
];

function toError(err: unknown, fallback: string): Error {
  if (err instanceof Error) return err;
  if (typeof err === "string") return new Error(err);
  try {
    return new Error(JSON.stringify(err));
  } catch {
    return new Error(fallback);
  }
}

export class PostgresProjectRepository implements ProjectRepository {
  private dbPromise: Promise<Database>;
  private initializedPromise: Promise<void>;

  constructor(databaseUrl: string) {
    this.dbPromise = Database.load(databaseUrl);
    this.initializedPromise = this.initialize();
  }

  async getAll(): Promise<Project[]> {
    await this.initializedPromise;
    const db = await this.dbPromise;
    const projectRows = await db.select<ProjectRow[]>(
      "SELECT id, name, description, status, accent, updated_at FROM projects ORDER BY updated_at DESC",
    );
    const resourceRows = await db.select<ResourceRow[]>(`SELECT ${RESOURCE_COLUMNS} FROM resources ORDER BY created_at ASC`);

    return projectRows.map((project) => toProject(project, resourceRows));
  }

  async getById(id: string): Promise<Project | null> {
    await this.initializedPromise;
    const db = await this.dbPromise;
    const projectRows = await db.select<ProjectRow[]>(
      "SELECT id, name, description, status, accent, updated_at FROM projects WHERE id = $1 LIMIT 1",
      [id],
    );

    if (projectRows.length === 0) {
      return null;
    }

    const resourceRows = await db.select<ResourceRow[]>(
      `SELECT ${RESOURCE_COLUMNS} FROM resources WHERE project_id = $1 ORDER BY created_at ASC`,
      [id],
    );

    return toProject(projectRows[0], resourceRows);
  }

  async replaceAll(projects: Project[]): Promise<void> {
    await this.initializedPromise;
    const db = await this.dbPromise;

    await db.execute("DELETE FROM resources");
    await db.execute("DELETE FROM projects");

    for (const project of projects) {
      await db.execute(
        "INSERT INTO projects (id, name, description, status, accent, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [project.id, project.name, project.description, project.status, project.accent, project.updatedAt, project.updatedAt],
      );

      for (const resource of project.resources) {
        await db.execute(INSERT_RESOURCE_SQL, resourceInsertValues(resource, project.id));
      }
    }
  }

  async create(input: CreateProjectInput): Promise<Project> {
    await this.initializedPromise;
    const db = await this.dbPromise;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const countRows = await db.select<CountRow[]>("SELECT COUNT(*)::integer AS project_count FROM projects");
    const accent = normalizeProjectAccent(input.accent, rowCount(countRows[0]?.project_count));

    await db.execute(
      "INSERT INTO projects (id, name, description, status, accent, created_at, updated_at) VALUES ($1, $2, $3, 'active', $4, $5, $6)",
      [id, input.name, input.description, accent, now, now],
    );

    return {
      id,
      name: input.name,
      description: input.description,
      status: "active",
      accent,
      updatedAt: now,
      resources: [],
    };
  }

  async update(input: UpdateProjectInput): Promise<Project> {
    await this.initializedPromise;
    const db = await this.dbPromise;
    const now = new Date().toISOString();

    await db.execute(
      "UPDATE projects SET name = $1, description = $2, status = $3, accent = $4, updated_at = $5 WHERE id = $6",
      [input.name, input.description, input.status, normalizeProjectAccent(input.accent, 0), now, input.id],
    );

    const project = await this.getById(input.id);

    if (!project) {
      throw new Error("Project not found");
    }

    return project;
  }

  async delete(id: string): Promise<void> {
    await this.initializedPromise;
    const db = await this.dbPromise;
    await db.execute("DELETE FROM projects WHERE id = $1", [id]);
  }

  async addResource(input: CreateResourceInput): Promise<Resource> {
    await this.initializedPromise;
    const db = await this.dbPromise;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const pinned = input.pinned ? 1 : 0;

    try {
      await db.execute(INSERT_RESOURCE_SQL, [
        id,
        input.projectId,
        input.type,
        input.name,
        input.target,
        input.detail,
        pinned,
        input.authType ?? "none",
        input.username ?? "",
        input.keyPath ?? "",
        input.encryptedSecret?.ciphertext ?? null,
        input.encryptedSecret?.iv ?? null,
        input.encryptedSecret?.salt ?? null,
        input.encryptedSecret?.kdfIterations ?? null,
        now,
        now,
      ]);
    } catch (err) {
      throw toError(err, "Failed to insert resource");
    }

    try {
      await db.execute("UPDATE projects SET updated_at = $1 WHERE id = $2", [now, input.projectId]);
    } catch (err) {
      throw toError(err, "Failed to update project timestamp");
    }

    return {
      id,
      projectId: input.projectId,
      type: input.type,
      name: input.name,
      target: input.target,
      detail: input.detail,
      pinned: input.pinned ?? false,
      authType: input.authType ?? "none",
      username: input.username ?? "",
      keyPath: input.keyPath ?? "",
      encryptedSecret: input.encryptedSecret ?? null,
      createdAt: now,
      updatedAt: now,
    };
  }

  async updateResource(input: UpdateResourceInput): Promise<Resource> {
    await this.initializedPromise;
    const db = await this.dbPromise;
    const now = new Date().toISOString();
    const rows = await db.select<Array<{ project_id: string }>>("SELECT project_id FROM resources WHERE id = $1", [
      input.id,
    ]);

    if (rows.length === 0) {
      throw new Error("Resource not found");
    }

    await db.execute(UPDATE_RESOURCE_SQL, resourceUpdateValues(input, now));
    await db.execute("UPDATE projects SET updated_at = $1 WHERE id = $2", [now, rows[0].project_id]);

    return {
      id: input.id,
      projectId: rows[0].project_id,
      type: input.type,
      name: input.name,
      target: input.target,
      detail: input.detail,
      pinned: input.pinned ?? false,
      authType: input.authType ?? "none",
      username: input.username ?? "",
      keyPath: input.keyPath ?? "",
      encryptedSecret: input.encryptedSecret ?? null,
      createdAt: now,
      updatedAt: now,
    };
  }

  async deleteResource(id: string): Promise<void> {
    await this.initializedPromise;
    const db = await this.dbPromise;
    const rows = await db.select<Array<{ project_id: string }>>("SELECT project_id FROM resources WHERE id = $1", [id]);

    await db.execute("DELETE FROM resources WHERE id = $1", [id]);

    if (rows[0]) {
      await db.execute("UPDATE projects SET updated_at = $1 WHERE id = $2", [new Date().toISOString(), rows[0].project_id]);
    }
  }

  async search(query: string): Promise<SearchResult[]> {
    await this.initializedPromise;
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return [];
    }

    const db = await this.dbPromise;
    const rows = await db.select<
      Array<{
        entity_type: "project" | ResourceType;
        entity_id: string;
        project_id: string;
        title: string;
        body: string;
      }>
    >(
      `SELECT 'project' AS entity_type, id AS entity_id, id AS project_id, name AS title, description AS body
       FROM projects
       WHERE name ILIKE $1 OR description ILIKE $1
       UNION ALL
       SELECT type AS entity_type, id AS entity_id, project_id, name AS title, CONCAT_WS(' ', NULLIF(target, ''), NULLIF(detail, '')) AS body
       FROM resources
       WHERE name ILIKE $1 OR target ILIKE $1 OR detail ILIKE $1 OR type ILIKE $1
       LIMIT 30`,
      [`%${trimmedQuery}%`],
    );

    return rows.map((row) => ({
      entityType: row.entity_type,
      entityId: row.entity_id,
      projectId: row.project_id,
      title: row.title,
      body: row.body,
    }));
  }

  private async initialize() {
    const db = await this.dbPromise;

    await db.execute(CREATE_PROJECTS_SQL);
    await db.execute(CREATE_RESOURCES_SQL);

    for (const migration of POSTGRES_RESOURCE_MIGRATIONS) {
      await db.execute(migration);
    }
  }
}

function toProject(project: ProjectRow, resources: ResourceRow[]): Project {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    accent: project.accent,
    updatedAt: project.updated_at,
    resources: resources.filter((resource) => resource.project_id === project.id).map(toResource),
  };
}

function resourceInsertValues(resource: Resource, projectId: string) {
  return [
    resource.id,
    projectId,
    resource.type,
    resource.name,
    resource.target ?? "",
    resource.detail,
    resource.pinned ? 1 : 0,
    resource.authType ?? "none",
    resource.username ?? "",
    resource.keyPath ?? "",
    resource.encryptedSecret?.ciphertext ?? null,
    resource.encryptedSecret?.iv ?? null,
    resource.encryptedSecret?.salt ?? null,
    resource.encryptedSecret?.kdfIterations ?? null,
    resource.createdAt,
    resource.updatedAt,
  ];
}

function resourceUpdateValues(input: UpdateResourceInput, updatedAt: string) {
  return [
    input.type,
    input.name,
    input.target,
    input.detail,
    input.pinned === undefined ? null : input.pinned ? 1 : 0,
    input.authType ?? "none",
    input.username ?? "",
    input.keyPath ?? "",
    input.encryptedSecret?.ciphertext ?? null,
    input.encryptedSecret?.iv ?? null,
    input.encryptedSecret?.salt ?? null,
    input.encryptedSecret?.kdfIterations ?? null,
    updatedAt,
    input.id,
  ];
}

function toResource(resource: ResourceRow): Resource {
  return {
    id: resource.id,
    projectId: resource.project_id,
    name: resource.name,
    target: resource.target,
    detail: resource.detail,
    type: resource.type,
    pinned: toBoolean(resource.pinned),
    authType: resource.auth_type,
    username: resource.username,
    keyPath: resource.key_path,
    encryptedSecret:
      resource.encrypted_secret && resource.secret_iv && resource.secret_salt && resource.secret_kdf_iterations
        ? {
            ciphertext: resource.encrypted_secret,
            iv: resource.secret_iv,
            salt: resource.secret_salt,
            kdfIterations: resource.secret_kdf_iterations,
          }
        : null,
    createdAt: resource.created_at,
    updatedAt: resource.updated_at,
  };
}

function toBoolean(value: boolean | number | string | null | undefined) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    return ["true", "t", "1", "yes", "y"].includes(value.toLowerCase());
  }

  return false;
}
