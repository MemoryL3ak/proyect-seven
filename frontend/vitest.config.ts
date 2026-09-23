import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Mismo alias "@/…" que usa Next (tsconfig paths), para que las pruebas
// puedan importar módulos que a su vez importan "@/lib/api" y similares.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { environment: "node", include: ["**/*.test.ts", "**/*.test.tsx"], exclude: ["node_modules", ".next"] },
});
