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
    const resourceRows = await db.select<ResourceRow[]>(
      "SELECT id, project_id, name, detail, type, pinned, auth_type, username, key_path, encrypted_secret, secret_iv, secret_salt, secret_kdf_iterations, created_at, updated_at FROM resources ORDER BY created_at ASC",
    );

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
      "SELECT id, project_id, name, detail, type, pinned, auth_type, username, key_path, encrypted_secret, secret_iv, secret_salt, secret_kdf_iterations, created_at, updated_at FROM resources WHERE project_id = $1 ORDER BY created_at ASC",
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
        await db.execute(
          "INSERT INTO resources (id, project_id, type, name, detail, pinned, auth_type, username, key_path, encrypted_secret, secret_iv, secret_salt, secret_kdf_iterations, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)",
          [
            resource.id,
            project.id,
            resource.type,
            resource.name,
            resource.detail,
            resource.pinned ?? false,
            resource.authType ?? "none",
            resource.username ?? "",
            resource.keyPath ?? "",
            resource.encryptedSecret?.ciphertext ?? null,
            resource.encryptedSecret?.iv ?? null,
            resource.encryptedSecret?.salt ?? null,
            resource.encryptedSecret?.kdfIterations ?? null,
            resource.createdAt,
            resource.updatedAt,
          ],
        );
      }
    }
  }

  async create(input: CreateProjectInput): Promise<Project> {
    await this.initializedPromise;
    const db = await this.dbPromise;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const accent = "bg-emerald-500";

    await db.execute(
      "INSERT INTO projects (id, name, description, status, accent, created_at, updated_at) VALUES ($1, $2, $3, 'active', $4, $5, $5)",
      [id, input.name, input.description, accent, now],
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
      "UPDATE projects SET name = $1, description = $2, status = $3, updated_at = $4 WHERE id = $5",
      [input.name, input.description, input.status, now, input.id],
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

    await db.execute(
      "INSERT INTO resources (id, project_id, type, name, detail, pinned, auth_type, username, key_path, encrypted_secret, secret_iv, secret_salt, secret_kdf_iterations, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)",
      [
        id,
        input.projectId,
        input.type,
        input.name,
        input.detail,
        input.pinned ?? false,
        input.authType ?? "none",
        input.username ?? "",
        input.keyPath ?? "",
        input.encryptedSecret?.ciphertext ?? null,
        input.encryptedSecret?.iv ?? null,
        input.encryptedSecret?.salt ?? null,
        input.encryptedSecret?.kdfIterations ?? null,
        now,
      ],
    );
    await db.execute("UPDATE projects SET updated_at = $1 WHERE id = $2", [now, input.projectId]);

    return {
      id,
      projectId: input.projectId,
      type: input.type,
      name: input.name,
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

    await db.execute(
      "UPDATE resources SET type = $1, name = $2, detail = $3, pinned = COALESCE($4::BOOLEAN, pinned), auth_type = $5, username = $6, key_path = $7, encrypted_secret = $8, secret_iv = $9, secret_salt = $10, secret_kdf_iterations = $11, updated_at = $12 WHERE id = $13",
      [
        input.type,
        input.name,
        input.detail,
        input.pinned ?? null,
        input.authType ?? "none",
        input.username ?? "",
        input.keyPath ?? "",
        input.encryptedSecret?.ciphertext ?? null,
        input.encryptedSecret?.iv ?? null,
        input.encryptedSecret?.salt ?? null,
        input.encryptedSecret?.kdfIterations ?? null,
        now,
        input.id,
      ],
    );
    await db.execute("UPDATE projects SET updated_at = $1 WHERE id = $2", [now, rows[0].project_id]);

    return {
      id: input.id,
      projectId: rows[0].project_id,
      type: input.type,
      name: input.name,
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
       SELECT type AS entity_type, id AS entity_id, project_id, name AS title, detail AS body
       FROM resources
       WHERE name ILIKE $1 OR detail ILIKE $1 OR type ILIKE $1
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

    await db.execute(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
        accent TEXT NOT NULL DEFAULT 'bg-emerald-500',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS resources (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('file', 'url', 'server', 'database', 'command', 'note')),
        name TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '',
        pinned BOOLEAN NOT NULL DEFAULT FALSE,
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
    `);

    await db.execute("ALTER TABLE resources ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE");
    await db.execute("CREATE INDEX IF NOT EXISTS resources_project_id_idx ON resources(project_id)");
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

function toResource(resource: ResourceRow): Resource {
  return {
    id: resource.id,
    projectId: resource.project_id,
    name: resource.name,
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
