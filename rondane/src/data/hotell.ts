// Fakta om hotellet, samlet ett sted. Brukes i bunnen, i strukturert data
// og i kontaktlenker. Endres her, endres overalt.
export const hotell = {
  navn: 'Rondane Høyfjellshotell',
  kortnavn: 'Rondane',
  slagord: 'Porten til Rondane nasjonalpark',
  adresse: { gate: 'Rondanevegen 1264', sted: 'Mysuseter', postnr: '2674', poststed: 'Otta', land: 'NO' },
  postboks: 'PB 74, 2675 Otta',
  koordinater: { lat: 61.808694, lng: 9.673444 },
  telefon: '+47 61 20 90 90',
  telefonVis: '61 20 90 90',
  epost: 'booking@rondane.no',
  orgnr: 'NO 997 155 246 MVA',
  booking: 'https://booking.rondane.no/',
  pakker: 'https://booking.rondane.no/no/package/list',
  facebook: 'https://www.facebook.com/rondanehotel/',
  instagram: 'https://www.instagram.com/rondanehotel/',
  tripadvisor:
    'https://no.tripadvisor.com/Hotel_Review-g968371-d948263-Reviews-Rondane_Hoyfjellshotell-Mysuseter_Sel_Municipality_Oppland_Eastern_Norway.html',
  innsjekk: '16:00',
  utsjekk: '11:00',
  // Varselfeltet øverst på alle sider. Tom tekst = ingen varsel.
  varsel: '',
};
