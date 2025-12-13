import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyResourceHash, verifyResourcesHashes } from './hash-verifier.js';
import type { ExternalResource } from './html-parser.js';

const createResource = (overrides: Partial<ExternalResource> = {}): ExternalResource => ({
  tagName: 'script',
  src: 'https://example.com/app.js',
  integrity: 'sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC',
  crossorigin: 'anonymous',
  line: 1,
  column: 1,
  disabled: false,
  ...overrides,
});

const defaultOptions = { timeout: 5000 };

describe('HashVerifier', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('verifyResourceHash', () => {
    describe('URL validation', () => {
      it('should reject non-HTTPS URLs', async () => {
        const resource = createResource({ src: 'http://example.com/app.js' });
        const result = await verifyResourceHash(resource, defaultOptions);

        expect(result.verified).toBe(false);
        expect(result.error).toContain('Only HTTPS');
      });

      it('should accept protocol-relative URLs', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
          new Response('test content', { status: 200 })
        );

        const resource = createResource({
          src: '//example.com/app.js',
          integrity: 'sha256-7iDP7V0PVOAZQXisIRzPT5Fg3uo5oW0vjiE8+CF8qvE=',
        });
        const result = await verifyResourceHash(resource, defaultOptions);

        expect(globalThis.fetch).toHaveBeenCalledWith(
          'https://example.com/app.js',
          expect.any(Object)
        );
      });
    });

    describe('integrity validation', () => {
      it('should return error for missing integrity', async () => {
        const resource = createResource({ integrity: null });
        const result = await verifyResourceHash(resource, defaultOptions);

        expect(result.verified).toBe(false);
        expect(result.error).toBe('No integrity attribute');
      });

      it('should return error for invalid integrity format', async () => {
        const resource = createResource({ integrity: 'invalid-format' });
        const result = await verifyResourceHash(resource, defaultOptions);

        expect(result.verified).toBe(false);
        expect(result.error).toBe('Invalid integrity format');
      });
    });

    describe('hash verification', () => {
      it('should verify matching hash', async () => {
        const content = 'test content';
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
          new Response(content, { status: 200 })
        );

        const resource = createResource({
          integrity: 'sha256-auinVVUgn9bEQVfArtgBbnY/9DWhnPGG92hjFAFD/3I=',
        });
        const result = await verifyResourceHash(resource, defaultOptions);

        expect(result.verified).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should detect hash mismatch', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
          new Response('different content', { status: 200 })
        );

        const resource = createResource({
          integrity: 'sha256-auinVVUgn9bEQVfArtgBbnY/9DWhnPGG92hjFAFD/3I=',
        });
        const result = await verifyResourceHash(resource, defaultOptions);

        expect(result.verified).toBe(false);
        expect(result.error).toBe('Hash mismatch');
        expect(result.expected).toBe('auinVVUgn9bEQVfArtgBbnY/9DWhnPGG92hjFAFD/3I=');
        expect(result.actual).toBeDefined();
      });

      it('should support sha384 algorithm', async () => {
        const content = 'test content';
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
          new Response(content, { status: 200 })
        );

        const resource = createResource({
          integrity: 'sha384-8cFK5mW+eeVbAO7clwcEVX1yowIas7iMz9wbg9HWbEeQkeI8+2Ah9Dt6EnOm9KMY',
        });
        const result = await verifyResourceHash(resource, defaultOptions);

        expect(result.verified).toBe(true);
      });

      it('should support sha512 algorithm', async () => {
        const content = 'test content';
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
          new Response(content, { status: 200 })
        );

        const resource = createResource({
          integrity:
            'sha512-DL9MrvOAR7upok5iGpYUhOXSqSF2qFnn6yffND3TTrmNU4psX02hzjAuwlC4IcwAHkbMl6cEmIKXGFpN9+mWAg==',
        });
        const result = await verifyResourceHash(resource, defaultOptions);

        expect(result.verified).toBe(true);
      });

      it('should use first valid hash from multiple hashes', async () => {
        const content = 'test content';
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
          new Response(content, { status: 200 })
        );

        const resource = createResource({
          integrity:
            'sha256-auinVVUgn9bEQVfArtgBbnY/9DWhnPGG92hjFAFD/3I= sha384-8cFK5mW+eeVbAO7clwcEVX1yowIas7iMz9wbg9HWbEeQkeI8+2Ah9Dt6EnOm9KMY',
        });
        const result = await verifyResourceHash(resource, defaultOptions);

        expect(result.verified).toBe(true);
      });
    });

    describe('error handling', () => {
      it('should handle HTTP error responses', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
          new Response('Not Found', { status: 404, statusText: 'Not Found' })
        );

        const resource = createResource();
        const result = await verifyResourceHash(resource, defaultOptions);

        expect(result.verified).toBe(false);
        expect(result.error).toContain('404');
      });

      it('should handle network errors', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

        const resource = createResource();
        const result = await verifyResourceHash(resource, defaultOptions);

        expect(result.verified).toBe(false);
        expect(result.error).toContain('Network error');
      });

      it('should handle timeout', async () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(
          () =>
            new Promise((_, reject) => {
              const error = new Error('Aborted');
              error.name = 'AbortError';
              setTimeout(() => reject(error), 100);
            })
        );

        const resource = createResource();
        const result = await verifyResourceHash(resource, { timeout: 50 });

        expect(result.verified).toBe(false);
        expect(result.error).toContain('timed out');
      });
    });
  });

  describe('verifyResourcesHashes', () => {
    it('should verify multiple resources', async () => {
      const content = 'test content';
      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(new Response(content, { status: 200 }))
      );

      const resources: ExternalResource[] = [
        createResource({
          src: 'https://example.com/a.js',
          integrity: 'sha256-auinVVUgn9bEQVfArtgBbnY/9DWhnPGG92hjFAFD/3I=',
        }),
        createResource({
          src: 'https://example.com/b.js',
          integrity: 'sha256-auinVVUgn9bEQVfArtgBbnY/9DWhnPGG92hjFAFD/3I=',
        }),
      ];

      const results = await verifyResourcesHashes(resources, defaultOptions);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.verified)).toBe(true);
    });

    it('should skip disabled resources', async () => {
      const resources: ExternalResource[] = [
        createResource({ disabled: true }),
        createResource({
          integrity: 'sha256-auinVVUgn9bEQVfArtgBbnY/9DWhnPGG92hjFAFD/3I=',
        }),
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('test content', { status: 200 })
      );

      const results = await verifyResourcesHashes(resources, defaultOptions);

      expect(results).toHaveLength(1);
    });

    it('should skip resources without integrity', async () => {
      const resources: ExternalResource[] = [
        createResource({ integrity: null }),
        createResource({
          integrity: 'sha256-auinVVUgn9bEQVfArtgBbnY/9DWhnPGG92hjFAFD/3I=',
        }),
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('test content', { status: 200 })
      );

      const results = await verifyResourcesHashes(resources, defaultOptions);

      expect(results).toHaveLength(1);
    });

    it('should return empty array for empty resources', async () => {
      const results = await verifyResourcesHashes([], defaultOptions);

      expect(results).toHaveLength(0);
    });
  });
});
