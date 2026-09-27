-- When each account last did anything, so a device nobody claimed can be
-- erased after twelve months without it.
--
-- The generated statement adds the column, and every existing row gets the
-- moment of the migration. The update below is hand-written and replaces that
-- with the latest thing the database can show the account doing itself: its
-- sessions were touched on every request, and the rest are the rows only its
-- own hand writes. `greatest` passes over the nulls. It goes by what the
-- account did, never by what was done to it — a like on its listing, a
-- message to it — for the same reason `resolveSession` does.
--
-- Only the account's own sessions. One the switcher minted (`issued_by` set)
-- is an admin at the controls, which `resolveSession` never counts and the
-- sweep's second witness looks past; counted here, it gave a test account last
-- week's mark over its own session from two years ago. The other tables say
-- nothing of who was at the controls — a like made through the switcher reads
-- like any other — so there the admin's doing counts as the account's, which
-- is the safe side.
--
-- Nothing is guessed older than it is: a row with no trace at all keeps the
-- day it was made, and anything later wins. A later value only means a device
-- is kept a little longer, which is the safe side of a sweep that deletes.
ALTER TABLE "users" ADD COLUMN "last_active_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "users" u SET "last_active_at" = greatest(
  u.created_at,
  u.bankid_verified_at,
  (SELECT max(s.last_seen_at) FROM sessions s
     WHERE s.user_id = u.id AND s.issued_by IS NULL),
  (SELECT max(d.last_seen_at) FROM devices d WHERE d.user_id = u.id),
  (SELECT max(l.created_at) FROM likes l WHERE l.from_user = u.id),
  (SELECT max(h.created_at) FROM hidden_listings h WHERE h.user_id = u.id),
  (SELECT max(greatest(i.created_at, i.deleted_at)) FROM items i WHERE i.owner_id = u.id),
  (SELECT max(m.created_at) FROM messages m WHERE m.sender_id = u.id),
  (SELECT max(o.created_at) FROM trade_offers o WHERE o.proposed_by = u.id),
  (SELECT max(a.accepted_at) FROM trade_acceptances a WHERE a.user_id = u.id),
  (SELECT max(greatest(p.sent_at, p.received_at, p.paid_at))
     FROM trade_participants p WHERE p.user_id = u.id),
  (SELECT max(w.requested_at) FROM trade_withdrawals w WHERE w.requested_by = u.id),
  (SELECT max(r.created_at) FROM reviews r WHERE r.rater = u.id),
  (SELECT max(r.created_at) FROM reports r WHERE r.reporter = u.id),
  (SELECT max(b.created_at) FROM blocks b WHERE b.blocker = u.id),
  (SELECT max(f.created_at) FROM app_feedback f WHERE f.user_id = u.id),
  (SELECT max(v.used_at) FROM invites v WHERE v.used_by = u.id),
  (SELECT max(v.created_at) FROM invites v WHERE v.inviter_id = u.id)
);
