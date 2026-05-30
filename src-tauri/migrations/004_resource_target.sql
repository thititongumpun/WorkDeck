ALTER TABLE resources ADD COLUMN target TEXT NOT NULL DEFAULT '';

UPDATE resources
SET target = detail,
    detail = ''
WHERE target = ''
  AND type IN ('file', 'url', 'server', 'database');

DROP TRIGGER IF EXISTS resources_search_insert;
DROP TRIGGER IF EXISTS resources_search_update;

CREATE TRIGGER IF NOT EXISTS resources_search_insert
AFTER INSERT ON resources
BEGIN
  INSERT INTO search_index(entity_type, entity_id, project_id, title, body)
  VALUES (NEW.type, NEW.id, NEW.project_id, NEW.name, trim(NEW.target || ' ' || NEW.detail));
END;

CREATE TRIGGER IF NOT EXISTS resources_search_update
AFTER UPDATE ON resources
BEGIN
  DELETE FROM search_index WHERE entity_id = OLD.id;
  INSERT INTO search_index(entity_type, entity_id, project_id, title, body)
  VALUES (NEW.type, NEW.id, NEW.project_id, NEW.name, trim(NEW.target || ' ' || NEW.detail));
END;

DELETE FROM search_index WHERE entity_type IN ('file', 'url', 'server', 'database', 'command', 'note');

INSERT INTO search_index(entity_type, entity_id, project_id, title, body)
SELECT type, id, project_id, name, trim(target || ' ' || detail)
FROM resources;
