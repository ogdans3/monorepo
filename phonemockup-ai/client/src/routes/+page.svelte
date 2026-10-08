<script lang="ts">
    import {Button} from "$lib/components/ui/button";
    import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "$lib/components/ui/card";
    import {
        Accordion,
        AccordionContent,
        AccordionItem,
        AccordionTrigger,
    } from "$lib/components/ui/accordion";
    import {
        ArrowRight,
        Check,
        Sparkles,
        Layers,
        Film,
        Image as ImageIcon,
        Box,
        Wand2,
        Download,
        Upload,
        Play,
    } from "@lucide/svelte";

    import animationGroups from "$lib/animations/animations.svelte";
    import type {AnimationGroup} from "$lib/components/mock-video/Animation";
    import AnimationGroupPreview from "$lib/components/mock-video/AnimationGroupPreview.svelte";
    import Logo from "$lib/components/Logo.svelte";

    const highlightedCount = 6;
    const topAnimations: AnimationGroup[] = [...animationGroups]
        .toSorted((a, b) => {
            if (Number(b.isOfficial) - Number(a.isOfficial) !== 0) {
                return Number(b.isOfficial) - Number(a.isOfficial);
            }
            return (b.priority ?? 0) - (a.priority ?? 0);
        })
        .slice(0, highlightedCount);

    const valueProps = [
        {
            icon: Sparkles,
            title: "Free while in beta",
            body:
                "Every feature is unlocked. No watermark, no attribution, no credit card. " +
                "We'll add paid tiers later — current users keep what they're using.",
        },
        {
            icon: Box,
            title: "Runs in your browser",
            body:
                "Three.js renders the scene locally on your GPU. Your assets never leave " +
                "your machine until you choose to save a project.",
        },
        {
            icon: Download,
            title: "Export anywhere",
            body:
                "MP4, WebM, animated GIF, or transparent PNG. Single shots or bulk queues. " +
                "App-store-ready resolutions out of the box.",
        },
    ];

    const capabilities = [
        {
            icon: Film,
            title: "Animation timeline",
            body:
                "Keyframe position, rotation, and opacity with cubic-bezier easing. " +
                "Scrub, loop, and preview in real time.",
        },
        {
            icon: Layers,
            title: "Premade presets",
            body:
                `${animationGroups.length} ready-made animations — spin, zoom, reveal, ` +
                "fly-in. Drop one onto your screen and tweak from there.",
        },
        {
            icon: ImageIcon,
            title: "Screen capture",
            body:
                "Drop a video, image, or GIF onto a phone face. Composites at full " +
                "fidelity with correct masking and reflections.",
        },
        {
            icon: Wand2,
            title: "Material controls",
            body:
                "Color, finish, lighting, and reflection per device. Bring multiple " +
                "phones into a single scene.",
        },
        {
            icon: Box,
            title: "Multiple device models",
            body:
                "iPhone 17 Pro Max, Pixel 10, and more. Swap models without losing " +
                "your animation or screen content.",
        },
        {
            icon: Download,
            title: "Bulk export queue",
            body:
                "Render many animations or many screens in one batch. Each output " +
                "downloads as it finishes.",
        },
    ];

    const steps = [
        {
            n: "01",
            icon: Upload,
            title: "Drop your screen",
            body: "A video, image, or GIF — drag it in. It maps onto the phone face automatically.",
        },
        {
            n: "02",
            icon: Wand2,
            title: "Pick an animation",
            body: "Start from a preset or build keyframes by hand on the timeline.",
        },
        {
            n: "03",
            icon: Download,
            title: "Export",
            body: "MP4, WebM, GIF, or PNG. Single render or bulk queue.",
        },
    ];

    const faqs = [
        {
            q: "Is it really free?",
            a:
                "Yes. While PhoneMockup.app is in beta every feature is free with no " +
                "watermark and no attribution required. We plan to add paid tiers later " +
                "for things like cloud render queues and team workspaces — anything you " +
                "use today will keep working on a generous free tier.",
        },
        {
            q: "Do I need an account?",
            a:
                "No. The editor runs entirely in your browser; you can render and " +
                "download without signing in. An account only unlocks saving projects " +
                "to the cloud and accessing them from another device.",
        },
        {
            q: "What can I export?",
            a:
                "Images (PNG, JPG, transparent PNG sequences) and video (MP4, WebM, GIF). " +
                "Single renders or bulk queues are both available.",
        },
        {
            q: "Can I import my own device frames?",
            a:
                "Custom-frame upload is on the roadmap. Today you can choose between " +
                "the bundled iPhone and Pixel models and adjust color, finish, and lighting.",
        },
        {
            q: "What about easing curves?",
            a:
                "Linear, ease-in, ease-out, ease-in-out, and a SineInOut preset are " +
                "built in. Custom cubic-bezier authoring is coming.",
        },
        {
            q: "Where does my data go?",
            a:
                "The editor is local-first. Rendering happens on your GPU; nothing leaves " +
                "your browser unless you sign in and explicitly save a project to the cloud.",
        },
    ];

    const productSchema = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: "PhoneMockup.app",
        url: "https://phonemockup.app/",
        image: ["https://phonemockup.app/og-cover.jpg"],
        description:
            "Browser-based 3D phone mockup generator. Animate, render, and export images and video. Free during beta.",
        offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
            description: "Free while in beta — no attribution required.",
        },
        brand: {"@type": "Brand", name: "PhoneMockup.app"},
    };

    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: {"@type": "Answer", text: f.a},
        })),
    };

    /** A JSON-LD script element; `<` is escaped so no string can close it early. */
    function jsonLd(data: unknown) {
        const json = JSON.stringify(data).replace(/</g, "\\u003c");
        return `<script type="application/ld+json">${json}</` + `script>`;
    }
</script>

<svelte:head>
    <title>
        PhoneMockup.app — Free Phone Mockup Generator. Browser-based 3D Phone
                Mockups with Animation, Video, and Bulk Export.
    </title>
    <meta
            name="description"
            content="Create professional phone mockups in your browser. Animate, render, and export MP4, WebM, GIF, or PNG. Free while in beta — no watermark, no attribution, no signup."
    />
    <meta
            name="keywords"
            content="phone mockup free no attribution, smartphone mockup, device mockup, app previews, app store screenshots, UI mockup, 3D phone mockup, video mockup"
    />
    <meta property="og:title" content="PhoneMockup.app — Free Phone Mockup Generator"/>
    <meta
            property="og:description"
            content="Browser-based 3D phone mockups with custom video, images, and animations. Free while in beta — no attribution required."
    />
    <meta property="og:type" content="website"/>
    <meta property="og:url" content="https://phonemockup.app/"/>
    <meta property="og:image" content="https://phonemockup.app/og-cover.jpg"/>
    <meta name="twitter:card" content="summary_large_image"/>
    <meta name="twitter:title" content="PhoneMockup.app — Free Phone Mockup Generator"/>
    <meta
            name="twitter:description"
            content="Browser-based 3D phone mockups. Animate, render, export. Free while in beta."
    />
    <meta name="twitter:image" content="https://phonemockup.app/og-cover.jpg"/>
    <link rel="canonical" href="https://phonemockup.app/"/>

    <!-- Markup inside a script element is raw text to Svelte, so the JSON-LD
         has to go in as HTML or it ships as literal source. -->
    {@html jsonLd(productSchema)}
    {@html jsonLd(faqSchema)}
</svelte:head>

<div class="min-h-screen bg-background text-foreground">
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
            <a href="/" class="inline-flex items-center" aria-label="PhoneMockup.app home">
                <Logo/>
            </a>
            <nav class="hidden items-center gap-7 text-sm text-muted-foreground md:flex" aria-label="Primary">
                <a href="#features" class="transition hover:text-foreground">Features</a>
                <a href="/platform/animation" class="transition hover:text-foreground">Animations</a>
                <a href="#how" class="transition hover:text-foreground">How it works</a>
                <a href="#faq" class="transition hover:text-foreground">FAQ</a>
            </nav>
            <div class="flex items-center gap-2">
                <a href="/platform/project" class="hidden sm:inline-flex">
                    <Button variant="ghost" size="sm" class="text-sm">My projects</Button>
                </a>
                <a href="/platform/animation/still">
                    <Button size="sm" class="text-sm">
                        Start creating
                        <ArrowRight class="ml-1 h-4 w-4"/>
                    </Button>
                </a>
            </div>
        </div>
    </header>

    <!-- Hero -->
    <section
            class="relative overflow-hidden border-b border-border/60"
            aria-labelledby="hero-title"
    >
        <div class="absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)] pointer-events-none"
             aria-hidden="true">
            <div class="h-full w-full bg-grid"></div>
        </div>

        <div class="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:py-28 lg:grid-cols-12">
            <div class="lg:col-span-7">
                <a href="#faq"
                   class="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1 text-xs text-muted-foreground transition hover:border-border hover:text-foreground">
                    <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    Free while in beta — every feature, no signup
                </a>

                <h1
                        id="hero-title"
                        class="mt-6 text-balance text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl"
                >
                    Phone mockups, rendered in your browser.
                </h1>

                <p class="mt-5 max-w-xl text-balance text-lg text-muted-foreground md:text-xl">
                    A 3D phone mockup studio with a real animation timeline. Drop in your
                    screen, pick a preset, export MP4, WebM, GIF, or PNG. No watermark.
                </p>

                <div class="mt-8 flex flex-wrap items-center gap-3">
                    <a href="/platform/animation/still">
                        <Button size="lg" class="h-11 px-6 text-sm font-medium">
                            Start creating — it's free
                            <ArrowRight class="ml-1.5 h-4 w-4"/>
                        </Button>
                    </a>
                    <a href="#demo">
                        <Button variant="outline" size="lg" class="h-11 px-6 text-sm font-medium">
                            <Play class="mr-1.5 h-4 w-4"/>
                            Watch the demo
                        </Button>
                    </a>
                </div>

                <ul class="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                    <li class="inline-flex items-center gap-2">
                        <Check class="h-4 w-4 text-foreground/70"/>
                        No attribution
                    </li>
                    <li class="inline-flex items-center gap-2">
                        <Check class="h-4 w-4 text-foreground/70"/>
                        No signup required
                    </li>
                    <li class="inline-flex items-center gap-2">
                        <Check class="h-4 w-4 text-foreground/70"/>
                        MP4, WebM, GIF, PNG
                    </li>
                </ul>
            </div>

            <div class="lg:col-span-5">
                <div class="relative">
                    <div class="absolute inset-0 -z-10 translate-y-6 rounded-3xl bg-foreground/[0.04] blur-2xl" aria-hidden="true"></div>
                    <div class="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-2 shadow-sm">
                        <div class="overflow-hidden rounded-xl bg-muted/40">
                            <img
                                    src="/media/hero-image.png"
                                    alt="PhoneMockup.app render of an iPhone with a rotating mockup"
                                    class="h-auto w-full"
                                    loading="eager"
                                    decoding="async"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Demo video -->
    <section id="demo" class="border-b border-border/60 py-16 md:py-20">
        <div class="mx-auto max-w-5xl px-6">
            <div class="mb-8 text-center">
                <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Live demo</p>
                <h2 class="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                    From upload to export in under a minute.
                </h2>
            </div>
            <Card class="overflow-hidden border-border/70 p-1.5 shadow-sm">
                <div class="aspect-video overflow-hidden rounded-lg bg-muted/40">
                    <video
                            class="h-full w-full object-cover"
                            src="/media/hero-demo.mp4"
                            poster="/media/hero-poster.png"
                            preload="metadata"
                            controls
                            playsinline
                            muted
                    ></video>
                </div>
            </Card>
        </div>
    </section>

    <!-- Value propositions -->
    <section id="features" class="border-b border-border/60 py-20 md:py-24">
        <div class="mx-auto max-w-6xl px-6">
            <div class="max-w-2xl">
                <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Why PhoneMockup</p>
                <h2 class="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
                    A serious mockup tool that happens to be free.
                </h2>
                <p class="mt-3 text-base text-muted-foreground md:text-lg">
                    Built for designers, indie devs, and marketers who need real phone
                    mockups — not stock images.
                </p>
            </div>

            <div class="mt-12 grid gap-6 md:grid-cols-3">
                {#each valueProps as v}
                    <div class="group rounded-xl border border-border/70 bg-card p-6 transition hover:border-border">
                        <div class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border/70 bg-background">
                            <v.icon class="h-5 w-5"/>
                        </div>
                        <h3 class="mt-5 text-base font-semibold">{v.title}</h3>
                        <p class="mt-2 text-sm leading-relaxed text-muted-foreground">{v.body}</p>
                    </div>
                {/each}
            </div>
        </div>
    </section>

    <!-- Premade animations -->
    <section id="animations" class="border-b border-border/60 py-20 md:py-24">
        <div class="mx-auto max-w-6xl px-6">
            <div class="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
                <div class="max-w-2xl">
                    <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Premade animations
                    </p>
                    <h2 class="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
                        Start from a preset.
                    </h2>
                    <p class="mt-3 text-base text-muted-foreground md:text-lg">
                        Click any animation to open it in the editor. Tweak timing, easing,
                        and layers from there.
                    </p>
                </div>
                <a href="/platform/animation" class="shrink-0">
                    <Button variant="outline" size="sm">
                        Browse all {animationGroups.length}
                        <ArrowRight class="ml-1 h-4 w-4"/>
                    </Button>
                </a>
            </div>

            <div class="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 justify-items-center">
                {#each topAnimations as group}
                    <a
                            href={`/platform/animation/${encodeURIComponent(group.id)}`}
                            title={(group.categories?.join(", ")) || group.name}
                            class="group block rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                        <AnimationGroupPreview animationGroup={group}/>
                    </a>
                {/each}
            </div>
        </div>
    </section>

    <!-- How it works -->
    <section id="how" class="border-b border-border/60 py-20 md:py-24">
        <div class="mx-auto max-w-6xl px-6">
            <div class="max-w-2xl">
                <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">How it works</p>
                <h2 class="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
                    Three steps. No setup.
                </h2>
            </div>

            <ol class="mt-12 grid gap-6 md:grid-cols-3">
                {#each steps as step, i}
                    <li class="relative rounded-xl border border-border/70 bg-card p-6">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                Step {step.n}
                            </span>
                            <step.icon class="h-5 w-5 text-muted-foreground"/>
                        </div>
                        <h3 class="mt-4 text-lg font-semibold">{step.title}</h3>
                        <p class="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                    </li>
                {/each}
            </ol>
        </div>
    </section>

    <!-- Capabilities grid -->
    <section class="border-b border-border/60 py-20 md:py-24">
        <div class="mx-auto max-w-6xl px-6">
            <div class="max-w-2xl">
                <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Capabilities</p>
                <h2 class="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
                    Everything you'd expect, plus a few things you wouldn't.
                </h2>
            </div>

            <div class="mt-12 grid gap-px overflow-hidden rounded-xl border border-border/70 bg-border/70 sm:grid-cols-2 lg:grid-cols-3">
                {#each capabilities as cap}
                    <div class="bg-card p-6">
                        <cap.icon class="h-5 w-5 text-muted-foreground"/>
                        <h3 class="mt-4 text-base font-semibold">{cap.title}</h3>
                        <p class="mt-2 text-sm leading-relaxed text-muted-foreground">{cap.body}</p>
                    </div>
                {/each}
            </div>
        </div>
    </section>

    <!-- FAQ -->
    <section id="faq" class="border-b border-border/60 py-20 md:py-24">
        <div class="mx-auto max-w-3xl px-6">
            <div class="text-center">
                <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">FAQ</p>
                <h2 class="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
                    Questions, answered.
                </h2>
            </div>

            <Accordion type="single" class="mt-10 w-full">
                {#each faqs as f, i}
                    <AccordionItem value={`item-${i}`} class="border-border/70">
                        <AccordionTrigger class="text-left text-base font-medium hover:no-underline">
                            {f.q}
                        </AccordionTrigger>
                        <AccordionContent class="text-sm leading-relaxed text-muted-foreground">
                            {f.a}
                        </AccordionContent>
                    </AccordionItem>
                {/each}
            </Accordion>
        </div>
    </section>

    <!-- Final CTA -->
    <section class="py-20 md:py-28">
        <div class="mx-auto max-w-4xl px-6">
            <div class="overflow-hidden rounded-2xl border border-border/70 bg-card p-10 text-center md:p-14">
                <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Free while in beta
                </p>
                <h2 class="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                    Make your first mockup in 60 seconds.
                </h2>
                <p class="mx-auto mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
                    Open the editor, drop in a screen, hit export. No signup, no watermark,
                    no attribution.
                </p>
                <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
                    <a href="/platform/animation/still">
                        <Button size="lg" class="h-11 px-6 text-sm font-medium">
                            Start creating
                            <ArrowRight class="ml-1.5 h-4 w-4"/>
                        </Button>
                    </a>
                    <a href="/platform/project">
                        <Button variant="outline" size="lg" class="h-11 px-6 text-sm font-medium">
                            My projects
                        </Button>
                    </a>
                </div>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <footer class="border-t border-border/60 py-10">
        <div class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
            <div class="flex items-center gap-3">
                <Logo/>
                <span class="text-xs text-muted-foreground">
                    © {new Date().getFullYear()} — Free phone mockup generator
                </span>
            </div>
            <nav class="flex items-center gap-6 text-xs text-muted-foreground" aria-label="Footer">
                <a href="/platform/animation" class="transition hover:text-foreground">Animations</a>
                <a href="/platform/project" class="transition hover:text-foreground">Projects</a>
                <a href="#faq" class="transition hover:text-foreground">FAQ</a>
            </nav>
        </div>
    </footer>
</div>

<style>
    :global(.bg-grid) {
        background-image:
                linear-gradient(to right, color-mix(in oklch, var(--foreground) 6%, transparent) 1px, transparent 1px),
                linear-gradient(to bottom, color-mix(in oklch, var(--foreground) 6%, transparent) 1px, transparent 1px);
        background-size: 32px 32px;
    }
</style>
