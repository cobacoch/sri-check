# SRI Check

A GitHub Action that validates Subresource Integrity (SRI) attributes on `<script>` and `<link rel="stylesheet">` tags in Pull Request changes.

## Features

- Automatically detects HTML/HTM/PHP files changed in PRs
- Checks for the presence of `integrity` attributes on external scripts and stylesheets
- Validates `integrity` attribute format (sha256/sha384/sha512)
- Optionally fetches resources and verifies hash values
- Checks for `crossorigin` attributes
- Displays inline errors/warnings on GitHub code view
- Supports disabling checks for specific tags via comments

## Usage

### Basic Example

```yaml
name: Check SRI

on:
  pull_request:
    paths:
      - '**.html'
      - '**.htm'
      - '**.php'

jobs:
  sri-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: cobacoch/sri-check@v1
```

### Full Configuration Example

```yaml
- uses: cobacoch/sri-check@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    file-patterns: '**/*.html,**/*.htm,**/*.php,**/*.vue'
    exclude-patterns: 'vendor/**,node_modules/**,dist/**'
    fail-mode: fail
    verify-hashes: true
    check-crossorigin: true
    fetch-timeout: 15000
    output-format: text
```

## Inputs

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `github-token` | No | `${{ github.token }}` | GitHub token for API access |
| `file-patterns` | No | `**/*.html,**/*.htm,**/*.php` | Glob patterns for files to check (comma-separated) |
| `exclude-patterns` | No | ` ` | Glob patterns for files to exclude (comma-separated) |
| `fail-mode` | No | `fail` | Behaviour when issues are found: `fail` or `warn` |
| `verify-hashes` | No | `false` | Fetch external resources and verify hash values |
| `check-crossorigin` | No | `false` | Check for `crossorigin` attribute on tags with `integrity` |
| `fetch-timeout` | No | `10000` | Timeout for fetching external resources (milliseconds) |
| `output-format` | No | `text` | Output format: `text` or `json` |

## Detected Issues

### Errors (cause CI failure when `fail-mode: fail`)

- **missing-integrity**: External resource lacks `integrity` attribute
- **invalid-integrity-format**: `integrity` attribute has invalid format
- **Hash mismatch**: Resource hash does not match declared value (when `verify-hashes: true`)

### Warnings

- **missing-crossorigin**: Tag with `integrity` lacks `crossorigin` attribute (when `check-crossorigin: true`)
- **invalid-crossorigin**: `crossorigin` attribute has invalid value

## Disabling Checks

To exclude a specific tag from checks, add a comment on the preceding line:

```html
<!-- sri-check-disable-next-line -->
<script src="https://example.com/legacy-lib.js"></script>
```

## Correct integrity Attribute Examples

```html
<!-- External JavaScript -->
<script
  src="https://cdn.example.com/lib.js"
  integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
  crossorigin="anonymous">
</script>

<!-- External CSS -->
<link
  rel="stylesheet"
  href="https://cdn.example.com/styles.css"
  integrity="sha256-abc123def456..."
  crossorigin="anonymous">
```

## Generating integrity Attributes

### Using OpenSSL

```bash
# Generate SHA-384 hash
curl -s https://cdn.example.com/lib.js | openssl dgst -sha384 -binary | openssl base64 -A
# Example output: oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC

# Output in integrity attribute format
echo "sha384-$(curl -s https://cdn.example.com/lib.js | openssl dgst -sha384 -binary | openssl base64 -A)"
```

### SRI Hash Generator

You can also generate hashes by entering a URL at [srihash.org](https://www.srihash.org/).

## Output

Results are displayed in two ways:

1. **Inline annotations** - Errors and warnings appear directly on the relevant lines in the PR "Files changed" tab
2. **Actions log** - A full report is written to the GitHub Actions log in the format specified below

### Text Format (default)

```
=== SRI Check Report ===

index.html
  Line 15: Missing integrity attribute on script tag (https://cdn.example.com/lib.js)
  Line 20: Missing crossorigin attribute on script tag with integrity (https://cdn.example.com/other.js)

--- Summary ---
Files checked: 3
Files with issues: 1
Errors: 1
Warnings: 1
```

### JSON Format

```json
{
  "files": [
    {
      "filename": "index.html",
      "issues": [
        {
          "type": "missing-integrity",
          "severity": "error",
          "message": "Missing integrity attribute on script tag (https://cdn.example.com/lib.js)",
          "line": 15,
          "column": 5,
          "src": "https://cdn.example.com/lib.js"
        }
      ],
      "hashResults": []
    }
  ],
  "summary": {
    "totalFiles": 3,
    "filesWithIssues": 1,
    "totalIssues": 1,
    "errorCount": 1,
    "warningCount": 0,
    "hashVerificationsFailed": 0
  }
}
```

## Privacy

This action does not collect or transmit any personal data.

When `verify-hashes` is enabled, this action fetches external resources (scripts and stylesheets) from the URLs specified in your HTML files to verify their integrity hashes. Only URLs explicitly written in your source files are accessed, and no data is sent to external servers.

## Licence

MIT License
