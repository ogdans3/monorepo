// Things for a test account to own, so that making one costs a tap rather than
// three minutes of typing into 10b.
//
// Norwegian, ordinary, and deliberately uneven: a couple of them have no
// estimated value and one is a service, because a listing without a number and
// a listing that can never be reserved are both states the screens draw and
// the easiest ones to forget to test.
export type Fixture = {
  title: string
  category: string
  subcategory?: string
  kind?: 'item' | 'service'
  condition?: 'new' | 'good' | 'worn'
  valueNok?: number
  description?: string
}

export const CATALOGUE: Fixture[] = [
  { title: 'Bosch drill 18V', category: 'verktoy', subcategory: 'Elektroverktøy', condition: 'good', valueNok: 600, description: 'Lite brukt, lader og koffert følger med.' },
  { title: 'Terrengsykkel 26"', category: 'sykling', subcategory: 'Sykler', condition: 'good', valueNok: 2500, description: 'Brukt på turer i skogen.' },
  { title: 'Retro spillkonsoll', category: 'gaming', condition: 'good', valueNok: 1200, description: 'To kontrollere og ni spill.' },
  { title: 'Fiskestang med snelle', category: 'friluft', subcategory: 'Fiske', condition: 'good', valueNok: 850 },
  { title: 'Kajakk med åre', category: 'bat', condition: 'worn', valueNok: 2400 },
  { title: 'Ullgenser M', category: 'klaer', condition: 'good', valueNok: 300 },
  { title: 'Skateboard', category: 'sport', condition: 'worn', valueNok: 450 },
  { title: 'Barnesykkel 20"', category: 'barn', condition: 'good', valueNok: 600 },
  { title: 'Kaffekvern', category: 'hjem', condition: 'new', valueNok: 900 },
  // No number on it at all: «Helt billige ting kan være gratis», and the card
  // has to draw without a «Verdi …» line.
  { title: 'Eske med LEGO', category: 'barn', condition: 'worn' },
  { title: 'Klassisk gitar', category: 'musikk', condition: 'good', valueNok: 1400 },
  { title: 'Snømåking en vinter', category: 'hjem', kind: 'service', valueNok: 1500, description: 'Jeg måker innkjørselen din hele vinteren.' },
]

/**
 * Names and towns for test accounts: a first name and the initial T., for
 * test. The first name is what the screens call somebody — «Som motparten»
 * draws «Kari godtar» — so each is a different one. They used to be
 * «Testbruker Én», «Testbruker To», …, which every screen shortened to
 * «Testbruker», and a three-way trade read «Testbruker godtar» twice.
 *
 * More of them than the twenty accounts a ring may hold, so a new account
 * can always be given a first name nobody in the ring has (`createTestAccount`).
 * The badge, not the name, is what says it is a test account.
 */
export const PEOPLE = [
  { name: 'Kari T.', town: 'Trondheim' },
  { name: 'Ola T.', town: 'Bergen' },
  { name: 'Ingrid T.', town: 'Stavanger' },
  { name: 'Lars T.', town: 'Tromsø' },
  { name: 'Sigrid T.', town: 'Kristiansand' },
  { name: 'Henrik T.', town: 'Ålesund' },
  { name: 'Astrid T.', town: 'Bodø' },
  { name: 'Magnus T.', town: 'Drammen' },
  { name: 'Solveig T.', town: 'Fredrikstad' },
  { name: 'Jonas T.', town: 'Lillehammer' },
  { name: 'Marit T.', town: 'Molde' },
  { name: 'Eirik T.', town: 'Hamar' },
  { name: 'Tuva T.', town: 'Trondheim' },
  { name: 'Sindre T.', town: 'Bergen' },
  { name: 'Hedda T.', town: 'Stavanger' },
  { name: 'Aksel T.', town: 'Tromsø' },
  { name: 'Nora T.', town: 'Kristiansand' },
  { name: 'Vegard T.', town: 'Ålesund' },
  { name: 'Synnøve T.', town: 'Bodø' },
  { name: 'Håkon T.', town: 'Drammen' },
  { name: 'Live T.', town: 'Fredrikstad' },
  { name: 'Even T.', town: 'Lillehammer' },
]

export const INTERESTS = ['verktoy', 'gaming', 'sykling'] as const
