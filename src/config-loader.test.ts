import * as core from '@actions/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from './config-loader.js';

vi.mock('@actions/core');

describe('ConfigLoader', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadConfig', () => {
    it('should return default values when no inputs are provided', () => {
      vi.mocked(core.getInput).mockReturnValue('');

      const config = loadConfig();

      expect(config.filePatterns).toEqual(['**/*.html', '**/*.htm', '**/*.php']);
      expect(config.excludePatterns).toEqual([]);
      expect(config.failMode).toBe('fail');
      expect(config.verifyHashes).toBe(false);
      expect(config.checkCrossorigin).toBe(false);
      expect(config.fetchTimeout).toBe(10000);
      expect(config.outputFormat).toBe('text');
    });

    it('should parse file-patterns input as comma-separated values', () => {
      vi.mocked(core.getInput).mockImplementation((name: string) => {
        if (name === 'file-patterns') return '**/*.html,**/*.vue,src/**/*.php';
        return '';
      });

      const config = loadConfig();

      expect(config.filePatterns).toEqual(['**/*.html', '**/*.vue', 'src/**/*.php']);
    });

    it('should parse exclude-patterns input as comma-separated values', () => {
      vi.mocked(core.getInput).mockImplementation((name: string) => {
        if (name === 'exclude-patterns') return 'vendor/**,node_modules/**';
        return '';
      });

      const config = loadConfig();

      expect(config.excludePatterns).toEqual(['vendor/**', 'node_modules/**']);
    });

    it('should parse fail-mode input', () => {
      vi.mocked(core.getInput).mockImplementation((name: string) => {
        if (name === 'fail-mode') return 'warn';
        return '';
      });

      const config = loadConfig();

      expect(config.failMode).toBe('warn');
    });

    it('should default to "fail" for invalid fail-mode', () => {
      vi.mocked(core.getInput).mockImplementation((name: string) => {
        if (name === 'fail-mode') return 'invalid';
        return '';
      });

      const config = loadConfig();

      expect(config.failMode).toBe('fail');
    });

    it('should parse verify-hashes as boolean', () => {
      vi.mocked(core.getInput).mockImplementation((name: string) => {
        if (name === 'verify-hashes') return 'true';
        return '';
      });

      const config = loadConfig();

      expect(config.verifyHashes).toBe(true);
    });

    it('should parse check-crossorigin as boolean', () => {
      vi.mocked(core.getInput).mockImplementation((name: string) => {
        if (name === 'check-crossorigin') return 'true';
        return '';
      });

      const config = loadConfig();

      expect(config.checkCrossorigin).toBe(true);
    });

    it('should parse fetch-timeout as number', () => {
      vi.mocked(core.getInput).mockImplementation((name: string) => {
        if (name === 'fetch-timeout') return '5000';
        return '';
      });

      const config = loadConfig();

      expect(config.fetchTimeout).toBe(5000);
    });

    it('should use default fetch-timeout for invalid number', () => {
      vi.mocked(core.getInput).mockImplementation((name: string) => {
        if (name === 'fetch-timeout') return 'invalid';
        return '';
      });

      const config = loadConfig();

      expect(config.fetchTimeout).toBe(10000);
    });

    it('should parse output-format input', () => {
      vi.mocked(core.getInput).mockImplementation((name: string) => {
        if (name === 'output-format') return 'json';
        return '';
      });

      const config = loadConfig();

      expect(config.outputFormat).toBe('json');
    });

    it('should default to "text" for invalid output-format', () => {
      vi.mocked(core.getInput).mockImplementation((name: string) => {
        if (name === 'output-format') return 'xml';
        return '';
      });

      const config = loadConfig();

      expect(config.outputFormat).toBe('text');
    });

    it('should trim whitespace from comma-separated values', () => {
      vi.mocked(core.getInput).mockImplementation((name: string) => {
        if (name === 'file-patterns') return ' **/*.html , **/*.php ';
        return '';
      });

      const config = loadConfig();

      expect(config.filePatterns).toEqual(['**/*.html', '**/*.php']);
    });

    it('should filter out empty values from comma-separated inputs', () => {
      vi.mocked(core.getInput).mockImplementation((name: string) => {
        if (name === 'file-patterns') return '**/*.html,,**/*.php,';
        return '';
      });

      const config = loadConfig();

      expect(config.filePatterns).toEqual(['**/*.html', '**/*.php']);
    });
  });
});
