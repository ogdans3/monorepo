<script>
    import {APP_NAME} from "$lib/stores/settings.svelte";
</script>


<h2 class="tracking-wide font-semibold text-sm">
    <span class="text-red-400">{APP_NAME.name}</span><span>.</span><span>{APP_NAME.tld}</span>
</h2>
