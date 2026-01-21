import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), tanstackRouter({}), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3001,
  },
  optimizeDeps: {
    include: [
      "@Sales_ai_automation_v3/shared",
      "@Sales_ai_automation_v3/shared/product-configs",
    ],
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/, /packages/],
    },
  },
});
