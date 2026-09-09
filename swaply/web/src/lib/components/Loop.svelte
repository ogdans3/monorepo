<script lang="ts">
  /**
   * The picture of the product: three wishes that happen to close a ring.
   *
   * Drawn rather than photographed because the thing worth showing is not a
   * drill, it is the loop — nobody has to want what you want, they only have to
   * want it in a circle. The arrows are wishes, and the things travel the other
   * way, which is the one sentence the caption has to carry.
   *
   * Everything is visible without the animation: the keyframes run backwards
   * from a hidden state, so a headless render or a paused tab still gets the
   * finished drawing.
   */
  let { compact = false }: { compact?: boolean } = $props()

  const people = [
    { name: 'Ola', thing: 'Drill', x: 210, y: 62, labelY: 118 },
    // The two at the bottom sit lower than the arc that runs between them, or
    // the arrowhead lands in the middle of a word once the labels grow on a
    // narrow screen.
    { name: 'Kari', thing: 'Fiskestang', x: 312.2, y: 239, labelY: 309 },
    { name: 'Per', thing: 'Bysykkel', x: 107.8, y: 239, labelY: 309 },
  ]

  // Clockwise arcs between the three, with a gap either end so an arrowhead
  // never lands on a face.
  const arcs = [
    { d: 'M 261.7 73.9 A 118 118 0 0 1 327.7 188.2', heart: [312.2, 121] },
    { d: 'M 276 277.8 A 118 118 0 0 1 144 277.8', heart: [210, 298] },
    { d: 'M 92.3 188.2 A 118 118 0 0 1 158.3 73.9', heart: [107.8, 121] },
  ]
</script>

<svg
  class="loop"
  class:compact
  viewBox="0 0 420 360"
  role="img"
  aria-label="Ola vil ha Karis fiskestang, Kari vil ha Pers bysykkel, og Per vil ha Olas drill. Ønskene lukker en sirkel, og de tre bytter."
>
  <defs>
    <marker id="wish-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5.5"
            markerHeight="5.5" orient="auto-start-reverse">
      <path d="M 0 1 L 9 5 L 0 9 z" fill="currentColor" />
    </marker>
  </defs>

  {#each arcs as arc, i (arc.d)}
    <path
      class="arc"
      style="--i: {i}"
      d={arc.d}
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      marker-end="url(#wish-arrow)"
    />
    <g class="heart" style="--i: {i}" transform="translate({arc.heart[0]} {arc.heart[1]})">
      <circle r="15" class="heart-plate" />
      <path
        class="heart-mark"
        transform="translate(-7 -6.4) scale(0.58)"
        d="M12 21s-7.5-4.9-9.9-9A5.6 5.6 0 0 1 12 5.6 5.6 5.6 0 0 1 21.9 12c-2.4 4.1-9.9 9-9.9 9z"
      />
    </g>
  {/each}

  {#each people as person, i (person.name)}
    <g class="node" style="--i: {i}">
      <circle cx={person.x} cy={person.y} r="30" class="node-plate" />
      <text x={person.x} y={person.y + 7} class="node-initial">{person.name[0]}</text>
      <text x={person.x} y={person.labelY} class="node-thing">{person.thing}</text>
      <text x={person.x} y={person.labelY + 17} class="node-name">{person.name}</text>
    </g>
  {/each}
</svg>

<style>
  .loop {
    width: 100%;
    max-width: 30rem;
    height: auto;
    color: var(--on-green-soft);
    overflow: visible;
  }

  .compact {
    max-width: 20rem;
  }

  .arc {
    /* Just over the arc length, so the dash never shows a seam. */
    stroke-dasharray: 150;
    animation: draw 1000ms var(--ease-out) backwards;
    animation-delay: calc(180ms + var(--i) * 210ms);
  }

  .heart-plate {
    fill: var(--green);
  }

  .heart-mark {
    fill: var(--green-deep);
  }

  .heart {
    animation: pop 520ms var(--ease-out) backwards;
    animation-delay: calc(760ms + var(--i) * 210ms);
    transform-box: fill-box;
    transform-origin: center;
  }

  .node {
    animation: rise 620ms var(--ease-out) backwards;
    animation-delay: calc(var(--i) * 110ms);
  }

  .node-plate {
    fill: var(--on-green);
  }

  .node-initial {
    fill: var(--green-deep);
    font-size: 1.6rem;
    font-weight: 700;
    text-anchor: middle;
  }

  .node-thing {
    fill: var(--on-green);
    font-size: 1.05rem;
    font-weight: 600;
    text-anchor: middle;
  }

  .node-name {
    fill: var(--on-green-soft);
    font-size: 0.85rem;
    text-anchor: middle;
  }

  /* The drawing scales with its box, and so does every label in it. On a narrow
     phone that put the names at about eight pixels, which is a decoration and
     not a word — so the type inside grows as the box shrinks. */
  @media (max-width: 26rem) {
    .node-thing {
      font-size: 1.35rem;
    }

    .node-name {
      font-size: 1.15rem;
    }

    .node-initial {
      font-size: 1.9rem;
    }
  }

  @keyframes draw {
    from {
      stroke-dashoffset: 150;
      opacity: 0;
    }
    5% {
      opacity: 1;
    }
    to {
      stroke-dashoffset: 0;
      opacity: 1;
    }
  }

  @keyframes pop {
    from {
      opacity: 0;
      scale: 0.4;
    }
  }

  @keyframes rise {
    from {
      opacity: 0;
      translate: 0 10px;
    }
  }
</style>
