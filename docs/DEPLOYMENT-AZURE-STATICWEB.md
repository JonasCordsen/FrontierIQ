# CI/CD Deployment Guide — Azure Static Web Apps

This guide walks through setting up GitHub Actions CI/CD to build and deploy the FrontierIQ web UI to Azure Static Web Apps.

## Prerequisites

- Azure subscription with sufficient quota for Static Web Apps
- GitHub repository with write access to Actions secrets
- Entra app registration with:
  - `NEXT_PUBLIC_AZURE_TENANT_ID` (tenant ID)
  - `NEXT_PUBLIC_AZURE_CLIENT_ID` (client/app ID)
  - `AZURE_CLIENT_SECRET` (client secret; server-side only)

## Step 1: Create Azure Static Web Apps Resource

### Option A: Using Azure CLI

```bash
az staticwebapp create \
  --name frontieriq-web \
  --resource-group frontieriq-rg \
  --source https://github.com/JonasCordsen/FrontierIQ.git \
  --location eastus \
  --branch jonascordsen-scaffold-src-structure \
  --app-location frontend \
  --output-location ".next/static" \
  --skip-api-build true
```

**Notes:**
- Replace `--branch` with your deployment branch (e.g., `main` for production)
- `--app-location` points to the frontend folder
- `--output-location` points to Next.js static output
- `--skip-api-build` because we handle Next.js build via GitHub Actions

### Option B: Using Azure Portal

1. Navigate to **Static Web Apps** in the Azure Portal
2. Click **Create**
3. Fill in:
   - **Resource Group**: Create new or use existing
   - **Name**: `frontieriq-web` (or your choice)
   - **Region**: East US (or nearest region)
   - **Source**: GitHub
   - **Organization**: Your GitHub username
   - **Repository**: FrontierIQ
   - **Branch**: jonascordsen-scaffold-src-structure
   - **Build presets**: Custom
   - **App location**: `frontend`
   - **API location**: (leave blank if using Next.js built-in API routes)
   - **Output location**: `.next/static`
4. Click **Create**

After creation, Azure will generate a deployment token.

## Step 2: Configure GitHub Secrets

The GitHub Actions workflow requires these secrets:

### Required Secrets

1. **AZURE_STATIC_WEB_APPS_API_TOKEN**
   - Source: Azure Static Web Apps resource → Manage deployment token
   - Copy the full token (starts with `SharedAccessSignature=...`)
   - Paste in GitHub → Settings → Secrets and variables → Actions → New repository secret

2. **NEXT_PUBLIC_AZURE_TENANT_ID**
   - Value: Your Entra tenant ID (e.g., `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
   - This is exposed to the browser (NEXT_PUBLIC_)

3. **NEXT_PUBLIC_AZURE_CLIENT_ID**
   - Value: Your Entra app registration client ID
   - This is exposed to the browser (NEXT_PUBLIC_)

4. **AZURE_CLIENT_SECRET** ⚠️ **KEEP PRIVATE**
   - Value: Your Entra app registration client secret
   - **DO NOT** use NEXT_PUBLIC_ prefix (server-side only)
   - Not exposed to the browser; only used in Next.js API routes on the server

### GitHub UI Steps

1. Go to repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. For each secret above:
   - Name: Exactly as shown (case-sensitive)
   - Value: Paste the secret
   - Click "Add secret"

Verify all four secrets are listed.

## Step 3: Update Workflow Variables

Edit `.github/workflows/deploy-webui.yml`:

- **Main branch trigger**: Change `branches: [main]` if your production branch is different
- **Paths filter**: Customize which file changes trigger deployments
- **Node version**: Change `NODE_VERSION: '18'` if needed

## Step 4: Test Deployment

### Test 1: Create a Pull Request

1. Push a test branch (e.g., `test-deploy`)
2. Create a PR against `main`
3. GitHub Actions should run: build-and-validate → deploy-staging
4. Workflow logs available in Actions tab
5. Preview URL posted on PR once deployment completes

### Test 2: Merge to Main

1. Merge PR to `main`
2. GitHub Actions should run: build-and-validate → deploy-production
3. Check Static Web Apps resource → URL for production deployment

## Step 5: Verify Secrets Are Safe

### ✅ DO
- [x] Store `AZURE_CLIENT_SECRET` as a secret (not in code)
- [x] Use GitHub Secrets for all credentials
- [x] Prefix browser-visible vars with `NEXT_PUBLIC_`
- [x] Review Actions logs to ensure secrets are masked

### ❌ DON'T
- [ ] Commit `.env.local` or secrets to git
- [ ] Hardcode credentials in YAML
- [ ] Use `NEXT_PUBLIC_AZURE_CLIENT_SECRET` (defeats the purpose)
- [ ] Log or print secrets in scripts

## Troubleshooting

### Build Fails: "NEXT_PUBLIC_AZURE_TENANT_ID not defined"

**Cause**: GitHub Secret not set or workflow doesn't read it.

**Fix**:
1. Verify secret exists in GitHub → Settings → Secrets
2. Check workflow YAML reads the secret in the `build` step env
3. Rebuild

### Deployment Fails: "API token invalid"

**Cause**: AZURE_STATIC_WEB_APPS_API_TOKEN is wrong or expired.

**Fix**:
1. Go to Azure Portal → Static Web Apps → Manage deployment token
2. Copy the new token (old one may have been rotated)
3. Update GitHub secret

### Protected API Returns 401 in Deployed Environment

**Cause**: MSAL token validation fails (wrong tenant/client ID).

**Fix**:
1. Verify NEXT_PUBLIC_AZURE_TENANT_ID matches Entra tenant ID
2. Verify NEXT_PUBLIC_AZURE_CLIENT_ID matches app registration
3. Test with a real Entra token (use Azure CLI: `az account get-access-token`)

### OBO Exchange Fails in Deployed Environment

**Cause**: AZURE_CLIENT_SECRET not set or wrong; or OBO scope not granted to app.

**Fix**:
1. Verify AZURE_CLIENT_SECRET secret exists in GitHub (not prefixed with NEXT_PUBLIC_)
2. Check app registration has `Application permissions` for Microsoft Graph (`.default` scope)
3. Admin consent required for app permissions (check Azure Portal → API permissions)

## Environment-Specific Configuration

### Staging (PR Preview)

- Triggered on: Pull requests
- URL: `https://<random-hash>.<region>.azurestaticapps.net`
- Environment: Test with staging Entra app registration (optional)

### Production (Main Branch)

- Triggered on: Push to main
- URL: `https://<app-name>.<region>.azurestaticapps.net`
- Environment: Uses production Entra app registration

To use different Entra credentials per environment:

1. Create separate GitHub environments (Settings → Environments)
2. Add environment-specific secrets
3. Update workflow to reference environment secrets

```yaml
deploy-production:
  environment: production
  env:
    NEXT_PUBLIC_AZURE_TENANT_ID: ${{ secrets.PROD_NEXT_PUBLIC_AZURE_TENANT_ID }}
    NEXT_PUBLIC_AZURE_CLIENT_ID: ${{ secrets.PROD_NEXT_PUBLIC_AZURE_CLIENT_ID }}
    AZURE_CLIENT_SECRET: ${{ secrets.PROD_AZURE_CLIENT_SECRET }}
```

## Next Steps

1. ✅ Azure Static Web Apps resource created
2. ✅ GitHub Actions workflow deployed
3. ✅ Secrets configured in GitHub
4. ➡️ **Monitor first deployment** (check Actions tab for logs)
5. ➡️ **Test protected API with real Entra token**
6. ➡️ **Set up per-environment configurations** (if needed)

## Additional Resources

- [Azure Static Web Apps Docs](https://learn.microsoft.com/azure/static-web-apps/)
- [GitHub Actions for Azure Static Web Apps](https://github.com/Azure/static-web-apps-deploy)
- [Next.js Deployment on Static Web Apps](https://learn.microsoft.com/azure/static-web-apps/deploy-nextjs-hybrid)
- [GitHub Secrets Management](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
