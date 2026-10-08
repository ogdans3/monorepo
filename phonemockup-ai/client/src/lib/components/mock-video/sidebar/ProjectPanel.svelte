<script lang="ts">
    import {Label} from "$lib/components/ui/label";
    import {Input} from "$lib/components/ui/input";
    import {Badge} from "$lib/components/ui/badge";
    import {project} from "$lib/stores/project.svelte";

    function onNameInput(value: string) {
        // Kept as typed, so the field can be cleared; saving names a blank project.
        project.name = value;
    }
</script>

<section class="px-2 py-2 space-y-3" aria-label="Project settings">
    <div class="flex items-center gap-2">
        <h3 class="text-sm font-medium">Project</h3>
        <Badge class="ml-auto text-[11px] px-1.5 py-0.5">
            {project.id.slice(0, 8)}
        </Badge>
    </div>

    <div class="grid gap-1.5">
        <Label for="project-name" class="text-xs text-muted-foreground">Name</Label>
        <Input
                id="project-name"
                type="text"
                class="h-8 w-full"
                value={project.name}
                oninput={(e) => onNameInput((e.target as HTMLInputElement).value)}
                placeholder="My project"
                aria-label="Project name"
        />
    </div>
</section>