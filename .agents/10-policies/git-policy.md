---
id: AG-POLICY-GIT-001
version: 1.0.0
scope: global
status: active
created: 2025-10-18
---

# Git Policy

## Branching Strategy

### Main Branch Protection
- **NEVER** commit directly to `main`
- **NEVER** push to `main` without PR (if using PR workflow)
- `main` contains only production-ready code

### Feature Branches
```
feat/<task-slug>      # New features
fix/<issue>           # Bug fixes
docs/<topic>          # Documentation
refactor/<scope>      # Structural changes
chore/<task>          # Maintenance tasks
```

**Examples:**
```
feat/init-project
feat/bearer-auth
feat/markdown-parser
fix/iframe-access
docs/api-usage
```

### Branch Lifecycle
1. Create from latest `main`
2. Work in feature branch
3. Test thoroughly
4. Merge to `main` (or create PR)
5. Delete feature branch after merge

## Commit Guidelines

### Commit Message Format
```
[Structural|Behavioral] (<scope>) <summary> [<task-slug>]

<optional body>
```

### Categories
- **Structural:** Changes to code organization, no behavior change
  - Rename functions, move files, refactor structure
  - Add types, interfaces, configuration
  
- **Behavioral:** Changes to functionality
  - Add features, fix bugs, modify logic
  - Change API responses, alter algorithms

### Examples
```
[Structural] (project) Initialize TypeScript configuration [init-project]

[Behavioral] (auth) Add bearer token validation [init-project]

[Structural] (parser) Extract markdown conversion to separate module [init-project]

[Behavioral] (parser) Support table detection in documents [init-project]

[Behavioral] (api) Return 504 on parsing timeout [init-project]
```

### Commit Best Practices
- One commit = one logical change
- Commit message describes **why**, not **what**
- Reference task slug in brackets
- Keep commits small and focused
- Commit only after tests pass (Green state)

## What NOT to Commit

### Secrets
- API keys, tokens, passwords
- Environment-specific configuration
- Private keys, certificates

### Generated Files
- `node_modules/`
- `.wrangler/`
- Build artifacts
- Compiled output

### Local Configuration
- `.env` files
- IDE-specific settings (unless agreed upon)
- OS-specific files (`.DS_Store`)

## .gitignore Template

```gitignore
# Dependencies
node_modules/
package-lock.json
pnpm-lock.yaml
yarn.lock

# Cloudflare
.wrangler/
.dev.vars

# Environment
.env
.env.local

# Build
dist/
*.log

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
```

## Pre-Commit Checklist

- [ ] No secrets in code
- [ ] TypeScript compiles (`npm run type-check`)
- [ ] Tests pass (if applicable)
- [ ] Code follows project style
- [ ] Commit message follows format
- [ ] Changes are on feature branch (not `main`)

## Rollback Procedure

### Undo Last Commit (Not Pushed)
```bash
git reset --soft HEAD~1
```

### Undo Last Commit (Already Pushed)
```bash
git revert HEAD
git push
```

### Return to Previous State
```bash
git checkout <commit-hash>
git checkout -b fix/rollback-issue
```

## Integration with Cloudflare

### Deployment Workflow
```bash
# From feature branch
npm run type-check
npm run deploy

# Or deploy from main
git checkout main
git merge feat/my-feature
npm run deploy
```

### Rollback Deployment
```bash
npx wrangler rollback
```

## Collaboration Notes

For solo projects:
- Simpler workflow acceptable
- Still use feature branches
- Can merge directly to `main`

For team projects:
- Require PR reviews
- Run CI/CD on PRs
- Protect `main` branch in GitHub settings
