import {browser} from "$app/environment";

// Whether the last thing the user did was press a key. Controls give up
// focus after a click so the studio's shortcuts (Space, the arrows) reach the
// timeline; after a pick made from the keyboard that dropped focus to <body>,
// and the next Tab started again at the top of the page.
let lastInputWasKeyboard = false;
if (browser) {
    window.addEventListener("keydown", () => (lastInputWasKeyboard = true), {capture: true});
    window.addEventListener("pointerdown", () => (lastInputWasKeyboard = false), {capture: true});
}

export function unfocusElement() {
    if (browser && document && !lastInputWasKeyboard) {
        (document.activeElement as HTMLElement | null)?.blur();
    }
}
