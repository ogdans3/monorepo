import type {PageLoad} from "./$types";
import {getProjectFromLocalStorage} from "$lib/repo/localstorage.svelte";

// Projects live in this browser's storage, which the server can't read.
export const ssr = false;

export const load: PageLoad = async ({params}) => {
    const project = getProjectFromLocalStorage(params.id);
    return {project};
};
