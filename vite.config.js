import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const site = (env.VITE_SITE_URL || '').replace(/\/$/, '').replace(/[&<>\"]/g, '');
  return { plugins: [react(), { name: 'portfolio-seo', transformIndexHtml(html) {
    return site ? html.replace('<!-- canonical -->', `<link rel="canonical" href="${site}/"><meta property="og:url" content="${site}/"><meta property="og:image" content="${site}/social.svg">`) : html;
  }}] };
});