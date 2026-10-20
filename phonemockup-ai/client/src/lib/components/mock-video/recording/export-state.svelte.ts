/**
 * Whether an export is rendering right now. The export dialog reads it to
 * ignore Escape meanwhile: one key threw a long render away without asking.
 * Outside clicks were already ignored; Cancel still stops the export.
 */
export const exportState = $state({running: false});
