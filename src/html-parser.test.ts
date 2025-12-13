import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as core from '@actions/core';
import { parseHtml, type ExternalResource } from './html-parser.js';

vi.mock('@actions/core');

describe('HtmlParser', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('parseHtml', () => {
    describe('script tag extraction', () => {
      it('should extract external script tags with src attribute', () => {
        const html = '<html><head><script src="app.js"></script></head></html>';
        const result = parseHtml(html, 'test.html');

        expect(result.resources).toHaveLength(1);
        expect(result.resources[0]).toMatchObject({
          tagName: 'script',
          src: 'app.js',
        });
      });

      it('should ignore inline scripts without src', () => {
        const html = '<html><head><script>console.log("inline")</script></head></html>';
        const result = parseHtml(html, 'test.html');

        expect(result.resources).toHaveLength(0);
      });

      it('should extract integrity attribute', () => {
        const html =
          '<script src="app.js" integrity="sha384-abc123"></script>';
        const result = parseHtml(html, 'test.html');

        expect(result.resources[0]?.integrity).toBe('sha384-abc123');
      });

      it('should extract crossorigin attribute', () => {
        const html = '<script src="app.js" crossorigin="anonymous"></script>';
        const result = parseHtml(html, 'test.html');

        expect(result.resources[0]?.crossorigin).toBe('anonymous');
      });

      it('should return null for missing integrity', () => {
        const html = '<script src="app.js"></script>';
        const result = parseHtml(html, 'test.html');

        expect(result.resources[0]?.integrity).toBeNull();
      });

      it('should return null for missing crossorigin', () => {
        const html = '<script src="app.js"></script>';
        const result = parseHtml(html, 'test.html');

        expect(result.resources[0]?.crossorigin).toBeNull();
      });
    });

    describe('link tag extraction', () => {
      it('should extract stylesheet link tags', () => {
        const html = '<link rel="stylesheet" href="styles.css">';
        const result = parseHtml(html, 'test.html');

        expect(result.resources).toHaveLength(1);
        expect(result.resources[0]).toMatchObject({
          tagName: 'link',
          src: 'styles.css',
        });
      });

      it('should ignore link tags without rel="stylesheet"', () => {
        const html = '<link rel="icon" href="favicon.ico">';
        const result = parseHtml(html, 'test.html');

        expect(result.resources).toHaveLength(0);
      });

      it('should ignore link tags without href', () => {
        const html = '<link rel="stylesheet">';
        const result = parseHtml(html, 'test.html');

        expect(result.resources).toHaveLength(0);
      });

      it('should extract integrity from link tags', () => {
        const html =
          '<link rel="stylesheet" href="styles.css" integrity="sha256-xyz789">';
        const result = parseHtml(html, 'test.html');

        expect(result.resources[0]?.integrity).toBe('sha256-xyz789');
      });

      it('should extract crossorigin from link tags', () => {
        const html =
          '<link rel="stylesheet" href="styles.css" crossorigin="use-credentials">';
        const result = parseHtml(html, 'test.html');

        expect(result.resources[0]?.crossorigin).toBe('use-credentials');
      });
    });

    describe('line and column calculation', () => {
      it('should calculate correct line number for script', () => {
        const html = '<html>\n<head>\n<script src="app.js"></script>\n</head>\n</html>';
        const result = parseHtml(html, 'test.html');

        expect(result.resources[0]?.line).toBe(3);
      });

      it('should calculate correct column for script', () => {
        const html = '<html>\n  <script src="app.js"></script>\n</html>';
        const result = parseHtml(html, 'test.html');

        expect(result.resources[0]?.column).toBe(3);
      });

      it('should calculate correct line for link', () => {
        const html = '<html>\n<head>\n\n<link rel="stylesheet" href="styles.css">\n</head>\n</html>';
        const result = parseHtml(html, 'test.html');

        expect(result.resources[0]?.line).toBe(4);
      });

      it('should handle multiple resources with correct positions', () => {
        const html = `<html>
<head>
<script src="first.js"></script>
<link rel="stylesheet" href="styles.css">
<script src="second.js"></script>
</head>
</html>`;
        const result = parseHtml(html, 'test.html');

        expect(result.resources).toHaveLength(3);
        const scripts = result.resources.filter((r) => r.tagName === 'script');
        const links = result.resources.filter((r) => r.tagName === 'link');
        expect(scripts).toHaveLength(2);
        expect(links).toHaveLength(1);
        expect(scripts[0]?.line).toBe(3);
        expect(links[0]?.line).toBe(4);
        expect(scripts[1]?.line).toBe(5);
      });
    });

    describe('disable comment handling', () => {
      it('should mark resources after disable comment as disabled', () => {
        const html = `<html>
<!-- sri-check-disable-next-line -->
<script src="ignored.js"></script>
<script src="checked.js"></script>
</html>`;
        const result = parseHtml(html, 'test.html');

        expect(result.resources).toHaveLength(2);
        expect(result.resources[0]?.disabled).toBe(true);
        expect(result.resources[1]?.disabled).toBe(false);
      });

      it('should handle disable comment for link tags', () => {
        const html = `<html>
<!-- sri-check-disable-next-line -->
<link rel="stylesheet" href="ignored.css">
</html>`;
        const result = parseHtml(html, 'test.html');

        expect(result.resources[0]?.disabled).toBe(true);
      });

      it('should handle multiple disable comments', () => {
        const html = `<html>
<!-- sri-check-disable-next-line -->
<script src="first.js"></script>
<script src="second.js"></script>
<!-- sri-check-disable-next-line -->
<script src="third.js"></script>
</html>`;
        const result = parseHtml(html, 'test.html');

        expect(result.resources[0]?.disabled).toBe(true);
        expect(result.resources[1]?.disabled).toBe(false);
        expect(result.resources[2]?.disabled).toBe(true);
      });

      it('should allow whitespace in disable comment', () => {
        const html = `<html>
<!--   sri-check-disable-next-line   -->
<script src="ignored.js"></script>
</html>`;
        const result = parseHtml(html, 'test.html');

        expect(result.resources[0]?.disabled).toBe(true);
      });
    });

    describe('error handling', () => {
      it('should return empty resources for empty content', () => {
        const result = parseHtml('', 'test.html');

        expect(result.resources).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
      });

      it('should handle malformed HTML gracefully', () => {
        const html = '<script src="app.js">';
        const result = parseHtml(html, 'test.html');

        expect(result.resources).toHaveLength(1);
        expect(result.errors).toHaveLength(0);
      });

      it('should extract resources from complex nested HTML', () => {
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test</title>
  <link rel="stylesheet" href="main.css" integrity="sha384-hash1" crossorigin="anonymous">
</head>
<body>
  <div id="app">
    <script src="vendor.js"></script>
    <script src="app.js" integrity="sha512-hash2"></script>
  </div>
</body>
</html>`;
        const result = parseHtml(html, 'test.html');

        expect(result.resources).toHaveLength(3);
        const scripts = result.resources.filter((r) => r.tagName === 'script');
        const links = result.resources.filter((r) => r.tagName === 'link');

        expect(links).toHaveLength(1);
        expect(links[0]?.integrity).toBe('sha384-hash1');

        expect(scripts).toHaveLength(2);
        expect(scripts.find((s) => s.src === 'vendor.js')?.integrity).toBeNull();
        expect(scripts.find((s) => s.src === 'app.js')?.integrity).toBe('sha512-hash2');
      });
    });

    describe('CDN URLs', () => {
      it('should extract full CDN URLs', () => {
        const html =
          '<script src="https://cdn.example.com/lib.js" integrity="sha384-abc" crossorigin="anonymous"></script>';
        const result = parseHtml(html, 'test.html');

        expect(result.resources[0]?.src).toBe('https://cdn.example.com/lib.js');
        expect(result.resources[0]?.integrity).toBe('sha384-abc');
        expect(result.resources[0]?.crossorigin).toBe('anonymous');
      });

      it('should handle protocol-relative URLs', () => {
        const html = '<script src="//cdn.example.com/lib.js"></script>';
        const result = parseHtml(html, 'test.html');

        expect(result.resources[0]?.src).toBe('//cdn.example.com/lib.js');
      });
    });
  });
});
