import { mediaUrl } from '../lib/media.js'
import { iso, num, type Row } from '../lib/rows.js'

/** Your own profile: everything, including what only you may see. */
export const publicMe = (u: Row) => ({
  id: u['id'],
  displayName: u['display_name'],
  email: u['email'],
  phone: u['phone'],
  town: u['town'],
  postalCode: u['postal_code'],
  interests: u['interests'] ?? [],
  bankidVerified: Boolean(u['bankid_verified_at']),
  ratingAvg: num(u['rating_avg']),
  ratingCount: num(u['rating_count']) ?? 0,
  memberSince: iso(u['created_at']),
  // Looking around on a device, with no profile yet. An account always has an
  // e-mail — 10c demands one — so there is nothing else to store for this.
  anonymous: u['email'] === null,
})

/** Somebody else: no e-mail, and the phone only where a trade needs it. */
export const publicUser = (u: Row) => ({
  id: u['id'],
  displayName: u['display_name'] ?? 'Slettet bruker',
  town: u['town'],
  bankidVerified: Boolean(u['bankid_verified_at']),
  ratingAvg: num(u['rating_avg']),
  ratingCount: num(u['rating_count']) ?? 0,
  memberSince: iso(u['created_at']),
  itemCount: num(u['item_count']),
  tradeCount: num(u['trade_count']),
})

export const publicItem = (i: Row) => ({
  id: i['id'],
  ownerId: i['owner_id'],
  kind: i['kind'],
  title: i['title'],
  description: i['description'],
  category: i['category'],
  subcategory: i['subcategory'],
  condition: i['condition'],
  estimatedValueNok: num(i['estimated_value_nok']),
  town: i['town'],
  status: i['status'],
  reserved: Boolean(i['active_trade_id']),
  cover: mediaUrl(i['cover']),
  media: (i['media'] as string[] | undefined)?.map(mediaUrl),
  likedByMe: i['liked_by_me'] === undefined ? undefined : Boolean(i['liked_by_me']),
  likeCount: num(i['like_count']) ?? undefined,
  createdAt: iso(i['created_at']),
})

export const publicMessage = (m: Row) => ({
  id: m['id'],
  senderId: m['sender_id'],
  senderName: m['sender_name'] ?? null,
  body: m['body'],
  createdAt: iso(m['created_at']),
  mine: m['mine'] === undefined ? undefined : Boolean(m['mine']),
})

/**
 * A listing on the open web: the fields a link needs to look like something in a
 * chat, and not one more. No owner id, no like count, no reservation state —
 * whoever holds the link was given it, and that is not the same as being let
 * into the app.
 */
export const sharedItem = (i: Row) => ({
  title: i['title'],
  description: i['description'],
  kind: i['kind'],
  category: i['category'],
  subcategory: i['subcategory'],
  condition: i['condition'],
  estimatedValueNok: num(i['estimated_value_nok']),
  town: i['town'],
  media: ((i['media'] ?? []) as string[]).map(mediaUrl),
  ownerName: i['owner_name'] ?? null,
})
