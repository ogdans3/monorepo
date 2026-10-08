import 'dotenv/config';
import {drizzle} from 'drizzle-orm/neon-http';
import {neon} from '@neondatabase/serverless';
import * as schema from './schema';

const neonSql = neon(process.env.DATABASE_URL!);
export const db = drizzle({client: neonSql, schema});
export * as tables from './schema';