# 560-github-ci-workflow — GitHub CI Workflow

## Purpose

Repository-level CI workflow to run the full Node test suite on pull requests
to `main` and direct pushes to `main`.

## File

`.github/workflows/node-test.yml`

## Behavior

1. Trigger on `pull_request` to `main`
2. Trigger on `push` to `main`
3. Support manual `workflow_dispatch`
4. Use Node 22
5. Run `node --test`

## Why this matters

This provides deterministic build validation for every change set and keeps the
contract-first architecture guarded by automated tests.

