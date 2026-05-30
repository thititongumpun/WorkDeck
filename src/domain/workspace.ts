export type ResourceType = "file" | "url" | "server" | "database" | "command" | "note";

export type ProjectStatus = "active" | "paused" | "archived";
export type AuthType = "none" | "agent" | "password" | "key";

export type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  salt: string;
  kdfIterations: number;
};

export type Resource = {
  id: string;
  projectId: string;
  name: string;
  target: string;
  detail: string;
  type: ResourceType;
  pinned: boolean;
  authType: AuthType;
  username: string;
  keyPath: string;
  encryptedSecret: EncryptedSecret | null;
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  accent: string;
  updatedAt: string;
  resources: Resource[];
};

export type CreateProjectInput = {
  name: string;
  description: string;
  accent: string;
};

export type CreateResourceInput = {
  projectId: string;
  type: ResourceType;
  name: string;
  target: string;
  detail: string;
  pinned?: boolean;
  authType?: AuthType;
  username?: string;
  keyPath?: string;
  encryptedSecret?: EncryptedSecret | null;
};

export type UpdateProjectInput = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  accent: string;
};

export type UpdateResourceInput = {
  id: string;
  type: ResourceType;
  name: string;
  target: string;
  detail: string;
  pinned?: boolean;
  authType?: AuthType;
  username?: string;
  keyPath?: string;
  encryptedSecret?: EncryptedSecret | null;
};

export type SearchResult = {
  entityType: "project" | ResourceType;
  entityId: string;
  projectId: string;
  title: string;
  body: string;
};

export interface ProjectRepository {
  getAll(): Promise<Project[]>;
  getById(id: string): Promise<Project | null>;
  replaceAll(projects: Project[]): Promise<void>;
  create(input: CreateProjectInput): Promise<Project>;
  update(input: UpdateProjectInput): Promise<Project>;
  delete(id: string): Promise<void>;
  addResource(input: CreateResourceInput): Promise<Resource>;
  updateResource(input: UpdateResourceInput): Promise<Resource>;
  deleteResource(id: string): Promise<void>;
  search(query: string): Promise<SearchResult[]>;
}
