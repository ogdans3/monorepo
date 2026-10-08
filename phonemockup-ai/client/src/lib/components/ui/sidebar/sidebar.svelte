<script lang="ts">
    import * as Sheet from "$lib/components/ui/sheet/index.js";
    import {cn, type WithElementRef} from "$lib/utils.js";
    import type {HTMLAttributes} from "svelte/elements";
    import {useSidebar} from "./context.svelte.js";

    let {
        ref = $bindable(null),
        side = "left",
        variant = "sidebar",
        collapsible = "offcanvas",
        class: className,
        children,
        ...restProps
    }: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
        side?: "left" | "right";
        variant?: "sidebar" | "floating" | "inset";
        collapsible?: "offcanvas" | "icon" | "none";
    } = $props();
</script>

<div
        class={cn(
			"bg-sidebar text-sidebar-foreground w-(--sidebar-width) flex h-full flex-col",
			className
		)}
        bind:this={ref}
        {...restProps}
>
    {@render children?.()}
</div>
