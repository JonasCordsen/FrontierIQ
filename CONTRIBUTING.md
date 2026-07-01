# Contributing to FrontierIQ

Thanks for helping improve FrontierIQ.

## Before you start

- Read the project overview in `README.md`.
- Keep changes aligned to one primary pillar: OBSERVE, GOVERN, SECURE, or
  OPTIMIZE.
- Open or reference an issue before starting larger changes so scope and intent
  are visible.
- If your change touches a security-sensitive area, review `SECURITY.md` first.

## Development workflow

1. Branch from `main`.
2. Keep pull requests focused on a single outcome.
3. Update documentation when behavior, contracts, or operator expectations
   change.
4. Run the deterministic test suite before opening a pull request:

   ```bash
   node --test
   ```

## Pull request expectations

- Describe the problem, the change, and the expected impact.
- Link the relevant issue or explain why one was not needed.
- Summarize validation steps and results.
- Call out security, privacy, or tenancy implications when they apply.
- Use the pull request template and keep checklist items honest.

## Repository protection model

Some repository safeguards are enforced in GitHub settings rather than in the
working tree, including rulesets, vulnerability reporting, and repository-level
security features. If a proposed change needs one of those controls updated,
raise it in an issue or maintainer discussion instead of weakening the workflow
or bypassing an existing rule.

## Conduct

This project follows `CODE_OF_CONDUCT.md`. Be respectful, direct, and
constructive in issues, pull requests, and reviews.

## Security disclosures

Do not use issues or pull requests for suspected vulnerabilities. Report them
through the private reporting flow documented in `SECURITY.md`.
