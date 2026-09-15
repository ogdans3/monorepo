import { hotell } from '../data/hotell';

/** Meta description av markdown-tekst: første setningene, uten markdown, maks ~155 tegn. */
export function beskrivelseAv(body: string | undefined, fallback = ''): string {
  if (!body) return fallback;
  let t = body
    .replace(/<Sidefelt>[\s\S]*?<\/Sidefelt>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_>|`]/g, ' ')
    .replace(/&[a-z#0-9]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return fallback;
  if (t.length <= 158) return t;
  const kutt = t.slice(0, 158);
  const siste = Math.max(kutt.lastIndexOf('. '), kutt.lastIndexOf(', '), kutt.lastIndexOf(' '));
  return kutt.slice(0, siste > 80 ? siste : 158).replace(/[,.\s]+$/, '') + '…';
}

export function orgJsonLd(site: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Hotel',
    '@id': `${site}/#hotell`,
    name: hotell.navn,
    url: `${site}/`,
    telephone: hotell.telefon,
    email: hotell.epost,
    image: `${site}/bilder/delebilde.jpg`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: hotell.adresse.gate,
      addressLocality: hotell.adresse.poststed,
      postalCode: hotell.adresse.postnr,
      addressRegion: 'Innlandet',
      addressCountry: hotell.adresse.land,
    },
    geo: { '@type': 'GeoCoordinates', latitude: hotell.koordinater.lat, longitude: hotell.koordinater.lng },
    checkinTime: hotell.innsjekk,
    checkoutTime: hotell.utsjekk,
    amenityFeature: [
      { '@type': 'LocationFeatureSpecification', name: 'Svømmebasseng', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Badstue', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Restaurant', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Elbillading', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Gratis wifi', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Konferanserom', value: true },
    ],
    sameAs: [hotell.facebook, hotell.instagram, hotell.tripadvisor],
  };
}

export function brodsmulerJsonLd(site: string, smuler: { navn: string; sti: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: smuler.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: s.navn,
      item: `${site}${s.sti}`,
    })),
  };
}
