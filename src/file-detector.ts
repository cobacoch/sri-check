import * as github from '@actions/github';
import * as core from '@actions/core';
import * as fs from 'node:fs/promises';
import { minimatch } from 'minimatch';

export interface PullRequestFile {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed' | 'copied' | 'changed' | 'unchanged';
}

export interface FileWithContent extends PullRequestFile {
  content: string;
}

type GitHubContext = typeof github.context;

export async function getPullRequestFiles(
  token: string,
  context: GitHubContext
): Promise<PullRequestFile[]> {
  const pullRequest = context.payload.pull_request;

  if (!pullRequest) {
    throw new Error('This action must be run in a pull_request context');
  }

  const octokit = github.getOctokit(token);

  const { data: files } = await octokit.rest.pulls.listFiles({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: pullRequest.number as number,
    per_page: 100,
  });

  return files
    .filter((file) => file.status !== 'removed')
    .map((file) => ({
      filename: file.filename,
      status: file.status as PullRequestFile['status'],
    }));
}

function matchesAnyPattern(filename: string, patterns: string[]): boolean {
  return patterns.some((pattern) => minimatch(filename, pattern, { matchBase: true }));
}

export function filterFilesByPattern(
  files: PullRequestFile[],
  includePatterns: string[],
  excludePatterns: string[]
): PullRequestFile[] {
  return files.filter((file) => {
    const included = matchesAnyPattern(file.filename, includePatterns);
    if (!included) {
      return false;
    }

    if (excludePatterns.length > 0) {
      const excluded = matchesAnyPattern(file.filename, excludePatterns);
      if (excluded) {
        return false;
      }
    }

    return true;
  });
}

export async function getFileContents(files: PullRequestFile[]): Promise<FileWithContent[]> {
  const results: FileWithContent[] = [];

  for (const file of files) {
    try {
      const content = await fs.readFile(file.filename, 'utf-8');
      results.push({
        ...file,
        content,
      });
    } catch (error) {
      core.warning(`Skipping file ${file.filename}: ${(error as Error).message}`);
    }
  }

  return results;
}
