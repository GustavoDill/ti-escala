-- =============================================================================
-- ti-escala: Supabase Authentication Schema (public.escala_auth)
-- =============================================================================
-- Purpose:
--   Stores SHA-512 hashed passwords for the two privileged roles:
--     1. 'administrator' (Boss / Escala Manager)
--     2. 'system'        (Developer / System Maintainer)
--   Both roles grant access to Edit Mode and schedule mutation endpoints.
--
-- Password Recovery / Manual Reset by DB Admin:
--   In the event of a lost password, open the Supabase SQL Editor and run:
--
--   UPDATE public.escala_auth
--   SET password_hash = encode(digest('NEW_PLAIN_PASSWORD', 'sha512'), 'hex'),
--       updated_at = NOW()
--   WHERE role = 'administrator';
--
--   (Or compute the 128-character hex SHA-512 hash externally and paste it into
--   the `password_hash` column in the Supabase Table Editor.)
-- =============================================================================

-- 1. Enable pgcrypto extension for native SHA-512 hashing in PostgreSQL
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create authentication table in the "public" schema
CREATE TABLE IF NOT EXISTS public.escala_auth (
    role TEXT PRIMARY KEY CHECK (role IN ('administrator', 'system')),
    password_hash TEXT NOT NULL CHECK (char_length(password_hash) = 128),
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS)
--    The backend uses SUPABASE_SERVICE_ROLE_KEY (which bypasses RLS) or reads via
--    controlled policy if using an anon key.
ALTER TABLE public.escala_auth ENABLE ROW LEVEL SECURITY;

-- Optional policy if the server connects with a non-service-role key:
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'escala_auth'
          AND policyname = 'Allow read access for auth verification'
    ) THEN
        CREATE POLICY "Allow read access for auth verification"
            ON public.escala_auth
            FOR SELECT
            USING (true);
    END IF;
END
$$;

-- 4. Seed initial passwords for 'administrator' and 'system' (SHA-512 hex digests)
--    Generated initial credentials:
--      - administrator : r!AGV7BY$*!Ab92j
--      - system        : JbZZ&3j5t5FeveGo
--    (You can also run `npm run hash-password` to generate new ones or use
--     `encode(digest('YOUR_PASSWORD', 'sha512'), 'hex')` directly in SQL.)
INSERT INTO public.escala_auth (role, password_hash, description)
VALUES
    (
        'administrator',
        '33dfeebe3dd55ad269152a6f9338c6a18ec330b09076f0f3e480e338d2e9f1184b6b3bb7d543604382df87725849329e0bb89a9e2f716516a7c53495a07ebad8',
        'Administrator role for Boss / Escala Manager (full Edit Mode access)'
    ),
    (
        'system',
        '953bcbc329fe32aecc274cbf13f6ed45334978641180c4ccb47098852239009d10a3077434b2d9b56c0b0a4ad65c8743649cb80e1f8ee2616e149a57ad0a03f1',
        'System role for Developer / Maintainer (full Edit Mode access)'
    )
ON CONFLICT (role) DO UPDATE
SET
    password_hash = EXCLUDED.password_hash,
    description = EXCLUDED.description,
    updated_at = NOW();
