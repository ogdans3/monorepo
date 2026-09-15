import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Én side på nettstedet. Feltene speiler det som fantes på gamle rondane.no:
// tittel + undertittel (prisen eller ingressen som sto i bildet), et
// hero-bilde, eventuelle underside-kort og et galleri.
const sider = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/sider' }),
  schema: ({ image }) =>
    z.object({
      tittel: z.string(),
      undertittel: z.string().optional(),
      ingress: z.string().optional(),
      beskrivelse: z.string().optional(), // meta description; utledes fra teksten om den mangler
      seksjon: z.enum([
        'overnatting', 'kurs-og-konferanse', 'selskap', 'tur-og-aktiviteter',
        'basseng', 'om-hotellet', 'guide', 'bilder',
      ]),
      sti: z.string(),
      forelder: z.string().optional(),
      rekkefolge: z.number().default(99),
      hero: image().optional(),
      heroAlt: z.string().optional(),
      barn: z
        .array(
          z.object({
            sti: z.string(),
            tittel: z.string(),
            under: z.string().nullable().optional(),
            bilde: z.string().nullable().optional(),
          }),
        )
        .default([]),
      galleri: z.array(image()).default([]),
      gammelSti: z.string().optional(),
      skjul: z.boolean().default(false),
    }),
});

const blogg = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/blogg' }),
  schema: ({ image }) =>
    z.object({
      tittel: z.string(),
      dato: z.coerce.date().optional(),
      forfatter: z.string().optional(),
      hero: image().optional(),
      beskrivelse: z.string().optional(),
      gammelSti: z.string().optional(),
      sti: z.string(),
    }),
});

export const collections = { sider, blogg };
