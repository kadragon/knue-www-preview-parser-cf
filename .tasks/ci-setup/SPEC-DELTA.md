# Spec Delta: CI/CD Pipeline

## CI Workflow

### Triggering
- The CI pipeline MUST run on every push to the `main` branch.
- The CI pipeline MUST run on every Pull Request targeting the `main` branch.

### Jobs
- **Test Job**:
    - MUST use the latest stable Ubuntu image.
    - MUST use Node.js v20 (LTS).
    - MUST install dependencies using `npm ci` for deterministic builds.
    - MUST execute `npm run type-check` to verify TypeScript types.
    - MUST execute `npm run test` to run Vitest suite.

## Dependency Management
- **Dependabot**:
    - MUST monitor `npm` packages (already exists).
    - MUST monitor `github-actions` for workflow updates.
    - Update interval SHOULD be weekly.
