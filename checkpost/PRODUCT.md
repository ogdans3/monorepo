# Product

## Register

product

## Users

Two or more people who need one shared list, right now, with no setup. A couple
packing for a trip. Housemates with a shopping list. A small crew running an
event checklist. A parent and a teenager splitting chores.

Their context is hands-busy and impatient: standing in a shop, halfway through
packing, walking to the car. They open the app to do exactly one thing: tick
something off, or add something before they forget. The session is measured in
seconds. Anyone they share with must be able to join in one tap, with no
account, no invite, no email.

The job to be done: *"we both need to see the same list, and I need to know
what's already done."*

## Product Purpose

Checkpost is a shared checklist that lives at a link. You create a list, you
share the link (as a QR code, a message, anything), and everyone who has it can
read and edit the same list in real time. There are no accounts and no
passwords. The link *is* the access. If a link gets somewhere it shouldn't,
you replace it, and the old one dies.

Success looks like: a list created and shared in under fifteen seconds, and two
people ticking items off it at the same time without ever noticing that
synchronisation is a thing that had to happen.

## Brand Personality

**Calm, exact, unbothered.**

Voice is plain and short. It says what happened, not how it feels about it.
"Link replaced. The old link no longer works." Not "Success! Your new link is
ready." No exclamation marks, no mascot, no gamification, no streaks. Ticking
something off is already satisfying. The app's job is to not get in the way of
that.

Emotionally the target is *relief*: the list is handled, everyone can see it,
nothing is going to be lost.

## Anti-references

- **Todoist / TickTick / Any.do**. Feature-dense productivity systems with
  priorities, labels, projects, karma scores. Checkpost is one list of one kind
  of thing. Nothing nests.
- **Trello / Notion**. Boards, databases, workspaces. There is no hierarchy
  here beyond list → item.
- **The blue-and-white productivity default.** The category reflex is a cool
  blue accent and a green checkmark. Both are banned.
- **Consumer-cute.** Confetti on completion, illustrated empty-state mascots,
  bouncy springs, "You're crushing it!" copy.
- **Anything that implies an account.** No avatars, no "invited by", no member
  lists. Presence is a count, not a roster.

## Design Principles

1. **The link is the product.** Sharing is not a settings screen buried three
   taps deep. It is a first-class action on every list, and its interface (QR,
   long URL, replace) must be legible to someone who has never used the app.
2. **Optimistic, always.** Every tap lands instantly against local state. The
   network reconciles afterwards and is allowed to correct us. The user never
   waits on a spinner to tick a box.
3. **Two hands, two people.** Every screen must survive somebody else editing
   it while you look at it. Remote changes animate in place. They never scroll
   the list out from under a thumb or steal focus from a text field.
4. **Say less.** If a label, an icon, a divider, or a state can be removed and
   the screen still reads, remove it. Density is not the goal. Quiet is.
5. **No dead ends.** Rotated links, deleted lists, and lost connections are
   normal events here, not errors. Each one has a plain sentence and a way
   forward.

## Accessibility & Inclusion

- **WCAG 2.2 AA.** Body text ≥ 4.5:1, UI component boundaries and focus rings
  ≥ 3:1. Verified numerically against the palette, not by eye.
- **Never colour alone.** A checked item is communicated by the checkbox mark,
  the strikethrough, and the dimmed text. The rose accent is confirmation, not
  the signal. This is a colour-blind-safe requirement, and it is why the
  checked state is *not* a green tick.
- **Every gesture has a non-gesture equivalent.** Swipe-to-open is a shortcut.
  The same detail sheet is reachable by tapping the right-hand edge of the row,
  and every destructive action is reachable from a menu. Nothing is
  gesture-only.
- **Touch targets ≥ 48dp**, including the checkbox and the row's right-edge
  affordance.
- **Respect `prefers-reduced-motion` / "Reduce Motion".** Item transitions
  become instant or crossfade. Nothing slides.
- **Full screen-reader labelling** on the checkbox ("Not done: buy milk"),
  the presence indicator, and the QR code (which carries the URL as its label,
  because a QR is invisible to a screen reader).
- **Dynamic type**: the app scales to the OS text-size setting without
  clipping. Rows grow. They do not truncate at large sizes.
