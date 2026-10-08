import {
    pgTable,
    text,
    json,
    timestamp,
    uuid,
    primaryKey,
    integer,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// user table (public.user)
export const user = pgTable('user', {
    id: text('id').primaryKey(), // TEXT PRIMARY KEY
    createdAt: timestamp('created_at', { withTimezone: true })
        .notNull()
        .default(sql`now()`),
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

    createdAt: timestamp('created_at', { withTimezone: true })
        .notNull()
        .default(sql`now()`),

    updatedAt: timestamp('updated_at', { withTimezone: true })
        .notNull()
        .default(sql`now()`),
});

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
});