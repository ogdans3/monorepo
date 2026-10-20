import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/client.js', () => ({ db: {} }));
const { utf8FileName } = await import('../src/routes/file.js');

describe('upload file names', () => {
    it('restores UTF-8 names that multer read as latin1', () => {
        const garbled = Buffer.from('skjermbilde-æøå.png', 'utf8').toString('latin1');
        expect(utf8FileName(garbled)).toBe('skjermbilde-æøå.png');
    });
    it('keeps plain ASCII and names that were decoded already', () => {
        expect(utf8FileName('screen.png')).toBe('screen.png');
        expect(utf8FileName('skjermbilde-ø-✓.png')).toBe('skjermbilde-ø-✓.png');
    });
});
