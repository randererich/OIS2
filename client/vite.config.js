import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      "/api": {
        target: process.env.API_TARGET || "http://server:3000",
        changeOrigin: true
      }
    },
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      "ois2.tartu.vironia.ee"
    ]
  }
});
