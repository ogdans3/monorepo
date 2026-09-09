# Product

Written 09.09.2026, when the public web pages were designed. Everything here is
drawn from `DESIGN.md`, `ARCHITECTURE.md`, `round-5-brief.md` and the meeting
notes; where it disagrees with them, they win. It exists because the web is the
one surface with no screen export behind it, so the decisions that would
otherwise live in a drawing have to live somewhere.

## Register

**Brand** — for `web/`. It is the only surface a stranger sees, and it exists to
make a link look like something in a chat and to explain a closed app to somebody
who has just been handed a key. Nothing is transacted there.

The Flutter app is the product surface, and it is not designed here: round 5 is
the authority for it (`round-5-screens.md`).

## Who it is for

Somebody in a Norwegian town who has a drill they never use and wants a fishing
rod. They open the link on a phone, in the evening, from a Messenger group, and
have thirty seconds of curiosity to spend on it.

They are not shopping. That is the whole distinction from a marketplace: nobody
pays anybody, so the page has nothing to sell and everything to explain.

## Purpose

1. Make a shared listing look like a real thing in a chat preview.
2. Tell a stranger what Swaply is in one sentence they can repeat.
3. Get the key they were handed into the app without losing them.

## Personality

**Håndfast, nabolagsvennlig, stille selvsikker.** Norwegian plain speech, no
exclamation marks, no growth-marketing verbs. The product's own copy in the app
already reads this way — «Fullfør din del av byttet», «Gi gjenstanden en tittel»
— and the web has to sound like the same people.

The one thing it is allowed to be proud of is what it refuses to do: no freight,
no payment, no cut, no fødselsnummer. That is the voice.

## Anti-references

- **Finn.no and every marketplace.** No prices as prices, no «kjøp», no urgency,
  no listings grid. Value is stated because a barter needs it, not to sell.
- **Startup landing pages.** No hero metrics, no logo wall, no waitlist, no
  «Join thousands of…». There is nothing to join without an invitation, and
  pretending otherwise would be a lie on the first screen.
- **Cosy-Nordic pastel.** The palette is the app's, and it is a committed deep
  green — not beige, not sage, not hygge.

## Principles

- **The loop is the only thing worth drawing.** Nobody has to want what you want;
  they have to want it in a circle. That picture explains the product faster than
  any sentence, and it is the page's imagery.
- **Honesty is the design.** No photo yet means the page says so. A spent
  invitation says so. An app that only opens in a browser says so. The product's
  credibility is that it does not overclaim, and the surface has to match.
- **Invite-only is a feature, not an obstacle.** The page tells somebody without a
  link that they need to know somebody. It does not apologise for it.

## Accessibility

Norwegian (`lang="no"`), body text at 4.5:1 or better against its background,
every animation reduced to its finished state under
`prefers-reduced-motion`, and no content that depends on motion or hover to be
readable. The pages are server rendered and work with JavaScript turned
off, including the paste box on the landing page: it posts to a route that does
the same thing, and the client handler only saves the round trip.
