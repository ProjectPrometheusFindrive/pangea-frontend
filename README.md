# Pangea_v2

This is a code bundle for Pangea_v2. The original project is available at https://www.figma.com/design/QM7aRgKRyrLDvSoKJAUq1Y/Pangea_v2.

## Running the code

Run `npm i` to install the dependencies.

Run `npm run dev` to start the development server.

## Branch strategy

- Default branch: `dev`
- Development flow: `feature/*` -> `dev` (PR + review required)
- Release flow: `dev` -> `production` (PR + review required)
- `main` branch is not used in this repository.
- Tags: on push to `production`, GitHub Actions creates the next patch tag (`vX.Y.Z`).

## Terminology Standard (BK-001)

- FE/BE common glossary: [docs/common_glossary.md](docs/common_glossary.md)
- FE/BE API v2 draft contract (BK-002): [docs/api/openapi_v2_draft.yaml](docs/api/openapi_v2_draft.yaml)
- Jira operating rules (BK-003): [docs/jira_operating_rules.md](docs/jira_operating_rules.md)
- This glossary is the source of truth for `vehicleNumber/vin/plate`, `reservation/rental`, and domain-scoped `status` values.
