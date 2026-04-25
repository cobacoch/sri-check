import * as core from '@actions/core';

export interface Config {
  filePatterns: string[];
  excludePatterns: string[];
  failMode: 'fail' | 'warn';
  verifyHashes: boolean;
  checkCrossorigin: boolean;
  fetchTimeout: number;
  outputFormat: 'text' | 'json';
}

const DEFAULT_FILE_PATTERNS = ['**/*.html', '**/*.htm', '**/*.php'];
const DEFAULT_FETCH_TIMEOUT = 10000;

function parseCommaSeparated(value: string): string[] {
  if (!value.trim()) {
    return [];
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseBoolean(value: string): boolean {
  return value.toLowerCase() === 'true';
}

function parseNumber(value: string, defaultValue: number): number {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

function parseFailMode(value: string): 'fail' | 'warn' {
  if (value === 'warn') {
    return 'warn';
  }
  return 'fail';
}

function parseOutputFormat(value: string): 'text' | 'json' {
  if (value === 'json') {
    return 'json';
  }
  return 'text';
}

export function loadConfig(): Config {
  const filePatternsInput = core.getInput('file-patterns');
  const excludePatternsInput = core.getInput('exclude-patterns');
  const failModeInput = core.getInput('fail-mode');
  const verifyHashesInput = core.getInput('verify-hashes');
  const checkCrossoriginInput = core.getInput('check-crossorigin');
  const fetchTimeoutInput = core.getInput('fetch-timeout');
  const outputFormatInput = core.getInput('output-format');

  const filePatterns = parseCommaSeparated(filePatternsInput);

  return {
    filePatterns: filePatterns.length > 0 ? filePatterns : DEFAULT_FILE_PATTERNS,
    excludePatterns: parseCommaSeparated(excludePatternsInput),
    failMode: parseFailMode(failModeInput),
    verifyHashes: parseBoolean(verifyHashesInput),
    checkCrossorigin: parseBoolean(checkCrossoriginInput),
    fetchTimeout: parseNumber(fetchTimeoutInput, DEFAULT_FETCH_TIMEOUT),
    outputFormat: parseOutputFormat(outputFormatInput),
  };
}
