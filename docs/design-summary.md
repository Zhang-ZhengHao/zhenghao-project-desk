# Design Summary

## Purpose

Zhenghao Project Desk will be a real project-intake entry point for Zhenghao Zhang's independent full-stack work. It is intentionally not a generic CRM, marketplace, or multi-tenant SaaS.

## v0.1 workflow

```text
public service page
  -> limited project inquiry
  -> email verification
  -> private owner review
  -> internal note and review status
```

## Runtime boundary

The codebase may share domain and schema modules, but a running process has one fixed capability:

- `primary`: real intake, owner GitHub OAuth, primary PostgreSQL, Turnstile, and transactional email.
- `demo`: synthetic fixtures, demo PostgreSQL, and eventually Stripe Test Mode.

A request, cookie, header, or URL cannot switch that process capability. Primary and demo deployments receive different database credentials and secrets. The v0.1 public release enables only the primary workflow; proposal approval and the isolated test-payment demo are later milestones.

## Database capability boundary

Four login roles keep runtime access separate:

| Role               | Database access | Capability                                     |
| ------------------ | --------------- | ---------------------------------------------- |
| `primary_app`      | Primary only    | Business-table DML and migration-journal reads |
| `primary_migrator` | Primary only    | Schema migration and journal ownership         |
| `demo_app`         | Demo only       | Business-table DML and migration-journal reads |
| `demo_migrator`    | Demo only       | Schema migration and journal ownership         |

All four roles are non-superusers without database creation, role creation, replication, or row-security bypass. `PUBLIC` database and schema privileges are revoked before migration. App roles have no schema creation, temporary-table, or migration-journal write capability. Default privileges apply the same boundary to future tables created by the corresponding migrator.

The two databases use the same version-controlled Drizzle SQL and must produce the same schema fingerprint. Before applying anything, the migration process compares the existing journal with the expected ordered prefix. It then takes a PostgreSQL advisory lock, runs pending work, and requires the exact committed migration journal before reporting success. A changed checksum or unknown migration fails closed.

`/health` proves only that the web process is alive. `/ready` reads the fixed runtime's migration journal and returns a non-diagnostic `503` for missing configuration, an unreachable database, an empty database, or a divergent journal. Neither endpoint can be redirected to the other mode by request input.

## Trust and privacy rules

- No fabricated clients, testimonials, revenue, conversion metrics, or usage figures.
- No file uploads in v0.1.
- Reference links are inert metadata and are never fetched.
- Tokens are one-time, purpose-bound, expiring, and stored only as hashes.
- Logs omit email addresses, inquiry text, cookies, tokens, and OAuth credentials.
- Operational records and scenario identities in screenshots, videos, fixtures, issues, and CI artifacts use synthetic data. Public developer-profile branding is not presented as a customer identity.

## Release sequence

- `v0.1.0`: verified project intake and private owner review
- `v0.2.0`: versioned proposal review and client approval
- `v0.3.0`: isolated synthetic Stripe Test Mode demo

Each release must pass its own tests, deployment checks, privacy review, and documentation gate before it is presented as complete.
