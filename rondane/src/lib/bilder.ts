import type { ImageMetadata } from 'astro';

// Alle bildene under src/assets/bilder, slått opp på stien slik den står i
// frontmatter (f.eks. "box/enkeltrom-box-ny.jpg"). Eager, fordi Astro må
// kjenne bildene på byggetidspunktet for å kunne lage webp/avif av dem.
const alle = import.meta.glob<{ default: ImageMetadata }>('/src/assets/bilder/**/*.{jpg,jpeg,png,gif,JPG}', { eager: true });

export function bilde(sti: string | null | undefined): ImageMetadata | undefined {
  if (!sti) return undefined;
  const ren = sti.replace(/^(\.\.\/)+assets\/bilder\//, '').replace(/^\/?src\/assets\/bilder\//, '');
  return alle['/src/assets/bilder/' + ren]?.default;
}
