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
const prismaOptions = dbUrl
  ? {
      datasources: {
        db: {
          url: dbUrl,
        },
      },
    }
  : undefined;

if (!dbUrl && process.env.NODE_ENV === 'development') {
  console.warn(
    'DATABASE_URL was not set during build/development. Prisma will attempt to use the runtime DATABASE_URL when the server starts.'
  );
}

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient(prismaOptions);

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
