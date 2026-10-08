import {browser} from "$app/environment";

export function unfocusElement() {
    if (browser && document) {
        (document.activeElement as HTMLElement | null)?.blur();
    }
}