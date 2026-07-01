import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

const envFiles = ['.env.local', '.env.production', '.env'];
for (const file of envFiles) {
  const envPath = resolve(process.cwd(), file);
  if (existsSync(envPath)) {
    loadEnv({ path: envPath });
  }
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error(
    'Missing DATABASE_URL. Set DATABASE_URL in .env.local, .env.production, or the runtime environment. In production, DATABASE_URL must point to your production Postgres instance (for Supabase, use the Supabase Postgres connection string), not localhost unless the DB is local.'
  );
}

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
