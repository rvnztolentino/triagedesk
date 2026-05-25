import { defineConfig } from "eslint/config";
import next from "eslint-config-next";
export default defineConfig([
  {
    ignores: [".codex/**", ".next/**", "node_modules/**", "public/uploads/**"],
  },
  {
    extends: [...next],
  },
]);
