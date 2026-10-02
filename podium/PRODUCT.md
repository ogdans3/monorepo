# Product
<!-- impeccable:product-schema 1 -->

Written 02.10.2026 from the owner's brief alone: they asked for no questions,
so every line marked *(assumed)* is an inference to confirm, not a decision.

## Platform
web

## Stack
The owner's choice: Svelte (SvelteKit) for every screen, a Go API, Postgres,
and a local volume for the images and videos a presentation carries. Minimalist.

## Users
- **The presenter**, who is also the admin: builds a presentation ahead of a
  talk, then starts it and steps through it in the room, on a laptop driving a
  projector. One person, one password *(assumed)*.
- **The audience**, in the room, on their own phones: they scan a QR code on
  the screen and vote on the question showing. No account, no app, no name.

## Product Purpose
A presentation tool where the room answers back. Slides carry text, images and
video, and a question slide carries answer options the audience votes on from
their phones while the screen counts every vote as it lands, each one with a
sound. Success is a room that votes in the first ten seconds and watches its
own answer arrive.

## Positioning
The presenter places every answer option on the slide where it should be, as
part of the slide's own composition, rather than getting a generic poll chart:
the votes land on the slide the presenter designed.

## Operating Context
- Built at a desk, ahead of time, in the admin section.
- Shown full screen on a projector or a large screen, usually 16:9, in a room
  with the lights down *(assumed)*; stepped through with arrow keys or a
  presentation clicker *(assumed)*.
- Voted on from phones over the venue's network, in the seconds a question is
  up, by people who have never seen the page before.

## Capabilities and Constraints
- Three parts: admin (make presentations, start them), display (show the live
  slide and nothing else), voting (the phone page behind the QR code).
- A slide is a 16:9 canvas with text, images and videos placed on it.
- A question slide has any number of answer options, each placed by the admin
  on the slide; all of a question's options are on one slide.
- Each vote plays a sound on the display and is counted on screen.
- The owner asked for the sound from Dr Kawashima's Brain Training. That sound
  belongs to Nintendo and is not shipped: the app synthesizes its own chime in
  that spirit, and a presentation can carry an uploaded sound of the owner's
  instead.
- One vote per phone per question *(assumed)*.
- Norwegian interface *(assumed from the owner writing in Norwegian)*.

## Evidence on Hand
None. There are no real presentations, photographs or videos in the project;
anything shown in screenshots is labelled demonstration content.

## Product Principles
- **The slide is the presenter's.** Nothing the tool adds — the QR code, the
  counts — goes anywhere the presenter did not put it.
- **A vote is felt.** It is heard and seen the moment it lands, or it did not
  happen as far as the room is concerned.
- **The phone page asks one thing.** The current question and its options,
  big enough for a thumb in a dark room; nothing to read first.
- **Minimal.** Every control in the admin earns its place; the display has
  none.

## Accessibility & Inclusion
The voting page works one-handed, in the dark, on any phone, with large
targets and text that follows the phone's size setting *(assumed)*. Counts are
numbers on screen, so a vote is not carried by sound alone.
