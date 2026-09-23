import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

// Next.js в dev-режиме перезагружает модули при каждом изменении файла —
// без этого трюка плодились бы новые подключения к базе при каждом хот-релоаде.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
