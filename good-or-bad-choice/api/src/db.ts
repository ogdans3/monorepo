import postgres from 'postgres';

export type Sql = postgres.Sql<Record<string, never>>;

export function createDb(url: string): Sql {
  return postgres(url, {
    max: 10,
    // The product's only clock is the moment of the tap, and it is compared
    // across devices in different places. Everything is UTC on the wire and
    // turned into local time by the client that draws it.
    types: {},
    onnotice: () => {},
  });
}
