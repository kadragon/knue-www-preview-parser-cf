# Plan: CI Setup

## 1. Dependabot Configuration
- [x] Update `.github/dependabot.yml` to include `github-actions` ecosystem.

## 2. GitHub Actions Workflow
- [x] Create `.github/workflows/ci.yml`.
- [x] Define triggers (push/pr to main).
- [x] Define `test` job with Node.js setup, dependency installation, type checking, build, and testing.

## 3. Verification
- [x] Run `npm run type-check` locally to ensure it passes.
- [x] Run `npm run build` locally to ensure it passes.
- [x] Run `npm run test:ci` locally to ensure it passes.
- [x] Commit changes.