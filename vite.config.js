import { defineConfig } from "vite";

// Relative asset paths, so the same build works at a site's root (Netlify)
// and from a sub-folder (itch.io serves HTML5 games from one)
export default defineConfig({
    base: "./",
});
