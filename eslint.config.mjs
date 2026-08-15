import { defineConfig } from "eslint/config";
import next from "eslint-config-next";
export default defineConfig([
  {
    ignores: [".claude/**", ".next/**", "node_modules/**", "public/uploads/**"],
  },
  {
    extends: [...next],
  },
]);
