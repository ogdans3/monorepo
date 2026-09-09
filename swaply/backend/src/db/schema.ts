import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSchema,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

// Postgres has no first-class tsvector in drizzle. The column is generated and
// never written to by hand, so a thin custom type is all it needs.
const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' })

export const tradeState = pgEnum('trade_state', [
  'talking',
  'pending',
  'countered',
  'accepted',
  'completed',
  'cancelled',
])

export const itemStatus = pgEnum('item_status', ['available', 'reserved', 'traded', 'withdrawn'])

export const listingKind = pgEnum('listing_kind', ['item', 'service'])

export const category = pgEnum('category', [
  'verktoy',
  'gaming',
  'sykkel',
  'klaer',
  'sport',
  'bat_og_fritid',
  'mobler',
  'elektronikk',
  'barn',
  'hage',
  'musikk',
  'bil_og_mc',
])

export const condition = pgEnum('condition', ['new', 'good', 'worn'])

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

// No national identity number, ever. BankID gives us a pseudonymous subject and
// that is all we keep: police can resolve it with the provider, and we never
// hold the person. Norwegian law only allows storing a fødselsnummer where there
// is an objective need for certain identification, and a barter app has none.
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Anonymous-first: a device is an identity until a trade needs a stable one.
    // A device id is personal data in its own right.
    deviceId: text('device_id').unique(),
    displayName: text('display_name'),
    email: text('email').unique(),
    phone: text('phone').unique(),
    // Coarse on purpose. Town and county are enough to meet up, and a street
    // address would be more than the product needs.
    town: text('town'),
    county: text('county'),
    interests: category('interests').array().notNull().default(sql`'{}'`),
    bankidSubject: text('bankid_subject').unique(),
    bankidVerifiedAt: timestamp('bankid_verified_at', { withTimezone: true }),
    ratingAvg: numeric('rating_avg', { precision: 3, scale: 2 }),
    ratingCount: integer('rating_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // Erasure is anonymisation, not DELETE: the counterparty keeps their own
    // trade history. The row lives on as a tombstone with nothing personal in it.
    anonymisedAt: timestamp('anonymised_at', { withTimezone: true }),
  },
  (t) => [
    check(
      'interests_bounds',
      sql`cardinality(${t.interests}) = 0 or cardinality(${t.interests}) between 3 and 5`,
    ),
  ],
)

// Push tokens are personal data with their own lifetime, and they go stale on
// their own. Kept apart from the user so deleting them is a delete.
export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  platform: text('platform').notNull(),
  pushToken: text('push_token').notNull().unique(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
})

export const invites = pgTable('invites', {
  // Only the hash. A raw invite token is never stored, the same way a password
  // is not.
  tokenHash: text('token_hash').primaryKey(),
  inviterId: uuid('inviter_id').references(() => users.id),
  // Set when the link came from sharing an item, which is what makes the share
  // button a growth channel rather than a wall.
  itemId: uuid('item_id'),
  usedBy: uuid('used_by').references(() => users.id),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// Trades
//
// Declared before items because an item points at the trade holding it.
// ---------------------------------------------------------------------------

// A trade is a negotiation, not a proposal that gets a yes or a no. It starts as
// `talking` the moment someone writes the first message, long before there is an
// offer on the table.
export const trades = pgTable('trades', {
  id: uuid('id').primaryKey().defaultRandom(),
  state: tradeState('state').notNull().default('talking'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  // Says why in words, because "the drill was reserved by another trade" is a
  // screen, not a silent disappearance.
  closeReason: text('close_reason'),
})

export const tradeParticipants = pgTable(
  'trade_participants',
  {
    tradeId: uuid('trade_id')
      .notNull()
      .references(() => trades.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    // The order around the cycle: 0 gives to 1, 1 gives to 2, 2 gives back to 0.
    position: smallint('position').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.tradeId, t.userId] }),
    unique('trade_participant_position').on(t.tradeId, t.position),
    index('trade_participants_user').on(t.userId),
  ],
)

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

export const items = pgTable(
  'items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    kind: listingKind('kind').notNull().default('item'),
    title: text('title').notNull(),
    description: text('description'),
    category: category('category').notNull(),
    // Meaningless for a service: "worn" says nothing about shovelling snow.
    condition: condition('condition'),
    estimatedValueNok: integer('estimated_value_nok'),
    town: text('town'),
    county: text('county'),
    status: itemStatus('status').notNull().default('available'),
    // The reservation, and the whole of "one item, one trade". Null means free.
    // Set when the item's own owner accepts an offer containing it — never
    // earlier, or anyone could freeze your things by opening a conversation.
    activeTradeId: uuid('active_trade_id').references(() => trades.id, { onDelete: 'set null' }),
    search: tsvector('search').generatedAlwaysAs(
      sql`setweight(to_tsvector('norwegian', coalesce(title, '')), 'A') || setweight(to_tsvector('norwegian', coalesce(description, '')), 'B')`,
    ),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('condition_for_items', sql`${t.kind} = 'service' or ${t.condition} is not null`),
    // A service is not exclusive. One person can paint three living rooms, so it
    // never holds a reservation the way a drill does.
    check('exclusive_only_for_items', sql`${t.kind} = 'item' or ${t.activeTradeId} is null`),
    // The status filter is the hot predicate in every cycle search, so the index
    // carries it rather than the query.
    index('items_owner_available')
      .on(t.ownerId)
      .where(sql`status = 'available'`),
    index('items_search').using('gin', t.search),
    index('items_title_trgm').using('gin', sql`${t.title} gin_trgm_ops`),
  ],
)

// Optional, and deliberately so: a listing with no photo is allowed, and a
// service usually has none. Discovery draws a generated card in that case.
export const itemMedia = pgTable(
  'item_media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    position: integer('position').notNull(),
  },
  (t) => [unique('item_media_position').on(t.itemId, t.position)],
)

// The directed edge, and nothing else. Whether a like should also name what you
// would give is still open; the answer changes the shape of the cycle search.
export const likes = pgTable(
  'likes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fromUser: uuid('from_user')
      .notNull()
      .references(() => users.id),
    targetItem: uuid('target_item')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('like_once').on(t.fromUser, t.targetItem),
    index('likes_target').on(t.targetItem),
    index('likes_from').on(t.fromUser),
  ],
)

// ---------------------------------------------------------------------------
// Offers: the versions of a negotiation
// ---------------------------------------------------------------------------

// One row per version, never updated. A counter-offer writes a new one, and the
// current offer is simply the highest seq — no denormalised pointer to go stale.
export const tradeOffers = pgTable(
  'trade_offers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tradeId: uuid('trade_id')
      .notNull()
      .references(() => trades.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    proposedBy: uuid('proposed_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('offer_seq').on(t.tradeId, t.seq)],
)

export const tradeOfferItems = pgTable(
  'trade_offer_items',
  {
    offerId: uuid('offer_id')
      .notNull()
      .references(() => tradeOffers.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id),
    giverPosition: smallint('giver_position').notNull(),
  },
  // An offer may be half filled — "I want this" names one side and nothing back.
  (t) => [primaryKey({ columns: [t.offerId, t.itemId] })],
)

// The cash difference. We write it down and never settle it: Swaply is not a
// party to the trade and moves no money.
export const tradeOfferCash = pgTable(
  'trade_offer_cash',
  {
    offerId: uuid('offer_id')
      .notNull()
      .references(() => tradeOffers.id, { onDelete: 'cascade' }),
    payerPosition: smallint('payer_position').notNull(),
    payeePosition: smallint('payee_position').notNull(),
    amountNok: integer('amount_nok').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.offerId, t.payerPosition, t.payeePosition] }),
    check('cash_positive', sql`${t.amountNok} > 0`),
    check('cash_two_parties', sql`${t.payerPosition} <> ${t.payeePosition}`),
  ],
)

// Acceptance hangs off the offer version, not the trade. Hang it off the trade
// and a counter-offer silently invalidates what people already agreed to, which
// is how you end up having accepted something else.
export const tradeAcceptances = pgTable(
  'trade_acceptances',
  {
    offerId: uuid('offer_id')
      .notNull()
      .references(() => tradeOffers.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull().defaultNow(),
    // What they actually ticked. We are not a party to the agreement, but we are
    // the one holding the record of it, so it has to be exact.
    termsVersion: text('terms_version').notNull(),
    // De-accepting keeps the row. Deleting it would hide that it ever happened.
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.offerId, t.userId] })],
)

// Taken when a trade completes. The trade owns a copy of what was traded rather
// than a pointer to a live listing, which means the listing can be deleted
// freely — and that editing an item later cannot rewrite history.
export const tradeItemSnapshots = pgTable(
  'trade_item_snapshots',
  {
    tradeId: uuid('trade_id')
      .notNull()
      .references(() => trades.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id').notNull(),
    giverPosition: smallint('giver_position').notNull(),
    title: text('title').notNull(),
    kind: listingKind('kind').notNull(),
    category: category('category').notNull(),
    estimatedValueNok: integer('estimated_value_nok'),
    // One image, not ten: the screens show a thumbnail, and photos of people's
    // things are often photos of their homes. Dropped at the retention horizon,
    // leaving the text, which is what a history actually needs.
    coverUrl: text('cover_url'),
    snapshotAt: timestamp('snapshot_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tradeId, t.itemId] })],
)

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

// One thread per trade, always. There is no such thing as a conversation
// without a trade: writing the first message is what creates the trade.
export const threads = pgTable('threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  tradeId: uuid('trade_id')
    .notNull()
    .unique()
    .references(() => trades.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const threadParticipants = pgTable(
  'thread_participants',
  {
    threadId: uuid('thread_id')
      .notNull()
      .references(() => threads.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    // What the unread badge on the Chats tab counts.
    lastReadMessageId: uuid('last_read_message_id'),
  },
  (t) => [primaryKey({ columns: [t.threadId, t.userId] })],
)

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => threads.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('messages_thread').on(t.threadId, t.createdAt.desc())],
)

// ---------------------------------------------------------------------------
// Trust, safety and feedback
// ---------------------------------------------------------------------------

export const reviews = pgTable(
  'reviews',
  {
    tradeId: uuid('trade_id')
      .notNull()
      .references(() => trades.id),
    rater: uuid('rater')
      .notNull()
      .references(() => users.id),
    ratee: uuid('ratee')
      .notNull()
      .references(() => users.id),
    score: smallint('score').notNull(),
    comment: text('comment'),
    chips: text('chips').array().notNull().default(sql`'{}'`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.tradeId, t.rater, t.ratee] }),
    check('review_score', sql`${t.score} between 1 and 5`),
  ],
)

// Not the same thing as a review: a review is about the counterparty, this is
// about us. Shown far less often, and it is not tied to a trade.
export const appFeedback = pgTable(
  'app_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    score: smallint('score').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('feedback_score', sql`${t.score} between 1 and 5`)],
)

// Survives the reported user's deletion. Otherwise delete-and-re-register is a
// free wash of the record.
export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporter: uuid('reporter')
      .notNull()
      .references(() => users.id),
    targetUser: uuid('target_user').references(() => users.id),
    targetItem: uuid('target_item').references(() => items.id),
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    handledAt: timestamp('handled_at', { withTimezone: true }),
  },
  (t) => [check('report_one_target', sql`num_nonnulls(${t.targetUser}, ${t.targetItem}) = 1`)],
)

export const blocks = pgTable(
  'blocks',
  {
    blocker: uuid('blocker')
      .notNull()
      .references(() => users.id),
    blocked: uuid('blocked')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.blocker, t.blocked] }),
    check('no_self_block', sql`${t.blocker} <> ${t.blocked}`),
  ],
)

// The payload holds ids, never finished text. A push that reads "Ola liked your
// Bosch drill" carries a name through Google and Apple; the app fetches the
// words itself.
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('notifications_unread')
      .on(t.userId, t.createdAt.desc())
      .where(sql`read_at is null`),
  ],
)

// ---------------------------------------------------------------------------
// Retained: the sealed record
//
// Its own schema so it can have its own grants. The running application has no
// business reading from here — it exists for the Article 17(3)(e) case, where
// data is needed to establish or defend a legal claim, and it is reached through
// a documented process rather than by a service.
// ---------------------------------------------------------------------------

export const retained = pgSchema('retained')

export const retainedIdentities = retained.table('identities', {
  userId: uuid('user_id').primaryKey(),
  // Enough to identify a person to a court or the police, and no more. The
  // BankID subject is the key: the provider holds the link to the human, so we
  // never have to.
  bankidSubject: text('bankid_subject'),
  email: text('email'),
  phone: text('phone'),
  displayName: text('display_name'),
  reason: text('reason').notNull().default('legal_claims'),
  sealedAt: timestamp('sealed_at', { withTimezone: true }).notNull().defaultNow(),
  // Completed trade plus three years — the general limitation period in
  // foreldelsesloven § 2. Once a claim can no longer be brought the purpose is
  // spent and the row goes.
  purgeAfter: date('purge_after').notNull(),
})

// Recognise a banned person without knowing who they are.
export const retainedBlockedSubjects = retained.table('blocked_subjects', {
  subjectHash: text('subject_hash').primaryKey(),
  reason: text('reason').notNull(),
  permanent: boolean('permanent').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
