<script lang="ts">
	import SameNamePage from '$lib/ui/tools/SameNamePage.svelte';
	import { sameNameBySlug } from '$lib/tools/samename';

	const page = sameNameBySlug('jpg-to-jpeg')!;
</script>

<SameNamePage {page} />
