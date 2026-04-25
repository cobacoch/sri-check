import * as core from '@actions/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExternalResource } from './html-parser.js';
import {
  createReport,
  type FileResult,
  outputAllAnnotations,
  outputJsonReport,
  outputTextReport,
} from './reporter.js';

vi.mock('@actions/core');

const createResource = (overrides: Partial<ExternalResource> = {}): ExternalResource => ({
  tagName: 'script',
  src: 'https://example.com/app.js',
  integrity: 'sha384-abc',
  crossorigin: 'anonymous',
  line: 10,
  column: 5,
  disabled: false,
  ...overrides,
});

describe('Reporter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('createReport', () => {
    it('should create report with summary for empty results', () => {
      const report = createReport([]);

      expect(report.files).toHaveLength(0);
      expect(report.summary).toEqual({
        totalFiles: 0,
        filesWithIssues: 0,
        totalIssues: 0,
        errorCount: 0,
        warningCount: 0,
        hashVerificationsFailed: 0,
      });
    });

    it('should count errors and warnings correctly', () => {
      const resource = createResource();
      const fileResults: FileResult[] = [
        {
          filename: 'test.html',
          issues: [
            {
              resource,
              type: 'missing-integrity',
              severity: 'error',
              message: 'Missing integrity',
            },
            {
              resource,
              type: 'missing-crossorigin',
              severity: 'warning',
              message: 'Missing crossorigin',
            },
          ],
          hashResults: [],
        },
      ];

      const report = createReport(fileResults);

      expect(report.summary.errorCount).toBe(1);
      expect(report.summary.warningCount).toBe(1);
      expect(report.summary.totalIssues).toBe(2);
    });

    it('should count hash verification failures', () => {
      const resource = createResource();
      const fileResults: FileResult[] = [
        {
          filename: 'test.html',
          issues: [],
          hashResults: [
            { resource, verified: true },
            { resource, verified: false, error: 'Hash mismatch' },
          ],
        },
      ];

      const report = createReport(fileResults);

      expect(report.summary.hashVerificationsFailed).toBe(1);
    });

    it('should count files with issues', () => {
      const resource = createResource();
      const fileResults: FileResult[] = [
        {
          filename: 'clean.html',
          issues: [],
          hashResults: [],
        },
        {
          filename: 'with-issue.html',
          issues: [
            {
              resource,
              type: 'missing-integrity',
              severity: 'error',
              message: 'Missing integrity',
            },
          ],
          hashResults: [],
        },
        {
          filename: 'hash-fail.html',
          issues: [],
          hashResults: [{ resource, verified: false, error: 'Mismatch' }],
        },
      ];

      const report = createReport(fileResults);

      expect(report.summary.totalFiles).toBe(3);
      expect(report.summary.filesWithIssues).toBe(2);
    });
  });

  describe('outputTextReport', () => {
    it('should output summary for clean report', () => {
      const report = createReport([]);

      outputTextReport(report);

      expect(core.info).toHaveBeenCalledWith(expect.stringContaining('Report'));
      expect(core.info).toHaveBeenCalledWith(expect.stringContaining('Files checked: 0'));
    });

    it('should output file issues with line numbers', () => {
      const resource = createResource({ line: 15 });
      const fileResults: FileResult[] = [
        {
          filename: 'test.html',
          issues: [
            {
              resource,
              type: 'missing-integrity',
              severity: 'error',
              message: 'Missing integrity attribute',
            },
          ],
          hashResults: [],
        },
      ];

      const report = createReport(fileResults);
      outputTextReport(report);

      expect(core.info).toHaveBeenCalledWith(expect.stringContaining('test.html'));
      expect(core.info).toHaveBeenCalledWith(expect.stringContaining('Line 15'));
      expect(core.info).toHaveBeenCalledWith(expect.stringContaining('Missing integrity'));
    });

    it('should output hash verification failures', () => {
      const resource = createResource({ src: 'https://cdn.example.com/lib.js', line: 20 });
      const fileResults: FileResult[] = [
        {
          filename: 'test.html',
          issues: [],
          hashResults: [{ resource, verified: false, error: 'Hash mismatch' }],
        },
      ];

      const report = createReport(fileResults);
      outputTextReport(report);

      expect(core.info).toHaveBeenCalledWith(expect.stringContaining('Hash verification failed'));
      expect(core.info).toHaveBeenCalledWith(expect.stringContaining('cdn.example.com'));
    });

    it('should skip files without issues', () => {
      const fileResults: FileResult[] = [
        {
          filename: 'clean.html',
          issues: [],
          hashResults: [],
        },
      ];

      const report = createReport(fileResults);
      outputTextReport(report);

      const calls = vi.mocked(core.info).mock.calls.flat();
      expect(calls.some((c) => c.includes('clean.html'))).toBe(false);
    });
  });

  describe('outputJsonReport', () => {
    it('should output valid JSON', () => {
      const resource = createResource();
      const fileResults: FileResult[] = [
        {
          filename: 'test.html',
          issues: [
            {
              resource,
              type: 'missing-integrity',
              severity: 'error',
              message: 'Missing integrity',
            },
          ],
          hashResults: [],
        },
      ];

      const report = createReport(fileResults);
      outputJsonReport(report);

      const calls = vi.mocked(core.info).mock.calls;
      const jsonCall = calls.find((c) => c[0].includes('"files"'));
      if (!jsonCall) throw new Error('jsonCall not found');

      const parsed = JSON.parse(jsonCall[0]);
      expect(parsed.files).toHaveLength(1);
      expect(parsed.summary.errorCount).toBe(1);
    });

    it('should include issue details in JSON output', () => {
      const resource = createResource({ line: 10, column: 5 });
      const fileResults: FileResult[] = [
        {
          filename: 'test.html',
          issues: [
            {
              resource,
              type: 'missing-integrity',
              severity: 'error',
              message: 'Missing integrity',
            },
          ],
          hashResults: [],
        },
      ];

      const report = createReport(fileResults);
      outputJsonReport(report);

      const calls = vi.mocked(core.info).mock.calls;
      const jsonCall = calls.find((c) => c[0].includes('"files"'));
      if (!jsonCall) throw new Error('jsonCall not found');
      const parsed = JSON.parse(jsonCall[0]);

      expect(parsed.files[0].issues[0]).toMatchObject({
        type: 'missing-integrity',
        severity: 'error',
        line: 10,
        column: 5,
      });
    });
  });

  describe('outputAllAnnotations', () => {
    it('should output error annotations for errors', () => {
      const resource = createResource({ line: 10, column: 5 });
      const fileResults: FileResult[] = [
        {
          filename: 'test.html',
          issues: [
            {
              resource,
              type: 'missing-integrity',
              severity: 'error',
              message: 'Missing integrity',
            },
          ],
          hashResults: [],
        },
      ];

      const report = createReport(fileResults);
      outputAllAnnotations(report);

      expect(core.error).toHaveBeenCalledWith('Missing integrity', {
        file: 'test.html',
        startLine: 10,
        startColumn: 5,
      });
    });

    it('should output warning annotations for warnings', () => {
      const resource = createResource({ line: 15, column: 3 });
      const fileResults: FileResult[] = [
        {
          filename: 'test.html',
          issues: [
            {
              resource,
              type: 'missing-crossorigin',
              severity: 'warning',
              message: 'Missing crossorigin',
            },
          ],
          hashResults: [],
        },
      ];

      const report = createReport(fileResults);
      outputAllAnnotations(report);

      expect(core.warning).toHaveBeenCalledWith('Missing crossorigin', {
        file: 'test.html',
        startLine: 15,
        startColumn: 3,
      });
    });

    it('should output error annotations for hash failures', () => {
      const resource = createResource({ line: 20, column: 1 });
      const fileResults: FileResult[] = [
        {
          filename: 'test.html',
          issues: [],
          hashResults: [{ resource, verified: false, error: 'Hash mismatch' }],
        },
      ];

      const report = createReport(fileResults);
      outputAllAnnotations(report);

      expect(core.error).toHaveBeenCalledWith(
        expect.stringContaining('Hash verification failed'),
        expect.objectContaining({
          file: 'test.html',
          startLine: 20,
        }),
      );
    });

    it('should not output annotations for verified hashes', () => {
      const resource = createResource();
      const fileResults: FileResult[] = [
        {
          filename: 'test.html',
          issues: [],
          hashResults: [{ resource, verified: true }],
        },
      ];

      const report = createReport(fileResults);
      outputAllAnnotations(report);

      expect(core.error).not.toHaveBeenCalled();
      expect(core.warning).not.toHaveBeenCalled();
    });

    it('should output annotations for multiple files', () => {
      const resource1 = createResource({ line: 10 });
      const resource2 = createResource({ line: 20 });
      const fileResults: FileResult[] = [
        {
          filename: 'file1.html',
          issues: [
            {
              resource: resource1,
              type: 'missing-integrity',
              severity: 'error',
              message: 'Error 1',
            },
          ],
          hashResults: [],
        },
        {
          filename: 'file2.html',
          issues: [
            {
              resource: resource2,
              type: 'missing-integrity',
              severity: 'error',
              message: 'Error 2',
            },
          ],
          hashResults: [],
        },
      ];

      const report = createReport(fileResults);
      outputAllAnnotations(report);

      expect(core.error).toHaveBeenCalledTimes(2);
      expect(core.error).toHaveBeenCalledWith(
        'Error 1',
        expect.objectContaining({ file: 'file1.html' }),
      );
      expect(core.error).toHaveBeenCalledWith(
        'Error 2',
        expect.objectContaining({ file: 'file2.html' }),
      );
    });
  });
});
