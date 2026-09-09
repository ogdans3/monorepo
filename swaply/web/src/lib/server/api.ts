import { env } from '$env/dynamic/private'

/**
 * Where this server talks to the API.
 *
 * Read at runtime, not compiled in: the web image is a Node server, so unlike the
 * Flutter bundle it can be pointed somewhere else by restarting it. Inside
 * Compose that is the api service by name; on a developer's machine it is the
 * port `pnpm dev` prints.
 */
export const apiOrigin = env.API_ORIGIN || 'http://localhost:3001'

/** What the public page behind a link is allowed to know. */
export type SharedItem = {
  title: string
  description: string | null
  kind: 'item' | 'service'
  category: string
  subcategory: string | null
  condition: 'new' | 'good' | 'worn' | null
  estimatedValueNok: number | null
  town: string | null
  media: string[]
  ownerName: string | null
}

export type Invite = {
  token: string
  url: string
  used: boolean
  inviter: { displayName: string; town: string | null } | null
  item: SharedItem | null
  shareText: string
}
