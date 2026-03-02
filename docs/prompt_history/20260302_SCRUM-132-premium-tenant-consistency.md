# SCRUM-132 Premium Installation Tenant Consistency

- Date: 2026-03-02
- Author: Codex (GPT-5)
- Branch: `fix/SCRUM-132-premium-tenant-consistency`
- Jira Key: SCRUM-132
- Jira Status: In Progress
- PR URL: PENDING
- Tags: scrum-132,premium,device-installation,tenant,super-admin,frontend

## Start Context
- Ticket objective: fix tenant key inconsistency in super_admin Premium installation flow.
- Reported mismatch:
  - pre-check list used `user.companyId`
  - create used `selectedAsset.companyId` first
  - refresh/detail fallback reverted to `user.companyId`
- Expected behavior: pre-check/create/recover/refresh must use one consistent `companyId`.

## Changes Summary
- Extended Premium receipt session model with `companyId` to persist tenant context across refresh/re-entry.
- Unified company scope in submit pipeline:
  - compute `requestCompanyId` once
  - reuse it in pre-check list queries, create, detail refetch, and 409 recovery.
- Hardened status refresh:
  - resolve detail query tenant as `receipt.companyId ?? user.companyId`.
- Kept backward compatibility for old session payloads without `companyId` by using safe fallback.

## Diffs & Files
- `src/app/components/PremiumInstallationRequestSection.tsx`
  - added `companyId?: string` to `PremiumInstallationReceipt`
  - restored/saved `companyId` in session storage parsing/writing
  - changed `findInProgressInstallationByVin(vin, companyId?)`
  - changed `refreshReceiptById` to prefer receipt tenant context
  - applied single `requestCompanyId` across create/pre-check/recover/detail
- `docs/prompt_library/prompt_library_v1.md`
  - bumped version to `v1.2.42`
  - added `SCRUM-132` entry to Version History

## Notes
- Validation:
  - `npm ci`: pass
  - `npm run test:e2e:install`: pass
  - `npm run build`: pass
  - `npm run test:e2e`: failed in Windows shell due Playwright `webServer` using POSIX inline env format (`VITE_API_BASE_URL=...`), not due feature logic.
