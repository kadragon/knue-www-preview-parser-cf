# Research: CI Setup with GitHub Actions

## Goal
Establish a CI pipeline to automatically run type checks and tests on Pull Requests and pushes to main.

## Current Stack
- **Runtime:** Cloudflare Workers
- **Language:** TypeScript
- **Package Manager:** npm
- **Test Runner:** Vitest (`@cloudflare/vitest-pool-workers`)
- **Linter/Type Checker:** `tsc`

## Requirements
1.  **Triggers:**
    - Push to `main`
    - Pull Request to `main`
2.  **Jobs:**
    - `test`:
        - Checkout code
        - Install Node.js (LTS)
        - Install dependencies (`npm ci`)
        - Run Type Check (`npm run type-check`)
        - Run Tests (`npm run test`)
3.  **Dependabot:**
    - Enable version updates for GitHub Actions.

## Implementation Details

### GitHub Actions Workflow (`.github/workflows/ci.yml`)

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Type Check
        run: npm run type-check

      - name: Run Tests
        run: npm run test
```

### Dependabot Configuration (`.github/dependabot.yml`)

Current content needs to be appended with:

```yaml
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

## Verification
- Create the workflow file.
- Create/Update dependabot config.
- Push changes.
- Verify Actions tab in GitHub (simulated by checking file content since I cannot access external UI).
