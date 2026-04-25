/**
 * Script Integrity Checker - GitHub Action Entry Point
 *
 * Validates Subresource Integrity (SRI) attributes in HTML files
 * within Pull Request changes.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { loadConfig } from './config-loader.js';
import { filterFilesByPattern, getFileContents, getPullRequestFiles } from './file-detector.js';
import { verifyResourcesHashes } from './hash-verifier.js';
import { parseHtml } from './html-parser.js';
import { validateResources } from './integrity-validator.js';
import {
  createReport,
  type FileResult,
  outputAllAnnotations,
  outputJsonReport,
  outputTextReport,
} from './reporter.js';

async function run(): Promise<void> {
  try {
    const config = loadConfig();
    core.info('Script Integrity Checker started');
    core.info(`File patterns: ${config.filePatterns.join(', ')}`);
    if (config.excludePatterns.length > 0) {
      core.info(`Exclude patterns: ${config.excludePatterns.join(', ')}`);
    }

    const token = core.getInput('github-token', { required: true });
    const prFiles = await getPullRequestFiles(token, github.context);
    core.info(`Found ${prFiles.length} changed files in PR`);

    const matchedFiles = filterFilesByPattern(prFiles, config.filePatterns, config.excludePatterns);
    core.info(`${matchedFiles.length} files match the configured patterns`);

    if (matchedFiles.length === 0) {
      core.info('No files to check. Exiting successfully.');
      return;
    }

    const filesWithContent = await getFileContents(matchedFiles);
    core.info(`Loaded content from ${filesWithContent.length} files`);

    const fileResults: FileResult[] = [];

    for (const file of filesWithContent) {
      const { resources, errors } = parseHtml(file.content, file.filename);

      if (errors.length > 0) {
        for (const error of errors) {
          core.warning(error);
        }
      }

      const issues = validateResources(resources, {
        checkCrossorigin: config.checkCrossorigin,
        failMode: config.failMode,
      });

      let hashResults: Awaited<ReturnType<typeof verifyResourcesHashes>> = [];
      if (config.verifyHashes) {
        hashResults = await verifyResourcesHashes(resources, {
          timeout: config.fetchTimeout,
        });
      }

      fileResults.push({
        filename: file.filename,
        issues,
        hashResults,
      });
    }

    const report = createReport(fileResults);

    if (config.outputFormat === 'json') {
      outputJsonReport(report);
    } else {
      outputTextReport(report);
    }

    outputAllAnnotations(report);

    const hasErrors = report.summary.errorCount > 0 || report.summary.hashVerificationsFailed > 0;

    if (hasErrors && config.failMode === 'fail') {
      core.setFailed(
        `Found ${report.summary.errorCount} errors and ${report.summary.hashVerificationsFailed} hash verification failures`,
      );
    } else if (report.summary.totalIssues > 0 || report.summary.hashVerificationsFailed > 0) {
      core.warning(
        `Found ${report.summary.totalIssues} issues and ${report.summary.hashVerificationsFailed} hash verification failures`,
      );
    } else {
      core.info('All integrity checks passed!');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(`Action failed: ${message}`);
  }
}

run();
