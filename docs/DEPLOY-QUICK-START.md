# Quick Start: Deploy FrontierIQ Web UI to Azure

This is a quick checklist for getting the web UI deployed. See `docs/DEPLOYMENT-AZURE-STATICWEB.md` for detailed instructions.

## 🚀 Quick Setup (5 minutes)

### 1. Get Entra App Registration Details

```bash
# Get your Entra app registration details from Azure Portal
# Copy these:
# - Tenant ID (Directory ID)
# - Client ID (Application ID)
# - Client Secret (create new secret if needed)
```

### 2. Create Azure Static Web Apps Resource

```bash
az staticwebapp create \
  --name frontieriq-web \
  --resource-group frontieriq-rg \
  --source https://github.com/JonasCordsen/FrontierIQ.git \
  --location eastus \
  --branch main \
  --app-location frontend \
  --output-location ".next/static"
```

### 3. Get Deployment Token

```bash
# From Azure Portal or CLI:
az staticwebapp secrets list --name frontieriq-web --resource-group frontieriq-rg
# Copy the deployment token
```

### 4. Set GitHub Secrets

Go to: Repository → Settings → Secrets and variables → Actions

Add these 4 secrets:

| Secret Name | Value | Example |
|-------------|-------|---------|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Deployment token from Azure | `SharedAccessSignature=...` |
| `NEXT_PUBLIC_AZURE_TENANT_ID` | Entra tenant ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `NEXT_PUBLIC_AZURE_CLIENT_ID` | Entra client ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `AZURE_CLIENT_SECRET` | Entra client secret | `~test~XXXXXXXXXXXXX` |

### 5. Trigger Deployment

**Option A: Create a PR**
- Push a branch and create a PR to `main`
- Workflow runs automatically
- Preview URL appears on PR

**Option B: Push to Main**
- Merge PR to `main`
- Workflow runs automatically
- Production deployment starts

### 6. Monitor Deployment

Go to: Repository → Actions tab

- Watch logs in real-time
- Check build and deploy steps
- Verify no secrets are exposed in logs

## ✅ Verification Checklist

- [ ] Azure Static Web Apps resource created
- [ ] GitHub secrets configured (all 4)
- [ ] First PR or push created and triggered workflow
- [ ] Build passed (no TypeScript errors)
- [ ] Deployment succeeded
- [ ] Preview URL works (PR) or production URL works (main)
- [ ] Secrets are masked in logs (**not printed**)

## 🧪 Test Protected API

Once deployed, test the protected API with a real Entra token:

```bash
# Get a test token from your Entra app
TOKEN=$(az account get-access-token --query accessToken -o tsv)

# Call the protected endpoint
curl -H "Authorization: Bearer $TOKEN" \
  https://<your-static-web-app-url>/api/protected-current-state
```

Expected responses:
- ✅ **200 OK**: Token valid, has FrontierIQ.Admin role
- ❌ **401 Unauthorized**: Invalid token or expired
- ❌ **403 Forbidden**: Valid token but missing FrontierIQ.Admin role

## 🐛 Common Issues

| Issue | Fix |
|-------|-----|
| Build fails: "NEXT_PUBLIC_AZURE_TENANT_ID not defined" | Check GitHub secrets are set |
| Deployment fails: "API token invalid" | Refresh token from Azure Portal |
| Protected API returns 401 | Verify token has FrontierIQ.Admin role claim |
| Logs show secrets in plain text | Recreate GitHub secrets (old ones may not be masked) |

## 📚 Documentation

- **Full guide**: `docs/DEPLOYMENT-AZURE-STATICWEB.md`
- **Workflow**: `.github/workflows/deploy-webui.yml`
- **Web UI guide**: `frontend/README.md`
- **Environment variables**: See `.env.local` template in `frontend/README.md`

## 📞 Support

For issues, check:
1. Azure Static Web Apps diagnostic logs (Azure Portal)
2. GitHub Actions logs (Actions tab)
3. Local build: `cd frontend && npm run build`
