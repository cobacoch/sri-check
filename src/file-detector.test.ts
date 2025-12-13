import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as github from '@actions/github';
import * as core from '@actions/core';
import * as fs from 'node:fs/promises';
import {
  getPullRequestFiles,
  filterFilesByPattern,
  getFileContents,
  type PullRequestFile,
  type FileWithContent,
} from './file-detector.js';

vi.mock('@actions/github');
vi.mock('@actions/core');
vi.mock('node:fs/promises');

describe('FileDetector', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getPullRequestFiles', () => {
    it('should return list of changed files from PR', async () => {
      const mockFiles = [
        { filename: 'index.html', status: 'added' },
        { filename: 'styles.css', status: 'modified' },
      ];

      const mockOctokit = {
        rest: {
          pulls: {
            listFiles: vi.fn().mockResolvedValue({ data: mockFiles }),
          },
        },
      };

      vi.mocked(github.getOctokit).mockReturnValue(mockOctokit as ReturnType<typeof github.getOctokit>);

      const context = {
        repo: { owner: 'test-owner', repo: 'test-repo' },
        payload: { pull_request: { number: 123 } },
      };

      const files = await getPullRequestFiles('fake-token', context as typeof github.context);

      expect(files).toHaveLength(2);
      expect(files[0]).toEqual({ filename: 'index.html', status: 'added' });
      expect(files[1]).toEqual({ filename: 'styles.css', status: 'modified' });
    });

    it('should filter out removed files', async () => {
      const mockFiles = [
        { filename: 'index.html', status: 'added' },
        { filename: 'deleted.html', status: 'removed' },
        { filename: 'modified.html', status: 'modified' },
      ];

      const mockOctokit = {
        rest: {
          pulls: {
            listFiles: vi.fn().mockResolvedValue({ data: mockFiles }),
          },
        },
      };

      vi.mocked(github.getOctokit).mockReturnValue(mockOctokit as ReturnType<typeof github.getOctokit>);

      const context = {
        repo: { owner: 'test-owner', repo: 'test-repo' },
        payload: { pull_request: { number: 123 } },
      };

      const files = await getPullRequestFiles('fake-token', context as typeof github.context);

      expect(files).toHaveLength(2);
      expect(files.some((f) => f.status === 'removed')).toBe(false);
    });

    it('should include renamed files', async () => {
      const mockFiles = [
        { filename: 'new-name.html', status: 'renamed', previous_filename: 'old-name.html' },
      ];

      const mockOctokit = {
        rest: {
          pulls: {
            listFiles: vi.fn().mockResolvedValue({ data: mockFiles }),
          },
        },
      };

      vi.mocked(github.getOctokit).mockReturnValue(mockOctokit as ReturnType<typeof github.getOctokit>);

      const context = {
        repo: { owner: 'test-owner', repo: 'test-repo' },
        payload: { pull_request: { number: 123 } },
      };

      const files = await getPullRequestFiles('fake-token', context as typeof github.context);

      expect(files).toHaveLength(1);
      expect(files[0]?.status).toBe('renamed');
    });

    it('should throw error when not in pull_request context', async () => {
      const context = {
        repo: { owner: 'test-owner', repo: 'test-repo' },
        payload: {},
      };

      await expect(
        getPullRequestFiles('fake-token', context as typeof github.context)
      ).rejects.toThrow('This action must be run in a pull_request context');
    });

    it('should call GitHub API with correct parameters', async () => {
      const mockListFiles = vi.fn().mockResolvedValue({ data: [] });
      const mockOctokit = {
        rest: {
          pulls: {
            listFiles: mockListFiles,
          },
        },
      };

      vi.mocked(github.getOctokit).mockReturnValue(mockOctokit as ReturnType<typeof github.getOctokit>);

      const context = {
        repo: { owner: 'test-owner', repo: 'test-repo' },
        payload: { pull_request: { number: 456 } },
      };

      await getPullRequestFiles('fake-token', context as typeof github.context);

      expect(mockListFiles).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 456,
        per_page: 100,
      });
    });
  });

  describe('filterFilesByPattern', () => {
    const testFiles: PullRequestFile[] = [
      { filename: 'index.html', status: 'added' },
      { filename: 'src/page.html', status: 'modified' },
      { filename: 'styles.css', status: 'added' },
      { filename: 'app.php', status: 'modified' },
      { filename: 'vendor/lib.html', status: 'added' },
      { filename: 'node_modules/pkg/index.html', status: 'added' },
      { filename: 'src/component.vue', status: 'added' },
    ];

    it('should filter files by include patterns', () => {
      const result = filterFilesByPattern(testFiles, ['**/*.html'], []);

      expect(result).toHaveLength(4);
      expect(result.map((f) => f.filename)).toEqual([
        'index.html',
        'src/page.html',
        'vendor/lib.html',
        'node_modules/pkg/index.html',
      ]);
    });

    it('should support multiple include patterns', () => {
      const result = filterFilesByPattern(testFiles, ['**/*.html', '**/*.php'], []);

      expect(result).toHaveLength(5);
      expect(result.some((f) => f.filename === 'app.php')).toBe(true);
    });

    it('should exclude files matching exclude patterns', () => {
      const result = filterFilesByPattern(testFiles, ['**/*.html'], ['vendor/**', 'node_modules/**']);

      expect(result).toHaveLength(2);
      expect(result.map((f) => f.filename)).toEqual(['index.html', 'src/page.html']);
    });

    it('should return empty array when no files match', () => {
      const result = filterFilesByPattern(testFiles, ['**/*.ts'], []);

      expect(result).toHaveLength(0);
    });

    it('should handle empty file list', () => {
      const result = filterFilesByPattern([], ['**/*.html'], []);

      expect(result).toHaveLength(0);
    });

    it('should handle files with deep paths', () => {
      const deepFiles: PullRequestFile[] = [
        { filename: 'src/components/deep/nested/page.html', status: 'added' },
      ];

      const result = filterFilesByPattern(deepFiles, ['**/*.html'], []);

      expect(result).toHaveLength(1);
    });

    it('should apply exclude patterns after include patterns', () => {
      const result = filterFilesByPattern(
        testFiles,
        ['**/*.html', '**/*.css'],
        ['**/*.css']
      );

      expect(result).toHaveLength(4);
      expect(result.every((f) => !f.filename.endsWith('.css'))).toBe(true);
    });
  });

  describe('getFileContents', () => {
    it('should read file contents for each file', async () => {
      const files: PullRequestFile[] = [
        { filename: 'index.html', status: 'added' },
        { filename: 'page.html', status: 'modified' },
      ];

      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        if (path === 'index.html') return '<html>index</html>';
        if (path === 'page.html') return '<html>page</html>';
        throw new Error('File not found');
      });

      const result = await getFileContents(files);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        filename: 'index.html',
        status: 'added',
        content: '<html>index</html>',
      });
      expect(result[1]).toEqual({
        filename: 'page.html',
        status: 'modified',
        content: '<html>page</html>',
      });
    });

    it('should skip files that do not exist and log warning', async () => {
      const files: PullRequestFile[] = [
        { filename: 'exists.html', status: 'added' },
        { filename: 'missing.html', status: 'added' },
      ];

      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        if (path === 'exists.html') return '<html>exists</html>';
        const error = new Error('ENOENT: no such file or directory');
        (error as NodeJS.ErrnoException).code = 'ENOENT';
        throw error;
      });

      const result = await getFileContents(files);

      expect(result).toHaveLength(1);
      expect(result[0]?.filename).toBe('exists.html');
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('missing.html')
      );
    });

    it('should handle empty file list', async () => {
      const result = await getFileContents([]);

      expect(result).toHaveLength(0);
    });

    it('should skip files with read errors and log warning', async () => {
      const files: PullRequestFile[] = [{ filename: 'error.html', status: 'added' }];

      vi.mocked(fs.readFile).mockRejectedValue(new Error('Permission denied'));

      const result = await getFileContents(files);

      expect(result).toHaveLength(0);
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('error.html')
      );
    });

    it('should read files with correct encoding', async () => {
      const files: PullRequestFile[] = [{ filename: 'test.html', status: 'added' }];

      vi.mocked(fs.readFile).mockResolvedValue('content');

      await getFileContents(files);

      expect(fs.readFile).toHaveBeenCalledWith('test.html', 'utf-8');
    });
  });
});
