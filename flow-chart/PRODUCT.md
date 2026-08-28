# Product

## Register

product

## Users

Somebody who has to explain a process to someone else and has a whiteboard's
worth of it in their head: an approval flow, a deployment, what happens when an
order arrives. They are not designers, they do not want an account, and the
diagram is not the deliverable. It goes into a document, a ticket, a README or
a message, and then they are done with it.

## Product Purpose

Draw a flow chart quickly, get it out in a form something else can use, and
close the tab. Success is a diagram that took under a minute and came out as a
file or a block of Mermaid that renders where it is going.

## Brand Personality

Quiet and unfussy. The paper and the shapes are the interface; the chrome is a
single row of controls that stays out of the way. Dry copy, no exclamation
marks, no celebration when a box is placed.

## Anti-references

- **Visio and its descendants**: stencils, ribbons, and a shape library nobody
  reads. The five shapes here cover what a flow chart is made of.
- **Whiteboard products**: infinite canvases full of cursors, comments and
  sticky notes. This is one person drawing one diagram.
- **Diagram sites that want an account** before letting you export the thing
  you just drew.

## Design Principles

1. **The paper is the page.** The canvas fills the window. Everything else is
   one row of controls and a line of help at the bottom.
2. **Drawing beats configuring.** Place, name, connect. No inspector panel of
   properties for a box that only needs a word in it.
3. **It leaves the way it came.** Mermaid in, Mermaid out, plus SVG, PNG and a
   file. A diagram that cannot get out is a diagram you have to redraw.
4. **Nothing is uploaded.** The work stays in the tab and in this browser's
   storage. There is no server to send it to.
5. **Every state drawn.** Empty, placing, dragging, connecting, selected,
   imported with lines skipped. None of them an afterthought.

## Accessibility & Inclusion

WCAG 2.1 AA on the chrome: real buttons, visible focus rings, body text over
4.5:1. The canvas is a pointer surface, and the keyboard reaches what it can
(Enter to rename, Delete to remove, Escape to drop out, Ctrl+Z to undo). The
text view is the accessible path to the whole diagram: it can be read, edited
and loaded back without touching the canvas at all.
