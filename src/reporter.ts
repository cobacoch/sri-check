import * as core from '@actions/core';
import type { HashVerificationResult } from './hash-verifier.js';
import type { ValidationIssue } from './integrity-validator.js';

export interface FileResult {
  filename: string;
  issues: ValidationIssue[];
  hashResults: HashVerificationResult[];
}

export interface ReportSummary {
  totalFiles: number;
  filesWithIssues: number;
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  hashVerificationsFailed: number;
}

export interface Report {
  files: FileResult[];
  summary: ReportSummary;
}

export function createReport(fileResults: FileResult[]): Report {
  let errorCount = 0;
  let warningCount = 0;
  let hashVerificationsFailed = 0;
  let filesWithIssues = 0;

  for (const file of fileResults) {
    const hasIssues = file.issues.length > 0 || file.hashResults.some((r) => !r.verified);
    if (hasIssues) {
      filesWithIssues++;
    }

    for (const issue of file.issues) {
      if (issue.severity === 'error') {
        errorCount++;
      } else {
        warningCount++;
      }
    }

    for (const result of file.hashResults) {
      if (!result.verified) {
        hashVerificationsFailed++;
      }
    }
  }

  return {
    files: fileResults,
    summary: {
      totalFiles: fileResults.length,
      filesWithIssues,
      totalIssues: errorCount + warningCount,
      errorCount,
      warningCount,
      hashVerificationsFailed,
    },
  };
}

export function outputTextReport(report: Report): void {
  core.info('=== Script Integrity Check Report ===');
  core.info('');

  for (const file of report.files) {
    const hasIssues = file.issues.length > 0 || file.hashResults.some((r) => !r.verified);
    if (!hasIssues) {
      continue;
    }

    core.info(`📄 ${file.filename}`);

    for (const issue of file.issues) {
      const prefix = issue.severity === 'error' ? '❌' : '⚠️';
      core.info(`  ${prefix} Line ${issue.resource.line}: ${issue.message}`);
    }

    for (const result of file.hashResults) {
      if (!result.verified) {
        core.info(
          `  ❌ Line ${result.resource.line}: Hash verification failed for ${result.resource.src}: ${result.error}`,
        );
      }
    }

    core.info('');
  }

  core.info('--- Summary ---');
  core.info(`Files checked: ${report.summary.totalFiles}`);
  core.info(`Files with issues: ${report.summary.filesWithIssues}`);
  core.info(`Errors: ${report.summary.errorCount}`);
  core.info(`Warnings: ${report.summary.warningCount}`);
  if (report.summary.hashVerificationsFailed > 0) {
    core.info(`Hash verification failures: ${report.summary.hashVerificationsFailed}`);
  }
}

export function outputJsonReport(report: Report): void {
  const jsonOutput = JSON.stringify(
    {
      files: report.files.map((file) => ({
        filename: file.filename,
        issues: file.issues.map((issue) => ({
          type: issue.type,
          severity: issue.severity,
          message: issue.message,
          line: issue.resource.line,
          column: issue.resource.column,
          src: issue.resource.src,
        })),
        hashResults: file.hashResults.map((result) => ({
          verified: result.verified,
          error: result.error,
          src: result.resource.src,
          line: result.resource.line,
          column: result.resource.column,
        })),
      })),
      summary: report.summary,
    },
    null,
    2,
  );

  core.info(jsonOutput);
}

export function outputAnnotations(report: Report, filename: string): void {
  for (const file of report.files) {
    if (file.filename !== filename) {
      continue;
    }

    for (const issue of file.issues) {
      const properties: core.AnnotationProperties = {
        file: file.filename,
        startLine: issue.resource.line,
        startColumn: issue.resource.column,
      };

      if (issue.severity === 'error') {
        core.error(issue.message, properties);
      } else {
        core.warning(issue.message, properties);
      }
    }

    for (const result of file.hashResults) {
      if (!result.verified) {
        core.error(`Hash verification failed: ${result.error}`, {
          file: file.filename,
          startLine: result.resource.line,
          startColumn: result.resource.column,
        });
      }
    }
  }
}

export function outputAllAnnotations(report: Report): void {
  for (const file of report.files) {
    outputAnnotations(report, file.filename);
  }
}
