/**
 * Minimum high-risk permission matcher baseline.
 * This is intentionally explicit to avoid broad false positives.
 */
const HIGH_RISK_PERMISSION_RULES = [
  "Directory.ReadWrite.All",
  "Directory.AccessAsUser.All",
  "Application.ReadWrite.All",
  "RoleManagement.ReadWrite.Directory",
  "User.ReadWrite.All",
  "Sites.FullControl.All",
  "Mail.Send",
];

const HIGH_RISK_RBAC_ROLES = [
  "Owner",
  "User Access Administrator",
  "Privileged Role Administrator",
  "Global Administrator",
];

/**
 * @param {string} permissionName
 * @param {"appRole"|"delegatedScope"|"rbacRole"|"custom"} permissionKind
 */
export function isHighRiskPermission(permissionName, permissionKind) {
  if (!permissionName) return false;

  if (permissionKind === "rbacRole") {
    return HIGH_RISK_RBAC_ROLES.includes(permissionName);
  }

  return HIGH_RISK_PERMISSION_RULES.includes(permissionName);
}

export function listHighRiskBaselines() {
  return {
    permissionRules: [...HIGH_RISK_PERMISSION_RULES],
    rbacRoles: [...HIGH_RISK_RBAC_ROLES],
  };
}

