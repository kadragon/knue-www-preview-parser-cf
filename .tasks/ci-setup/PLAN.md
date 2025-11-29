# Plan: CI Setup

## 1. Dependabot Configuration
- [ ] Update `.github/dependabot.yml` to include `github-actions` ecosystem.

## 2. GitHub Actions Workflow
- [ ] Create `.github/workflows/ci.yml`.
- [ ] Define triggers (push/pr to main).
- [ ] Define `test` job with Node.js setup, dependency installation, type checking, and testing.

## 3. Verification
- [ ] Run `npm run type-check` locally to ensure it passes.
- [ ] Run `npm run test` locally to ensure it passes.
- [ ] Commit changes.
