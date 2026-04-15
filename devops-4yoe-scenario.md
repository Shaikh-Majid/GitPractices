# Production DevOps Scenario: 4 Years of Experience - Git-Focused

## Scenario Overview
You're a Senior DevOps Engineer at **TechFlow Inc.**, a SaaS platform with 500+ microservices. You have 4 years of experience managing infrastructure, CI/CD pipelines, and Git-based workflows. The company processes billions of transactions daily and serves customers in 50+ countries.

---

## 🎯 Current Situation

### The Problem
On Monday morning, you discover:
1. **Production Outage**: Payment service returned 500 errors at 2 AM
2. **Failed Deployment**: Code from a merge to `main` contained a critical bug
3. **Git Issue**: Multiple developers pushed to `main` directly, bypassing branch protections
4. **Credential Leak**: AWS access keys accidentally committed in a merged PR
5. **Database Migration**: A database schema change wasn't tracked in Git
6. **Deployment Lag**: Takes 45 minutes to deploy across 5 environments
7. **Inconsistent Tags**: No proper versioning, tags are chaotic
8. **Disaster Recovery**: Lost access to staging environment backup (Git history untraceable)

### Team Context
- **3 platform teams** (Payment, Auth, Analytics) with 20+ developers
- **2 DevOps engineers** (including you)
- **5 environments**: Dev, Staging, Pre-Prod, Production, DR
- **Tech Stack**: Kubernetes, Docker, Terraform, Jenkins CI/CD
- **Git Server**: GitHub Enterprise (on-prem)
- **Current Release Cycle**: Manual, twice weekly

---

## 📋 Topics to Cover & Scenarios

### 1. **Git Workflow & Branch Strategy**

**Scenario**: Design the ideal Git workflow from scratch

**Tasks**:
```
a) Define branching strategy
   - main → stable production releases only
   - release/* → version branches (release/v1.2.3)
   - develop → integration branch for features
   - feature/* → individual feature branches
   - hotfix/* → emergency production fixes

b) Implement branch protection rules
   - Require PR reviews (minimum 2 approvals for main, 1 for develop)
   - Dismiss stale reviews on push
   - Require status checks to pass (CI/CD, tests, linting)
   - Require linear history (no merge commits on main)
   - Require branches to be up to date
   - Restrict who can push (only DevOps team to main)

c) Squash vs merge strategy
   - Feature branches → squash merge to develop
   - Develop → release/* → create release tag
   - Release branch → merge to main and develop (preserve merge commits)
   - Hotfix/* → merge to main and develop directly

d) Implement automated checks
   - Branch naming conventions (feat/, fix/, chore/, etc.)
   - Commit message validation (conventional commits)
   - Rebase vs merge enforcement
```

**Real-world Implementation**:
```bash
# Update branch protection via GitHub API/CLI
gh api repos/company/repo/branches/main/protection \
  -f required_status_checks='{"strict": true, "contexts": ["ci/test", "ci/build"]}' \
  -f required_pull_request_reviews='{"dismissal_restrictions": {}, "require_code_owner_reviews": true}'

# Pre-commit hook to enforce naming
#!/bin/bash
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if ! [[ "$BRANCH" =~ ^(main|develop|release|hotfix|feature|bugfix)/ ]]; then
  echo "❌ Branch name must start with: feature/, bugfix/, hotfix/, release/"
  exit 1
fi
```

---

### 2. **Git Credentials & Security**

**Scenario**: Discovered AWS keys leaked in commit history

**Tasks**:
```
a) Credential Management
   - Rotate all exposed AWS credentials
   - Scan Git history for secrets (TruffleHog, git-secrets)
   - Remove credentials from commit history (git filter-branch, BFG Repo-Cleaner)
   - Implement secret scanning in CI/CD

b) Setup GitOps Secrets Management
   - Use Sealed Secrets or Vault for storing credentials
   - Reference secrets via environment variables in CI/CD
   - Never commit .env files

c) Audit Git Access
   - Review SSH key access logs
   - Enforce MFA for Git operations
   - Implement GitHub Apps for CI/CD instead of personal tokens
   - Set token expiration policies (90 days)

d) Pre-commit Hooks to Prevent Leaks
   - Scan files before commit
   - Block patterns: AWS_SECRET, PRIVATE_KEY, password=
   - Reject large binary files
```

**Implementation**:
```bash
# Install and configure git-secrets
git secrets --install
git secrets --register-aws

# Scan existing repository
git secrets --scan

# Remove credential from history
git filter-branch --tree-filter 'rm -f config/secrets.yml' HEAD~50..HEAD

# Force push (with caution)
git push --force-with-lease --all
```

---

### 3. **Tagging & Versioning Strategy**

**Scenario**: Deployment tracking is a nightmare; can't correlate Docker images to Git commits

**Tasks**:
```
a) Semantic Versioning
   - MAJOR.MINOR.PATCH (e.g., v1.2.3)
   - Aligned with API changes, features, and bug fixes
   - Automated version bumping in CI/CD

b) Tag Format Standards
   - Production releases: v1.2.3
   - Release candidates: v1.2.3-rc.1
   - Dev builds: v1.2.3-dev+build.42
   - Annotated tags with commit message

c) Track tags to deployments
   - Tag SHA matches deployment config
   - Deployment logs reference Git tag
   - Container image tagged with Git SHA and version
   - Traceability: tag → SHA → image → deployment

d) Automated tagging in CI/CD
   - Parse conventional commits
   - Determine version bump
   - Create and push tag
   - Build and push Docker image with tag
```

**Implementation**:
```bash
# Manual annotated tag
git tag -a v1.2.3 -m "Release v1.2.3: Payment processing fix"
git push origin v1.2.3

# List tags with commit info
git tag -l -n10

# Verify tag is signed/legitimate
git tag -v v1.2.3

# In Dockerfile/CI
ARG GIT_SHA
ARG GIT_TAG
RUN echo "Built from ${GIT_TAG} (${GIT_SHA})" > /app/version.txt

# Shell script for auto-versioning
#!/bin/bash
LAST_TAG=$(git describe --tags --abbrev=0)
COMMITS=$(git rev-list ${LAST_TAG}..HEAD --count)
if git diff ${LAST_TAG}..HEAD | grep -q "BREAKING"; then
  VERSION=$(semver bump major ${LAST_TAG})
else
  VERSION=$(semver bump minor ${LAST_TAG})
fi
git tag -a ${VERSION} -m "Auto-tagged: $(git log -1 --pretty=%B)"
```

---

### 4. **Git History & Cleanup**

**Scenario**: Git repository is bloated (5GB+), cloning takes 15 minutes

**Tasks**:
```
a) Analyze repository size
   - Find large files in history
   - Identify unnecessary branches
   - Check for duplicate commits

b) Clean up large files
   - Remove build artifacts, cache files
   - Delete abandoned branches
   - Remove old release branches (>1 year)

c) Shallow cloning for CI/CD
   - Use --depth 1 to reduce clone time
   - Cache Git objects between runs
   - Fetch only relevant branches

d) Repository maintenance
   - Run gc (garbage collection) regularly
   - Repack objects to improve performance
   - Archive old tags/releases
```

**Implementation**:
```bash
# Find largest files in history
git rev-list --all --objects | sed -n $(git rev-list --objects --all | cut -f1 -d' ' | git cat-file --batch-check | grep blob | sort -k3 -n | tail -10 | while read hash type size; do echo -n "-e s/$hash/$size/p "; done) | sort -k1 -n

# Clean up branches
git branch -D feature/old-stuff
git branch -r -d origin/old-branch

# In CI/CD - shallow clone
git clone --depth 1 --branch main https://github.com/company/repo.git
git fetch --unshallow  # Only if full history needed later

# Garbage collection
git gc --aggressive
```

---

### 5. **Merge Conflicts & Resolution Strategies**

**Scenario**: Multiple teams pushing to `develop` causing frequent merge conflicts

**Tasks**:
```
a) Conflict Prevention
   - Use conventional commits
   - Keep branches short-lived (<3 days)
   - Frequent rebasing against develop
   - Clear ownership of files/modules

b) Automated Conflict Detection
   - CI/CD checks for merge conflicts before PR merge
   - Fail PR if conflicts aren't resolved
   - Require rebase if develop has changed

c) Conflict Resolution Strategies
   - Theirs vs ours strategy based on context
   - Merge driver for specific files (e.g., package.json merge)
   - Pre-configured resolution rules

d) Git Rerere (Reuse Recorded Resolution)
   - Record conflict resolutions
   - Reuse for similar conflicts
   - Saves time during rebases
```

**Implementation**:
```bash
# Configure 3-way merge for package.json
git config merge.npm.driver 'npm ci && npm merge-base $BASE $OURS $THEIRS'

# Enable rerere
git config rerere.enabled true

# Record resolutions
git rerere record

# Simulate merge to check conflicts
git merge --no-commit --no-ff develop

# Abort if conflicts
git merge --abort

# Rebase and auto-resolve using rerere
git rebase develop  # Uses recorded resolutions

# Merge strategy: prefer current branch
git merge -X ours develop
```

---

### 6. **Cherry-pick & Backport Scenarios**

**Scenario**: Critical security fix needed in multiple release branches simultaneously

**Tasks**:
```
a) Cherry-pick for urgent hotfixes
   - Security patch → main
   - Cherry-pick to release/v1.5.x
   - Cherry-pick to release/v1.4.x
   - Cherry-pick to develop (forward integration)

b) Ensure forward/backward compatibility
   - Document which versions are affected
   - Update version notes
   - Test cherry-pick target branches

c) Conflict resolution during cherry-pick
   - Handle version number conflicts
   - Update CHANGELOG per branch
   - Commit cherry-pick with reference to original

d) Automation
   - Detect security commits (tags with security label)
   - Auto-cherry-pick to supported branches
   - Create verification PR before merge
```

**Implementation**:
```bash
# Cherry-pick security fix
git cherry-pick abc123def456

# Resolve conflicts during cherry-pick
# Edit conflicted files
git add .
git cherry-pick --continue

# Cherry-pick with no-commit to batch multiple
git cherry-pick -n abc123def456
git cherry-pick -n def789ghi012
git commit -m "Cherry-picked security fixes to v1.4"

# Script: Auto cherry-pick to all supported versions
#!/bin/bash
SECURITY_COMMIT="abc123"
for version in v1.5 v1.4 v1.3; do
  git checkout release/${version}
  git pull
  git cherry-pick ${SECURITY_COMMIT} || git cherry-pick --abort
  echo "Cherry-picked to ${version}"
done
```

---

### 7. **CI/CD Pipeline Integration with Git**

**Scenario**: Build-test-deploy pipeline is inconsistent across environments

**Tasks**:
```
a) Trigger Management
   - Push to feature/* → run tests only
   - Push to develop → run tests + build image
   - Create PR to main → all checks + deploy to staging
   - Merge to main → deploy to production
   - Tag creation → create GitHub release + deploy

b) Artifact Tagging & Tracking
   - Build number → Git SHA → Docker image tag
   - Keep build artifacts for 30 days
   - Reference image digest (not just tag) in deployments

c) Environment Parity
   - Identical setup across dev/staging/prod
   - Use same Dockerfile, manifests, config (with env vars)
   - Reproducible builds (pin dependencies)

d) Rollback Strategy
   - Tag previous working version
   - Revert to image tag in deployment
   - Git commit shows rollback with reason
   - Clear communication in Git history
```

**Implementation (Jenkins + GitHub)**:
```groovy
pipeline {
    triggers {
        githubPush()
    }
    stages {
        stage('Checkout') {
            steps {
                checkout([$class: 'GitSCM', 
                    branches: [[name: "${env.GIT_BRANCH}"]],
                    userRemoteConfigs: [[url: "${env.GIT_URL}"]]])
            }
        }
        stage('Build') {
            when { branch 'develop' }
            steps {
                script {
                    env.GIT_SHA = sh(returnStdout: true, script: 'git rev-parse --short HEAD').trim()
                    env.BUILD_TAG = "${env.BUILD_NUMBER}-${env.GIT_SHA}"
                    
                    sh '''
                        docker build -t myapp:${BUILD_TAG} .
                        docker tag myapp:${BUILD_TAG} myapp:latest
                        docker push myapp:${BUILD_TAG}
                    '''
                }
            }
        }
        stage('Deploy-Staging') {
            when { branch 'main' }
            steps {
                sh 'helm upgrade --install myapp ./helm --values values-staging.yaml'
            }
        }
    }
}

# Kubernetes deployment.yaml
spec:
  containers:
  - name: app
    image: myapp:abc123def (image digest, not tag)
    env:
    - name: GIT_COMMIT
      value: "abc123def456"
    - name: BUILD_VERSION
      value: "v1.2.3"
```

---

### 8. **Git Stash & Work-in-Progress Management**

**Scenario**: Developer needs to switch context; has uncommitted work on multiple files

**Tasks**:
```
a) Stash best practices
   - Stash with meaningful names: git stash push -m "WIP: auth refactor"
   - List stashes regularly: git stash list
   - Apply vs pop: apply keeps stash, pop removes

b) Unfinished work tracking
   - Use WIP branches instead of long-term stashes
   - Push to remote for backup
   - Clearly mark as work-in-progress (prefix)

c) Interactive stash
   - Stash specific files/hunks
   - git stash push -p (patch mode)

d) Cleanup
   - Regularly clean old stashes
   - Automate via CI/CD: delete stashes older than 30 days
```

**Implementation**:
```bash
# Stash specific files
git stash push src/auth/login.ts src/auth/logout.ts -m "WIP: auth refactor"

# Stash specific hunks (interactive)
git stash push -p

# List stashes with details
git stash list

# Apply without removing
git stash apply stash@{0}

# Drop after applying
git stash drop stash@{0}

# Script: Clean old stashes (>30 days)
#!/bin/bash
THIRTY_DAYS_AGO=$(date -d "30 days ago" +%s)
git stash list --pretty='%gd %ci' | while read stash date; do
  STASH_DATE=$(date -d "${date}" +%s)
  if [ ${STASH_DATE} -lt ${THIRTY_DAYS_AGO} ]; then
    git stash drop ${stash}
  fi
done
```

---

### 9. **Disaster Recovery & Backup Scenarios**

**Scenario**: Accidental force push to main; need to recover deleted commits

**Tasks**:
```
a) Git reflog recovery
   - Find lost commits via reflog
   - Recover branch from reflog
   - Prevent data loss via pre-receive hooks

b) Backup strategy
   - Mirror repositories to backup server
   - Daily backups of all branches/tags
   - Backup pre-receive hooks prevent force push

c) Prevention
   - Disable force push on main branch
   - Implement receive hooks
   - Require review before pushing to protected branches

d) Recovery procedures
   - Locate commit in reflog
   - Create new branch from recovered SHA
   - Force push recovery to test branch
   - Verify before merging
```

**Implementation**:
```bash
# Find lost commits
git reflog

# Recover specific commit
git reflog show main
# Output: abc123 main@{10}: rebase (finish)
git checkout -b recovery abc123

# Pre-receive hook to prevent force push
#!/bin/bash
# .git/hooks/pre-receive
while read old_ref new_ref ref_name; do
  if [[ "$ref_name" == "refs/heads/main" ]]; then
    OLD_HEAD=$(git rev-parse $old_ref)
    NEW_HEAD=$(git rev-parse $new_ref)
    if ! git merge-base --is-ancestor $OLD_HEAD $NEW_HEAD; then
      echo "❌ Force push to main rejected!"
      exit 1
    fi
  fi
done

# Server-side script to prevent deletions
#!/bin/bash
# On Git server
git config --global receive.denyDeletes true
git config --global receive.denyNonFastForwards true
```

---

### 10. **Multi-Repository Management & Monorepo Handling**

**Scenario**: Managing 50+ microservice repos with shared dependencies

**Tasks**:
```
a) Monorepo vs Multi-repo strategy
   - Single repo with /services/payment, /services/auth, etc.
   - Shared /libs for common code
   - Separate CI/CD jobs per service

b) Dependency Management
   - Git submodules for shared libraries
   - Or: single monorepo with workspace support (npm/yarn)
   - Version compatibility tracking

c) Atomic commits across repos
   - Use git-subtree or git submodule
   - Update main monorepo when dependencies change
   - Enforce dependency version pinning

d) Workflow for developers
   - Clone monorepo once
   - Work on specific service
   - Push changes; CI/CD detects changed services
   - Deploy only changed services
```

**Implementation (Monorepo with npm workspaces)**:
```json
// package.json
{
  "workspaces": ["services/payment", "services/auth", "libs/common"]
}

# Root .github/workflows/deploy.yml
on: [push]
jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      payment: ${{ steps.changes.outputs.payment }}
      auth: ${{ steps.changes.outputs.auth }}
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      - id: changes
        run: |
          git diff HEAD~1 HEAD --name-only | grep -q "services/payment" && \
            echo "payment=true" >> $GITHUB_OUTPUT || \
            echo "payment=false" >> $GITHUB_OUTPUT

  deploy-payment:
    needs: detect-changes
    if: needs.detect-changes.outputs.payment == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install -w services/payment && npm run build -w services/payment
      - run: docker build -t payment:${GIT_SHA} services/payment/
```

**With Git Submodules**:
```bash
# Add shared library as submodule
git submodule add https://github.com/company/shared-libs libs/common

# In service repos
git submodule update --init --recursive

# Push update to shared library
cd libs/common
git add feature-x && git commit -m "Add feature X"
git push

# Go back to main repo
cd ../..
git add libs/common && git commit -m "Update shared-libs ref"
git push
```

---

### 11. **Code Review Workflow & GitHub/GitLab Integration**

**Scenario**: Enforce code quality and security via Git workflow

**Tasks**:
```
a) PR Requirements
   - Automated CODEOWNERS file: enforce domain expertise reviews
   - DORA metrics tracking: time-to-review, cycle time
   - Auto-request reviews based on file changes

b) Review Checks
   - Code coverage must improve or stay same
   - Linting passes (ESLint, Prettier, etc.)
   - Security scan (SAST, dependency check)
   - No hardcoded secrets

c) Approval Management
   - Require 2 approvals for main, 1 for develop
   - Dismiss stale approvals if code changes
   - At least 1 approval from CODEOWNERS
   - Track who approved what

d) Merge Controls
   - Auto-delete branch after merge
   - Squash-merge for feature branches
   - Linear history enforcement
   - Require up-to-date with base branch
```

**Implementation (CODEOWNERS)**:
```
# .github/CODEOWNERS
/services/payment/  @payment-team @security-team
/services/auth/     @auth-team @security-team
/libs/common/       @platform-team
*.tf                @devops-team
.github/workflows   @devops-team @platform-team

# Workflow: Auto-request reviews
name: Auto-Assign Reviewers
on: [pull_request]
jobs:
  auto-review:
    runs-on: ubuntu-latest
    steps:
      - uses: kentaro-m/auto-assign-action@v2.0.0
        with:
          repo-token: ${{ secrets.GITHUB_TOKEN }}
          configuration-path: .github/auto_assign.yml
```

---

### 12. **Documentation & Change Logs in Git**

**Scenario**: Release notes are outdated; no clear record of what changed

**Tasks**:
```
a) CHANGELOG Management
   - Auto-generate from commit messages
   - Categorize: Features, Fixes, Breaking Changes, Security
   - Date-tagged releases

b) Version Documentation
   - Document new features per version
   - API changes tracked
   - Migration guides for breaking changes
   - Deprecation notices

c) Git Commit Message Standards
   - Conventional Commits: feat:, fix:, chore:, docs:, etc.
   - Include issue/ticket reference
   - Body explains why, not what
   - Footer: Closes #123, Co-authored-by: name

d) Automated Changelog Generation
   - Parse commits using conventional-changelog
   - Generate release notes from PR descriptions
   - Update CHANGELOG.md automatically

e) Release Notes in GitHub
   - Create GitHub Release for each tag
   - Auto-populate description from commits
   - Include breaking changes section
```

**Implementation**:
```bash
# Commit message format
feat(auth): add OAuth2 integration

Add support for Google and GitHub OAuth2 login.
- Implement OAuth2 flow
- Store refresh tokens securely
- Add logout functionality

Closes #456
Co-authored-by: John Doe <john@example.com>

# Generate CHANGELOG using conventional-changelog
npm install conventional-changelog-cli --save-dev
npx conventional-changelog -p angular -i CHANGELOG.md -s -r 0

# GitHub CLI to create release with auto-generated notes
gh release create v1.2.3 --generate-notes

# In CI/CD workflow
- name: Bump version and push tag
  run: |
    npm version patch
    git push --tags
    
- name: Create Release
  uses: actions/create-release@v1
  with:
    tag_name: ${{ steps.version.outputs.version }}
    release_name: Release ${{ steps.version.outputs.version }}
    generate_release_notes: true
```

---

### 13. **Git Performance Optimization**

**Scenario**: Git operations are slow; 30-second clone, slow status checks

**Tasks**:
```
a) Clone Performance
   - Shallow cloning for CI/CD
   - Use --single-branch to fetch only needed branch
   - Cache Git data between runs

b) Index Optimization
   - Enable untracked cache
   - Use sparse checkout for large repos
   - Watchman integration for file system monitoring

c) Network Optimization
   - SSH key-based auth (vs HTTPS)
   - Repository mirroring closer to users
   - Batch operations: single push vs multiple

d) Sparse Checkout
   - Only check out needed directories
   - Reduce disk space for large monorepos
   - Speed up operations on specific services
```

**Implementation**:
```bash
# Shallow clone for CI/CD
git clone --depth 1 --single-branch --branch main https://github.com/company/repo.git

# Enable untracked cache
git config core.untrackedCache true

# Sparse checkout setup
git clone --sparse https://github.com/company/repo.git
cd repo
git sparse-checkout set services/payment

# In CI/CD pipeline
# Use this instead of full clone
git clone --depth 1 --single-branch --branch ${BRANCH} \
  --filter=blob:none --sparse \
  https://token@github.com/company/repo.git

# Configure sparse patterns
echo "services/payment/" >> .git/info/sparse-checkout
echo "libs/" >> .git/info/sparse-checkout
git read-tree -m -u HEAD
```

---

### 14. **Git Hooks & Automation**

**Scenario**: Developers making common mistakes (forget to add tests, commit secrets, etc.)

**Tasks**:
```
a) Pre-commit Hooks
   - Lint staged files
   - Run tests on changed files
   - Check for secrets
   - Format code (Prettier)
   - Validate commit messages

b) Post-commit Hooks
   - Auto-update build artifacts
   - Trigger local dev server reload

c) Pre-push Hooks
   - Verify branch name format
   - Run full test suite
   - Ensure commits are signed
   - Check for incomplete rebases

d) Server-side Hooks
   - Pre-receive: reject commits with issues
   - Post-receive: trigger CI/CD, send notifications
   - Update-ref: log all ref changes for audit

e) Husky Framework
   - Easy Git hook management
   - Share hooks across team
   - Stage-specific hooks
```

**Implementation**:
```bash
# Install Husky
npm install husky --save-dev
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit 'npm run lint-staged'

# Content: .husky/pre-commit
#!/bin/sh
npm run lint-staged
npm run test:unit

# Content: .husky/pre-push
#!/bin/sh
# Verify branch protection rules
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" == "main" ]]; then
  echo "❌ Cannot push to main directly. Create a PR."
  exit 1
fi

# Run full test suite
npm run test

# Content: .husky/commit-msg
#!/bin/sh
# Validate conventional commit format
if ! grep -qE '^(feat|fix|chore|docs|style|refactor|test|perf)(\(.+\))?: ' "$1"; then
  echo "❌ Commit message must follow conventional commits"
  exit 1
fi

# Server-side pre-receive hook
#!/bin/bash
while read oldrev newrev refname; do
  # Reject force push
  if git rev-list ${newrev}..${oldrev} | grep -q .; then
    echo "❌ Force push rejected to ${refname}"
    exit 1
  fi
done
```

---

### 15. **Audit, Compliance & Git Security Governance**

**Scenario**: Compliance audit requires Git access logs, commit signatures, and immutability

**Tasks**:
```
a) Commit Signing
   - GPG key signing for all commits
   - Verify commits are signed
   - Reject unsigned commits to main

b) Audit Logging
   - Log all Git operations (push, delete, force-push)
   - Track who made changes
   - Timestamp every action
   - Export audit logs quarterly

c) Access Control
   - GitHub SAML SSO integration
   - Enforce MFA for all users
   - IP whitelisting for Git access
   - Review repository access quarterly

d) Compliance Reports
   - Git commit provenance: who, when, what
   - Deployment audit trail (git tag → deployment)
   - Regulatory compliance (SOC2, ISO27001)

e) Immutability
   - Prevent unauthorized deletions
   - Enforce signed commits for regulated branches
   - Require reviewed approval for high-risk changes
```

**Implementation**:
```bash
# Generate GPG key
gpg --full-generate-key

# Configure Git to use GPG
git config --global user.signingkey <GPG_KEY_ID>
git config --global commit.gpgSign true

# Commit with signature
git commit -S -m "Critical security fix"

# Verify signature
git log --show-signature

# Branch protection: require signed commits
gh api repos/company/repo/branches/main/protection \
  -f required_signatures='{"enabled": true}'

# Audit log query: show all pushes to main in last 30 days
git log --all --oneline --remotes --since="30 days ago" | grep main

# Export audit logs from GitHub
gh api repos/company/repo/events --paginate > audit_logs.json

# Script: Generate compliance report
#!/bin/bash
echo "=== Git Compliance Report ==="
echo "Repository: $(git config --get remote.origin.url)"
echo "Report Date: $(date)"
echo ""
echo "=== Recent Commits ==="
git log --oneline -20
echo ""
echo "=== Unsigned Commits (last 100) ==="
git log --oneline -100 | while read commit; do
  if ! git verify-commit ${commit%% *} &>/dev/null; then
    echo "⚠️  Unsigned: ${commit}"
  fi
done
```

---

## 🔧 Implementation Checklist

```
Phase 1: Immediate Crisis (Day 1)
☐ Scan for secrets in repository
☐ Rotate exposed credentials
☐ Implement emergency branch protections
☐ Revert breaking commit
☐ Restore production from backup
☐ Update on-call runbook

Phase 2: Short-term Fixes (Week 1)
☐ Implement branch protection rules
☐ Setup Git hooks (Husky)
☐ Define merge strategy
☐ Document tagging policy
☐ Train team on new workflows

Phase 3: Infrastructure Improvements (Week 2-3)
☐ Implement semantic versioning
☐ Setup CI/CD pipeline integration
☐ Configure GitHub/GitLab branch rules
☐ Implement pre-receive hooks
☐ Setup audit logging

Phase 4: Optimization & Automation (Month 2)
☐ Automate versioning and tagging
☐ Automate changelog generation
☐ Optimize repository performance
☐ Implement full GitOps workflow
☐ Documentation and runbooks
```

---

## 📊 Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Clone time | 15 min | < 1 min |
| Deployment frequency | 2x/week | 1x/day or more |
| Lead time for changes | 5-7 days | < 1 day |
| Mean time to recovery (MTTR) | 4 hours | < 30 min |
| Production incidents from Git issues | 3-5/month | < 1/month |
| Code review cycle time | 2-3 days | < 24 hours |
| Failed deployments | 10-15% | < 2% |
| Unplanned downtime | 10+ hours/year | < 2 hours/year |

---

## 🎓 Knowledge Base for 4-YOE DevOps Engineer

**Must Know**:
- Git internals (objects, refs, packfiles)
- Advanced rebase, cherry-pick, reflog
- Git hooks (client + server side)
- Branch protection strategies
- CI/CD integration
- Secret management
- Disaster recovery procedures

**Tools & Technologies**:
- GitHub/GitLab advanced features
- GitHub Actions / GitLab CI
- Kubernetes GitOps (ArgoCD, Flux)
- Terraform for IaC
- Helm for deployment
- Container registries (ECR, ACR, GCR)

**Soft Skills**:
- Mentoring junior engineers on Git workflows
- Communication during outages
- Documentation and runbook creation
- Cross-team collaboration
- Incident post-mortems

---

## 📚 Reference Materials

- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git - The Simple Guide](http://rogerdudley.github.io/git-guide/)
- [GitHub Enterprise Security](https://docs.github.com/en/enterprise-cloud@latest/admin/security)
- [GitOps Best Practices](https://cloud.google.com/architecture/devops-culture-framework)
