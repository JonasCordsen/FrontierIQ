/**
 * Release notes synthesis contract.
 * Pillar: OPTIMIZE (reporting)
 *
 * Deterministic synthesis of release notes from issues, artifacts, and PR
 * metadata.
 */

/**
 * Group issues by category token from title prefix.
 * @param {{number:number,title:string,state?:string}[]} issues
 * @returns {Record<string, object[]>}
 */
export function groupReleaseIssues(issues = []) {
  const list = Array.isArray(issues) ? issues : [];
  const grouped = {};
  for (const issue of list) {
    const token = typeof issue?.title === 'string' && issue.title.includes('—')
      ? issue.title.split('—')[0].trim().toLowerCase()
      : 'general';
    if (!grouped[token]) grouped[token] = [];
    grouped[token].push(issue);
  }
  return grouped;
}

/**
 * Build release highlights summary.
 * @param {{phase:string, issues:object[], artifacts:string[]}} input
 * @returns {{ phase:string, issueCount:number, artifactCount:number, categories:string[] }}
 */
export function buildReleaseHighlights(input = {}) {
  const issues = Array.isArray(input.issues) ? input.issues : [];
  const artifacts = Array.isArray(input.artifacts) ? input.artifacts : [];
  const grouped = groupReleaseIssues(issues);
  return {
    phase: input.phase ?? 'unknown',
    issueCount: issues.length,
    artifactCount: artifacts.length,
    categories: Object.keys(grouped).sort(),
  };
}

/**
 * Build release notes model.
 * @param {{version:string,phase:string,prNumber:number,generatedAt:string,issues:object[],artifacts:string[]}} input
 * @returns {object}
 */
export function buildReleaseNotesModel(input = {}) {
  const issues = Array.isArray(input.issues) ? input.issues : [];
  const artifacts = Array.isArray(input.artifacts) ? input.artifacts : [];
  return {
    version: input.version ?? '0.0.0',
    phase: input.phase ?? 'phase-unknown',
    prNumber: input.prNumber ?? null,
    generatedAt: input.generatedAt ?? null,
    highlights: buildReleaseHighlights({
      phase: input.phase,
      issues,
      artifacts,
    }),
    issues: issues.map(issue => ({
      number: issue.number,
      title: issue.title,
      state: issue.state ?? 'closed',
    })),
    artifacts,
  };
}

/**
 * Render release notes markdown from release notes model.
 * @param {object} model
 * @returns {string}
 */
export function renderReleaseNotesMarkdown(model) {
  const lines = [
    `# Release ${model.version}`,
    '',
    `- Phase: ${model.phase}`,
    `- PR: #${model.prNumber ?? 'n/a'}`,
    `- GeneratedAt: ${model.generatedAt ?? 'n/a'}`,
    '',
    '## Highlights',
    `- Issues: ${model.highlights.issueCount}`,
    `- Artifacts: ${model.highlights.artifactCount}`,
    `- Categories: ${model.highlights.categories.join(', ') || 'none'}`,
    '',
    '## Issues',
  ];

  for (const issue of model.issues) {
    lines.push(`- #${issue.number} ${issue.title} (${issue.state})`);
  }

  lines.push('', '## Artifacts');
  for (const artifact of model.artifacts) {
    lines.push(`- ${artifact}`);
  }
  return lines.join('\n');
}
