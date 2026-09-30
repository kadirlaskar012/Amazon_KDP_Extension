import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  manifest: {
    name: 'KDP Niche Finder',
    description: 'Personal Amazon KDP niche, keyword, and category research tool',
    version: '1.0.0',
    permissions: ['storage', 'alarms', 'activeTab', 'offscreen'],
    host_permissions: [
      'https://www.amazon.com/*',
      'https://completion.amazon.com/*',
      'https://api.anthropic.com/*',
    ],
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
  },
});
