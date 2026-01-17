-- Allow duplicate usernames across families, enforce uniqueness per family (case-insensitive).
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_username_key;

CREATE UNIQUE INDEX IF NOT EXISTS users_family_username_key
    ON public.users (family_id, lower(trim(username)));
