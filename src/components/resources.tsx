import { BookOpenText, Box, Database, ExternalLink, Eye, FileText, FolderOpen, Link2, Pencil, Plus, Server, SquareTerminal, Star, Trash2 } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { clsx } from "clsx";
import type { AuthType, Project, Resource, ResourceType } from "../domain/workspace";
import {
  getResourceSummary,
  getResourceTargetLabel,
  getResourceTargetPlaceholder,
  resourceTypes,
  shouldShowCredentialFields,
  type ResourceFormInput,
  type ResourceQuickView,
} from "../domain/resources";
import { pickFilePath, pickFolderPath } from "../services/filePicker";
import { encryptSecret } from "../services/masterSecret";

export const resourceIcons: Record<ResourceType, typeof FileText> = {
  file: FileText,
  url: Link2,
  server: Server,
  database: Database,
  command: SquareTerminal,
  note: BookOpenText,
};

export function ResourceLibraryView({
  isError,
  isLoading,
  items,
  onActivate,
  onAdd,
  onDelete,
  onEdit,
  onQuickView,
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
  onQuickView: (resource: Resource, projectName?: string) => void;
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
              <ResourceSkeleton />
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
                onQuickView={onQuickView}
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

export function ResourceMini({
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

export function ResourceRow({
  resource,
  className,
  projectName,
  onDelete,
  onEdit,
  onQuickView,
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
  onQuickView: (resource: Resource, projectName?: string) => void;
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
          <button
            className="min-w-0 truncate text-left font-medium hover:text-primary focus:outline-none focus-visible:text-primary"
            onClick={() => onQuickView(resource, projectName)}
            type="button"
          >
            {resource.name}
          </button>
          <span className="badge badge-outline shrink-0 text-xs capitalize">{resource.type}</span>
          {resource.authType !== "none" ? (
            <span className="badge badge-ghost shrink-0 text-xs capitalize">{resource.authType}</span>
          ) : null}
        </div>
        <p className="truncate text-sm text-base-content/60">
          {projectName ? `${projectName} / ` : ""}
          {resource.username ? `${resource.username} @ ` : ""}
          {getResourceSummary(resource)}
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

export function CreateResourceDialog({
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
  const [pickedTarget, setPickedTarget] = useState<string | null>(null);
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
      setPickedTarget(null);
    }
  }, [defaultType, isOpen]);

  async function handlePickFile() {
    const path = await pickFilePath();

    if (path) {
      setType("file");
      setPickedTarget(path);
      setPickedName(path.split("/").pop() || "File");
    }
  }

  async function handlePickFolder() {
    const path = await pickFolderPath();

    if (path) {
      setType("file");
      setPickedTarget(path);
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
        target: String(formData.get("target") ?? "").trim(),
        detail: String(formData.get("detail") ?? "").trim(),
        authType: shouldShowCredentialFields(type) ? authType : "none",
        username: shouldShowCredentialFields(type) ? username.trim() : "",
        keyPath: shouldShowCredentialFields(type) ? keyPath.trim() : "",
        encryptedSecret,
      });
      setType(defaultType);
      setPickedName(null);
      setPickedTarget(null);
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
          <ResourceFormFields
            nameDefaultValue={pickedName ?? ""}
            nameKey={pickedName ?? "new-resource-name"}
            onPickFile={handlePickFile}
            onPickFolder={handlePickFolder}
            pickedTarget={pickedTarget ?? ""}
            targetKey={pickedTarget ?? "new-resource-target"}
            type={type}
            onTypeChange={setType}
          />

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

          <DialogActions
            icon={isSaving ? <span className="loading loading-spinner loading-sm" /> : <Plus size={17} />}
            isSaving={isSaving}
            onClose={onClose}
            submitLabel="Add"
          />
        </form>
      </div>
      <ModalBackdrop onClose={onClose} />
    </dialog>
  );
}

export function EditResourceDialog({
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
  const [pickedTarget, setPickedTarget] = useState<string | null>(null);
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
    setPickedTarget(null);
    setFormError("");
  }, [resource]);

  async function handlePickFile() {
    const path = await pickFilePath();

    if (path) {
      setPickedTarget(path);
    }
  }

  async function handlePickFolder() {
    const path = await pickFolderPath();

    if (path) {
      setPickedTarget(path);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const target = String(formData.get("target") ?? pickedTarget ?? "").trim();
    const detail = String(formData.get("detail") ?? "").trim();

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
        target,
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
          <ResourceFormFields
            detailDefaultValue={resource.detail}
            nameDefaultValue={resource.name}
            onPickFile={handlePickFile}
            onPickFolder={handlePickFolder}
            pickedTarget={pickedTarget ?? resource.target}
            targetKey={pickedTarget ?? resource.target}
            type={editType}
            onTypeChange={setEditType}
          />

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

          <DialogActions
            icon={isSaving ? <span className="loading loading-spinner loading-sm" /> : <Pencil size={17} />}
            isSaving={isSaving}
            onClose={onClose}
            submitLabel="Save"
          />
        </form>
      </div>
      <ModalBackdrop onClose={onClose} />
    </dialog>
  );
}

export function ResourceDetailDialog({ quickView, onClose }: { quickView: ResourceQuickView | null; onClose: () => void }) {
  if (!quickView) {
    return null;
  }

  const { projectName, resource } = quickView;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-3xl rounded-lg">
        <div className="mb-5">
          <h3 className="truncate text-lg font-semibold">{resource.name}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="badge badge-outline text-xs capitalize">{resource.type}</span>
            <span className="badge badge-ghost text-xs">{resource.pinned ? "Pinned" : "Not pinned"}</span>
            {resource.authType !== "none" ? (
              <span className="badge badge-ghost text-xs capitalize">{resource.authType}</span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <ResourceInfo label="Project" value={projectName || resource.projectId} />
            <ResourceInfo label="Type" value={resource.type} />
            <ResourceInfo label="Resource ID" value={resource.id} />
            <ResourceInfo label="Project ID" value={resource.projectId} />
            <ResourceInfo label="Pinned" value={resource.pinned ? "Yes" : "No"} />
            <ResourceInfo label="Auth type" value={resource.authType} />
            <ResourceInfo label="Username" value={resource.username || "None"} />
            <ResourceInfo label="Key path" value={resource.keyPath || "None"} />
            <ResourceInfo label="Secret" value={resource.encryptedSecret ? "Encrypted secret saved" : "None"} />
            <ResourceInfo label="Created" value={resource.createdAt} />
            <ResourceInfo label="Updated" value={resource.updatedAt} />
          </div>

          <Field label={getResourceTargetLabel(resource.type)}>
            <p className="rounded-md border border-base-300 bg-base-200/60 px-3 py-2 text-sm break-words">
              {resource.target || "None"}
            </p>
          </Field>

          <Field label="Detail">
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md border border-base-300 bg-base-200/60 p-3 font-mono text-sm">
              {resource.detail || "No detail"}
            </pre>
          </Field>
        </div>

        <div className="modal-action">
          <button className="btn btn-primary rounded-md" onClick={onClose} type="button">
            Close
          </button>
        </div>
      </div>
      <ModalBackdrop onClose={onClose} />
    </dialog>
  );
}

function ResourceFormFields({
  detailDefaultValue = "",
  nameDefaultValue,
  nameKey,
  onPickFile,
  onPickFolder,
  pickedTarget,
  targetKey,
  type,
  onTypeChange,
}: {
  detailDefaultValue?: string;
  nameDefaultValue: string;
  nameKey?: string;
  onPickFile: () => void;
  onPickFolder: () => void;
  pickedTarget: string;
  targetKey: string;
  type: ResourceType;
  onTypeChange: (type: ResourceType) => void;
}) {
  return (
    <>
      <Field label="Type">
        <select
          className="select select-bordered w-full rounded-md"
          onChange={(event) => onTypeChange(event.target.value as ResourceType)}
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
          defaultValue={nameDefaultValue}
          key={nameKey}
          maxLength={100}
          name="name"
          placeholder="Production dashboard"
        />
      </Field>

      <Field label={getResourceTargetLabel(type)}>
        <div className="grid gap-2">
          <input
            className="input input-bordered w-full rounded-md"
            defaultValue={pickedTarget}
            key={targetKey}
            maxLength={260}
            name="target"
            placeholder={getResourceTargetPlaceholder(type)}
          />
          {type === "file" ? (
            <div className="flex gap-2 max-sm:flex-col">
              <button className="btn btn-outline rounded-md" onClick={onPickFile} type="button">
                <FileText size={17} />
                File
              </button>
              <button className="btn btn-outline rounded-md" onClick={onPickFolder} type="button">
                <FolderOpen size={17} />
                Folder
              </button>
            </div>
          ) : null}
        </div>
      </Field>

      <Field label="Detail">
        <textarea
          className="textarea textarea-bordered min-h-36 w-full resize-y rounded-md font-mono text-sm"
          defaultValue={detailDefaultValue}
          name="detail"
          placeholder="Paste a long command, notes, or usage details."
        />
      </Field>
    </>
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

function ResourceInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-base-300 bg-base-200/60 px-3 py-2">
      <div className="text-xs font-medium text-base-content/55">{label}</div>
      <div className="mt-1 break-words text-sm">{value}</div>
    </div>
  );
}

function ResourceSkeleton() {
  return (
    <div className="rounded-lg border border-base-300 bg-base-200 p-4">
      <div className="skeleton h-5 w-40 rounded-md" />
      <div className="skeleton mt-3 h-4 w-full rounded-md" />
      <div className="skeleton mt-2 h-4 w-3/4 rounded-md" />
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-base-content/80">{label}</span>
      {children}
    </label>
  );
}

function DialogActions({
  icon,
  isSaving,
  onClose,
  submitLabel,
}: {
  icon: ReactNode;
  isSaving: boolean;
  onClose: () => void;
  submitLabel: string;
}) {
  return (
    <div className="modal-action">
      <button className="btn btn-ghost rounded-md" disabled={isSaving} onClick={onClose} type="button">
        Cancel
      </button>
      <button className="btn btn-primary rounded-md" disabled={isSaving} type="submit">
        {icon}
        {submitLabel}
      </button>
    </div>
  );
}

function ModalBackdrop({ onClose }: { onClose: () => void }) {
  return (
    <form className="modal-backdrop" method="dialog">
      <button onClick={onClose} type="button">
        close
      </button>
    </form>
  );
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
