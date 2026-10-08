<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { Play, Pause } from "@lucide/svelte";

  let {
    src,
    poster,
    label,
    priority = false,
    paused = false,
    controls = true,
  }: {
    src: string;
    poster?: string;
    label: string;
    priority?: boolean;
    paused?: boolean;
    controls?: boolean;
  } = $props();
  // New cache key avoids the old CDN entries that lack byte-range metadata.
  const playbackSrc = $derived(
    `${src}${src.includes("?") ? "&" : "?"}delivery=iphone-range-v1`,
  );
  let root: HTMLDivElement;
  let video = $state<HTMLVideoElement>();
  let mounted = $state(false);
  let visible = $state(false);
  let loaded = $state(false);
  let pageVisible = $state(true);
  let reduced = $state(false);
  let manualPlay = $state(false);
  let locallyPaused = $state(false);
  let playing = $state(false);
  let blocked = $state(false);
  const shouldPlay = $derived(
    mounted &&
      visible &&
      pageVisible &&
      !paused &&
      !locallyPaused &&
      (!reduced || manualPlay),
  );

  onMount(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => {
      reduced = preference.matches;
    };
    const syncVisibility = () => {
      pageVisible = !document.hidden;
    };
    syncPreference();
    syncVisibility();
    mounted = true;
    preference.addEventListener("change", syncPreference);
    document.addEventListener("visibilitychange", syncVisibility);
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting && entry.intersectionRatio >= 0.15;
        if (visible) loaded = true;
      },
      { threshold: [0, 0.15] },
    );
    observer.observe(root);
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", syncPreference);
      document.removeEventListener("visibilitychange", syncVisibility);
      if (video) stop(video);
    };
  });

  // Source assignment and play() must happen in the same trusted tap. A
  // reactive src attribute can otherwise reload the video after that gesture.
  let playRequest = 0;
  function prepare(el: HTMLVideoElement, source: string) {
    el.muted = true;
    el.defaultMuted = true;
    el.playsInline = true;
    if (el.getAttribute("src") !== source) {
      ++playRequest;
      playing = false;
      el.setAttribute("src", source);
    }
  }

  function stop(el: HTMLVideoElement) {
    ++playRequest;
    el.pause();
    playing = false;
  }

  function start(el: HTMLVideoElement, source: string) {
    prepare(el, source);
    // play() alone cannot recover a failed media resource. Reload it while
    // still inside the tap, before asking the browser to play again.
    if (el.error || el.networkState === HTMLMediaElement.NETWORK_NO_SOURCE)
      el.load();
    if (!el.paused) return; // Do not race an in-flight, gesture-started play.
    const request = ++playRequest;
    blocked = false;
    el.play()
      .then(() => {
        if (request === playRequest) blocked = false;
      })
      .catch((error: unknown) => {
        if (request !== playRequest) return;
        playing = false;
        // Scrolling, pausing, and changing sources legitimately abort play.
        if (!(error instanceof DOMException && error.name === "AbortError"))
          blocked = true;
      });
  }

  $effect(() => {
    const el = video;
    const play = shouldPlay;
    const source = playbackSrc;
    const load = loaded;
    if (!el || !mounted) return;
    untrack(() => {
      if (load) prepare(el, source);
      // One playback authority; no competing native autoplay or src update.
      if (play) start(el, source);
      else stop(el);
    });
  });

  function toggle(event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    if (!video || paused || !mounted) return;
    if (!video.paused && !blocked) {
      locallyPaused = true;
      stop(video);
    } else {
      manualPlay = true;
      locallyPaused = false;
      loaded = true;
      // A tappable control is visible, even if its observer callback is late.
      visible = true;
      start(video, playbackSrc);
    }
  }
</script>

<div
  class="motion-preview"
  bind:this={root}
  data-motion-preview
  data-visible={visible}
  data-playing={playing}
>
  <!-- svelte-ignore a11y_media_has_caption (Silent decorative product motion; described by the adjacent title.) -->
  <video
    bind:this={video}
    {poster}
    muted
    playsinline
    preload={priority ? "auto" : "none"}
    disablepictureinpicture
    aria-label={`${label} animation preview`}
    onplaying={() => {
      playing = true;
      blocked = false;
    }}
    onended={() => {
      // Restart the same authorized element explicitly: native looping can
      // seek to zero without resuming the decoder on WebKit.
      if (video && shouldPlay) {
        video.currentTime = 0;
        start(video, playbackSrc);
      }
    }}
    onpause={() => {
      playing = false;
    }}
    onerror={() => {
      ++playRequest;
      blocked = true;
      playing = false;
    }}
  ></video>
  {#if controls && !paused}
    <button
      type="button"
      class="playback"
      onclick={toggle}
      disabled={!mounted}
      aria-label={`${playing ? "Pause" : "Play"} ${label}`}
    >
      {#if playing}<Pause size={14} fill="currentColor" />{:else}<Play
          size={14}
          fill="currentColor"
        />{/if}
      {#if blocked}<span>Tap to play</span>{/if}
    </button>
  {/if}
</div>

<style>
  .motion-preview {
    position: relative;
    width: 100%;
    height: 100%;
    isolation: isolate;
    overflow: hidden;
    background: inherit;
  }
  video {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
  }
  .playback {
    position: absolute;
    z-index: 1;
    touch-action: manipulation;
    right: 14px;
    bottom: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 40px;
    min-height: 40px;
    padding: 10px;
    border: 1px solid #ffffff70;
    border-radius: 50px;
    background: #f9faf0df;
    color: #263329;
    cursor: pointer;
    backdrop-filter: blur(8px);
    font:
      500 11px/1.2 Arial,
      sans-serif;
  }
  .playback:hover {
    background: #fff;
  }
  .playback:focus-visible {
    outline: 3px solid #1e4527;
    outline-offset: 3px;
  }
  @media (pointer: coarse) {
    .playback {
      min-width: 44px;
      min-height: 44px;
    }
  }
</style>
