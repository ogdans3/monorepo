// src/lib/utils/cn.ts
import clsx from 'clsx';

// Optional: if you use tailwind-merge, uncomment and use it for deduping
// import { twMerge } from 'tailwind-merge';

export function cn(...inputs: any[]) {
    // If you want Tailwind conflict resolution, use twMerge(clsx(...inputs))
    return clsx(inputs);
}