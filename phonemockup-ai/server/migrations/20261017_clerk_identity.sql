-- Apply before deploying the Clerk API. Existing users and owners stay intact.
BEGIN;
CREATE TABLE IF NOT EXISTS public.auth_identity (
    clerk_id text PRIMARY KEY,
    user_id text NOT NULL,
    CONSTRAINT auth_identity_user_id_unique UNIQUE (user_id),
    CONSTRAINT auth_identity_user_id_user_id_fk
        FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE
);
COMMIT;
