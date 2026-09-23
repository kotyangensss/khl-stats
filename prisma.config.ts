import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Этот файл читает только сам Prisma CLI (generate, db push, migrate).
// Рантайм-подключение самого сайта настраивается отдельно в lib/db.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DIRECT_URL"),
  },
});
