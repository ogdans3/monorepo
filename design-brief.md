# Swapply — Design Brief for Claude

A prompt for generating screen mockups we can discuss. Read the **Design direction** first, then the **User flow overview** (the map), then the **Screen details** (one section per screen).

Goal: **as few taps as possible to complete a trade.** Barter is visual and social — items are photos, matches are people. The design should feel effortless, trustworthy, and a little playful.

---

## What Swapply is

A bartering app. You add items you'd trade away, swipe on items you want, and when intent closes a loop — you want theirs, they want yours (directly, or through a chain of 3–5 people) — Swapply connects everyone so a swap can happen. Invite-only. No sign-up needed to start; you create an account only when a trade is about to happen.

**The killer idea:** it's not just 1-to-1. Swapply builds *chains* — you give to Isak, Isak gives to Maria, Maria gives to you. The design has to make that loop feel obvious and magical, not confusing.

---

## Design direction

- **Aesthetic:** sleek, minimal, generous whitespace, large item imagery, soft rounded corners (16–24px), subtle shadows. Content-first — chrome stays out of the way.
- **Platform:** iOS + Android (Flutter). Design mobile portrait screens.
- **Base color: green.** Suggested palette (adjust freely):
  - Primary green `#12B76A` (emerald — CTAs, active states, the swipe "yes")
  - Deep green `#064E3B` (headers, emphasis)
  - Off-white background `#FAFAF9`
  - Ink text `#141C18`
  - Soft grey `#8A938E` (secondary text, borders)
  - Coral accent `#FF6B5E` for the swipe "no" / destructive only
- **Typography:** one clean geometric sans (e.g. Inter / SF). Big, confident headings; quiet body text.
- **Components:** full-bleed photo cards, pill-shaped buttons, a 4-tab bottom nav, avatar chips for people.
- **Motion (note in captions, not required in stills):** physical swipe cards; a celebratory reveal on a match.
- **Tone of copy:** warm, short, human. "It's a match!", "Waiting on Isak", "Your turn".

**Bottom nav (4 tabs):** Discover · Likes · Trades · Profile.

---

## User flow overview (the map)

```
FIRST RUN (invite-only, anonymous)
  1. Splash
  2. Invite landing (opened via deep link)
  3. How it works (2 quick slides, skippable)
  4. Add your first item  ← anonymous, no sign-up yet

CORE LOOP
  5. Discover (search + swipe cards)   ⟷  6. Item detail
                                       ⟷  7. Search & filters
  → swipe right on things you want
  8. It's a match! (direct OR chain)
  9. Trade detail + Accept flow (waiting / accepted states)
  10. Chat (group thread for the match)

BECOME A USER (deferred)
  11. Claim account  ← triggered the first time a match needs you

MANAGE
  12. Trades / "Mine handler" (pending · accepted · done + handoff)
  13. Likes (who liked your items → browse their items)
  14. Profile (your items, rating, categories, badges)
  15. Review (after a completed trade)

SUPPORTING
  16. Notifications
  17. Report / block (modal)  ·  Settings
```

Happiest path to a trade: **Discover → swipe right → It's a match → Accept → (chat to arrange) → Done → Review.**

---

## Screen details

### 1. Splash
- Full green screen, centered Swapply wordmark/logo, subtle motion feel. Nothing else.

### 2. Invite landing
- Opened from a deep link. "You've been invited to Swapply."
- Who invited them (inviter avatar + name), one line on what Swapply is, single primary button: **Get started**.
- Reinforces exclusivity (invite-only) — feels like a club.

### 3. How it works (2 slides, skippable)
- Slide 1: "Add stuff you'd trade." Slide 2: "Swipe what you want — we find the match, even through a chain." Simple illustrations, page dots, **Skip** top-right, **Next / Start** bottom.

### 4. Add your first item (anonymous)
- The hook — no sign-up gate. Big friendly "Add your first item".
- Fields: **photos** (up to 10, first is cover, big add-photo tile), **title**, **description**, **estimated value** (kr, user-set — note "very cheap items can be free"), **category** (chips: Gaming, Klær, Verktøy, Sykling, Båt, Diverse…), **condition** (New / Good / Worn), **location** (town/county only — coarse).
- Primary button: **List it**. Keep the form short and scannable; not all fields feel mandatory.

### 5. Discover (home) — search + swipe
- Top: a **search bar** (free-text, main way to find things) + filter icon.
- Center: a **stack of full-bleed item cards** (Tinder-style). Each card: cover photo, title, estimated value, category chip, distance/town, condition.
- Bottom: two swipe buttons — **✕ (no, coral)** and **♥ (yes, green)** — plus tap-to-open detail.
- Tiny hint that swiping right = "I'd trade one of mine for this."

### 6. Item detail (expanded card)
- Full photo gallery (swipeable, up to 10), title, estimated value, description, category, condition, location.
- Owner strip: avatar, name, **rating** (stars), BankID badge if verified.
- Actions: **✕ / ♥** persist at bottom; overflow menu → **Report**.

### 7. Search & filters
- Search field with results, plus filter controls: category, location radius/town, condition, value range. Minimal, chip-based. Results feed straight back into the swipe stack.

### 8. It's a match! (celebration)
- Joyful reveal. **Two variants — design both:**
  - **Direct (2-way):** "It's a match! You and Isak both want each other's stuff." Two item photos facing each other with a swap arrow between.
  - **Chain (3–5 way):** the signature screen. A clear **loop diagram**: your item → Isak → Maria → back to you. Each hop shows a small avatar + item thumbnail + arrow, arranged as a circle/ring so the loop reads instantly. Caption: "A 3-way swap! Everyone gets something they want."
- Primary button: **View trade**. This is the moment that sells the whole app — make the chain legible and delightful.

### 9. Trade detail + Accept flow
- Header: the loop/swap diagram again (compact), match status.
- **Who gives what to whom**, laid out per hop: "You give [item] → Isak. You get [item] ← Maria."
- **Accept states — design all three:**
  1. **Needs your accept:** big **Accept trade** button. Copy: "Everyone must accept for the swap to happen."
  2. **Waiting on others:** you've accepted; show a checklist of participants (✓ accepted / ⏳ waiting) — "Waiting on Isak & Maria." Secondary **De-accept** (back out) link.
  3. **All accepted:** success state, items now **Traded**, primary button **Open chat** to arrange handoff. Keep a **De-accept** escape hatch (with a gentle warning).
- Entry point to **Chat**.

### 10. Chat (group thread)
- One thread for the whole match — **all participants together** (crucial for chains). Avatars in the header.
- Standard message list, text input. A pinned summary chip at top showing the swap ("3-way swap") so context is never lost.
- Text-only for MVP (no image upload yet).

### 11. Claim account (deferred sign-up)
- Appears the first time a match needs a stable identity / notifications. Framed positively: "One step to lock in your trade."
- Fields: **display name**, **email or phone** (one contact channel), confirm **location**. Mention BankID as an optional trust badge (future/at-trade).
- Keep it to a single short screen.

### 12. Trades — "Mine handler"
- Tabbed list: **Pending · Active · Done**. Each row: the other item photo(s), counterpart name(s), status pill (Waiting / Accepted / Traded).
- A trade's detail shows the **handoff**: "Your [item] goes to [name] — at this town / arrange in chat." (Shipping is out of MVP scope — coordinate in chat.)
- Done trades surface a **Leave a review** prompt.

### 13. Likes
- "People who liked your items." Grid/list of your items with a count of likes; tapping one shows **who** liked it → tap a person to **browse their items** and swipe back. Closes loops faster.

### 14. Profile (own)
- Avatar, display name, **rating** (stars + count), BankID badge (if any), location.
- **Interest categories** (the ones they pick/accumulate — Verktøy, Gaming, Sykling, Klær…) shown as chips; profile "fills out" as they use the app.
- **My items** grid (available / reserved / traded states visible). Add-item FAB.
- Edit profile, settings entry.

### 15. Review (after a trade)
- Simple: star rating + optional short comment about the counterpart. One tap to submit. Shown after a trade is marked done.

### 16. Notifications
- List: new match, someone accepted, your turn to accept, new chat message, someone liked your item. Green unread dots. Tapping deep-links to the relevant screen.

### 17. Report / block + Settings
- **Report** (modal): reason picker (spam, inappropriate, scam…), submit.
- **Block** a user (hides their items, no future matches).
- **Settings:** account, notifications, invites (share your invite deep link), logout, legal.

---

## Open questions for us to resolve while reviewing mockups

- **Name:** Swapply vs Swappify — pick one.
- Swipe UI confirmed as Tinder-style (per design doc) — do we still want to prototype the collage / TikTok-feed alternatives visually?
- Chain screen: ring/loop layout vs. linear step layout — which reads clearer? (Designing loop first.)
- Where does "unlock contact info for a fee" and the admin-fee/monetization surface, if at all, in the MVP screens? (Currently left out of the flow.)
