import * as core from '@actions/core';
import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

export interface ExternalResource {
  tagName: 'script' | 'link';
  src: string;
  integrity: string | null;
  crossorigin: string | null;
  line: number;
  column: number;
  disabled: boolean;
}

export interface ParseResult {
  resources: ExternalResource[];
  errors: string[];
}

function calculateLineAndColumn(
  content: string,
  startIndex: number
): { line: number; column: number } {
  const beforeElement = content.substring(0, startIndex);
  const lines = beforeElement.split('\n');
  const line = lines.length;
  const column = (lines[lines.length - 1]?.length ?? 0) + 1;
  return { line, column };
}

function findDisabledLines(content: string): Set<number> {
  const disabledLines = new Set<number>();
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line && /<!--\s*sri-check-disable-next-line\s*-->/.test(line)) {
      disabledLines.add(i + 2);
    }
  }

  return disabledLines;
}

export function parseHtml(content: string, filename: string): ParseResult {
  const resources: ExternalResource[] = [];
  const errors: string[] = [];

  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(content, {
      xml: {
        withStartIndices: true,
      },
    });
  } catch (error) {
    const message = `Failed to parse ${filename}: ${(error as Error).message}`;
    core.warning(message);
    errors.push(message);
    return { resources, errors };
  }

  const disabledLines = findDisabledLines(content);

  $('script[src]').each((_, element) => {
    const startIndex = (element as Element & { startIndex?: number }).startIndex;
    if (startIndex === undefined) {
      return;
    }

    const { line, column } = calculateLineAndColumn(content, startIndex);
    const $el = $(element);

    resources.push({
      tagName: 'script',
      src: $el.attr('src') ?? '',
      integrity: $el.attr('integrity') ?? null,
      crossorigin: $el.attr('crossorigin') ?? null,
      line,
      column,
      disabled: disabledLines.has(line),
    });
  });

  $('link[rel="stylesheet"][href]').each((_, element) => {
    const startIndex = (element as Element & { startIndex?: number }).startIndex;
    if (startIndex === undefined) {
      return;
    }

    const { line, column } = calculateLineAndColumn(content, startIndex);
    const $el = $(element);

    resources.push({
      tagName: 'link',
      src: $el.attr('href') ?? '',
      integrity: $el.attr('integrity') ?? null,
      crossorigin: $el.attr('crossorigin') ?? null,
      line,
      column,
      disabled: disabledLines.has(line),
    });
  });

  return { resources, errors };
}
