import { describe, it, expect } from 'vitest';
import {
  validateResource,
  validateResources,
  type ValidationOptions,
} from './integrity-validator.js';
import type { ExternalResource } from './html-parser.js';

describe('IntegrityValidator', () => {
  const defaultOptions: ValidationOptions = {
    checkCrossorigin: false,
    failMode: 'fail',
  };

  const createResource = (overrides: Partial<ExternalResource> = {}): ExternalResource => ({
    tagName: 'script',
    src: 'https://example.com/app.js',
    integrity: null,
    crossorigin: null,
    line: 1,
    column: 1,
    disabled: false,
    ...overrides,
  });

  describe('validateResource', () => {
    describe('integrity presence check', () => {
      it('should report missing integrity as error in fail mode', () => {
        const resource = createResource();
        const issues = validateResource(resource, defaultOptions);

        expect(issues).toHaveLength(1);
        expect(issues[0]?.type).toBe('missing-integrity');
        expect(issues[0]?.severity).toBe('error');
      });

      it('should report missing integrity as warning in warn mode', () => {
        const resource = createResource();
        const issues = validateResource(resource, { ...defaultOptions, failMode: 'warn' });

        expect(issues).toHaveLength(1);
        expect(issues[0]?.severity).toBe('warning');
      });

      it('should not report issue when integrity is present and valid', () => {
        const resource = createResource({
          integrity: 'sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC',
        });
        const issues = validateResource(resource, defaultOptions);

        expect(issues).toHaveLength(0);
      });

      it('should include source URL in message', () => {
        const resource = createResource({ src: 'https://cdn.example.com/lib.js' });
        const issues = validateResource(resource, defaultOptions);

        expect(issues[0]?.message).toContain('https://cdn.example.com/lib.js');
      });

      it('should include tag name in message', () => {
        const resource = createResource({ tagName: 'link' });
        const issues = validateResource(resource, defaultOptions);

        expect(issues[0]?.message).toContain('link');
      });
    });

    describe('integrity format validation', () => {
      it('should accept sha256 hash', () => {
        const resource = createResource({
          integrity: 'sha256-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQR=',
        });
        const issues = validateResource(resource, defaultOptions);

        expect(issues).toHaveLength(0);
      });

      it('should accept sha384 hash', () => {
        const resource = createResource({
          integrity: 'sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC',
        });
        const issues = validateResource(resource, defaultOptions);

        expect(issues).toHaveLength(0);
      });

      it('should accept sha512 hash', () => {
        const resource = createResource({
          integrity:
            'sha512-YWIzOWNiNzJmNTYxMDI3M2IxZGVkMDA5NTlhYzEyMTc2YzU5YjEzZjRjOGE5MzBhYWM3MjYxOTY3M2VjMTFiMA==',
        });
        const issues = validateResource(resource, defaultOptions);

        expect(issues).toHaveLength(0);
      });

      it('should accept multiple hashes separated by space', () => {
        const resource = createResource({
          integrity:
            'sha256-abc123= sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC',
        });
        const issues = validateResource(resource, defaultOptions);

        expect(issues).toHaveLength(0);
      });

      it('should reject invalid algorithm', () => {
        const resource = createResource({ integrity: 'sha1-abc123' });
        const issues = validateResource(resource, defaultOptions);

        expect(issues).toHaveLength(1);
        expect(issues[0]?.type).toBe('invalid-integrity-format');
      });

      it('should reject missing hash value', () => {
        const resource = createResource({ integrity: 'sha256-' });
        const issues = validateResource(resource, defaultOptions);

        expect(issues).toHaveLength(1);
        expect(issues[0]?.type).toBe('invalid-integrity-format');
      });

      it('should reject invalid base64 characters', () => {
        const resource = createResource({ integrity: 'sha256-invalid!@#$%^&*()' });
        const issues = validateResource(resource, defaultOptions);

        expect(issues).toHaveLength(1);
        expect(issues[0]?.type).toBe('invalid-integrity-format');
      });

      it('should reject empty integrity value', () => {
        const resource = createResource({ integrity: '' });
        const issues = validateResource(resource, defaultOptions);

        expect(issues).toHaveLength(1);
        expect(issues[0]?.type).toBe('invalid-integrity-format');
      });

      it('should include invalid value in message', () => {
        const resource = createResource({ integrity: 'invalid-format' });
        const issues = validateResource(resource, defaultOptions);

        expect(issues[0]?.message).toContain('invalid-format');
      });
    });

    describe('crossorigin validation', () => {
      it('should not check crossorigin when option is disabled', () => {
        const resource = createResource({
          integrity: 'sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC',
          crossorigin: null,
        });
        const issues = validateResource(resource, { ...defaultOptions, checkCrossorigin: false });

        expect(issues).toHaveLength(0);
      });

      it('should report missing crossorigin when enabled', () => {
        const resource = createResource({
          integrity: 'sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC',
          crossorigin: null,
        });
        const issues = validateResource(resource, { ...defaultOptions, checkCrossorigin: true });

        expect(issues).toHaveLength(1);
        expect(issues[0]?.type).toBe('missing-crossorigin');
        expect(issues[0]?.severity).toBe('warning');
      });

      it('should accept anonymous crossorigin', () => {
        const resource = createResource({
          integrity: 'sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC',
          crossorigin: 'anonymous',
        });
        const issues = validateResource(resource, { ...defaultOptions, checkCrossorigin: true });

        expect(issues).toHaveLength(0);
      });

      it('should accept use-credentials crossorigin', () => {
        const resource = createResource({
          integrity: 'sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC',
          crossorigin: 'use-credentials',
        });
        const issues = validateResource(resource, { ...defaultOptions, checkCrossorigin: true });

        expect(issues).toHaveLength(0);
      });

      it('should accept empty crossorigin attribute', () => {
        const resource = createResource({
          integrity: 'sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC',
          crossorigin: '',
        });
        const issues = validateResource(resource, { ...defaultOptions, checkCrossorigin: true });

        expect(issues).toHaveLength(0);
      });

      it('should reject invalid crossorigin value', () => {
        const resource = createResource({
          integrity: 'sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC',
          crossorigin: 'invalid',
        });
        const issues = validateResource(resource, { ...defaultOptions, checkCrossorigin: true });

        expect(issues).toHaveLength(1);
        expect(issues[0]?.type).toBe('invalid-crossorigin');
        expect(issues[0]?.severity).toBe('warning');
      });

      it('should not check crossorigin when integrity is missing', () => {
        const resource = createResource({ crossorigin: null });
        const issues = validateResource(resource, { ...defaultOptions, checkCrossorigin: true });

        expect(issues).toHaveLength(1);
        expect(issues[0]?.type).toBe('missing-integrity');
      });
    });

    describe('disabled resources', () => {
      it('should skip disabled resources', () => {
        const resource = createResource({ disabled: true });
        const issues = validateResource(resource, defaultOptions);

        expect(issues).toHaveLength(0);
      });

      it('should skip disabled resources even with invalid integrity', () => {
        const resource = createResource({
          disabled: true,
          integrity: 'invalid',
        });
        const issues = validateResource(resource, defaultOptions);

        expect(issues).toHaveLength(0);
      });
    });
  });

  describe('validateResources', () => {
    it('should validate multiple resources', () => {
      const resources: ExternalResource[] = [
        createResource({ src: 'a.js' }),
        createResource({ src: 'b.js' }),
      ];
      const issues = validateResources(resources, defaultOptions);

      expect(issues).toHaveLength(2);
    });

    it('should return empty array for empty resources', () => {
      const issues = validateResources([], defaultOptions);

      expect(issues).toHaveLength(0);
    });

    it('should skip disabled resources in batch', () => {
      const resources: ExternalResource[] = [
        createResource({ src: 'a.js', disabled: true }),
        createResource({ src: 'b.js' }),
      ];
      const issues = validateResources(resources, defaultOptions);

      expect(issues).toHaveLength(1);
      expect(issues[0]?.resource.src).toBe('b.js');
    });
  });
});
