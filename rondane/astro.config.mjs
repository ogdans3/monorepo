import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

// Kanonisk adresse. Forhåndsvisningen ligger på rondane.freelunch.no, men
// alle canonical-lenker, sitemap og strukturert data skal peke på det
// domenet hotellet eier. Sett PUBLIC_SITE for å overstyre.
const site = process.env.PUBLIC_SITE ?? 'https://rondane.no';

export default defineConfig({
  site,
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  compressHTML: true,
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.includes('/404'),
      changefreq: 'monthly',
      priority: 0.6,
      serialize(item) {
        if (item.url === `${site}/`) item.priority = 1.0;
        else if (item.url.split('/').filter(Boolean).length <= 3) item.priority = 0.8;
        return item;
      },
    }),
  ],
  image: {
    // Bildene er hotellets egne og ligger i src/assets; ingen eksterne domener.
    domains: [],
  },
});
