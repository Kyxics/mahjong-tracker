import { defineConfig } from 'vite';

// Relative base so the same build works at a domain root (Cloudflare Pages)
// or under a subpath (GitHub Pages project sites).
export default defineConfig({ base: './' });
