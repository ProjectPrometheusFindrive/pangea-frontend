# SCRUM-299 Super Admin Forbidden Route Guard Design

**Problem**

`super_admin` can reach `/forbidden` through route-level permission denial even though the role should never be blocked at the app shell level.

**Recommended approach**

Centralize the exception in the auth/route guard layer instead of patching individual pages or only adjusting login redirect behavior.

**Why**

- It fixes both direct route entry and post-login `returnUrl` re-entry.
- It keeps `admin`, `member`, and `installer` restrictions unchanged.
- It avoids depending on unstable `permissions/me` payload shape for the privileged role.

**Design**

1. Add a shared privileged-role helper in `src/services/auth.ts` for `super_admin`.
2. Use that helper in `src/app/components/RequireAuth.tsx` so `super_admin` is not redirected to `/forbidden` by route-level permission checks.
3. Keep `allowedRoles` checks intact so installer-only routes still behave as before.
4. Add regression tests that lock the centralized bypass behavior and confirm regular roles still rely on `canAccessRoute`.

**Out of scope**

- Per-page API `403` handling
- Company selection flows for `super_admin`
- Backend permission payload changes
