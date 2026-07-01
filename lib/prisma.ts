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

const dbUrl =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRESQL_URL;

if (dbUrl && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = dbUrl;
}

const prismaOptions = dbUrl
  ? {
      datasources: {
        db: {
          url: dbUrl,
        },
      },
    }
  : undefined;

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export function getPrisma() {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  if (!dbUrl) {
    const message =
      'Missing DATABASE_URL. Set DATABASE_URL in .env.local, .env.production, or the runtime environment. ' +
      'If you use Supabase, set DATABASE_URL to the Supabase Postgres connection string (not the HTTP SUPABASE_URL). ' +
      'Supported fallback names: SUPABASE_DB_URL, POSTGRES_URL, POSTGRESQL_URL.';

    throw new Error(message);
  }

  globalForPrisma.prisma = new PrismaClient(prismaOptions);
  return globalForPrisma.prisma;
}
