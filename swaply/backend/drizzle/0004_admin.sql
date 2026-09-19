-- Hand-finished below the generated statements, the way 0000 carries the
-- pg_trgm line: drizzle-kit emits neither triggers nor self-referencing
-- foreign keys, and the trigger is the whole point of this migration.
CREATE TABLE "admin_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"acting_as" uuid,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "issued_by" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "test_account_of" uuid;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_acting_as_users_id_fk" FOREIGN KEY ("acting_as") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_actions_admin" ON "admin_actions" USING btree ("admin_id","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_test_accounts" ON "users" USING btree ("test_account_of") WHERE test_account_of is not null;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "admin_is_not_a_test_account" CHECK (not ("users"."is_admin" and "users"."test_account_of" is not null));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_test_account_of_users_id_fk" FOREIGN KEY ("test_account_of") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- The key is cut outside the building.
--
-- `is_admin` may only ever go false -> true, and `test_account_of` may only
-- ever be adopted by an existing row, inside a transaction that has set
-- `swaply.admin_grant`. The only thing in the repository that sets that GUC is
-- backend/src/db/admin.ts, the CLI. No route, plugin or job sets it, so a
-- careless `update users set ...` in a route written a year from now — or an
-- injection into one — still cannot make anybody an admin.
--
-- The asymmetry is deliberate and is the sentence to keep if this is ever
-- simplified: an account may be BORN a test account, because POST
-- /admin/accounts inserts it that way, but no request may ADOPT one that
-- already exists. Otherwise the tool could quietly take ownership of a real
-- person's account and then act as them.
--
-- Taking the key away is never guarded: revoking admin, or releasing a test
-- account, must not need a ceremony.
CREATE FUNCTION users_admin_guard() RETURNS trigger LANGUAGE plpgsql AS $$
begin
  if current_setting('swaply.admin_grant', true) = 'on' then
    return new;
  end if;

  if new.is_admin and (tg_op = 'INSERT' or not old.is_admin) then
    raise exception 'is_admin is set by the admin CLI only (see backend/src/db/admin.ts)'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'UPDATE' and new.test_account_of is not null and old.test_account_of is null then
    raise exception 'test_account_of is set when the row is created, never adopted'
      using errcode = 'check_violation';
  end if;

  return new;
end
$$;--> statement-breakpoint
CREATE TRIGGER users_admin_guard BEFORE INSERT OR UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION users_admin_guard();
