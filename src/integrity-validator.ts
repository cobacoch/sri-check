import type { ExternalResource } from './html-parser.js';

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  resource: ExternalResource;
  type:
    | 'missing-integrity'
    | 'invalid-integrity-format'
    | 'missing-crossorigin'
    | 'invalid-crossorigin';
  severity: IssueSeverity;
  message: string;
}

export interface ValidationOptions {
  checkCrossorigin: boolean;
  failMode: 'fail' | 'warn';
}

const VALID_CROSSORIGIN_VALUES = ['anonymous', 'use-credentials', ''];

function isValidBase64(value: string): boolean {
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  return base64Regex.test(value);
}

function isValidIntegrityFormat(integrity: string): boolean {
  const parts = integrity.split(/\s+/);
  if (parts.length === 0) {
    return false;
  }

  return parts.every((part) => {
    const match = part.match(/^(sha256|sha384|sha512)-(.+)$/);
    if (!match) {
      return false;
    }
    const hash = match[2];
    return hash !== undefined && isValidBase64(hash);
  });
}

function isValidCrossoriginValue(crossorigin: string): boolean {
  return VALID_CROSSORIGIN_VALUES.includes(crossorigin);
}

export function validateResource(
  resource: ExternalResource,
  options: ValidationOptions,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const severity: IssueSeverity = options.failMode === 'fail' ? 'error' : 'warning';

  if (resource.disabled) {
    return issues;
  }

  if (resource.integrity === null) {
    issues.push({
      resource,
      type: 'missing-integrity',
      severity,
      message: `Missing integrity attribute on ${resource.tagName} tag (${resource.src})`,
    });
    return issues;
  }

  if (!isValidIntegrityFormat(resource.integrity)) {
    issues.push({
      resource,
      type: 'invalid-integrity-format',
      severity,
      message: `Invalid integrity format: ${resource.integrity}`,
    });
  }

  if (options.checkCrossorigin) {
    if (resource.crossorigin === null) {
      issues.push({
        resource,
        type: 'missing-crossorigin',
        severity: 'warning',
        message: `Missing crossorigin attribute on ${resource.tagName} tag with integrity (${resource.src})`,
      });
    } else if (!isValidCrossoriginValue(resource.crossorigin)) {
      issues.push({
        resource,
        type: 'invalid-crossorigin',
        severity: 'warning',
        message: `Invalid crossorigin value: ${resource.crossorigin}`,
      });
    }
  }

  return issues;
}

export function validateResources(
  resources: ExternalResource[],
  options: ValidationOptions,
): ValidationIssue[] {
  return resources.flatMap((resource) => validateResource(resource, options));
}
