# 625-codeql-analysis-workflow — CodeQL Analysis Workflow

## Purpose

Defines repository-level code scanning for FrontierIQ source changes on `main`,
pull requests to `main`, and a weekly scheduled sweep.

## Workflow

`.github/workflows/codeql.yml`

## Behavior

1. Trigger on `push` to `main`
2. Trigger on `pull_request` to `main`
3. Trigger on a weekly schedule
4. Use least-privilege workflow permissions:
   - `actions: read`
   - `contents: read`
   - `security-events: write`
5. Pin third-party actions to full commit SHAs
6. Disable persisted checkout credentials
7. Initialize, autobuild, and analyze JavaScript with CodeQL

## Why

This keeps repository code scanning versioned in the repo, aligns security
analysis with pull request flow, and avoids relying on manual setup drift.
