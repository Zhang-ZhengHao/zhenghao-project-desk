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
