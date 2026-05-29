import { seedProjects } from "../data/seed";
import type {
  CreateProjectInput,
  CreateResourceInput,
  Project,
  ProjectRepository,
  Resource,
  SearchResult,
  UpdateProjectInput,
  UpdateResourceInput,
} from "../domain/workspace";

const projects = [...seedProjects];

export class MemoryProjectRepository implements ProjectRepository {
  async getAll(): Promise<Project[]> {
    return projects;
  }

  async getById(id: string): Promise<Project | null> {
    return projects.find((project) => project.id === id) ?? null;
  }

  async replaceAll(nextProjects: Project[]): Promise<void> {
    projects.splice(0, projects.length, ...nextProjects.map(normalizeProject));
  }

  async create(input: CreateProjectInput): Promise<Project> {
    const now = new Date().toISOString();
    const project: Project = {
      id: crypto.randomUUID(),
      name: input.name,
      description: input.description,
      status: "active",
      accent: nextAccent(projects.length),
      updatedAt: now,
      resources: [],
    };

    projects.unshift(project);
    return project;
  }

  async update(input: UpdateProjectInput): Promise<Project> {
    const project = projects.find((candidate) => candidate.id === input.id);

    if (!project) {
      throw new Error("Project not found");
    }

    project.name = input.name;
    project.description = input.description;
    project.status = input.status;
    project.updatedAt = new Date().toISOString();
    return project;
  }

  async delete(id: string): Promise<void> {
    const index = projects.findIndex((project) => project.id === id);

    if (index >= 0) {
      projects.splice(index, 1);
    }
  }

  async addResource(input: CreateResourceInput): Promise<Resource> {
    const project = projects.find((candidate) => candidate.id === input.projectId);

    if (!project) {
      throw new Error("Project not found");
    }

    const now = new Date().toISOString();
    const resource: Resource = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      name: input.name,
      detail: input.detail,
      type: input.type,
      pinned: input.pinned ?? false,
      authType: input.authType ?? "none",
      username: input.username ?? "",
      keyPath: input.keyPath ?? "",
      encryptedSecret: input.encryptedSecret ?? null,
      createdAt: now,
      updatedAt: now,
    };

    project.resources.push(resource);
    project.updatedAt = now;
    return resource;
  }

  async updateResource(input: UpdateResourceInput): Promise<Resource> {
    const project = projects.find((candidate) => candidate.resources.some((resource) => resource.id === input.id));
    const resource = project?.resources.find((candidate) => candidate.id === input.id);

    if (!project || !resource) {
      throw new Error("Resource not found");
    }

    const now = new Date().toISOString();
    resource.type = input.type;
    resource.name = input.name;
    resource.detail = input.detail;
    resource.pinned = input.pinned ?? resource.pinned;
    resource.authType = input.authType ?? "none";
    resource.username = input.username ?? "";
    resource.keyPath = input.keyPath ?? "";
    resource.encryptedSecret = input.encryptedSecret ?? null;
    resource.updatedAt = now;
    project.updatedAt = now;
    return resource;
  }

  async deleteResource(id: string): Promise<void> {
    const project = projects.find((candidate) => candidate.resources.some((resource) => resource.id === id));

    if (!project) {
      return;
    }

    project.resources = project.resources.filter((resource) => resource.id !== id);
    project.updatedAt = new Date().toISOString();
  }

  async search(query: string): Promise<SearchResult[]> {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return [];
    }

    return projects.flatMap((project) => {
      const results: SearchResult[] = [];
      const projectText = `${project.name} ${project.description}`.toLowerCase();

      if (projectText.includes(normalizedQuery)) {
        results.push({
          entityType: "project",
          entityId: project.id,
          projectId: project.id,
          title: project.name,
          body: project.description,
        });
      }

      for (const resource of project.resources) {
        const resourceText = `${resource.name} ${resource.detail} ${resource.type}`.toLowerCase();

        if (resourceText.includes(normalizedQuery)) {
          results.push({
            entityType: resource.type,
            entityId: resource.id,
            projectId: project.id,
            title: resource.name,
            body: resource.detail,
          });
        }
      }

      return results;
    });
  }
}

function nextAccent(index: number) {
  return ["bg-emerald-500", "bg-sky-500", "bg-amber-500", "bg-rose-500", "bg-violet-500"][index % 5];
}

function normalizeProject(project: Project): Project {
  return {
    ...project,
    resources: project.resources.map((resource) => ({
      ...resource,
      pinned: resource.pinned ?? false,
      authType: resource.authType ?? "none",
      username: resource.username ?? "",
      keyPath: resource.keyPath ?? "",
      encryptedSecret: resource.encryptedSecret ?? null,
    })),
  };
}
