export const CONTROL_IDS = Object.freeze({
  ACCESS_LEAST_PRIVILEGE: "access.least-privilege",
  ACCESS_OWNER_ACCOUNTABILITY: "access.owner-accountability",
  DATA_RESIDENCY_ENFORCEMENT: "data.residency-enforcement",
  DATA_RETENTION_POLICY: "data.retention-policy",
  AUDIT_TRACEABILITY: "audit.traceability",
  APPROVAL_GATES: "governance.approval-gates",
  RESPONSIBLE_AI_REVIEW: "rai.review-required",
  RBAC_ROLE_SEGREGATION: "access.rbac-role-segregation",
  BYO_ENTRA_ONBOARDING: "identity.byo-entra-onboarding",
  SECRET_ROTATION: "secrets.rotation",
  POLICY_AS_CODE_ENFORCEMENT: "governance.policy-as-code-enforcement",
  CI_CD_VALIDATION_GATES: "governance.cicd-validation-gates",
  PURVIEW_LABEL_ENFORCEMENT: "data.purview-label-enforcement",
  PII_DETECTION_REDACTION: "data.pii-detection-redaction",
  CONSENT_PRIVACY_NOTICE: "privacy.consent-notice",
  REGIONAL_STORAGE_ALIGNMENT: "data.regional-storage-alignment",
  DATA_DELETION_WORKFLOW: "data.deletion-workflow",
});

export const CONTROL_CATALOG = Object.freeze([
  {
    id: CONTROL_IDS.ACCESS_LEAST_PRIVILEGE,
    domain: "access",
    title: "Least privilege enforcement",
    description: "Permissions must be scoped to minimum required capabilities.",
  },
  {
    id: CONTROL_IDS.ACCESS_OWNER_ACCOUNTABILITY,
    domain: "access",
    title: "Owner accountability",
    description: "Every principal, agent, and skill must have an accountable owner.",
  },
  {
    id: CONTROL_IDS.DATA_RESIDENCY_ENFORCEMENT,
    domain: "data",
    title: "Data residency enforcement",
    description: "Data processing and storage must follow tenant region constraints.",
  },
  {
    id: CONTROL_IDS.DATA_RETENTION_POLICY,
    domain: "data",
    title: "Data retention policy",
    description: "Retention and deletion windows must be explicit and auditable.",
  },
  {
    id: CONTROL_IDS.AUDIT_TRACEABILITY,
    domain: "audit",
    title: "Audit traceability",
    description: "All access decisions and policy outcomes must be traceable.",
  },
  {
    id: CONTROL_IDS.APPROVAL_GATES,
    domain: "governance",
    title: "Approval gates",
    description: "Risk-based approval gates must exist for deployment and change events.",
  },
  {
    id: CONTROL_IDS.RESPONSIBLE_AI_REVIEW,
    domain: "rai",
    title: "Responsible AI review",
    description: "High-impact scenarios require responsible AI review and evidence.",
  },
  {
    id: CONTROL_IDS.RBAC_ROLE_SEGREGATION,
    domain: "access",
    title: "RBAC role segregation",
    description: "Privileged roles must be separated across admin, reviewer, and approver responsibilities.",
  },
  {
    id: CONTROL_IDS.BYO_ENTRA_ONBOARDING,
    domain: "identity",
    title: "BYO Entra onboarding",
    description: "Tenant onboarding must use a controlled Entra app consent and registration flow.",
  },
  {
    id: CONTROL_IDS.SECRET_ROTATION,
    domain: "secrets",
    title: "Secret rotation",
    description: "Key Vault and app secrets must have defined rotation policy and ownership.",
  },
  {
    id: CONTROL_IDS.POLICY_AS_CODE_ENFORCEMENT,
    domain: "governance",
    title: "Policy as code enforcement",
    description: "Policy controls must be represented in machine-readable form and evaluated deterministically.",
  },
  {
    id: CONTROL_IDS.CI_CD_VALIDATION_GATES,
    domain: "governance",
    title: "CI/CD validation gates",
    description: "Build and release pipelines must enforce security and governance validation gates.",
  },
  {
    id: CONTROL_IDS.PURVIEW_LABEL_ENFORCEMENT,
    domain: "data",
    title: "Purview label enforcement",
    description: "Sensitivity labels must be preserved and enforced across ingestion and retrieval paths.",
  },
  {
    id: CONTROL_IDS.PII_DETECTION_REDACTION,
    domain: "data",
    title: "PII detection and redaction",
    description: "Sensitive personal data must be detected and redacted where policy requires it.",
  },
  {
    id: CONTROL_IDS.CONSENT_PRIVACY_NOTICE,
    domain: "privacy",
    title: "Consent and privacy notices",
    description: "Admin and user experiences must communicate data processing and consent boundaries.",
  },
  {
    id: CONTROL_IDS.REGIONAL_STORAGE_ALIGNMENT,
    domain: "data",
    title: "Regional storage alignment",
    description: "Storage and processing placements must align to tenant residency and regional policy.",
  },
  {
    id: CONTROL_IDS.DATA_DELETION_WORKFLOW,
    domain: "data",
    title: "Data deletion workflow",
    description: "Retention expiration, legal hold, and deletion workflows must be explicit and auditable.",
  },
]);

export function isKnownControl(controlId) {
  return CONTROL_CATALOG.some((control) => control.id === controlId);
}
