import * as crypto from 'node:crypto';
import type { ExternalResource } from './html-parser.js';

export type HashAlgorithm = 'sha256' | 'sha384' | 'sha512';

export interface HashVerificationResult {
  resource: ExternalResource;
  verified: boolean;
  error?: string;
  expected?: string;
  actual?: string;
}

export interface HashVerifierOptions {
  timeout: number;
}

function parseIntegrityHash(
  integrity: string
): { algorithm: HashAlgorithm; hash: string } | null {
  const parts = integrity.split(/\s+/);
  for (const part of parts) {
    const match = part.match(/^(sha256|sha384|sha512)-(.+)$/);
    if (match && match[1] && match[2]) {
      return {
        algorithm: match[1] as HashAlgorithm,
        hash: match[2],
      };
    }
  }
  return null;
}

function calculateHash(content: Buffer, algorithm: HashAlgorithm): string {
  return crypto.createHash(algorithm).update(content).digest('base64');
}

function isHttpsUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('//');
}

export async function verifyResourceHash(
  resource: ExternalResource,
  options: HashVerifierOptions
): Promise<HashVerificationResult> {
  if (!resource.integrity) {
    return {
      resource,
      verified: false,
      error: 'No integrity attribute',
    };
  }

  const parsed = parseIntegrityHash(resource.integrity);
  if (!parsed) {
    return {
      resource,
      verified: false,
      error: 'Invalid integrity format',
    };
  }

  if (!isHttpsUrl(resource.src)) {
    return {
      resource,
      verified: false,
      error: 'Only HTTPS URLs are supported for hash verification',
    };
  }

  const url = resource.src.startsWith('//')
    ? `https:${resource.src}`
    : resource.src;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        resource,
        verified: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const actualHash = calculateHash(buffer, parsed.algorithm);

    if (actualHash === parsed.hash) {
      return {
        resource,
        verified: true,
        expected: parsed.hash,
        actual: actualHash,
      };
    } else {
      return {
        resource,
        verified: false,
        expected: parsed.hash,
        actual: actualHash,
        error: 'Hash mismatch',
      };
    }
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'Request timed out'
        : (error as Error).message;

    return {
      resource,
      verified: false,
      error: `Fetch failed: ${message}`,
    };
  }
}

export async function verifyResourcesHashes(
  resources: ExternalResource[],
  options: HashVerifierOptions
): Promise<HashVerificationResult[]> {
  const results: HashVerificationResult[] = [];

  for (const resource of resources) {
    if (resource.disabled || !resource.integrity) {
      continue;
    }

    const result = await verifyResourceHash(resource, options);
    results.push(result);
  }

  return results;
}
