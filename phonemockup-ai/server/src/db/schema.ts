import {
    pgTable,
    text,
    json,
    timestamp,
    uuid,
    primaryKey,
    integer,
    index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// user table (public.user)
export const user = pgTable('user', {
    id: text('id').primaryKey(), // TEXT PRIMARY KEY
    createdAt: timestamp('created_at', { withTimezone: true })
        .notNull()
        .default(sql`now()`),
});

// Provider IDs remain separate from the stable IDs used by project.owner.
export const authIdentity = pgTable('auth_identity', {
    clerkId: text('clerk_id').primaryKey(),
    userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
});

// project table (public.project)
export const project = pgTable('project', {
    id: uuid('id')
        .primaryKey()
        .default(sql`gen_random_uuid()`),

    owner: text('owner')
        .notNull()
        // foreign key -> user.id ON DELETE CASCADE
        .references(() => user.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    fileUrl: text('file_url'),
    fileName: text('file_name'),
    projectJson: json('project_json'),

    // Milliseconds, as a JS Date holds them: the list's cursor goes through a
    // Date, and at microseconds rows later in the same millisecond were
    // skipped. See migrations/20261021_project_list.sql.
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 })
        .notNull()
        .default(sql`now()`),

    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 })
        .notNull()
        .default(sql`now()`),
}, (table) => [
    // A user's projects, newest first: the list and its cursor.
    index('project_owner_created_idx').on(table.owner, table.createdAt.desc(), table.id.desc()),
]);

export const file = pgTable('file', {
    // Primary key
    id: uuid('id')
        .primaryKey()
        .default(sql`gen_random_uuid()`),

    // FK to project (each project can have many files)
    projectId: uuid('project_id')
        .notNull()
        .references(() => project.id, { onDelete: 'cascade' }),

    // Basic file info
    fileType: text('file_type').notNull(), // e.g. 'image/png', 'application/pdf'
    url: text('url').notNull(), // storage location or signed/object URL
    fileName: text('file_name'), // optional original name
    sizeBytes: integer('size_bytes').notNull(),

    // Optional metadata
    checksum: text('checksum'), // e.g., sha256 for integrity/dedupe
    storageProvider: text('storage_provider'), // 's3', 'cloudflare_r2', 'gcs', 'local', etc.
}, (table) => [
    // A project's files, and the cascade when a project goes.
    index('file_project_idx').on(table.projectId),
]);
