<script lang="ts">
    import {User} from "@lucide/svelte";
    import {
        Avatar,
        AvatarFallback,
    } from "$lib/components/ui/avatar";
    import {
        Popover,
        PopoverContent,
        PopoverTrigger
    } from "$lib/components/ui/popover";
    import {Button} from "$lib/components/ui/button";
</script>

<Popover>
    <PopoverTrigger>
        <Avatar class="cursor-pointer">
            <AvatarFallback class="flex items-center justify-center">
                <User/>
            </AvatarFallback>
        </Avatar>
    </PopoverTrigger>

    <PopoverContent
            class="w-56"
            side="bottom"
            align="end"
            sideOffset={8}
    >
        <div class="text-sm">
            Accounts coming soon.
        </div>
    </PopoverContent>
</Popover>