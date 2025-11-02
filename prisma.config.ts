import "dotenv/config";
import { defineConfig } from "@prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  // Opcional: fija el datasource si quieres forzar la URL desde env
  // datasources: { db: { url: process.env.DATABASE_URL! } },
});
