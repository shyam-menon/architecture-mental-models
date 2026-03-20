import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/architecture-mental-models/",
  plugins: [react()],
});
