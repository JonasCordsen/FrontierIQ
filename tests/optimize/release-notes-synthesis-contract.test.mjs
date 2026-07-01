import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  groupReleaseIssues,
  buildReleaseHighlights,
  buildReleaseNotesModel,
  renderReleaseNotesMarkdown,
} from '../../src/optimize/reporting/release-notes-synthesis-contract.mjs';

const issues = [
  { number: 91, title: 'API — HTTP runtime adapter contract', state: 'closed' },
  { number: 92, title: 'Tenant — persistence adapter contract', state: 'closed' },
  { number: 93, title: 'CLI — smoke command contract', state: 'closed' },
];

describe('groupReleaseIssues', () => {
  it('groups issues by title prefix token', () => {
    const grouped = groupReleaseIssues(issues);
    assert.ok(grouped.api);
    assert.ok(grouped.tenant);
    assert.ok(grouped.cli);
  });
});

describe('buildReleaseHighlights', () => {
  it('builds issue and artifact counters', () => {
    const highlights = buildReleaseHighlights({
      phase: 'phase-10',
      issues,
      artifacts: ['docs/630-http-runtime-adapter.md'],
    });
    assert.equal(highlights.issueCount, 3);
    assert.equal(highlights.artifactCount, 1);
  });
});

describe('buildReleaseNotesModel', () => {
  it('builds complete release notes model', () => {
    const model = buildReleaseNotesModel({
      version: '0.10.0',
      phase: 'phase-10',
      prNumber: 999,
      generatedAt: '2026-01-01T00:00:00.000Z',
      issues,
      artifacts: ['artifact-a'],
    });
    assert.equal(model.version, '0.10.0');
    assert.equal(model.issues.length, 3);
    assert.equal(model.highlights.issueCount, 3);
  });
});

describe('renderReleaseNotesMarkdown', () => {
  it('renders markdown release notes output', () => {
    const model = buildReleaseNotesModel({
      version: '0.10.0',
      phase: 'phase-10',
      prNumber: 1000,
      generatedAt: '2026-01-01T00:00:00.000Z',
      issues,
      artifacts: ['artifact-a', 'artifact-b'],
    });
    const markdown = renderReleaseNotesMarkdown(model);
    assert.ok(markdown.includes('# Release 0.10.0'));
    assert.ok(markdown.includes('## Issues'));
    assert.ok(markdown.includes('#91'));
  });
});
