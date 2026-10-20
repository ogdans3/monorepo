import { describe, expect, it } from 'vitest';
import { checkConfig } from '../src/config.js';

const complete = {
    DATABASE_URL: 'postgres://db', B2_KEY_ID: 'k', B2_APP_KEY: 'a', B2_BUCKET_ID: 'b', B2_BUCKET_NAME: 'n',
};

describe('startup configuration', () => {
    it('accepts a complete development setup', () => {
        expect(checkConfig({ ...complete })).toEqual({ errors: [], warnings: [] });
    });
    it('stops without a database', () => {
        expect(checkConfig({ ...complete, DATABASE_URL: '' }).errors).toEqual(['DATABASE_URL is not set']);
    });
    it('refuses a missing or localhost APP_URL in production', () => {
        expect(checkConfig({ ...complete, NODE_ENV: 'production' }).errors).toEqual(['APP_URL is not set']);
        expect(checkConfig({ ...complete, NODE_ENV: 'production', APP_URL: 'http://localhost:5173' }).errors)
            .toHaveLength(1);
        expect(checkConfig({ ...complete, NODE_ENV: 'production', APP_URL: 'https://phonemockup.app' }).errors)
            .toEqual([]);
    });
    it('only warns when B2 is missing, because only uploads need it', () => {
        const { errors, warnings } = checkConfig({ DATABASE_URL: 'postgres://db' });
        expect(errors).toEqual([]);
        expect(warnings).toHaveLength(4);
    });
});
