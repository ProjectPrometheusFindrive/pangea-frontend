# Contract safety scoring UI

`/contract-safety` is available with reservation read permission; installer access is denied. Super admins select a company by name; admins/members use their own tenant. Score settings and event/Trip exclusions are admin/super-admin-only at both UI and API layers.

The score belongs to the rental contract and is displayed under its representative. All permitted drivers contribute; it is not a claim of individual-driver identification. The default per-contract minimum is 300km, with a five-minute return settlement wait. Settings changes affect newly created contracts only. Old contracts explicitly show “적용 전 계약”.

The approved formula weights harsh acceleration/braking/cornering 20% each, speeding 40%. The UI shows final/provisional, insufficient-distance, sync-pending and data-review states, frozen policy, events/Trips, KST Trip-start-month references and recent score/exclusion audit. Overall scores remain blank below the minimum or with incomplete evidence. Entire staff Trips may be excluded with reason; their distance and contained events are removed too. Restore requires a reason.

No discount, refund, billing or eligibility logic is included. See the BE `docs/features/contract-safety.md` for source qualifications, exact formulas, endpoint contracts and return watermark semantics.

Validation: `npm run build`; three interaction E2E tests in `e2e/contract-safety.spec.ts`. `e2e/contract-safety-live.spec.ts` is opt-in with `E2E_SAFETY_LIVE=1` and the BE disposable localhost fixture; it must never target production.
