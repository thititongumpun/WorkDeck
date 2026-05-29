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

const DATABASE_URL = "sqlite:workdeck.db";

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
  pinned: number;
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

type SearchRow = {
  entity_type: "project" | ResourceType;
  entity_id: string;
  project_id: string;
  title: string;
  body: string;
};

export class SQLiteProjectRepository implements ProjectRepository {
  private dbPromise: Promise<Database>;

  constructor() {
    this.dbPromise = Database.load(DATABASE_URL);
  }

  async getAll(): Promise<Project[]> {
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
    const db = await this.dbPromise;

    await db.execute("DELETE FROM resources");
    await db.execute("DELETE FROM projects");

    for (const project of projects) {
      await db.execute(
        "INSERT INTO projects (id, name, description, status, accent, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [project.id, project.name, project.description, project.status, project.accent, project.updatedAt, project.updatedAt],
      );

      for (const resource of project.resources) {
        const authType = resource.authType ?? "none";
        const username = resource.username ?? "";
        const keyPath = resource.keyPath ?? "";
        const encryptedSecret = resource.encryptedSecret ?? null;

        await db.execute(
          "INSERT INTO resources (id, project_id, type, name, detail, pinned, auth_type, username, key_path, encrypted_secret, secret_iv, secret_salt, secret_kdf_iterations, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)",
          [
            resource.id,
            project.id,
            resource.type,
            resource.name,
            resource.detail,
            resource.pinned ? 1 : 0,
            authType,
            username,
            keyPath,
            encryptedSecret?.ciphertext ?? null,
            encryptedSecret?.iv ?? null,
            encryptedSecret?.salt ?? null,
            encryptedSecret?.kdfIterations ?? null,
            resource.createdAt,
            resource.updatedAt,
          ],
        );
      }
    }
  }

  async create(input: CreateProjectInput): Promise<Project> {
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
    const db = await this.dbPromise;
    await db.execute("DELETE FROM resources WHERE project_id = $1", [id]);
    await db.execute("DELETE FROM projects WHERE id = $1", [id]);
  }

  async addResource(input: CreateResourceInput): Promise<Resource> {
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
        input.pinned ? 1 : 0,
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
    const db = await this.dbPromise;
    const now = new Date().toISOString();

    const rows = await db.select<Array<{ project_id: string }>>("SELECT project_id FROM resources WHERE id = $1", [
      input.id,
    ]);

    if (rows.length === 0) {
      throw new Error("Resource not found");
    }

    await db.execute(
      "UPDATE resources SET type = $1, name = $2, detail = $3, pinned = COALESCE($4, pinned), auth_type = $5, username = $6, key_path = $7, encrypted_secret = $8, secret_iv = $9, secret_salt = $10, secret_kdf_iterations = $11, updated_at = $12 WHERE id = $13",
      [
      input.type,
      input.name,
      input.detail,
      input.pinned === undefined ? null : input.pinned ? 1 : 0,
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
    const db = await this.dbPromise;
    const rows = await db.select<Array<{ project_id: string }>>("SELECT project_id FROM resources WHERE id = $1", [id]);

    await db.execute("DELETE FROM resources WHERE id = $1", [id]);

    if (rows[0]) {
      await db.execute("UPDATE projects SET updated_at = $1 WHERE id = $2", [new Date().toISOString(), rows[0].project_id]);
    }
  }

  async search(query: string): Promise<SearchResult[]> {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return [];
    }

    const db = await this.dbPromise;
    const rows = await db.select<SearchRow[]>(
      "SELECT entity_type, entity_id, project_id, title, body FROM search_index WHERE search_index MATCH $1 ORDER BY rank LIMIT 30",
      [escapeFtsQuery(trimmedQuery)],
    );

    return rows.map((row) => ({
      entityType: row.entity_type,
      entityId: row.entity_id,
      projectId: row.project_id,
      title: row.title,
      body: row.body,
    }));
  }
}

function escapeFtsQuery(query: string) {
  return query
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `"${term.replace(/"/g, '""')}"*`)
    .join(" ");
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
