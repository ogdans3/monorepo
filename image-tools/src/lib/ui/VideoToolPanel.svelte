<script lang="ts">
	import { editedFileName, formatBytes, resolveFormat } from '$lib/engine';
	import { resolveVideoFormat, videoAcceptAttribute, VIDEO_FORMATS } from '$lib/video/formats';
	import {
		editVideo,
		isLoaded,
		lastFfmpegLines,
		loadFfmpeg,
		readStill,
		resetFfmpeg,
		type LoadProgress
	} from '$lib/video/ffmpeg';
	import {
		BLUR_MAX,
		BLUR_MIN,
		evenSize,
		phoneLayout,
		SPEED_MAX,
		SPEED_MIN,
		STRETCH_MAX_SECONDS,
		STRETCH_MIN_SECONDS,
		stretchLayout,
		stretchedTotal,
		type EditOp,
		type TextPosition
	} from '$lib/video/edit';
	import {
		defaultRamp,
		FASTER,
		rampIsFlat,
		rampPeak,
		rampTotal,
		sampleRamp,
		SLOWER,
		speedAt,
		type RampPoint
	} from '$lib/video/ramp';
	import { formatTimecode, parseTimecode } from '$lib/video/timecode';
	import {
		BEZEL_COLOUR,
		paintPhoneFrame,
		phoneFrameDefaults,
		phoneFrameLimits
	} from '$lib/tools/phoneframe';
	import BackgroundPicker from './BackgroundPicker.svelte';
	import PhoneFrameControls from './PhoneFrameControls.svelte';
	import RampCurve from './RampCurve.svelte';
	import SliderField from './SliderField.svelte';
	import type { VideoTool } from '$lib/video/tools';
	import { downloadBlob } from './download';
	import Dropzone from './Dropzone.svelte';
	import { learnDuration } from './videolength';

	let { tool }: { tool: VideoTool } = $props();

	/** `reading` is the phone frame asking ffmpeg for a still the browser couldn't show. */
	type Stage = 'idle' | 'loading' | 'reading' | 'working' | 'done' | 'error';

	let stage = $state<Stage>('idle');
	let download = $state<LoadProgress>({ ratio: null, loadedBytes: 0, totalBytes: null });
	let workRatio = $state(0);
	let error = $state<string | null>(null);
	let file = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);
	let result = $state<{ blob: Blob; name: string; framesIntact: boolean } | null>(null);
	let elapsed = $state(0);
	let ticker: ReturnType<typeof setInterval> | null = null;
	/** The tail of ffmpeg's own log, rendered for screen readers only. */
	let ffmpegSaid = $state<string[]>([]);

	/** Read off the preview element, which knows before ffmpeg does. */
	let media = $state({ width: 0, height: 0, duration: 0 });
	let video = $state<HTMLVideoElement>();

	/* ---- the settings, one group per tool -------------------------------- */
	let startSeconds = $state(0);
	let endSeconds = $state(0);
	let exactTrim = $state(false);

	/**
	 * The slow motion page works in timecodes as well as sliders, because
	 * somebody who already knows the interesting part starts at 2:32 knows it
	 * as 2:32. The boxes hold text so a half typed value doesn't jump the mark
	 * about, and only a value that parses is committed.
	 */
	let stretchStart = $state(0);
	let stretchEnd = $state(0);
	let stretchTarget = $state(0);
	let stretchStartText = $state('0:00.0');
	let stretchEndText = $state('0:00.0');
	let stretchTargetText = $state('0:00.0');

	/**
	 * The slow motion page has two ways in. The simple one marks a section and
	 * gives it a length, which is one speed applied to one block. The curve one
	 * draws the pace across the whole clip, so the footage can ease down into
	 * slow motion, hold, and ease back out.
	 *
	 * Both live in this panel rather than in a panel each, because the shape
	 * either one works on is identical: one file, one preview, one probe, one
	 * download. Only the controls differ, which is what this panel already
	 * branches on for ten other tools. Splitting them would also throw the
	 * loaded video away every time somebody switched, which is the one thing
	 * a mode switch must not do.
	 */
	let stretchMode = $state<'simple' | 'curve'>('simple');
	/**
	 * Slow motion and speeding up are the same edit pointed in opposite
	 * directions, so they are one page's worth of controls used twice rather
	 * than two near-copies. Everything that differs between them is this flag
	 * and the words next to it.
	 */
	const faster = $derived(tool.direction === 'faster');
	const rampRange = $derived(faster ? FASTER : SLOWER);
	let rampPoints = $state<RampPoint[]>([]);
	/** Where the preview has reached, so the curve can show a playhead. */
	let playhead = $state(0);

	let cropBox = $state({ x: 0, y: 0, w: 1, h: 1 });
	/** Where the crop preview is paused, since it has no controls of its own. */
	let scrubAt = $state(0);

	let resizeWidth = $state(1280);
	let speedFactor = $state(2);
	let fps = $state(30);
	// Starts at zero, so the page opens showing the video the way it arrived.
	// A default of one turn meant the preview was already on its side before
	// anybody had asked for anything.
	let quarterTurns = $state(0);
	let flipHorizontal = $state(false);
	let flipVertical = $state(false);
	let blurStrength = $state(8);
	let quality = $state(28);

	let text = $state('');
	let textSize = $state(48);
	let textColour = $state('#ffffff');
	let textPosition = $state<TextPosition>('bottom');
	let textBox = $state(true);

	/**
	 * The phone frame, with the screenshot page's controls and geometry. The
	 * border moves in pixel pairs here, because a video puts its picture on
	 * even pixels and an odd border would leave a line down one edge.
	 */
	let phoneBezelOn = $state(true);
	let phoneBezel = $state(40);
	let phoneRadius = $state(129);
	let phoneBackground = $state('#ffffff');
	let phoneTransparent = $state(false);
	/** Set by hand, so the next recording keeps it. Same rule as the image page. */
	let phoneBezelTouched = false;
	let phoneRadiusTouched = false;
	/** The browser could not play the file, so the preview has nothing to show. */
	let previewFailed = $state(false);
	/**
	 * The recording's first frame, read by ffmpeg, as an object URL. The phone
	 * preview shows it in place of the video when the browser can't play the
	 * file, and the frame is sized from it.
	 */
	let still = $state<string | null>(null);
	/** ffmpeg couldn't read it either, so there really is nothing to frame. */
	let unreadable = $state<string | null>(null);
	let playing = $state(false);
	/** Set by the cancel button, so the run that throws next isn't an error. */
	let cancelled = false;

	const phoneDefaults = $derived(
		media.width ? phoneFrameDefaults(media.width, media.height, { even: true }) : null
	);
	const phoneLimits = $derived(
		media.width ? phoneFrameLimits(media.width, media.height, { even: true }) : null
	);

	/**
	 * The container the file arrived in, so an edit gives back the same kind.
	 * The one exception is a phone frame with see-through corners, which only a
	 * WebM can carry.
	 */
	const target = $derived.by(() => {
		if (tool.op === 'phone' && phoneTransparent) return VIDEO_FORMATS.webm;
		if (!file) return VIDEO_FORMATS.mp4;
		const ext = file.name.slice(file.name.lastIndexOf('.'));
		return resolveVideoFormat(ext.replace('.', '')) ?? VIDEO_FORMATS.mp4;
	});

	const outName = $derived(
		file ? editedFileName(file.name, tool.suffix, target.extensions[0]) : ''
	);

	const saving = $derived(
		result && file ? Math.round((1 - result.blob.size / file.size) * 100) : 0
	);

	/**
	 * The crop frame in real pixels, from the fractions the overlay works in.
	 * Rounded to even numbers here as well as in the plan, so the readout says
	 * what the file will actually be rather than a number one off it.
	 */
	const cropPixels = $derived({
		x: Math.round(cropBox.x * media.width),
		y: Math.round(cropBox.y * media.height),
		width: evenSize(cropBox.w * media.width),
		height: evenSize(cropBox.h * media.height)
	});

	const op = $derived.by((): EditOp => {
		switch (tool.op) {
			case 'trim':
				return {
					kind: 'trim',
					startSeconds,
					endSeconds: endSeconds > startSeconds ? endSeconds : null,
					exact: exactTrim
				};
			case 'crop':
				return { kind: 'crop', ...cropPixels };
			case 'resize':
				return { kind: 'resize', width: resizeWidth, height: null };
			case 'speed':
				return { kind: 'speed', factor: speedFactor };
			case 'stretch':
				if (stretchMode === 'curve') return { kind: 'ramp', points: rampPoints, range: rampRange };
				return {
					kind: 'stretch',
					startSeconds: stretchStart,
					endSeconds: stretchEnd,
					targetSeconds: stretchTarget
				};
			case 'fps':
				return { kind: 'fps', fps };
			case 'rotate':
				return { kind: 'rotate', quarterTurns, flipHorizontal, flipVertical };
			case 'blur':
				return { kind: 'blur', strength: blurStrength };
			case 'text':
				return { kind: 'text', text, size: textSize, colour: textColour, position: textPosition, box: textBox };
			case 'compress':
				return { kind: 'compress', quality };
			case 'phone':
				return {
					kind: 'phone',
					width: media.width,
					height: media.height,
					bezelOn: phoneBezelOn,
					bezel: phoneBezel,
					radius: phoneRadius,
					background: phoneBackground,
					transparent: phoneTransparent
				};
			default:
				return { kind: 'mute' };
		}
	});

	/**
	 * The frame the preview draws and the export encodes, from the one function
	 * both use, so what is on screen is what comes out.
	 */
	const phone = $derived(
		op.kind === 'phone' && media.width && (!previewFailed || still) ? phoneLayout(op) : null
	);

	/**
	 * The same phone with its border on, whatever the switch says, for the
	 * preview's column to be sized by. The column is as wide as the phone, so
	 * turning the border off narrowed it and pulled the controls beside it
	 * 11 px to the left, the switch included, from under the pointer that had
	 * just clicked it.
	 */
	const phoneBordered = $derived(op.kind === 'phone' && phone ? phoneLayout({ ...op, bezelOn: true }) : null);

	/**
	 * A phone preview is as tall as the screen allows, which puts anything
	 * under it out of sight. So its progress and its errors go where the button
	 * was, beside the preview, rather than below it where nobody would see the
	 * bar move.
	 */
	const statusBesideControls = $derived(
		tool.op === 'phone' && Boolean(file && previewUrl) && stage !== 'done'
	);

	/**
	 * While the engine loads or the file encodes. The phone frame's controls
	 * are held still for it, because its preview claims to be the export and
	 * a slider moved mid-run would draw a frame the file won't have.
	 */
	const busy = $derived(stage === 'loading' || stage === 'working');

	/** Nothing to do yet, so the button says so rather than producing a copy. */
	const ready = $derived.by(() => {
		if (!file) return false;
		if (tool.op === 'phone') return phone !== null;
		if (tool.op === 'text') return text.trim().length > 0;
		if (tool.op === 'trim') return startSeconds > 0 || (endSeconds > 0 && endSeconds < media.duration);
		if (tool.op === 'stretch') {
			if (stretchMode === 'curve') {
				// A curve sitting flat at the original speed is not an edit, and
				// offering to spend two minutes encoding one would be a tool
				// pretending to have been asked something.
				return rampPoints.length > 1 && !rampIsFlat(rampPoints) && media.duration > 0;
			}
			return stretchEnd > stretchStart && stretchTarget > 0 && stretchTarget !== stretchEnd - stretchStart;
		}
		if (tool.op === 'rotate') return quarterTurns % 4 !== 0 || flipHorizontal || flipVertical;
		if (tool.op === 'crop') return cropBox.w < 0.999 || cropBox.h < 0.999;
		return true;
	});

	function startClock() {
		elapsed = 0;
		ticker = setInterval(() => (elapsed += 1), 1000);
	}

	function stopClock() {
		if (ticker) clearInterval(ticker);
		ticker = null;
	}

	/**
	 * A still picture is the common mistake here, and ffmpeg doesn't consider it
	 * one: it reads a JPEG perfectly well and hands back a video one frame long.
	 * Better to notice than to spend a 7MB download on it.
	 */
	function imageMistake(dropped: File): boolean {
		const ext = dropped.name.slice(dropped.name.lastIndexOf('.'));
		return Boolean(resolveFormat(ext)) || dropped.type.startsWith('image/');
	}

	function onfiles(files: File[]) {
		const dropped = files[0];
		if (!dropped) return;
		if (imageMistake(dropped)) {
			error = 'That looks like a picture rather than a video. The image tools handle it.';
			stage = 'error';
			return;
		}
		error = null;
		result = null;
		previewFailed = false;
		forgetStill();
		playing = false;
		// The last file's size must not outlive it. The phone frame is built
		// from this, so a stale one framed a new recording at the old size.
		media = { width: 0, height: 0, duration: 0 };
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		file = dropped;
		previewUrl = URL.createObjectURL(dropped);
		stage = 'idle';
	}

	/** Defaults that need the file: the whole frame, the whole clip, its width. */
	function onLoadedMetadata() {
		if (!video) return;
		// A browser that can decode the sound but not the picture drops the
		// picture without an error and plays the rest, so the recording loads
		// with no size at all. The frame has nothing to fit, which is the same
		// dead end as a file it can't play at all, and it gets the same way out.
		if (tool.op === 'phone' && !(video.videoWidth > 0 && video.videoHeight > 0)) {
			void onPreviewFailed();
			return;
		}
		media = {
			width: video.videoWidth,
			height: video.videoHeight,
			duration: Number.isFinite(video.duration) ? video.duration : 0
		};
		cropBox = { x: 0, y: 0, w: 1, h: 1 };
		scrubAt = 0;
		startSeconds = 0;
		endSeconds = media.duration;
		// A section in the middle, at half pace, so the page opens on something
		// that already means something rather than on a no-op.
		// A section in the middle, retimed by two, so the page opens on something
		// that already means something rather than on a no-op.
		{
			const section = media.duration * 0.5;
			const faster = tool.direction === 'faster';
			setStretch(
				media.duration * 0.25,
				media.duration * 0.75,
				faster ? section / 2 : section * 2
			);
		}
		// Same reasoning for the curve: it opens on the shape somebody means
		// when they say slow motion, ready to be dragged rather than drawn from
		// a flat line.
		rampPoints = defaultRamp(media.duration, faster ? FASTER : SLOWER);
		playhead = 0;
		resizeWidth = Math.min(1280, media.width || 1280);
		textSize = Math.max(16, Math.round((media.height || 720) * 0.06));
		fitPhone();
		if (tool.op === 'phone' && !media.duration) void findLength(video);
	}

	/**
	 * A recording MediaRecorder made has no length in its header. Chrome writes
	 * the WebM as it records and never goes back to fill the length in, so the
	 * element reports Infinity, and ffmpeg prints "Duration: N/A" for the same
	 * file, so it can't say either. The phone preview has no controls of its
	 * own, which left it stuck on the first frame with nothing under it.
	 *
	 * Seeking far past the end makes the browser read to the last frame and
	 * work the length out, and the preview goes back to the start. If that
	 * fails the transport still plays and pauses, it just has no scrubber, and
	 * a length the browser finds by playing to the end arrives through
	 * `onDurationChange`. Only the phone frame asks: the other pages show the
	 * browser's own controls.
	 */
	async function findLength(el: HTMLVideoElement) {
		const forUrl = previewUrl;
		const found = await learnDuration(el);
		if (found && previewUrl === forUrl && tool.op === 'phone') media.duration = found;
	}

	function onDurationChange() {
		if (!video || tool.op !== 'phone' || !media.width) return;
		const length = video.duration;
		if (Number.isFinite(length) && length > 0 && length !== media.duration) media.duration = length;
	}

	/**
	 * A phone for this recording's own size, unless a value was set by hand,
	 * which is kept as far as the new recording has room for it.
	 */
	function fitPhone() {
		if (tool.op !== 'phone' || !media.width) return;
		const start = phoneFrameDefaults(media.width, media.height, { even: true });
		const room = phoneFrameLimits(media.width, media.height, { even: true });
		phoneBezel = phoneBezelTouched ? Math.min(phoneBezel, room.bezelMax) : start.bezel;
		phoneRadius = phoneRadiusTouched ? Math.min(phoneRadius, room.radiusMax) : start.radius;
	}

	function forgetStill() {
		if (still) URL.revokeObjectURL(still);
		still = null;
		unreadable = null;
	}

	/**
	 * The browser can't play the file, which for the phone frame used to be a
	 * dead end: the frame is fitted to what the preview shows. Every browser
	 * refuses AVI and many refuse the HEVC an iPhone records, and ffmpeg reads
	 * both, so it is asked for the first frame instead. It needs the engine
	 * the export needs anyway, so the download is only brought forward.
	 *
	 * Every await is followed by a check that the file is still the one this
	 * started for, since Start over or a new file can land in between.
	 */
	async function onPreviewFailed() {
		if (previewFailed) return;
		previewFailed = true;
		if (tool.op !== 'phone' || !file) return;
		const forFile = file;
		error = null;
		stage = isLoaded() ? 'reading' : 'loading';
		let ff: Awaited<ReturnType<typeof loadFfmpeg>>;
		try {
			ff = await loadFfmpeg((p) => (download = p));
		} catch {
			if (file !== forFile) return;
			unreadable = "The video engine didn't load, so this file can't be read. Check the connection and try again.";
			stage = 'idle';
			return;
		}
		if (file !== forFile) return;
		stage = 'reading';
		try {
			const { blob, probe } = await readStill(ff, forFile);
			const url = URL.createObjectURL(blob);
			const image = new Image();
			image.src = url;
			await image.decode();
			if (file !== forFile) {
				URL.revokeObjectURL(url);
				return;
			}
			still = url;
			media = {
				width: image.naturalWidth,
				height: image.naturalHeight,
				duration: probe.durationSeconds ?? 0
			};
			fitPhone();
		} catch {
			if (file !== forFile) return;
			unreadable =
				"Neither this browser nor the video engine can read that file, so there's nothing to fit the frame to.";
		}
		stage = 'idle';
	}

	function resetPhoneSizes() {
		if (!phoneDefaults) return;
		phoneBezel = phoneDefaults.bezel;
		phoneRadius = phoneDefaults.radius;
		phoneBezelTouched = false;
		phoneRadiusTouched = false;
	}

	/**
	 * Two corrections the preview needs and the export doesn't, because there
	 * the frame and the picture are one image and here they are two layers.
	 *
	 * The video layer snaps to whole device pixels and the canvas's hole does
	 * not, so at 125, 150 or 200 percent zoom one device pixel along each side
	 * of the screen was covered by neither, and the light stage showed through
	 * as a line. So the phone's body is laid under the video in black, the way
	 * `paintPhoneFrame` fills the whole body before it draws the screen, and a
	 * pixel the two layers leave open blends into black as it does in the file.
	 * Its only edge is the phone's outline, where the canvas has the same one.
	 *
	 * The video's own rounding is for see-through corners only. Anywhere else
	 * the canvas covers its square corners, and rounding it anyway put its soft
	 * edge on the same curve as the hole's, which let the stage through there.
	 */
	const phoneBody = $derived(
		phone && phone.bezel > 0
			? `${(phone.outerRadius / phone.width) * 100}% / ${(phone.outerRadius / phone.height) * 100}%`
			: null
	);
	const phoneVideoRadius = $derived(
		phone && phoneTransparent
			? `${(phone.innerRadius / phone.screen.width) * 100}% / ${(phone.innerRadius / phone.screen.height) * 100}%`
			: undefined
	);

	/**
	 * The browser couldn't play the file and there is no still yet, or never
	 * will be. Nothing to preview, so only the controls column is laid out.
	 */
	const phoneBlank = $derived(tool.op === 'phone' && previewFailed && !still);

	/** Where the video, or the still standing in for it, sits in the frame. */
	const phoneScreenStyle = $derived(
		phone
			? [
					`left: ${(phone.screen.x / phone.width) * 100}%`,
					`top: ${(phone.screen.y / phone.height) * 100}%`,
					`width: ${(phone.screen.width / phone.width) * 100}%`,
					`height: ${(phone.screen.height / phone.height) * 100}%`,
					phoneVideoRadius ? `border-radius: ${phoneVideoRadius}` : ''
				]
					.filter(Boolean)
					.join('; ')
			: 'left: 0; top: 0; width: 100%; height: 100%'
	);

	/*
	 * The frame over the preview is painted by the same function that paints
	 * the PNG ffmpeg lays over the video, at the same size, and scaled down by
	 * CSS. Queued to the next frame so dragging a slider paints once per frame
	 * rather than once per input event.
	 */
	let phoneCanvas = $state<HTMLCanvasElement>();
	let phoneQueued = false;
	$effect(() => {
		if (!phone || !phoneCanvas) return;
		void phoneBackground;
		void phoneTransparent;
		if (phoneQueued) return;
		phoneQueued = true;
		requestAnimationFrame(() => {
			phoneQueued = false;
			const ctx = phoneCanvas?.getContext('2d');
			if (!ctx || !phone) return;
			paintPhoneFrame(ctx, phone, { outside: phoneTransparent ? undefined : phoneBackground });
		});
	});

	function togglePlay() {
		if (!video) return;
		if (video.paused) void video.play();
		else video.pause();
	}

	/** Move the marks and the boxes together, so neither can drift. */
	function setStretch(start: number, end: number, targetSeconds: number) {
		stretchStart = Math.max(0, start);
		stretchEnd = Math.max(stretchStart, end);
		stretchTarget = Math.max(0, targetSeconds);
		stretchStartText = formatTimecode(stretchStart);
		stretchEndText = formatTimecode(stretchEnd);
		stretchTargetText = formatTimecode(stretchTarget);
	}

	function setStretchStart(value: number) {
		const limit = Math.max(0, media.duration - STRETCH_MIN_SECONDS);
		const start = Math.min(Math.max(0, value), limit);
		setStretch(start, Math.max(stretchEnd, start + STRETCH_MIN_SECONDS), stretchTarget);
	}

	function setStretchEnd(value: number) {
		const end = Math.min(Math.max(value, stretchStart + STRETCH_MIN_SECONDS), media.duration);
		setStretch(stretchStart, end, stretchTarget);
	}

	function setStretchTarget(value: number) {
		const target = Math.min(STRETCH_MAX_SECONDS, Math.max(STRETCH_MIN_SECONDS, value));
		setStretch(stretchStart, stretchEnd, target);
	}

	/**
	 * A box that was typed into. Anything that isn't a time puts the mark back
	 * where it was rather than silently reading as zero, which would move the
	 * section to the front of the clip on a stray keystroke.
	 */
	function commitTimecode(typed: string, apply: (value: number) => void, current: number) {
		const parsed = parseTimecode(typed);
		apply(parsed === null ? current : parsed);
	}

	/** What the finished file will look like, for the line under the controls. */
	/**
	 * The preview plays the curve.
	 *
	 * `playbackRate` on the element costs nothing and answers the question the
	 * graph cannot: whether the ramp actually looks right. Finding that out by
	 * encoding is a two minute round trip, and this is immediate. Browsers clamp
	 * the rate to roughly a sixteenth and up, so the whole range here is inside
	 * what they will play.
	 */
	function onTimeUpdate() {
		if (!video) return;
		playhead = video.currentTime;
		if (tool.op !== 'stretch' || stretchMode !== 'curve') return;
		const rate = speedAt(rampPoints, video.currentTime);
		if (Math.abs(video.playbackRate - rate) > 0.005) video.playbackRate = rate;
	}

	/** Leaving the curve mode hands the preview back at its own pace. */
	function setStretchMode(mode: 'simple' | 'curve') {
		stretchMode = mode;
		if (mode === 'simple' && video) video.playbackRate = 1;
	}

	const rampInfo = $derived.by(() => {
		if (tool.op !== 'stretch' || stretchMode !== 'curve' || !media.duration) return null;
		const segments = sampleRamp(rampPoints, media.duration, rampRange);
		if (segments.length === 0) return null;
		return {
			total: rampTotal(segments),
			peak: rampPeak(rampPoints),
			pieces: segments.length
		};
	});

	const stretchInfo = $derived.by(() => {
		if (tool.op !== 'stretch' || !media.duration || stretchEnd <= stretchStart) return null;
		const layout = stretchLayout(
			{ kind: 'stretch', startSeconds: stretchStart, endSeconds: stretchEnd, targetSeconds: stretchTarget },
			media.duration
		);
		return {
			section: layout.endSeconds - layout.startSeconds,
			target: layout.targetSeconds,
			stretch: layout.stretch,
			total: stretchedTotal(layout, media.duration)
		};
	});

	async function run() {
		if (!file || !ready) return;
		error = null;
		cancelled = false;
		stage = isLoaded() ? 'working' : 'loading';
		startClock();
		try {
			const ff = await loadFfmpeg((p) => (download = p));
			stage = 'working';
			const edited = await editVideo(ff, file, op, target, {
				// Only the compress tool has a quality control, and its slider was
				// being handed to every other tool as well, so a crop encoded at
				// the compressor's setting rather than the sensible default.
				quality: tool.op === 'compress' ? quality : undefined,
				onProgress: (r) => (workRatio = r)
			});
			result = { blob: edited.blob, name: outName, framesIntact: edited.framesIntact };
			// What ffmpeg said about the run it just finished, so a check in a
			// real browser can see a filter that was refused without erroring.
			ffmpegSaid = lastFfmpegLines(12);
			stage = 'done';
		} catch (thrown) {
			if (cancelled) {
				// Not an error, and the settings are all still there to change.
				stage = 'idle';
				workRatio = 0;
				return;
			}
			const detail = thrown instanceof Error ? thrown.message : '';
			error = detail || 'That file could not be edited';
			stage = 'error';
		} finally {
			stopClock();
		}
	}

	/**
	 * Stop an encode. ffmpeg.wasm has no way to interrupt a run, so this ends
	 * the worker it runs in, and the next run starts a new one out of the
	 * browser's cache. The file and every setting stay as they were.
	 */
	function cancelRun() {
		if (stage !== 'working') return;
		cancelled = true;
		resetFfmpeg();
	}

	function startOver() {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = null;
		previewFailed = false;
		forgetStill();
		playing = false;
		media = { width: 0, height: 0, duration: 0 };
		file = null;
		result = null;
		error = null;
		stage = 'idle';
		workRatio = 0;
	}

	/* ---- dragging the crop frame ----------------------------------------- */
	let frame = $state<HTMLDivElement>();

	function dragCrop(event: PointerEvent, edge: 'move' | 'nw' | 'ne' | 'sw' | 'se') {
		if (!frame) return;
		event.preventDefault();
		const rect = frame.getBoundingClientRect();
		const start = { ...cropBox };
		const from = { x: event.clientX, y: event.clientY };
		const target = event.currentTarget as HTMLElement;
		target.setPointerCapture(event.pointerId);

		const move = (e: PointerEvent) => {
			const dx = (e.clientX - from.x) / rect.width;
			const dy = (e.clientY - from.y) / rect.height;
			const next = { ...start };
			if (edge === 'move') {
				next.x = Math.min(Math.max(0, start.x + dx), 1 - start.w);
				next.y = Math.min(Math.max(0, start.y + dy), 1 - start.h);
			} else {
				const west = edge === 'nw' || edge === 'sw';
				const north = edge === 'nw' || edge === 'ne';
				if (west) {
					const x = Math.min(Math.max(0, start.x + dx), start.x + start.w - 0.05);
					next.w = start.w + (start.x - x);
					next.x = x;
				} else {
					next.w = Math.min(Math.max(0.05, start.w + dx), 1 - start.x);
				}
				if (north) {
					const y = Math.min(Math.max(0, start.y + dy), start.y + start.h - 0.05);
					next.h = start.h + (start.y - y);
					next.y = y;
				} else {
					next.h = Math.min(Math.max(0.05, start.h + dy), 1 - start.y);
				}
			}
			cropBox = next;
		};

		const up = () => {
			target.removeEventListener('pointermove', move);
			target.removeEventListener('pointerup', up);
		};
		target.addEventListener('pointermove', move);
		target.addEventListener('pointerup', up);
	}

	$effect(() => () => {
		stopClock();
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		if (still) URL.revokeObjectURL(still);
	});
</script>

{#snippet status()}
	{#if stage === 'loading'}
		<div class="working" role="status">
			<p class="working-title">Getting the video engine</p>
			<div class="bar"><div class="fill" style:width="{(download.ratio ?? 0) * 100}%"></div></div>
			<p class="working-note">
				{#if download.totalBytes}
					{formatBytes(download.loadedBytes)} of {formatBytes(download.totalBytes)}
				{:else}
					{formatBytes(download.loadedBytes)} so far
				{/if}
				· This is a one time download of about 7MB. Your browser keeps it, so the next video
				starts straight away.
			</p>
		</div>
	{/if}

	{#if stage === 'reading'}
		<div class="working" role="status">
			<p class="working-title">Reading {file?.name}</p>
			<p class="working-note">
				This browser can't play it, so the video engine is reading its first frame to fit the
				phone to.
			</p>
		</div>
	{/if}

	{#if stage === 'working'}
		<div class="working" role="status">
			<p class="working-title">Working on {file?.name}</p>
			<div class="bar"><div class="fill" style:width="{workRatio * 100}%"></div></div>
			<div class="working-row">
				<p class="working-note">{Math.round(workRatio * 100)}% · {elapsed}s</p>
				<button class="btn-ghost cancel" onclick={cancelRun}>Cancel</button>
			</div>
		</div>
	{/if}

	{#if stage === 'error' && error}
		<p class="error" role="alert">
			{error}
			<!-- A tool with a picture twin links to it straight under the panel. -->
			{#if error.includes('picture') && !tool.image}
				<a href="/tools">Use the image tools instead</a>.
			{/if}
		</p>
	{/if}
{/snippet}

<div class="panel">
	{#if !file}
		<Dropzone headline="Drop a video here" multiple={false} accept={videoAcceptAttribute()} {onfiles} />
		<p class="note">
			One file at a time. The video is edited on your own device, so nothing is uploaded and
			there's no size limit beyond what your browser can hold.
		</p>
	{/if}

	{#if file && previewUrl && stage !== 'done'}
		<!--
			The curve is a timeline, so it wants the width of the clip it
			describes rather than the sixteen-rem settings column the other ten
			tools are happy in. In that mode the preview goes full width and the
			curve sits under it.
		-->
		<div
			class="stage"
			class:phone-tool={tool.op === 'phone'}
			class:full={(tool.op === 'stretch' && stretchMode === 'curve') ||
				(tool.op === 'phone' && !!phone && phone.width > phone.height)}
			class:blank={phoneBlank}
		>
			<!--
				The phone's own settings sit apart from the rest of the controls so
				that on a phone they can go above the preview, which is as tall as
				the screen allows. Below it they would be a scroll away from the
				corners they change. On a wider screen they head the column beside it.
			-->
			{#if tool.op === 'phone' && phone && phoneDefaults && phoneLimits}
				<div class="phone-settings">
					<PhoneFrameControls
						bind:bezelOn={phoneBezelOn}
						bind:bezel={phoneBezel}
						bind:radius={phoneRadius}
						defaults={phoneDefaults}
						limits={phoneLimits}
						bezelStep={2}
						ontouch={(which) =>
							which === 'bezel' ? (phoneBezelTouched = true) : (phoneRadiusTouched = true)}
						onreset={resetPhoneSizes}
						disabled={busy}
					/>
				</div>
			{/if}
			<div class="viewer">
			{#if tool.op === 'phone'}
				<!--
					The recording plays under a canvas with the frame painted on it,
					the same frame ffmpeg is handed, so the preview is the export
					rather than an impression of it. No native controls: their bar
					would sit under the rounded corners, so the transport is below.
				-->
				<div class="phone-stage" class:gone={phoneBlank}>
					{#if phoneBordered}
						<!-- Holds the column at the bordered phone's size. Never drawn on. -->
						<canvas class="room" width={phoneBordered.width} height={phoneBordered.height} aria-hidden="true"></canvas>
					{/if}
					<div
						class="phone"
						class:checker={phoneTransparent}
						role="group"
						aria-label="Preview of the recording in its phone frame"
					>
						{#if phoneBody}
							<span class="phone-body" style:border-radius={phoneBody} style:background={BEZEL_COLOUR}></span>
						{/if}
						{#if still}
							<!-- What ffmpeg read, since the browser couldn't play the file. -->
							<img class="screen" src={still} alt="" style={phoneScreenStyle} />
						{:else}
							<!-- svelte-ignore a11y_media_has_caption, a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
							<video
								class="screen"
								bind:this={video}
								src={previewUrl}
								playsinline
								loop
								onloadedmetadata={onLoadedMetadata}
								ondurationchange={onDurationChange}
								ontimeupdate={onTimeUpdate}
								onplay={() => (playing = true)}
								onpause={() => (playing = false)}
								onerror={() => void onPreviewFailed()}
								onclick={togglePlay}
								style={phoneScreenStyle}
							></video>
						{/if}
						<canvas
							bind:this={phoneCanvas}
							width={phone?.width ?? 900}
							height={phone?.height ?? 1950}
							aria-hidden="true"
						></canvas>
					</div>
				</div>
				<!--
					Whenever the recording plays, whether or not its length is known.
					Only the scrubber needs the length, so only the scrubber waits.
				-->
				{#if media.width && !previewFailed}
					<div class="transport">
						<button class="chip" onclick={togglePlay}>{playing ? 'Pause' : 'Play'}</button>
						{#if media.duration}
							<input
								type="range"
								min="0"
								max={media.duration}
								step="0.01"
								value={playhead}
								aria-label="Move through the video"
								oninput={(e) => video && (video.currentTime = Number(e.currentTarget.value))}
							/>
						{/if}
						<span class="mono">{formatTimecode(playhead)}</span>
					</div>
				{/if}
				{#if phone && still}
					<p class="hint">
						This browser can't play the file, so the preview is its first frame. The whole
						recording goes in the frame.
					</p>
				{/if}
				{#if phone}
					<p class="readout phone-readout">
						<span class="mono">{media.width} × {media.height}</span>
						<span class="arrow" aria-hidden="true">→</span>
						<span class="mono size">{phone.width} × {phone.height} px</span>
						<span class="mono">· {target.name}</span>
					</p>
				{/if}
			{:else}
			<!-- svelte-ignore a11y_media_has_caption -->
			<div class="preview" bind:this={frame}>
				<video
					bind:this={video}
					src={previewUrl}
					controls={tool.op !== 'crop'}
					playsinline
					onloadedmetadata={onLoadedMetadata}
					ontimeupdate={onTimeUpdate}
					style:filter={tool.op === 'blur' ? `blur(${blurStrength * 0.6}px)` : undefined}
					style:transform={tool.op === 'rotate'
						? `rotate(${quarterTurns * 90}deg) scaleX(${flipHorizontal ? -1 : 1}) scaleY(${flipVertical ? -1 : 1})`
						: undefined}
				></video>

				{#if tool.op === 'crop' && media.width}
					<div
						class="cropframe"
						role="application"
						aria-label="Crop frame. Drag to move, drag a corner to resize."
						style:left="{cropBox.x * 100}%"
						style:top="{cropBox.y * 100}%"
						style:width="{cropBox.w * 100}%"
						style:height="{cropBox.h * 100}%"
						onpointerdown={(e) => dragCrop(e, 'move')}
					>
						{#each ['nw', 'ne', 'sw', 'se'] as const as corner (corner)}
							<span
								class="handle {corner}"
								role="button"
								tabindex="-1"
								aria-label="Resize from the {corner} corner"
								onpointerdown={(e) => {
									e.stopPropagation();
									dragCrop(e, corner);
								}}
							></span>
						{/each}
					</div>
				{/if}

				{#if tool.op === 'text' && text.trim()}
					<span
						class="caption {textPosition}"
						class:boxed={textBox}
						style:color={textColour}
						style:font-size="{(textSize / (media.height || 720)) * 100}cqh"
					>{text}</span>
				{/if}
			</div>

			{#if tool.op === 'crop' && media.duration}
				<!--
					The native controls are hidden here because the bar sits exactly
					where the two bottom handles are. Picking a frame to judge the
					crop against is all this needs, so it gets a scrubber instead.
				-->
				<label class="scrub">
					<span class="mono">{scrubAt.toFixed(1)}s</span>
					<input
						type="range"
						min="0"
						max={media.duration}
						step="0.1"
						bind:value={scrubAt}
						aria-label="Move through the video"
						oninput={() => video && (video.currentTime = scrubAt)}
					/>
				</label>
			{/if}
			{/if}
			</div>

			<div class="controls">
				{#if tool.op === 'trim'}
					<SliderField
						label="Start"
						bind:value={startSeconds}
						min={0}
						max={media.duration}
						step={0.1}
						format={formatTimecode}
						parse={(t) => parseTimecode(t)}
					/>
					<SliderField
						label="End"
						bind:value={endSeconds}
						min={0}
						max={media.duration}
						step={0.1}
						format={formatTimecode}
						parse={(t) => parseTimecode(t)}
					/>
					<label class="check">
						<input type="checkbox" bind:checked={exactTrim} />
						<span>Cut exactly where I set it. Slower, because it re-encodes.</span>
					</label>
					<p class="hint">
						{#if exactTrim}
							The clip is re-encoded so it starts precisely on your mark.
						{:else}
							Cuts on the nearest keyframe, which copies both streams and takes about a second.
						{/if}
					</p>
				{/if}

				{#if tool.op === 'crop'}
					<p class="readout mono">
						{cropPixels.width} × {cropPixels.height} from {cropPixels.x}, {cropPixels.y}
					</p>
					<div class="row">
						{#each [{ label: 'Square', r: 1 }, { label: '16:9', r: 16 / 9 }, { label: '9:16', r: 9 / 16 }, { label: '4:5', r: 4 / 5 }] as preset (preset.label)}
							<button
								class="chip"
								onclick={() => {
									const aspect = (media.width || 1) / (media.height || 1);
									const w = Math.min(1, preset.r / aspect);
									const h = Math.min(1, aspect / preset.r);
									cropBox = { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
								}}>{preset.label}</button
							>
						{/each}
						<button class="chip" onclick={() => (cropBox = { x: 0, y: 0, w: 1, h: 1 })}>Whole frame</button>
					</div>
				{/if}

				{#if tool.op === 'resize'}
					<SliderField
						label="Width"
						bind:value={resizeWidth}
						min={160}
						max={Math.max(1920, media.width || 1920)}
						step={2}
						unit="px"
					/>
					<div class="row">
						{#each [426, 640, 854, 1280, 1920] as w (w)}
							<button class="chip" onclick={() => (resizeWidth = w)}>{w}</button>
						{/each}
					</div>
					<p class="hint">
						The height follows so nothing is stretched.
						{#if media.width}
							Result about {resizeWidth} × {Math.round((resizeWidth / media.width) * media.height / 2) * 2}.
						{/if}
					</p>
				{/if}

				{#if tool.op === 'speed'}
					<SliderField
						label="Speed"
						bind:value={speedFactor}
						min={SPEED_MIN}
						max={SPEED_MAX}
						step={0.05}
						unit="×"
						decimals={2}
					/>
					<p class="hint">
						{#if media.duration}
							{media.duration.toFixed(1)}s becomes about {(media.duration / speedFactor).toFixed(1)}s.
						{/if}
					</p>
				{/if}

				{#if tool.op === 'stretch'}
					<!--
						Two ways of saying the same thing, so the one that fits what
						somebody already knows is the one they use. A length is what
						you know when the interesting part is a fixed clip. A curve is
						what you want when the point is the easing itself.
					-->
					<div class="modes" role="tablist" aria-label="How to describe the slowdown">
						{#each [['simple', 'Section and length'], ['curve', 'Speed curve']] as const as [mode, label] (mode)}
							<button
								role="tab"
								class="mode"
								class:on={stretchMode === mode}
								aria-selected={stretchMode === mode}
								onclick={() => setStretchMode(mode)}
							>
								{label}
							</button>
						{/each}
					</div>
				{/if}

				{#if tool.op === 'stretch' && stretchMode === 'curve'}
					<RampCurve
						points={rampPoints}
						duration={media.duration}
						range={rampRange}
						{playhead}
						onchange={(next) => (rampPoints = next)}
					/>
					<p class="hint">
						{#if rampInfo}
							{faster ? 'Fastest' : 'Slowest'} {rampInfo.peak.toFixed(2)}×, and the clip runs
							{formatTimecode(rampInfo.total)} instead of {formatTimecode(media.duration)}.
							{#if rampInfo.pieces > 1}
								It's cut into {rampInfo.pieces} pieces to follow the curve.
							{/if}
						{:else}
							Press play on the preview to watch the curve before you commit to it.
						{/if}
					</p>
				{/if}

				{#if tool.op === 'stretch' && stretchMode === 'simple'}
					<!--
						Timecodes as well as sliders, because somebody who already knows
						the interesting part starts at 2:32 knows it as 2:32. The boxes
						hold text so a half typed value does not jump the mark about,
						and only a value that parses is committed.
					-->
					<SliderField
						label={faster ? 'Fast part starts' : 'Slow part starts'}
						bind:value={stretchStart}
						min={0}
						max={media.duration}
						step={0.1}
						format={formatTimecode}
						parse={(t) => parseTimecode(t)}
						oninput={setStretchStart}
					/>
					<SliderField
						label="and stops"
						bind:value={stretchEnd}
						min={0}
						max={media.duration}
						step={0.1}
						format={formatTimecode}
						parse={(t) => parseTimecode(t)}
						oninput={setStretchEnd}
					/>
					<div class="field">
						<span>
							and should run for
							<input
								class="tc mono"
								type="text"
								inputmode="decimal"
								aria-label="How long the retimed part should run"
								bind:value={stretchTargetText}
								onchange={() => commitTimecode(stretchTargetText, setStretchTarget, stretchTarget)}
							/>
						</span>
					</div>
					<div class="row">
						{#each [2, 4, 10, 20] as times (times)}
							<button
								class="chip"
								onclick={() =>
									setStretchTarget(
										faster ? (stretchEnd - stretchStart) / times : (stretchEnd - stretchStart) * times
									)}
							>
								{times}× {faster ? 'faster' : 'slower'}
							</button>
						{/each}
					</div>
					<p class="hint">
						Type a timecode like 2:32, or plain seconds. Every part of the clip outside the
						section keeps its own pace.
						{#if stretchInfo}
							<br />
							{stretchInfo.section.toFixed(1)}s becomes {stretchInfo.target.toFixed(1)}s, which is
							{(stretchInfo.stretch < 1 ? 1 / stretchInfo.stretch : stretchInfo.stretch).toFixed(1)}×
							{stretchInfo.stretch < 1 ? 'faster' : 'slower'}, and the whole clip runs
							{formatTimecode(stretchInfo.total)} instead of {formatTimecode(media.duration)}.
						{/if}
					</p>
				{/if}

				{#if tool.op === 'fps'}
					<div class="row">
						{#each [15, 24, 25, 30, 50, 60] as rate (rate)}
							<button class="chip" class:on={fps === rate} onclick={() => (fps = rate)}>{rate}</button>
						{/each}
					</div>
					<p class="hint">The clip stays the same length. Fewer frames a second means a smaller file.</p>
				{/if}

				{#if tool.op === 'rotate'}
					<div class="row">
						<button class="chip" onclick={() => (quarterTurns = (quarterTurns + 1) % 4)}>Turn right</button>
						<button class="chip" onclick={() => (quarterTurns = (quarterTurns + 3) % 4)}>Turn left</button>
						<button class="chip" class:on={flipHorizontal} onclick={() => (flipHorizontal = !flipHorizontal)}>Mirror</button>
						<button class="chip" class:on={flipVertical} onclick={() => (flipVertical = !flipVertical)}>Flip</button>
					</div>
				{/if}

				{#if tool.op === 'blur'}
					<SliderField label="Strength" bind:value={blurStrength} min={BLUR_MIN} max={BLUR_MAX} />
					<p class="hint">The preview is close. The finished file is blurred by ffmpeg, not the browser.</p>
				{/if}

				{#if tool.op === 'text'}
					<label class="field">
						<span>Text</span>
						<input type="text" bind:value={text} placeholder="Your caption" maxlength="120" />
					</label>
					<SliderField
						label="Size"
						bind:value={textSize}
						min={12}
						max={Math.max(120, Math.round((media.height || 720) * 0.2))}
						unit="px"
					/>
					<div class="row">
						{#each ['top', 'centre', 'bottom'] as const as pos (pos)}
							<button class="chip" class:on={textPosition === pos} onclick={() => (textPosition = pos)}>{pos}</button>
						{/each}
						<label class="swatch">
							<input type="color" bind:value={textColour} aria-label="Text colour" />
						</label>
						<button class="chip" class:on={textBox} onclick={() => (textBox = !textBox)}>Backing box</button>
					</div>
				{/if}

				{#if tool.op === 'compress'}
					<SliderField label="Quality" bind:value={quality} min={18} max={40} />
					<p class="hint">Lower is better quality and a bigger file. 28 is a sensible middle.</p>
				{/if}

				{#if tool.op === 'mute'}
					<p class="hint">Nothing to set. The picture is copied untouched and the sound is left out.</p>
				{/if}

				{#if tool.op === 'phone' && unreadable}
					<p class="error" role="alert">{unreadable}</p>
					<div class="row">
						<button class="btn-ghost" onclick={startOver}>Try another video</button>
					</div>
				{/if}

				{#if tool.op === 'phone' && phone}
					<!-- A fieldset so one attribute holds the colour chips still too. -->
					<fieldset class="corners" disabled={busy}>
						{#if !phoneTransparent}
							<BackgroundPicker bind:value={phoneBackground} label="Corners" />
						{/if}
						<label class="check">
							<input type="checkbox" bind:checked={phoneTransparent} />
							<span>See-through corners, saved as WebM</span>
						</label>
						<p class="hint">
							{#if phoneTransparent}
								Chrome and Edge play it with the corners see-through. Safari doesn't.
							{:else}
								Match the colour to the slide or page the video will sit on.
							{/if}
						</p>
					</fieldset>
				{/if}

				<!-- A phone frame has nothing to set until the recording has a size. -->
				{#if (stage === 'idle' || stage === 'error') && (tool.op !== 'phone' || phone)}
					<button class="btn" onclick={run} disabled={!ready}>
						{ready ? (tool.action ?? tool.name) : 'Set something first'}
					</button>
					{#if !tool.keepsFrames}
						<p class="hint">
							This re-encodes every frame, so it takes seconds to minutes depending on the clip.
						</p>
					{/if}
				{/if}
				{#if statusBesideControls}{@render status()}{/if}
			</div>
		</div>
	{/if}

	{#if !statusBesideControls}{@render status()}{/if}

	{#if stage === 'done' && result && file}
		<div class="result">
			<div class="result-main">
				<span class="result-name mono">{result.name}</span>
				<span class="result-meta">
					{formatBytes(file.size)} <span class="arrow">→</span> {formatBytes(result.blob.size)}
					{#if saving > 0}<span class="pill">−{saving}%</span>{/if}
					<span class="dim">· {elapsed}s</span>
				</span>
				{#if result.framesIntact}
					<span class="result-note">
						The picture was copied untouched, which is why it finished so quickly. Every frame
						is identical to the original.
					</span>
				{/if}
			</div>
			<p class="ffmpeg-log" data-testid="ffmpeg-log" hidden>{ffmpegSaid.join('\n')}</p>
			<div class="result-actions">
				<button class="btn" onclick={() => downloadBlob(result!.blob, result!.name)}>Download</button>
				<button class="btn-ghost" onclick={startOver}>Start over</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.note {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--muted);
		max-width: 60ch;
	}

	.working {
		background: var(--surface);
		border-radius: var(--r-m);
		padding: 1.1rem 1.15rem;
	}

	.working-title {
		margin: 0 0 0.6rem;
		font-size: 0.9375rem;
		font-weight: 600;
	}

	.bar {
		height: 6px;
		border-radius: 99px;
		background: var(--surface-deep);
		overflow: hidden;
	}

	.fill {
		height: 100%;
		background: var(--primary);
		border-radius: 99px;
		transition: width 200ms var(--ease);
	}

	.working-note {
		margin: 0.55rem 0 0;
		font-size: 0.8125rem;
		color: var(--muted);
		max-width: 60ch;
	}

	/* The count on the left and the way out on the right, under the bar. */
	.working-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1rem;
		margin-top: 0.55rem;
	}

	.working-row .working-note {
		margin: 0;
	}

	.cancel {
		padding: 0.3rem 0.75rem;
		font-size: 0.8125rem;
	}

	.result {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem 1rem;
		padding: 0.85rem 1rem;
		background: var(--surface);
		border-radius: var(--r-m);
	}

	.result-main {
		min-width: 0;
	}

	.result-name {
		display: block;
		font-size: 0.9375rem;
	}

	.result-meta,
	.result-note {
		display: block;
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.result-note {
		margin-top: 0.2rem;
	}

	.pill {
		color: var(--accent);
		font-weight: 600;
	}

	.dim {
		color: var(--muted);
	}

	.result-actions {
		display: flex;
		gap: 0.5rem;
	}

	.error {
		margin: 0;
		color: var(--danger);
		font-size: 0.875rem;
	}

	/* The preview and its settings, side by side once there is room. */
	.stage {
		display: grid;
		gap: 1rem;
		grid-template-columns: minmax(0, 1.4fr) minmax(16rem, 1fr);
		align-items: start;
	}

	/*
	 * A portrait phone is narrow, so its column is the phone's width rather
	 * than a share of the row. At 1.4fr the column was a third wider than the
	 * phone and squeezed the controls until they wrapped, which pushed the
	 * button and the progress bar under the fold on a 1280 × 800 laptop.
	 */
	.stage.phone-tool {
		grid-template-columns: auto minmax(16rem, 1fr);
		/* The phone's settings over the rest of the controls, the preview beside both. */
		grid-template-rows: auto 1fr;
		grid-template-areas:
			'viewer settings'
			'viewer controls';
	}

	.stage.phone-tool > .viewer {
		grid-area: viewer;
	}

	.stage.phone-tool > .phone-settings {
		grid-area: settings;
	}

	.stage.phone-tool > .controls {
		grid-area: controls;
	}

	.stage.full,
	.stage.phone-tool.full {
		grid-template-columns: minmax(0, 1fr);
	}

	.stage.phone-tool.full {
		grid-template-rows: none;
		grid-template-areas: 'viewer' 'settings' 'controls';
	}

	@media (max-width: 46rem) {
		.stage,
		.stage.phone-tool {
			grid-template-columns: 1fr;
		}

		/*
		 * A portrait phone on a phone: the settings go above the preview. Under
		 * it they started 1,060 px down a 844 px screen, so nothing that could
		 * be changed was in view once a recording was loaded. Above it, the
		 * sliders are in view and the top corners they change are just below.
		 * A wide recording's preview is short enough to keep first.
		 */
		.stage.phone-tool:not(.full) {
			grid-template-rows: none;
			grid-template-areas: 'settings' 'viewer' 'controls';
		}
	}

	/*
	 * Nothing to preview yet, or at all. The empty viewer and settings rows
	 * each still cost a gap, which left a blank band above the status line.
	 * After the phone rules, so this wins at every width.
	 */
	.stage.phone-tool.blank {
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: none;
		grid-template-areas: 'controls';
	}

	.stage.phone-tool.blank > .viewer {
		display: none;
	}

	/*
	 * container-type so a caption can be sized in cqh, which is what keeps the
	 * preview honest: the text is set in pixels of the real frame, and the
	 * preview is some other size entirely.
	 */
	.viewer {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}

	.preview {
		position: relative;
		background: var(--surface-deep);
		border-radius: var(--r-m);
		overflow: hidden;
		container-type: size;
		aspect-ratio: 16 / 9;
	}

	.preview video {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	/*
	 * Everything outside the frame is dimmed by the frame's own shadow, spread
	 * far enough to cover the preview and clipped by its overflow. This was a
	 * clip-path polygon that traced the outside and then the hole, which does
	 * nothing: polygon fills by nonzero winding, so the second path does not
	 * cut anything out and the dimming never appeared at all.
	 */
	.cropframe {
		position: absolute;
		border: 2px solid var(--primary);
		box-shadow: 0 0 0 100vmax rgb(0 0 0 / 0.45);
		cursor: move;
		touch-action: none;
	}

	.handle {
		position: absolute;
		width: 14px;
		height: 14px;
		background: var(--primary);
		border-radius: 3px;
		touch-action: none;
	}

	.handle.nw { top: -8px; left: -8px; cursor: nwse-resize; }
	.handle.ne { top: -8px; right: -8px; cursor: nesw-resize; }
	.handle.sw { bottom: -8px; left: -8px; cursor: nesw-resize; }
	.handle.se { bottom: -8px; right: -8px; cursor: nwse-resize; }

	.caption {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		max-width: 92%;
		text-align: center;
		font-weight: 700;
		line-height: 1.2;
		pointer-events: none;
		white-space: pre-wrap;
	}

	.caption.top { top: 6%; }
	.caption.centre { top: 50%; transform: translate(-50%, -50%); }
	.caption.bottom { bottom: 6%; }

	.caption.boxed {
		background: rgb(0 0 0 / 0.5);
		padding: 0.15em 0.5em;
		border-radius: 4px;
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.8125rem;
	}

	.field > span {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		color: var(--muted);
	}

	.field input[type='text'] {
		font: inherit;
		padding: 0.4rem 0.55rem;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		background: var(--surface);
	}

	/* Narrow enough that three of them read as marks rather than as a form. */
	.tc {
		font: inherit;
		font-size: 0.8125rem;
		width: 6.5rem;
		text-align: right;
		padding: 0.15rem 0.35rem;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		background: var(--surface);
		color: inherit;
	}

	.check {
		display: flex;
		align-items: start;
		gap: 0.45rem;
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		align-items: center;
	}

	.chip {
		font: inherit;
		font-size: 0.8125rem;
		padding: 0.3rem 0.6rem;
		border: 1px solid var(--line);
		border-radius: 99px;
		background: var(--surface);
		cursor: pointer;
	}

	/* Two modes of one tool, so an underline rather than two pill buttons:
	   a segmented control would read as two things to pick between, and these
	   are two views of the same edit. */
	.modes {
		display: flex;
		gap: 0.25rem;
		border-bottom: 1px solid var(--line);
		margin-bottom: 0.2rem;
	}

	.mode {
		font: inherit;
		font-size: 0.875rem;
		padding: 0.45rem 0.6rem;
		border: 0;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		background: none;
		color: var(--muted);
		cursor: pointer;
		transition:
			color 150ms var(--ease),
			border-color 150ms var(--ease);
	}

	.mode:hover {
		color: var(--ink);
	}

	.mode.on {
		color: var(--ink);
		border-bottom-color: var(--primary);
		font-weight: 600;
	}

	.chip.on {
		border-color: var(--primary);
		color: var(--primary);
	}

	.swatch input {
		width: 2rem;
		height: 1.9rem;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		background: none;
		cursor: pointer;
	}

	.scrub {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.scrub input {
		flex: 1;
	}

	.hint,
	.readout {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--muted);
	}

	/*
	 * The phone preview. Sized by the canvas, the way the screenshot page is:
	 * a canvas the size of the output, scaled down to fit, which keeps its own
	 * proportions under both limits. The video sits underneath it at the
	 * screen's place as a share of the whole, so the two scale together.
	 */
	.phone-stage {
		/* One cell, so the phone sits over the space kept for it. */
		display: grid;
		place-items: center;
		padding: 1rem;
		background-color: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--r-m);
	}

	/* Kept in the page so the video element stays put, but an empty box the
	   height of the screen is no use to anybody. */
	.phone-stage.gone {
		display: none;
	}

	.phone-stage > * {
		grid-area: 1 / 1;
	}

	.phone {
		position: relative;
		line-height: 0;
		max-width: 100%;
	}

	/* Sized by the same rules as the phone's own canvas below. */
	.phone canvas,
	.room {
		position: relative;
		display: block;
		max-width: 100%;
		max-height: 62vh;
		pointer-events: none;
	}

	.room {
		visibility: hidden;
	}

	/* Under the video, so a pixel the two layers leave open is black. */
	.phone-body {
		position: absolute;
		inset: 0;
	}

	.phone .screen {
		position: absolute;
		object-fit: cover;
		object-position: 0 0;
	}

	.phone video {
		cursor: pointer;
	}

	@media (max-width: 40rem) {
		.phone canvas,
		.room {
			max-height: 52vh;
		}
	}

	.transport {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.transport input {
		flex: 1;
		accent-color: var(--primary);
	}

	.transport .chip {
		min-width: 4.2rem;
	}

	.phone-readout {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0 0.45rem;
	}

	.readout .size {
		color: var(--ink);
		font-weight: 600;
	}

	.corners {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		min-width: 0;
		margin: 0;
		padding: 0.85rem 0 0;
		border: 0;
		border-top: 1px solid var(--line);
	}

	/* The same olive tick as the border switch above it. */
	.corners .check input {
		margin: 0.15rem 0 0;
		accent-color: var(--primary);
	}

	.phone-settings {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}

	/* Across the page under a wide recording: the two sliders share a row. */
	.stage.full .phone-settings {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
		gap: 0.9rem 1.5rem;
	}

	.stage.full .phone-settings > :global(*:not(.field)) {
		grid-column: 1 / -1;
	}

	/* Its own row, but the width of its words like every other main button. */
	.stage.phone-tool.full .controls > .btn {
		align-self: flex-start;
	}
</style>
