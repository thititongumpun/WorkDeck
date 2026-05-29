ALTER TABLE resources ADD COLUMN auth_type TEXT NOT NULL DEFAULT 'none'
  CHECK (auth_type IN ('none', 'agent', 'password', 'key'));

ALTER TABLE resources ADD COLUMN username TEXT NOT NULL DEFAULT '';
ALTER TABLE resources ADD COLUMN key_path TEXT NOT NULL DEFAULT '';
ALTER TABLE resources ADD COLUMN encrypted_secret TEXT;
ALTER TABLE resources ADD COLUMN secret_iv TEXT;
ALTER TABLE resources ADD COLUMN secret_salt TEXT;
ALTER TABLE resources ADD COLUMN secret_kdf_iterations INTEGER;
