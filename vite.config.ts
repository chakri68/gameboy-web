import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { htmlInject } from "./src/vite/htmlInject";

export default defineConfig({
  plugins: [tailwindcss(), htmlInject()],
});
