CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  accent TEXT NOT NULL DEFAULT 'bg-emerald-500',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('file', 'url', 'server', 'database', 'command', 'note')),
  name TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
  entity_type,
  entity_id,
  project_id UNINDEXED,
  title,
  body
);

CREATE TRIGGER IF NOT EXISTS projects_search_insert
AFTER INSERT ON projects
BEGIN
  INSERT INTO search_index(entity_type, entity_id, project_id, title, body)
  VALUES ('project', NEW.id, NEW.id, NEW.name, NEW.description);
END;

CREATE TRIGGER IF NOT EXISTS projects_search_update
AFTER UPDATE ON projects
BEGIN
  DELETE FROM search_index WHERE entity_type = 'project' AND entity_id = OLD.id;
  INSERT INTO search_index(entity_type, entity_id, project_id, title, body)
  VALUES ('project', NEW.id, NEW.id, NEW.name, NEW.description);
END;

CREATE TRIGGER IF NOT EXISTS projects_search_delete
AFTER DELETE ON projects
BEGIN
  DELETE FROM search_index WHERE entity_type = 'project' AND entity_id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS resources_search_insert
AFTER INSERT ON resources
BEGIN
  INSERT INTO search_index(entity_type, entity_id, project_id, title, body)
  VALUES (NEW.type, NEW.id, NEW.project_id, NEW.name, NEW.detail);
END;

CREATE TRIGGER IF NOT EXISTS resources_search_update
AFTER UPDATE ON resources
BEGIN
  DELETE FROM search_index WHERE entity_id = OLD.id;
  INSERT INTO search_index(entity_type, entity_id, project_id, title, body)
  VALUES (NEW.type, NEW.id, NEW.project_id, NEW.name, NEW.detail);
END;

CREATE TRIGGER IF NOT EXISTS resources_search_delete
AFTER DELETE ON resources
BEGIN
  DELETE FROM search_index WHERE entity_id = OLD.id;
END;

INSERT OR IGNORE INTO projects (id, name, description, status, accent, created_at, updated_at)
VALUES
  ('ops-migration', 'Ops Migration', 'Cutover checklist, server inventory, and runbooks.', 'active', 'bg-emerald-500', '2026-05-28T00:00:00.000Z', 'Today'),
  ('analytics-lake', 'Analytics Lake', 'Warehouse access, notebooks, and daily load commands.', 'active', 'bg-sky-500', '2026-05-27T00:00:00.000Z', 'Yesterday'),
  ('incident-kit', 'Incident Kit', 'Reusable response links, logs, and shell commands.', 'paused', 'bg-amber-500', '2026-05-24T00:00:00.000Z', 'May 24');

INSERT OR IGNORE INTO resources (id, project_id, type, name, detail, created_at, updated_at)
VALUES
  ('r1', 'ops-migration', 'file', 'Migration Runbook', '~/work/ops/runbook.md', '2026-05-28T00:00:00.000Z', '2026-05-28T00:00:00.000Z'),
  ('r2', 'ops-migration', 'url', 'Grafana Dashboard', 'https://grafana.internal/migration', '2026-05-28T00:01:00.000Z', '2026-05-28T00:01:00.000Z'),
  ('r3', 'ops-migration', 'database', 'Primary DB', 'postgres://prod-main:5432', '2026-05-28T00:02:00.000Z', '2026-05-28T00:02:00.000Z'),
  ('r4', 'ops-migration', 'command', 'Restart Worker', 'systemctl restart worker', '2026-05-28T00:03:00.000Z', '2026-05-28T00:03:00.000Z'),
  ('r5', 'analytics-lake', 'command', 'Daily Loads', 'make warehouse-load', '2026-05-27T00:00:00.000Z', '2026-05-27T00:00:00.000Z'),
  ('r6', 'analytics-lake', 'file', 'Data Contracts', '~/warehouse/contracts', '2026-05-27T00:01:00.000Z', '2026-05-27T00:01:00.000Z'),
  ('r7', 'analytics-lake', 'database', 'Warehouse', 'snowflake://analytics', '2026-05-27T00:02:00.000Z', '2026-05-27T00:02:00.000Z'),
  ('r8', 'incident-kit', 'url', 'Pager Console', 'https://pager.internal', '2026-05-24T00:00:00.000Z', '2026-05-24T00:00:00.000Z'),
  ('r9', 'incident-kit', 'server', 'Log Host', 'ssh logs-01.internal', '2026-05-24T00:01:00.000Z', '2026-05-24T00:01:00.000Z'),
  ('r10', 'incident-kit', 'note', 'Postmortem Notes', 'Template and active drafts', '2026-05-24T00:02:00.000Z', '2026-05-24T00:02:00.000Z');
