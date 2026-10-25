import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { createLocalDemoClient, localDemoEnabled } from "./local-demo";

// Next.js в dev-режиме перезагружает модули при каждом изменении файла —
// без этого трюка плодились бы новые подключения к базе при каждом хот-релоаде.
function createClient() {
  if (localDemoEnabled()) return createLocalDemoClient();
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}
const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
