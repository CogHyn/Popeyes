import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  vite: () => ({
    envDir: '..',
  }),
  manifest: {
    permissions: ['contextMenus', 'storage'],
    host_permissions: ['https://api.groq.com/*', 'https://api.tavily.com/*'],
  },
});
