import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
      // `server-only` lanza fuera de Next; en tests unitarios lo neutralizamos.
      "server-only": path.resolve(import.meta.dirname, "tests/empty.ts"),
    },
  },
  test: { environment: "node", include: ["**/*.test.ts"], exclude: ["node_modules", ".next"] },
});
