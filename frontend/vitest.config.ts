import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    // Plugin React standard — on n'active PAS le React Compiler ici car
    // babel-plugin-react-compiler est un plugin Babel de production (Next.js)
    // et ne doit pas interférer avec l'environnement de test Vitest/jsdom.
    react(),
  ],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      // Correspond au paths "@/*": ["./src/*"] du tsconfig.json
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
