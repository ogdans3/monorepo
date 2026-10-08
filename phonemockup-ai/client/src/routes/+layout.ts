import posthog from 'posthog-js'
import {browser} from '$app/environment';

export const load = async () => {
    if (browser) {
        posthog.init(
            'phc_d6q9UL8mxg9gzlDXUcEz4azOSxawQ4nYGDTUI1n4p57',
            {
                api_host: 'https://e.phonemockup.app',
                ui_host: 'https://eu.posthog.com',
                defaults: '2025-05-24',
                person_profiles: 'identified_only', // or 'always' to create profiles for anonymous users as well
            }
        )
    }

    return
};