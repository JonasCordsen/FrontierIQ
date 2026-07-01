# 670-release-notes-synthesis-contract — Release Notes Synthesis Contract

## Purpose

Deterministic release notes model and markdown rendering from issue and artifact
inputs.

## Pillar: OPTIMIZE (reporting)

## Module

`src/optimize/reporting/release-notes-synthesis-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `groupReleaseIssues(issues)` | Groups issues by title category token |
| `buildReleaseHighlights(input)` | Builds release-level counters and category list |
| `buildReleaseNotesModel(input)` | Builds normalized release notes model |
| `renderReleaseNotesMarkdown(model)` | Renders markdown release notes |

## Output sections

- release metadata (version, phase, PR, generatedAt)
- highlights
- issues
- artifacts

## Tests

`tests/optimize/release-notes-synthesis-contract.test.mjs`

