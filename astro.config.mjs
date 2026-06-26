import { defineConfig } from 'astro/config';
import rehypeTagColors from './src/lib/rehype-tag-colors.mjs';

export default defineConfig({
  site: 'https://www.aidailyinsights.cn',
  markdown: {
    rehypePlugins: [rehypeTagColors],
  },
});
