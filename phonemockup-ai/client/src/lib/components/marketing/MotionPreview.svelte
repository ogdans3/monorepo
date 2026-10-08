<script lang="ts">
  import { onMount } from "svelte";
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
      video?.pause();
    };
  });

  $effect(() => {
    const el = video;
    const play = shouldPlay;
    src; // A new source must receive the same playback policy.
    if (!el || !mounted) return;
    let cancelled = false;
    el.muted = true;
    el.defaultMuted = true;
    // One playback authority: native autoplay would race this policy and
    // could restart a locally paused or reduced-motion preview.
    if (play) {
      el.play()
        .then(() => {
          if (!cancelled) blocked = false;
        })
        .catch(() => {
          if (!cancelled) blocked = true;
        });
    } else el.pause();
    return () => {
      cancelled = true;
    };
  });

  function toggle(event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    if (!video) return;
    if (playing) {
      locallyPaused = true;
      video.pause();
    } else {
      manualPlay = true;
      locallyPaused = false;
      loaded = true;
      // Keep play() in the actual user gesture for restrictive Safari settings.
      video.muted = true;
      video
        .play()
        .then(() => {
          blocked = false;
        })
        .catch(() => {
          blocked = true;
        });
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
    src={loaded ? src : undefined}
    {poster}
    muted
    playsinline
    loop
    preload={priority ? "auto" : "none"}
    disablepictureinpicture
    aria-label={`${label} animation preview`}
    onplay={() => {
      playing = true;
    }}
    onpause={() => {
      playing = false;
    }}
    onerror={() => {
      blocked = true;
      playing = false;
    }}
  ></video>
  {#if controls && !paused}
    <button
      type="button"
      class="playback"
      onclick={toggle}
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
  }
  .playback {
    position: absolute;
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
