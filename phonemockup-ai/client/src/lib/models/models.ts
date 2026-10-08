// Scene-related enums and types
export enum PresetName {
    FullHD_16_9 = 'Full HD (16:9)',
    Square_1_1 = 'Square (1:1)',
    TikTok_9_16 = 'TikTok (9:16)',
    Cinema4K_21_9 = 'Cinema 4K (21:9)',
}

export type Resolution = { width: number; height: number };
export type RGBA = [number, number, number, number];
