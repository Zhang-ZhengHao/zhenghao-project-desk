# Zhenghao Project Desk

Zhenghao Project Desk is a work-in-progress project intake portal for Zhenghao Zhang's independent full-stack development services.

The first release will let a prospective client submit a limited project brief, verify their email address, and receive a manual review status. A private owner workspace will be protected by a GitHub numeric-user-ID allowlist.

## Current status

Hosted foundation preview only. The fixed runtime boundary, PostgreSQL schema, checksum-pinned migration path, and liveness/readiness endpoints are implemented. The public inquiry form, email delivery, and owner workspace are not available in this revision.

- No real inquiries are accepted by this revision.
- v0.1 will not include payments, proposal approval, file uploads, or electronic signatures.
- Operational records, fixtures, and test identities use synthetic data. Public developer-profile branding may appear in referenced portfolio screenshots.
- Never submit passwords, API keys, production data, identity documents, health information, or payment-card data.

## Implemented foundation

- Next.js, React, and strict TypeScript landing page with a liveness endpoint
- Fixed `primary` and `demo` startup capabilities; request data cannot switch modes
- Separate least-privilege PostgreSQL app and migration credentials for each mode
- Nine-table PostgreSQL schema, a checksum-pinned forward migration, and an advisory lock for concurrent migration safety
- Non-diagnostic readiness checks that require the exact committed migration journal
- Three public project links backed by implemented interface screenshots and explicit evidence boundaries
- Standalone production packaging with `$PORT` validation and `0.0.0.0` binding for ASteam hosting
- Desktop, tablet, and mobile browser checks covering accessibility, keyboard focus, responsive layout, and asset loading
- Public-history scanning for the worktree, index, commit history, and Git metadata
- A non-root standalone Docker image and pinned GitHub Actions workflow

Verification evidence for the foundation at commit `2e2e0c3`: [successful Verify run](https://github.com/Zhang-ZhengHao/zhenghao-project-desk/actions/runs/38142485319).

## Still planned for v0.1

- Public inquiry validation and persistence through the primary runtime
- Transactional email outbox and one-time verification links
- GitHub OAuth owner access based on an immutable numeric user ID
- Limited project inquiry and private owner review

The validated design and implementation plan are maintained in the project workspace while foundation work continues. A public architecture summary remains in [`docs/design-summary.md`](docs/design-summary.md).

## Runtime boundaries

Each process receives exactly one capability and one database credential. Unused keys must be absent, not empty. Defining credentials for another mode makes startup fail closed.

| Process          | Required mode | Only database variable allowed   |
| ---------------- | ------------- | -------------------------------- |
| Primary web      | `primary`     | `PRIMARY_DATABASE_URL`           |
| Primary migrator | `primary`     | `PRIMARY_MIGRATION_DATABASE_URL` |
| Demo web         | `demo`        | `DEMO_DATABASE_URL`              |
| Demo migrator    | `demo`        | `DEMO_MIGRATION_DATABASE_URL`    |

The committed [`.env.example`](.env.example) is intentionally limited to a synthetic primary-web target under `.invalid`. Do not combine the four process environments in one file.

## Database commands

Run migrations from separate, minimally scoped environments:

```bash
npm run db:migrate:primary
npm run db:migrate:demo
```

Each command checks that `APP_MODE` matches its fixed target, refuses Web or cross-mode credentials, verifies the applied checksums, and serializes concurrent migration attempts. The GitHub Actions database job starts two empty PostgreSQL 17 databases, runs each command twice, and then exercises role, schema, isolation, constraint, and readiness behavior against the real server.

## Health and readiness

- `/health` is a liveness endpoint. It remains available without PostgreSQL and does not claim that dependencies are ready.
- `/ready` returns `200` only when the fixed runtime database is reachable and its migration journal exactly matches the committed migration set.
- Configuration, connection, and migration failures return a minimal `503` response without database targets or error details.

## Security

Do not report a vulnerability through a public issue. See [`SECURITY.md`](SECURITY.md) for the current reporting boundary.

## License

The source code in this repository is available under the [MIT License](LICENSE). Referenced project screenshots remain subject to their source repositories' asset-specific rights notices.
