import {
  AlertTriangle,
  Activity,
  AppWindow,
  BookOpenText,
  Box,
  Command,
  Copy,
  Database,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Folder,
  FolderOpen,
  Globe2,
  HardDrive,
  Link2,
  MoreHorizontal,
  Moon,
  PanelLeft,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings,
  SquareTerminal,
  Star,
  Sun,
  Trash2,
} from "lucide-react";
import { ChangeEvent, FormEvent, KeyboardEvent, ReactNode, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { clsx } from "clsx";
import {
  useAddResource,
  useCreateProject,
  useDeleteProject,
  useDeleteResource,
  useProjects,
  useReplaceWorkspace,
  useSearch,
  useUpdateProject,
  useUpdateResource,
} from "./hooks/useProjects";
import { copyText, getDatabaseKind, getDatabasePath } from "./services/appSettings";
import { checkForAppUpdate, getInstalledAppVersion, installAppUpdate, type UpdateCheckResult } from "./services/appUpdate";
import {
  isPostgresUrl,
  readDatabaseConfig,
  redactDatabaseUrl,
  saveDatabaseConfig,
  type DatabaseConfig,
} from "./services/databaseConfig";
import { activateResource } from "./services/resourceActions";
import { pickFilePath, pickFolderPath } from "./services/filePicker";
import { decryptSecret, encryptSecret } from "./services/masterSecret";
import { getProjectRepository, resetProjectRepository } from "./repositories/projectRepository";
import type { AuthType, EncryptedSecret, Project, ProjectStatus, Resource, ResourceType, SearchResult } from "./domain/workspace";

type ResourceFormInput = {
  type: ResourceType;
  name: string;
  detail: string;
  authType?: AuthType;
  username?: string;
  keyPath?: string;
  encryptedSecret?: EncryptedSecret | null;
};

type ThemeMode = "light" | "dark";
type WorkspaceSection = "projects" | "pinned" | "resources" | "commands" | "databases" | "notes";

type WorkspaceState = {
  activeSection: WorkspaceSection;
  selectedProjectId: string;
  resourceFilter: "all" | ResourceType;
  setActiveSection: (activeSection: WorkspaceSection) => void;
  setSelectedProjectId: (projectId: string) => void;
  setResourceFilter: (resourceFilter: "all" | ResourceType) => void;
};

const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeSection: "projects",
  selectedProjectId: "ops-migration",
  resourceFilter: "all",
  setActiveSection: (activeSection) => set({ activeSection }),
  setSelectedProjectId: (selectedProjectId) => set({ selectedProjectId }),
  setResourceFilter: (resourceFilter) => set({ resourceFilter }),
}));

const navigation = [
  { id: "projects", label: "Projects", icon: Folder, resourceType: null },
  { id: "pinned", label: "Pinned", icon: Star, resourceType: null, pinnedOnly: true },
  { id: "resources", label: "Resources", icon: Box, resourceType: null },
  { id: "commands", label: "Commands", icon: SquareTerminal, resourceType: "command" },
  { id: "databases", label: "Databases", icon: Database, resourceType: "database" },
  { id: "notes", label: "Notes", icon: BookOpenText, resourceType: "note" },
] satisfies Array<{
  id: WorkspaceSection;
  label: string;
  icon: typeof FileText;
  resourceType: ResourceType | null;
  pinnedOnly?: boolean;
}>;

const resourceIcons: Record<ResourceType, typeof FileText> = {
  file: FileText,
  url: Link2,
  server: Server,
  database: Database,
  command: SquareTerminal,
  note: BookOpenText,
};

const resourceTypes: ResourceType[] = ["file", "url", "server", "database", "command", "note"];
const projectStatuses: ProjectStatus[] = ["active", "paused", "archived"];

export function App() {
  const queryClient = useQueryClient();
  const activeSection = useWorkspaceStore((state) => state.activeSection);
  const selectedProjectId = useWorkspaceStore((state) => state.selectedProjectId);
  const resourceFilter = useWorkspaceStore((state) => state.resourceFilter);
  const setActiveSection = useWorkspaceStore((state) => state.setActiveSection);
  const setSelectedProjectId = useWorkspaceStore((state) => state.setSelectedProjectId);
  const setResourceFilter = useWorkspaceStore((state) => state.setResourceFilter);
  const { data: projects = [], isLoading, isError } = useProjects();
  const createProject = useCreateProject();
  const addResource = useAddResource();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const updateResource = useUpdateResource();
  const deleteResource = useDeleteResource();
  const replaceWorkspace = useReplaceWorkspace();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const search = useSearch(searchQuery);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isCreateResourceOpen, setIsCreateResourceOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => readStoredTheme());
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0];
  const displayedResources =
    selectedProject?.resources.filter((resource) => resourceFilter === "all" || resource.type === resourceFilter) ?? [];
  const activeNavigationItem = navigation.find((item) => item.id === activeSection) ?? navigation[0];
  const libraryResources = projects
    .flatMap((project) => project.resources.map((resource) => ({ project, resource })))
    .filter(({ resource }) => !activeNavigationItem.resourceType || resource.type === activeNavigationItem.resourceType)
    .filter(({ resource }) => !activeNavigationItem.pinnedOnly || resource.pinned);
  const pinnedResources = projects
    .flatMap((project) => project.resources.map((resource) => ({ project, resource })))
    .filter(({ resource }) => resource.pinned)
    .slice(0, 5);
  const searchResults = search.data ?? [];

  useEffect(() => {
    function handleKeydown(event: globalThis.KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  useEffect(() => {
    setSelectedSearchIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("workdeck-theme", theme);
  }, [theme]);

  async function handleCreateProject(input: { name: string; description: string }) {
    const project = await createProject.mutateAsync(input);
    setSelectedProjectId(project.id);
    setIsCreateProjectOpen(false);
  }

  async function handleDatabaseConfigChange(config: DatabaseConfig) {
    const previousConfig = readDatabaseConfig();
    saveDatabaseConfig(config);
    resetProjectRepository();

    try {
      await getProjectRepository().getAll();
      setSelectedProjectId("");
      queryClient.removeQueries();
      await queryClient.invalidateQueries();
    } catch (error) {
      saveDatabaseConfig(previousConfig);
      resetProjectRepository();
      throw error;
    }
  }

  async function handleUpdateProject(input: { name: string; description: string; status: ProjectStatus }) {
    if (!editingProject) {
      return;
    }

    await updateProject.mutateAsync({ ...input, id: editingProject.id });
    setEditingProject(null);
  }

  function handleDeleteProject(project: Project) {
    setConfirmDialog({
      title: `Delete "${project.name}"?`,
      message: "This will permanently remove the project and all its resources.",
      onConfirm: async () => {
        await deleteProject.mutateAsync(project.id);
        const nextProject = projects.find((candidate) => candidate.id !== project.id);
        setSelectedProjectId(nextProject?.id ?? "");
      },
    });
  }

  async function handleAddResource(input: ResourceFormInput) {
    if (!selectedProject) {
      return;
    }

    await addResource.mutateAsync({ ...input, projectId: selectedProject.id });
    setIsCreateResourceOpen(false);
  }

  async function handleUpdateResource(input: ResourceFormInput) {
    if (!editingResource) {
      return;
    }

    await updateResource.mutateAsync({ ...input, id: editingResource.id, pinned: editingResource.pinned });
    setEditingResource(null);
  }

  async function handleTogglePinned(resource: Resource) {
    await updateResource.mutateAsync({
      id: resource.id,
      type: resource.type,
      name: resource.name,
      detail: resource.detail,
      pinned: !resource.pinned,
      authType: resource.authType,
      username: resource.username,
      keyPath: resource.keyPath,
      encryptedSecret: resource.encryptedSecret,
    });
  }

  function handleDeleteResource(resource: Resource) {
    setConfirmDialog({
      title: `Delete "${resource.name}"?`,
      message: "This resource will be permanently removed from the project.",
      onConfirm: async () => {
        await deleteResource.mutateAsync(resource.id);
      },
    });
  }

  async function handleActivateResource(resource: Resource) {
    await activateResource(resource);
  }

  async function handleRevealSecret(resource: Resource) {
    if (!resource.encryptedSecret) {
      return;
    }

    const masterPassword = window.prompt("Master password");

    if (!masterPassword) {
      return;
    }

    try {
      const secret = await decryptSecret(resource.encryptedSecret, masterPassword);
      window.prompt("Decrypted secret", secret);
    } catch {
      window.alert("Could not decrypt secret. Check the master password.");
    }
  }

  function handleSelectSearchResult(result: SearchResult) {
    setSelectedProjectId(result.projectId);
    setActiveSection(result.entityType === "project" ? "projects" : "resources");
    setSearchQuery("");
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!searchQuery.trim() || searchResults.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedSearchIndex((current) => Math.min(current + 1, searchResults.length - 1));
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedSearchIndex((current) => Math.max(current - 1, 0));
    }

    if (event.key === "Enter") {
      event.preventDefault();
      handleSelectSearchResult(searchResults[selectedSearchIndex]);
    }
  }

  return (
    <main className="min-h-screen bg-base-200 text-base-content">
      <div className="grid min-h-screen grid-cols-[272px_minmax(0,1fr)] max-lg:grid-cols-1">
        <aside className="border-r border-base-300 bg-base-100 max-lg:hidden">
          <div className="flex h-16 items-center gap-3 border-b border-base-300 px-5">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-neutral text-neutral-content">
              <AppWindow size={20} />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">WorkDeck</h1>
              <p className="text-xs text-base-content/60">Local workspace manager</p>
            </div>
          </div>

          <nav className="space-y-1 px-3 py-4">
            {navigation.map((item) => (
              <button
                key={item.label}
                onClick={() => setActiveSection(item.id)}
                className={clsx(
                  "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition",
                  activeSection === item.id
                    ? "bg-base-200 text-base-content"
                    : "text-base-content/65 hover:bg-base-200 hover:text-base-content",
                )}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="px-5 py-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-base-content/50">Pinned</span>
              <button className="btn btn-ghost btn-xs" aria-label="Manage pinned resources" onClick={() => setActiveSection("pinned")}>
                <MoreHorizontal size={16} />
              </button>
            </div>
            <div className="space-y-2">
              {pinnedResources.length > 0 ? (
                pinnedResources.map(({ project, resource }) => (
                  <ResourceMini
                    key={resource.id}
                    detail={`${project.name} / ${resource.detail}`}
                    name={resource.name}
                    onClick={() => setActiveSection("pinned")}
                    type={resource.type}
                  />
                ))
              ) : (
                <p className="px-2 text-sm text-base-content/55">No pinned resources</p>
              )}
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col">
          <header className="flex h-16 items-center gap-3 border-b border-base-300 bg-base-100 px-5">
            <button className="btn btn-ghost btn-sm lg:hidden" aria-label="Open navigation">
              <PanelLeft size={18} />
            </button>
            <div className="relative min-w-0 flex-1">
              <label className="input input-bordered flex h-10 w-full items-center gap-2 rounded-md bg-base-200">
                <Search size={18} className="text-base-content/50" />
                <input
                  className="min-w-0 grow text-sm"
                  onKeyDown={handleSearchKeyDown}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search projects, files, URLs, servers, commands, databases, notes"
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                />
                <kbd className="kbd kbd-sm max-sm:hidden">Ctrl K</kbd>
              </label>
              {searchQuery.trim() ? (
                <SearchResults
                  isLoading={search.isLoading}
                  onSelect={handleSelectSearchResult}
                  results={searchResults}
                  selectedIndex={selectedSearchIndex}
                />
              ) : null}
            </div>
            <button
              className="btn btn-primary h-10 min-h-10 rounded-md"
              onClick={() => (activeSection === "projects" ? setIsCreateProjectOpen(true) : setIsCreateResourceOpen(true))}
            >
              <Plus size={18} />
              <span className="max-sm:hidden">Add</span>
            </button>
            <button
              className="btn btn-ghost h-10 min-h-10 w-10 rounded-md p-0"
              aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="btn btn-ghost h-10 min-h-10 w-10 rounded-md p-0"
              aria-label="Settings"
              onClick={() => setIsSettingsOpen(true)}
            >
              <Settings size={18} />
            </button>
          </header>

          <nav className="flex gap-1 overflow-x-auto border-b border-base-300 bg-base-100 px-3 py-2 lg:hidden">
            {navigation.map((item) => (
              <button
                className={clsx(
                  "btn btn-sm shrink-0 rounded-md",
                  activeSection === item.id ? "btn-neutral" : "btn-ghost",
                )}
                key={item.id}
                onClick={() => setActiveSection(item.id)}
              >
                <item.icon size={16} />
                {item.label}
              </button>
            ))}
          </nav>

          {activeSection === "projects" ? (
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(320px,420px)_minmax(0,1fr)] max-xl:grid-cols-1">
            <section className="border-r border-base-300 bg-base-100 max-xl:border-b max-xl:border-r-0">
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold">Projects</h2>
                  <p className="text-sm text-base-content/60">
                    {isLoading ? "Loading local workspace" : `${projects.length} workspaces tracked locally`}
                  </p>
                </div>
                <button className="btn btn-outline btn-sm rounded-md" onClick={() => setIsCreateProjectOpen(true)}>
                  <Plus size={16} />
                  New
                </button>
              </div>

              <div className="space-y-2 px-3 pb-4">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => setSelectedProjectId(project.id)}
                    className={clsx(
                      "w-full rounded-lg border p-4 text-left transition",
                      selectedProject.id === project.id
                        ? "border-primary/40 bg-primary/10"
                        : "border-transparent bg-base-200 hover:border-base-300",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className={clsx("mt-1 h-3 w-3 shrink-0 rounded-full", project.accent)} />
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold">{project.name}</h3>
                          <p className="mt-1 line-clamp-2 text-sm leading-5 text-base-content/65">
                            {project.description}
                          </p>
                        </div>
                      </div>
                      <span className="badge badge-ghost shrink-0 capitalize">{project.status}</span>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs text-base-content/55">
                      <span>{project.resources.length} resources</span>
                      <span>{new Date(project.updatedAt).toLocaleString()}</span>
                    </div>
                  </button>
                ))}
                {isLoading ? <ProjectSkeleton /> : null}
                {isError ? (
                  <div className="rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error">
                    WorkDeck could not load the local workspace database.
                  </div>
                ) : null}
              </div>
            </section>

            <section className="min-w-0 overflow-auto">
              {selectedProject ? (
                <div className="mx-auto max-w-5xl px-6 py-6 max-sm:px-4">
                <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="mb-2 flex items-center gap-2 text-sm text-base-content/60">
                      <HardDrive size={16} />
                      Offline SQLite workspace
                    </div>
                    <h2 className="text-3xl font-semibold tracking-normal max-sm:text-2xl">{selectedProject.name}</h2>
                    <p className="mt-2 max-w-2xl text-base text-base-content/65">{selectedProject.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-outline rounded-md" onClick={() => setEditingProject(selectedProject)}>
                      <Pencil size={17} />
                      Edit
                    </button>
                    <button className="btn btn-outline rounded-md" onClick={() => handleDeleteProject(selectedProject)}>
                      <Trash2 size={17} />
                      Delete
                    </button>
                    <button className="btn btn-primary rounded-md" onClick={() => setIsCreateResourceOpen(true)}>
                      <Command size={17} />
                      Add resource
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
                  <Metric icon={Activity} label="Status" value={selectedProject.status} />
                  <Metric icon={Star} label="Resources" value={String(selectedProject.resources.length)} />
                  <Metric icon={Globe2} label="Search" value="Ready" />
                </div>

                <div className="mt-7">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-semibold">Resources</h3>
                    <div className="flex items-center gap-2">
                      <div className="join max-sm:hidden">
                        <button
                          className={clsx("btn join-item btn-sm rounded-l-md", resourceFilter === "all" && "btn-active")}
                          onClick={() => setResourceFilter("all")}
                        >
                          All
                        </button>
                        <button
                          className={clsx("btn join-item btn-sm", resourceFilter === "file" && "btn-active")}
                          onClick={() => setResourceFilter("file")}
                        >
                          Files
                        </button>
                        <button
                          className={clsx("btn join-item btn-sm rounded-r-md", resourceFilter === "command" && "btn-active")}
                          onClick={() => setResourceFilter("command")}
                        >
                          Commands
                        </button>
                      </div>
                      <button className="btn btn-outline btn-sm rounded-md" onClick={() => setIsCreateResourceOpen(true)}>
                        <Plus size={16} />
                        Add
                      </button>
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-base-300 bg-base-100">
                    {displayedResources.length > 0 ? (
                      displayedResources.map((resource, index) => (
                        <ResourceRow
                          key={resource.id}
                          resource={resource}
                          className={index === displayedResources.length - 1 ? "" : "border-b border-base-300"}
                          onActivate={handleActivateResource}
                          onDelete={handleDeleteResource}
                          onEdit={setEditingResource}
                          onRevealSecret={handleRevealSecret}
                          onTogglePinned={handleTogglePinned}
                        />
                      ))
                    ) : (
                      <div className="px-4 py-10 text-center">
                        <h4 className="font-medium">No resources yet</h4>
                        <p className="mt-1 text-sm text-base-content/60">Add a file, URL, server, command, database, or note.</p>
                      </div>
                    )}
                  </div>
                </div>
                </div>
              ) : (
                <div className="grid h-full place-items-center px-6 py-12 text-center">
                  <div>
                    <h2 className="text-xl font-semibold">No projects yet</h2>
                    <p className="mt-2 text-sm text-base-content/60">Create a project to start collecting resources.</p>
                  </div>
                </div>
              )}
            </section>
          </div>
          ) : (
            <ResourceLibraryView
              isError={isError}
              isLoading={isLoading}
              items={libraryResources}
              onActivate={handleActivateResource}
              onAdd={() => setIsCreateResourceOpen(true)}
              onDelete={handleDeleteResource}
              onEdit={setEditingResource}
              onRevealSecret={handleRevealSecret}
              onTogglePinned={handleTogglePinned}
              projects={projects}
              pinnedOnly={Boolean(activeNavigationItem.pinnedOnly)}
              resourceType={activeNavigationItem.resourceType}
              title={activeNavigationItem.label}
            />
          )}
        </section>
      </div>
      <CreateProjectDialog
        isOpen={isCreateProjectOpen}
        isSaving={createProject.isPending}
        error={createProject.error instanceof Error ? createProject.error.message : null}
        onClose={() => setIsCreateProjectOpen(false)}
        onSubmit={handleCreateProject}
      />
      <EditProjectDialog
        error={updateProject.error instanceof Error ? updateProject.error.message : null}
        isSaving={updateProject.isPending}
        onClose={() => setEditingProject(null)}
        onSubmit={handleUpdateProject}
        project={editingProject}
      />
      <CreateResourceDialog
        defaultType={activeNavigationItem.resourceType ?? "file"}
        isOpen={isCreateResourceOpen && Boolean(selectedProject)}
        isSaving={addResource.isPending}
        error={addResource.error instanceof Error ? addResource.error.message : null}
        onClose={() => setIsCreateResourceOpen(false)}
        onSubmit={handleAddResource}
      />
      <EditResourceDialog
        error={updateResource.error instanceof Error ? updateResource.error.message : null}
        isSaving={updateResource.isPending}
        onClose={() => setEditingResource(null)}
        onSubmit={handleUpdateResource}
        resource={editingResource}
      />
      <SettingsDialog
        importError={replaceWorkspace.error instanceof Error ? replaceWorkspace.error.message : null}
        isImporting={replaceWorkspace.isPending}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onDatabaseConfigChange={handleDatabaseConfigChange}
        onImport={(nextProjects) => replaceWorkspace.mutateAsync(nextProjects)}
        projects={projects}
        theme={theme}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
      />
      <ConfirmDialog
        message={confirmDialog?.message ?? ""}
        title={confirmDialog?.title ?? ""}
        isOpen={confirmDialog !== null}
        onCancel={() => setConfirmDialog(null)}
        onConfirm={async () => {
          await confirmDialog?.onConfirm();
          setConfirmDialog(null);
        }}
      />
    </main>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex items-center gap-2 text-sm text-base-content/60">
        <Icon size={16} />
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold capitalize">{value}</div>
    </div>
  );
}

function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  return localStorage.getItem("workdeck-theme") === "dark" ? "dark" : "light";
}

function ResourceLibraryView({
  isError,
  isLoading,
  items,
  onActivate,
  onAdd,
  onDelete,
  onEdit,
  onRevealSecret,
  onTogglePinned,
  pinnedOnly,
  projects,
  resourceType,
  title,
}: {
  isError: boolean;
  isLoading: boolean;
  items: Array<{ project: Project; resource: Resource }>;
  onActivate: (resource: Resource) => void;
  onAdd: () => void;
  onDelete: (resource: Resource) => void;
  onEdit: (resource: Resource) => void;
  onRevealSecret: (resource: Resource) => void;
  onTogglePinned: (resource: Resource) => void;
  pinnedOnly: boolean;
  projects: Project[];
  resourceType: ResourceType | null;
  title: string;
}) {
  const totalResources = projects.reduce((sum, project) => sum + project.resources.length, 0);
  const resourceCounts = resourceTypes.map((type) => ({
    type,
    count: projects.reduce((sum, project) => sum + project.resources.filter((resource) => resource.type === type).length, 0),
  }));
  const Icon = resourceType ? resourceIcons[resourceType] : Box;

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mx-auto max-w-6xl px-6 py-6 max-sm:px-4">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-sm text-base-content/60">
              <Icon size={16} />
              Local resources
            </div>
            <h2 className="text-3xl font-semibold tracking-normal max-sm:text-2xl">{title}</h2>
            <p className="mt-2 max-w-2xl text-base text-base-content/65">
              {pinnedOnly
                ? `${items.length} pinned ${items.length === 1 ? "resource" : "resources"} across ${projects.length} projects`
                : resourceType
                ? `${items.length} ${resourceType} ${items.length === 1 ? "resource" : "resources"} across ${projects.length} projects`
                : `${totalResources} resources across ${projects.length} projects`}
            </p>
          </div>
          <button className="btn btn-primary rounded-md" disabled={projects.length === 0} onClick={onAdd}>
            <Plus size={17} />
            Add resource
          </button>
        </div>

        <div className="mb-5 grid grid-cols-6 gap-3 max-lg:grid-cols-3 max-sm:grid-cols-2">
          {resourceCounts.map(({ type, count }) => {
            const CountIcon = resourceIcons[type];

            return (
              <div
                className={clsx(
                  "rounded-lg border bg-base-100 p-3",
                  resourceType === type ? "border-primary/40 bg-primary/10" : "border-base-300",
                )}
                key={type}
              >
                <div className="flex items-center gap-2 text-xs font-medium capitalize text-base-content/60">
                  <CountIcon size={15} />
                  {type}
                </div>
                <div className="mt-2 text-lg font-semibold">{count}</div>
              </div>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-lg border border-base-300 bg-base-100">
          {isLoading ? (
            <div className="p-4">
              <ProjectSkeleton />
            </div>
          ) : isError ? (
            <div className="px-4 py-10 text-center text-sm text-error">
              WorkDeck could not load the local workspace database.
            </div>
          ) : items.length > 0 ? (
            items.map(({ project, resource }, index) => (
              <ResourceRow
                key={resource.id}
                resource={resource}
                projectName={project.name}
                className={index === items.length - 1 ? "" : "border-b border-base-300"}
                onActivate={onActivate}
                onDelete={onDelete}
                onEdit={onEdit}
                onRevealSecret={onRevealSecret}
                onTogglePinned={onTogglePinned}
              />
            ))
          ) : (
            <div className="px-4 py-10 text-center">
              <h4 className="font-medium">No {pinnedOnly ? "pinned resources" : resourceType ?? "resources"} yet</h4>
              <p className="mt-1 text-sm text-base-content/60">
                {projects.length > 0
                  ? pinnedOnly
                    ? "Use the star button on any resource to pin it."
                    : "Add a resource to the selected project."
                  : "Create a project before adding resources."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResourceMini({
  name,
  detail,
  type,
  onClick,
}: {
  name: string;
  detail: string;
  type: ResourceType;
  onClick?: () => void;
}) {
  const Icon = resourceIcons[type];

  return (
    <button className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-base-200" onClick={onClick}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-base-200">
        <Icon size={16} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="block truncate text-xs text-base-content/55">{detail}</span>
      </span>
    </button>
  );
}

function SearchResults({
  isLoading,
  results,
  onSelect,
  selectedIndex,
}: {
  isLoading: boolean;
  results: SearchResult[];
  onSelect: (result: SearchResult) => void;
  selectedIndex: number;
}) {
  return (
    <div className="absolute left-0 right-0 top-12 z-20 overflow-hidden rounded-lg border border-base-300 bg-base-100 shadow-xl">
      {isLoading ? (
        <div className="px-4 py-3 text-sm text-base-content/60">Searching local workspace...</div>
      ) : results.length > 0 ? (
        <div className="max-h-96 overflow-auto py-1">
          {results.map((result, index) => {
            const Icon = result.entityType === "project" ? Folder : resourceIcons[result.entityType];

            return (
              <button
                className={clsx(
                  "flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-base-200",
                  index === selectedIndex && "bg-base-200",
                )}
                key={`${result.entityType}-${result.entityId}`}
                onClick={() => onSelect(result)}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-base-200">
                  <Icon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">{result.title}</span>
                    <span className="badge badge-outline shrink-0 text-xs capitalize">{result.entityType}</span>
                  </span>
                  <span className="block truncate text-sm text-base-content/60">{result.body || "No detail"}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="px-4 py-3 text-sm text-base-content/60">No local matches</div>
      )}
    </div>
  );
}

function ProjectSkeleton() {
  return (
    <div className="rounded-lg border border-base-300 bg-base-200 p-4">
      <div className="skeleton h-5 w-40 rounded-md" />
      <div className="skeleton mt-3 h-4 w-full rounded-md" />
      <div className="skeleton mt-2 h-4 w-3/4 rounded-md" />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-base-content/80">{label}</span>
      {children}
    </label>
  );
}

function CreateProjectDialog({
  isOpen,
  isSaving,
  error,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  isSaving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: { name: string; description: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      return;
    }

    await onSubmit({ name: trimmedName, description: description.trim() });
    setName("");
    setDescription("");
  }

  if (!isOpen) {
    return null;
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-lg rounded-lg">
        <div className="mb-5">
          <h3 className="text-lg font-semibold">New project</h3>
          <p className="mt-1 text-sm text-base-content/60">Create a local workspace for related resources.</p>
        </div>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <Field label="Name">
            <input
              autoFocus
              className="input input-bordered w-full rounded-md"
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              placeholder="Customer portal"
              value={name}
            />
          </Field>

          <Field label="Description">
            <textarea
              className="textarea textarea-bordered min-h-24 w-full rounded-md"
              maxLength={240}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Folders, dashboards, commands, and notes for this workspace."
              value={description}
            />
          </Field>

          {error ? <p className="rounded-md bg-error/10 px-3 py-2 text-sm text-error">{error}</p> : null}

          <div className="modal-action">
            <button className="btn btn-ghost rounded-md" disabled={isSaving} onClick={onClose} type="button">
              Cancel
            </button>
            <button className="btn btn-primary rounded-md" disabled={!name.trim() || isSaving} type="submit">
              {isSaving ? <span className="loading loading-spinner loading-sm" /> : <Plus size={17} />}
              Create
            </button>
          </div>
        </form>
      </div>
      <form className="modal-backdrop" method="dialog">
        <button onClick={onClose} type="button">
          close
        </button>
      </form>
    </dialog>
  );
}

function EditProjectDialog({
  project,
  isSaving,
  error,
  onClose,
  onSubmit,
}: {
  project: Project | null;
  isSaving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: { name: string; description: string; status: ProjectStatus }) => Promise<void>;
}) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const status = String(formData.get("status") ?? "active") as ProjectStatus;

    if (!name) {
      return;
    }

    await onSubmit({ name, description, status });
  }

  if (!project) {
    return null;
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-lg rounded-lg">
        <div className="mb-5">
          <h3 className="text-lg font-semibold">Edit project</h3>
          <p className="mt-1 text-sm text-base-content/60">Update workspace details and status.</p>
        </div>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <Field label="Name">
            <input
              autoFocus
              className="input input-bordered w-full rounded-md"
              defaultValue={project.name}
              maxLength={80}
              name="name"
            />
          </Field>

          <Field label="Description">
            <textarea
              className="textarea textarea-bordered min-h-24 w-full rounded-md"
              defaultValue={project.description}
              maxLength={240}
              name="description"
            />
          </Field>

          <Field label="Status">
            <select className="select select-bordered w-full rounded-md" defaultValue={project.status} name="status">
              {projectStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </Field>

          {error ? <p className="rounded-md bg-error/10 px-3 py-2 text-sm text-error">{error}</p> : null}

          <div className="modal-action">
            <button className="btn btn-ghost rounded-md" disabled={isSaving} onClick={onClose} type="button">
              Cancel
            </button>
            <button className="btn btn-primary rounded-md" disabled={isSaving} type="submit">
              {isSaving ? <span className="loading loading-spinner loading-sm" /> : <Pencil size={17} />}
              Save
            </button>
          </div>
        </form>
      </div>
      <form className="modal-backdrop" method="dialog">
        <button onClick={onClose} type="button">
          close
        </button>
      </form>
    </dialog>
  );
}

function CreateResourceDialog({
  defaultType,
  isOpen,
  isSaving,
  error,
  onClose,
  onSubmit,
}: {
  defaultType: ResourceType;
  isOpen: boolean;
  isSaving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: ResourceFormInput) => Promise<void>;
}) {
  const [type, setType] = useState<ResourceType>(defaultType);
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [pickedDetail, setPickedDetail] = useState<string | null>(null);
  const [authType, setAuthType] = useState<AuthType>("none");
  const [username, setUsername] = useState("");
  const [keyPath, setKeyPath] = useState("");
  const [secret, setSecret] = useState("");
  const [masterPassword, setMasterPassword] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setType(defaultType);
      setPickedName(null);
      setPickedDetail(null);
    }
  }, [defaultType, isOpen]);

  async function handlePickFile() {
    const path = await pickFilePath();

    if (path) {
      setType("file");
      setPickedDetail(path);
      setPickedName(path.split("/").pop() || "File");
    }
  }

  async function handlePickFolder() {
    const path = await pickFolderPath();

    if (path) {
      setType("file");
      setPickedDetail(path);
      setPickedName(path.split("/").pop() || "Folder");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const trimmedName = String(formData.get("name") ?? "").trim();
    if (!trimmedName) {
      return;
    }

    try {
      setFormError("");
      const encryptedSecret = await buildEncryptedSecret(authType, secret, masterPassword);

      await onSubmit({
        type,
        name: trimmedName,
        detail: String(formData.get("detail") ?? "").trim(),
        authType: shouldShowCredentialFields(type) ? authType : "none",
        username: shouldShowCredentialFields(type) ? username.trim() : "",
        keyPath: shouldShowCredentialFields(type) ? keyPath.trim() : "",
        encryptedSecret,
      });
      setType(defaultType);
      setPickedName(null);
      setPickedDetail(null);
      setAuthType("none");
      setUsername("");
      setKeyPath("");
      setSecret("");
      setMasterPassword("");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : typeof error === "string" ? error : JSON.stringify(error));
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-lg rounded-lg">
        <div className="mb-5">
          <h3 className="text-lg font-semibold">Add resource</h3>
          <p className="mt-1 text-sm text-base-content/60">Attach a local project item to this workspace.</p>
        </div>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <Field label="Type">
            <select
              className="select select-bordered w-full rounded-md"
              onChange={(event) => setType(event.target.value as ResourceType)}
              value={type}
            >
              {resourceTypes.map((resourceType) => (
                <option key={resourceType} value={resourceType}>
                  {resourceType}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Name">
            <input
              autoFocus
              className="input input-bordered w-full rounded-md"
              defaultValue={pickedName ?? ""}
              key={pickedName ?? "new-resource-name"}
              maxLength={100}
              name="name"
              placeholder="Production dashboard"
            />
          </Field>

          <Field label="Target or detail">
            <div className="flex gap-2 max-sm:flex-col">
              <input
                className="input input-bordered min-w-0 flex-1 rounded-md"
                defaultValue={pickedDetail ?? ""}
                key={pickedDetail ?? "new-resource-detail"}
                maxLength={260}
                name="detail"
                placeholder="https://dashboard.internal or ~/project/docs"
              />
              <button className="btn btn-outline rounded-md" onClick={handlePickFile} type="button">
                <FileText size={17} />
                File
              </button>
              <button className="btn btn-outline rounded-md" onClick={handlePickFolder} type="button">
                <FolderOpen size={17} />
                Folder
              </button>
            </div>
          </Field>

          {shouldShowCredentialFields(type) ? (
            <CredentialFields
              authType={authType}
              keyPath={keyPath}
              masterPassword={masterPassword}
              secret={secret}
              setAuthType={setAuthType}
              setKeyPath={setKeyPath}
              setMasterPassword={setMasterPassword}
              setSecret={setSecret}
              setUsername={setUsername}
              username={username}
            />
          ) : null}

          {formError || error ? (
            <p className="rounded-md bg-error/10 px-3 py-2 text-sm text-error">{formError || error}</p>
          ) : null}

          <div className="modal-action">
            <button className="btn btn-ghost rounded-md" disabled={isSaving} onClick={onClose} type="button">
              Cancel
            </button>
            <button className="btn btn-primary rounded-md" disabled={isSaving} type="submit">
              {isSaving ? <span className="loading loading-spinner loading-sm" /> : <Plus size={17} />}
              Add
            </button>
          </div>
        </form>
      </div>
      <form className="modal-backdrop" method="dialog">
        <button onClick={onClose} type="button">
          close
        </button>
      </form>
    </dialog>
  );
}

function CredentialFields({
  authType,
  existingSecret = false,
  keyPath,
  masterPassword,
  secret,
  username,
  setAuthType,
  setKeyPath,
  setMasterPassword,
  setSecret,
  setUsername,
}: {
  authType: AuthType;
  existingSecret?: boolean;
  keyPath: string;
  masterPassword: string;
  secret: string;
  username: string;
  setAuthType: (value: AuthType) => void;
  setKeyPath: (value: string) => void;
  setMasterPassword: (value: string) => void;
  setSecret: (value: string) => void;
  setUsername: (value: string) => void;
}) {
  async function handlePickKey() {
    const path = await pickFilePath();

    if (path) {
      setKeyPath(path);
    }
  }

  return (
    <div className="grid gap-4 rounded-lg border border-base-300 bg-base-200/60 p-4">
      <div>
        <h4 className="text-sm font-semibold">Credential</h4>
        <p className="mt-1 text-xs text-base-content/60">Secrets are encrypted with the master password before saving.</p>
      </div>

      <Field label="Auth type">
        <select
          className="select select-bordered w-full rounded-md"
          onChange={(event) => setAuthType(event.target.value as AuthType)}
          value={authType}
        >
          <option value="none">none</option>
          <option value="agent">ssh-agent</option>
          <option value="password">password</option>
          <option value="key">ssh key</option>
        </select>
      </Field>

      {authType !== "none" ? (
        <Field label="Username">
          <input
            className="input input-bordered w-full rounded-md"
            maxLength={100}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="ubuntu"
            value={username}
          />
        </Field>
      ) : null}

      {authType === "key" ? (
        <Field label="Key path">
          <div className="flex gap-2 max-sm:flex-col">
            <input
              className="input input-bordered min-w-0 flex-1 rounded-md"
              maxLength={260}
              onChange={(event) => setKeyPath(event.target.value)}
              placeholder="~/.ssh/id_ed25519"
              value={keyPath}
            />
            <button className="btn btn-outline rounded-md" onClick={handlePickKey} type="button">
              <FileText size={17} />
              Key
            </button>
          </div>
        </Field>
      ) : null}

      {authType === "password" || authType === "key" ? (
        <>
          <Field label={authType === "password" ? "Password" : "Key passphrase"}>
            <input
              className="input input-bordered w-full rounded-md"
              onChange={(event) => setSecret(event.target.value)}
              placeholder={existingSecret ? "Leave blank to keep existing secret" : ""}
              type="password"
              value={secret}
            />
          </Field>

          <Field label="Master password">
            <input
              className="input input-bordered w-full rounded-md"
              onChange={(event) => setMasterPassword(event.target.value)}
              placeholder={existingSecret && !secret ? "Required only when changing the secret" : ""}
              type="password"
              value={masterPassword}
            />
          </Field>
        </>
      ) : null}
    </div>
  );
}

function shouldShowCredentialFields(type: ResourceType) {
  return type === "server" || type === "database";
}

async function buildEncryptedSecret(authType: AuthType, secret: string, masterPassword: string) {
  const trimmedSecret = secret.trim();

  if (authType === "none" || authType === "agent") {
    return null;
  }

  if (!trimmedSecret) {
    if (authType === "password") {
      throw new Error("Password is required for password auth");
    }

    return null;
  }

  if (!masterPassword) {
    throw new Error("Master password is required to encrypt the secret");
  }

  return encryptSecret(trimmedSecret, masterPassword);
}

function EditResourceDialog({
  resource,
  isSaving,
  error,
  onClose,
  onSubmit,
}: {
  resource: Resource | null;
  isSaving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: ResourceFormInput) => Promise<void>;
}) {
  const [pickedDetail, setPickedDetail] = useState<string | null>(null);
  const [editType, setEditType] = useState<ResourceType>("file");
  const [authType, setAuthType] = useState<AuthType>("none");
  const [username, setUsername] = useState("");
  const [keyPath, setKeyPath] = useState("");
  const [secret, setSecret] = useState("");
  const [masterPassword, setMasterPassword] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!resource) {
      return;
    }

    setAuthType(resource.authType);
    setEditType(resource.type);
    setUsername(resource.username);
    setKeyPath(resource.keyPath);
    setSecret("");
    setMasterPassword("");
    setPickedDetail(null);
    setFormError("");
  }, [resource]);

  async function handlePickFile() {
    const path = await pickFilePath();

    if (path) {
      setPickedDetail(path);
    }
  }

  async function handlePickFolder() {
    const path = await pickFolderPath();

    if (path) {
      setPickedDetail(path);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const detail = String(formData.get("detail") ?? pickedDetail ?? "").trim();

    if (!name) {
      return;
    }

    try {
      setFormError("");
      const encryptedSecret = secret
        ? await buildEncryptedSecret(authType, secret, masterPassword)
        : authType === "password"
          ? resource?.encryptedSecret ?? null
          : authType === "key"
            ? resource?.encryptedSecret ?? null
            : null;

      await onSubmit({
        type: editType,
        name,
        detail,
        authType: shouldShowCredentialFields(editType) ? authType : "none",
        username: shouldShowCredentialFields(editType) ? username.trim() : "",
        keyPath: shouldShowCredentialFields(editType) ? keyPath.trim() : "",
        encryptedSecret: shouldShowCredentialFields(editType) ? encryptedSecret : null,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : typeof error === "string" ? error : JSON.stringify(error));
    }
  }

  if (!resource) {
    return null;
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-lg rounded-lg">
        <div className="mb-5">
          <h3 className="text-lg font-semibold">Edit resource</h3>
          <p className="mt-1 text-sm text-base-content/60">Update this project resource.</p>
        </div>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <Field label="Type">
            <select
              className="select select-bordered w-full rounded-md"
              onChange={(event) => setEditType(event.target.value as ResourceType)}
              value={editType}
            >
              {resourceTypes.map((resourceType) => (
                <option key={resourceType} value={resourceType}>
                  {resourceType}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Name">
            <input
              autoFocus
              className="input input-bordered w-full rounded-md"
              defaultValue={resource.name}
              maxLength={100}
              name="name"
            />
          </Field>

          <Field label="Target or detail">
            <div className="flex gap-2 max-sm:flex-col">
              <input
                className="input input-bordered min-w-0 flex-1 rounded-md"
                defaultValue={pickedDetail ?? resource.detail}
                key={pickedDetail ?? resource.detail}
                maxLength={260}
                name="detail"
              />
              <button className="btn btn-outline rounded-md" onClick={handlePickFile} type="button">
                <FileText size={17} />
                File
              </button>
              <button className="btn btn-outline rounded-md" onClick={handlePickFolder} type="button">
                <FolderOpen size={17} />
                Folder
              </button>
            </div>
          </Field>

          {shouldShowCredentialFields(editType) ? (
            <CredentialFields
              authType={authType}
              existingSecret={Boolean(resource.encryptedSecret)}
              keyPath={keyPath}
              masterPassword={masterPassword}
              secret={secret}
              setAuthType={setAuthType}
              setKeyPath={setKeyPath}
              setMasterPassword={setMasterPassword}
              setSecret={setSecret}
              setUsername={setUsername}
              username={username}
            />
          ) : null}

          {formError || error ? (
            <p className="rounded-md bg-error/10 px-3 py-2 text-sm text-error">{formError || error}</p>
          ) : null}

          <div className="modal-action">
            <button className="btn btn-ghost rounded-md" disabled={isSaving} onClick={onClose} type="button">
              Cancel
            </button>
            <button className="btn btn-primary rounded-md" disabled={isSaving} type="submit">
              {isSaving ? <span className="loading loading-spinner loading-sm" /> : <Pencil size={17} />}
              Save
            </button>
          </div>
        </form>
      </div>
      <form className="modal-backdrop" method="dialog">
        <button onClick={onClose} type="button">
          close
        </button>
      </form>
    </dialog>
  );
}

function SettingsDialog({
  isOpen,
  isImporting,
  importError,
  projects,
  theme,
  onClose,
  onDatabaseConfigChange,
  onImport,
  onToggleTheme,
}: {
  isOpen: boolean;
  isImporting: boolean;
  importError: string | null;
  projects: Project[];
  theme: ThemeMode;
  onClose: () => void;
  onDatabaseConfigChange: (config: DatabaseConfig) => Promise<void>;
  onImport: (projects: Project[]) => Promise<void>;
  onToggleTheme: () => void;
}) {
  const [databasePath, setDatabasePath] = useState("");
  const [databaseKind, setDatabaseKind] = useState("");
  const [databaseConfig, setDatabaseConfig] = useState<DatabaseConfig>(() => readDatabaseConfig());
  const [databaseSaveStatus, setDatabaseSaveStatus] = useState("");
  const [databaseError, setDatabaseError] = useState("");
  const [appVersion, setAppVersion] = useState("");
  const [updateStatus, setUpdateStatus] = useState("");
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [importStatus, setImportStatus] = useState("");

  useEffect(() => {
    void getInstalledAppVersion().then(setAppVersion).catch(() => setAppVersion("unknown"));
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void getDatabasePath().then(setDatabasePath);
    setDatabaseKind(getDatabaseKind());
    setDatabaseConfig(readDatabaseConfig());
    setDatabaseSaveStatus("");
    setDatabaseError("");
    setUpdateStatus("");
    setUpdateResult(null);
    setCopyStatus("");
    setImportStatus("");
  }, [isOpen]);

  async function handleCopyDatabasePath() {
    await copyText(databasePath);
    setCopyStatus("Copied");
  }

  async function handleSaveDatabaseConfig() {
    const nextConfig =
      databaseConfig.kind === "postgres"
        ? { kind: "postgres" as const, postgresUrl: databaseConfig.postgresUrl.trim() }
        : { kind: "sqlite" as const, postgresUrl: "" };

    if (nextConfig.kind === "postgres" && !isPostgresUrl(nextConfig.postgresUrl)) {
      setDatabaseError("Use a postgres:// or postgresql:// connection URL.");
      setDatabaseSaveStatus("");
      return;
    }

    try {
      setDatabaseError("");
      await onDatabaseConfigChange(nextConfig);
      setDatabaseKind(nextConfig.kind === "postgres" ? "PostgreSQL" : "SQLite");
      setDatabasePath(nextConfig.kind === "postgres" ? redactDatabaseUrl(nextConfig.postgresUrl) : await getDatabasePath());
      setDatabaseSaveStatus("Saved. Workspace reloaded.");
    } catch (error) {
      setDatabaseError(error instanceof Error ? error.message : "Could not connect to database.");
      setDatabaseSaveStatus("");
    }
  }

  async function handleCheckUpdate() {
    setIsCheckingUpdate(true);
    setUpdateStatus("");

    try {
      const result = await checkForAppUpdate();
      setUpdateResult(result);

      if (result.status === "unsupported") {
        setUpdateStatus("Updates are available only in the installed desktop app.");
      } else if (result.status === "current") {
        setUpdateStatus("You are on the latest version.");
      } else {
        setUpdateStatus(`Version ${result.version} is available.`);
      }
    } catch (error) {
      setUpdateStatus(error instanceof Error ? error.message : "Could not check for updates.");
    } finally {
      setIsCheckingUpdate(false);
    }
  }

  async function handleInstallUpdate() {
    setIsInstallingUpdate(true);

    try {
      await installAppUpdate(setUpdateStatus);
    } catch (error) {
      setUpdateStatus(error instanceof Error ? error.message : "Could not install update.");
      setIsInstallingUpdate(false);
    }
  }

  function handleExport() {
    const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), projects }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `workdeck-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const parsed = JSON.parse(await file.text()) as { projects?: Project[] };

    if (!Array.isArray(parsed.projects)) {
      throw new Error("Backup file does not contain a projects array");
    }

    await onImport(parsed.projects);
    setImportStatus(`Imported ${parsed.projects.length} projects`);
    event.target.value = "";
  }

  if (!isOpen) {
    return null;
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl rounded-lg">
        <div className="mb-5">
          <h3 className="text-lg font-semibold">Settings</h3>
          <p className="mt-1 text-sm text-base-content/60">Local storage and desktop app details.</p>
        </div>

        <div className="grid gap-5">
          <section className="grid gap-2">
            <h4 className="text-sm font-semibold text-base-content/80">Database</h4>
            <p className="text-sm text-base-content/60">{databaseKind}</p>
            <div className="flex gap-2 max-sm:flex-col">
              <input className="input input-bordered min-w-0 flex-1 rounded-md" readOnly value={databasePath} />
              <button className="btn btn-outline rounded-md" onClick={handleCopyDatabasePath} type="button">
                <Copy size={17} />
                Copy
              </button>
            </div>
            {copyStatus ? <p className="text-sm text-success">{copyStatus}</p> : null}
            <div className="grid gap-3 rounded-lg border border-base-300 bg-base-200/60 p-3">
              <div className="flex flex-wrap gap-2">
                <button
                  className={clsx("btn rounded-md", databaseConfig.kind === "sqlite" ? "btn-primary" : "btn-outline")}
                  onClick={() => setDatabaseConfig({ kind: "sqlite", postgresUrl: "" })}
                  type="button"
                >
                  <HardDrive size={17} />
                  SQLite
                </button>
                <button
                  className={clsx("btn rounded-md", databaseConfig.kind === "postgres" ? "btn-primary" : "btn-outline")}
                  onClick={() => setDatabaseConfig({ ...databaseConfig, kind: "postgres" })}
                  type="button"
                >
                  <Database size={17} />
                  PostgreSQL
                </button>
              </div>
              {databaseConfig.kind === "postgres" ? (
                <input
                  className="input input-bordered rounded-md"
                  onChange={(event) => setDatabaseConfig({ kind: "postgres", postgresUrl: event.target.value })}
                  placeholder="postgres://user:password@host:5432/workdeck"
                  type="password"
                  value={databaseConfig.postgresUrl}
                />
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <button className="btn btn-primary rounded-md" onClick={handleSaveDatabaseConfig} type="button">
                  Save database
                </button>
                {databaseError ? (
                  <p className="flex items-center gap-1 text-sm text-error">
                    <AlertTriangle size={15} />
                    {databaseError}
                  </p>
                ) : null}
                {databaseSaveStatus ? <p className="text-sm text-success">{databaseSaveStatus}</p> : null}
              </div>
            </div>
          </section>

          <section className="grid gap-2">
            <h4 className="text-sm font-semibold text-base-content/80">App</h4>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-base-300 bg-base-200/60 p-3 max-sm:flex-col max-sm:items-stretch">
              <div>
                <p className="text-sm font-medium">Version {appVersion || "..."}</p>
                {updateStatus ? <p className="mt-1 text-xs text-base-content/60">{updateStatus}</p> : null}
                {updateResult?.status === "available" && updateResult.body ? (
                  <p className="mt-1 line-clamp-3 text-xs text-base-content/60">{updateResult.body}</p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <button
                  className="btn btn-outline rounded-md"
                  disabled={isCheckingUpdate || isInstallingUpdate}
                  onClick={handleCheckUpdate}
                  type="button"
                >
                  {isCheckingUpdate ? <span className="loading loading-spinner loading-sm" /> : <RefreshCw size={17} />}
                  Check
                </button>
                {updateResult?.status === "available" ? (
                  <button
                    className="btn btn-primary rounded-md"
                    disabled={isInstallingUpdate}
                    onClick={handleInstallUpdate}
                    type="button"
                  >
                    {isInstallingUpdate ? <span className="loading loading-spinner loading-sm" /> : <Download size={17} />}
                    Install
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          <section className="grid gap-2">
            <h4 className="text-sm font-semibold text-base-content/80">Appearance</h4>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-base-300 bg-base-200/60 p-3">
              <div>
                <p className="text-sm font-medium capitalize">{theme} mode</p>
                <p className="text-xs text-base-content/60">DaisyUI theme applied across WorkDeck.</p>
              </div>
              <button className="btn btn-outline rounded-md" onClick={onToggleTheme} type="button">
                {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
                {theme === "dark" ? "Light" : "Dark"}
              </button>
            </div>
          </section>

          <section className="grid gap-2">
            <h4 className="text-sm font-semibold text-base-content/80">Backup</h4>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-outline rounded-md" onClick={handleExport} type="button">
                Export JSON
              </button>
              <label className="btn btn-outline rounded-md">
                {isImporting ? <span className="loading loading-spinner loading-sm" /> : null}
                Import JSON
                <input accept="application/json" className="hidden" onChange={handleImport} type="file" />
              </label>
            </div>
            {importStatus ? <p className="text-sm text-success">{importStatus}</p> : null}
            {importError ? <p className="text-sm text-error">{importError}</p> : null}
          </section>
        </div>

        <div className="modal-action">
          <button className="btn btn-primary rounded-md" onClick={onClose} type="button">
            Close
          </button>
        </div>
      </div>
      <form className="modal-backdrop" method="dialog">
        <button onClick={onClose} type="button">
          close
        </button>
      </form>
    </dialog>
  );
}

function ResourceRow({
  resource,
  className,
  projectName,
  onDelete,
  onEdit,
  onActivate,
  onRevealSecret,
  onTogglePinned,
}: {
  resource: Resource;
  className?: string;
  projectName?: string;
  onActivate: (resource: Resource) => void;
  onDelete: (resource: Resource) => void;
  onEdit: (resource: Resource) => void;
  onRevealSecret: (resource: Resource) => void;
  onTogglePinned: (resource: Resource) => void;
}) {
  const Icon = resourceIcons[resource.type];

  return (
    <div className={clsx("flex items-center gap-3 px-4 py-3", className)}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-base-200">
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="truncate font-medium">{resource.name}</h4>
          <span className="badge badge-outline shrink-0 text-xs capitalize">{resource.type}</span>
          {resource.authType !== "none" ? (
            <span className="badge badge-ghost shrink-0 text-xs capitalize">{resource.authType}</span>
          ) : null}
        </div>
        <p className="truncate text-sm text-base-content/60">
          {projectName ? `${projectName} / ` : ""}
          {resource.username ? `${resource.username} @ ` : ""}
          {resource.detail}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        <button
          className={clsx(
            "btn btn-ghost h-9 min-h-9 w-9 rounded-md p-0",
            resource.pinned && "text-warning",
          )}
          aria-label={resource.pinned ? `Unpin ${resource.name}` : `Pin ${resource.name}`}
          onClick={() => onTogglePinned(resource)}
        >
          <Star size={16} fill={resource.pinned ? "currentColor" : "none"} />
        </button>
        {resource.encryptedSecret ? (
          <button
            className="btn btn-ghost h-9 min-h-9 w-9 rounded-md p-0"
            aria-label={`Reveal secret for ${resource.name}`}
            onClick={() => onRevealSecret(resource)}
          >
            <Eye size={16} />
          </button>
        ) : null}
        <button
          className="btn btn-ghost h-9 min-h-9 w-9 rounded-md p-0"
          aria-label={`Open ${resource.name}`}
          onClick={() => onActivate(resource)}
        >
          <ExternalLink size={16} />
        </button>
        <button
          className="btn btn-ghost h-9 min-h-9 w-9 rounded-md p-0"
          aria-label={`Edit ${resource.name}`}
          onClick={() => onEdit(resource)}
        >
          <Pencil size={16} />
        </button>
        <button
          className="btn btn-ghost h-9 min-h-9 w-9 rounded-md p-0 text-error"
          aria-label={`Delete ${resource.name}`}
          onClick={() => onDelete(resource)}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

function ConfirmDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirm() {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-sm rounded-lg">
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-error/10 text-error">
              <Trash2 size={18} />
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-base-content/60">{message}</p>
            </div>
          </div>
        </div>
        <div className="modal-action">
          <button className="btn btn-ghost rounded-md" disabled={isDeleting} onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="btn btn-error rounded-md" disabled={isDeleting} onClick={handleConfirm} type="button">
            {isDeleting ? <span className="loading loading-spinner loading-sm" /> : <Trash2 size={16} />}
            Delete
          </button>
        </div>
      </div>
      <form className="modal-backdrop" method="dialog">
        <button onClick={onCancel} type="button">close</button>
      </form>
    </dialog>
  );
}
