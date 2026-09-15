// Hovedmenyen. Rekkefølgen er den samme som på gamle rondane.no, fordi
// gjestene kjenner den. Undersidene hentes fra innholdet, ikke herfra.
export const meny = [
  { tittel: 'Overnatting', sti: '/overnatting/', seksjon: 'overnatting' },
  { tittel: 'Kurs og konferanse', sti: '/kurs-og-konferanse/', seksjon: 'kurs-og-konferanse' },
  { tittel: 'Selskap', sti: '/selskap/', seksjon: 'selskap' },
  { tittel: 'Tur og aktiviteter', sti: '/tur-og-aktiviteter/', seksjon: 'tur-og-aktiviteter' },
  { tittel: 'Svømmebasseng', sti: '/basseng/', seksjon: 'basseng' },
  { tittel: 'Om hotellet', sti: '/om-hotellet/', seksjon: 'om-hotellet' },
  { tittel: 'Bilder', sti: '/bilder/', seksjon: 'bilder' },
  { tittel: 'Guide', sti: '/guide/', seksjon: 'guide' },
  { tittel: 'Blogg', sti: '/blogg/', seksjon: 'blogg' },
] as const;

// De som får plass i toppen på brede skjermer. Resten ligger i menyen.
export const toppmeny = ['overnatting', 'kurs-og-konferanse', 'selskap', 'tur-og-aktiviteter', 'om-hotellet'];
