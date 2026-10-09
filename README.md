# Zhenghao Project Desk

Zhenghao Project Desk is a work-in-progress project intake portal for Zhenghao Zhang's independent full-stack development services.

The first release will let a prospective client submit a limited project brief, verify their email address, and receive a manual review status. A private owner workspace will be protected by a GitHub numeric-user-ID allowlist.

## Current status

Hosted foundation preview only. The landing page and liveness endpoint are implemented; project intake, PostgreSQL persistence, email verification, and owner authentication are not available in this revision.

- No real inquiries are accepted by this revision.
- v0.1 will not include payments, proposal approval, file uploads, or electronic signatures.
- Operational records, fixtures, and test identities use synthetic data. Public developer-profile branding may appear in referenced portfolio screenshots.
- Never submit passwords, API keys, production data, identity documents, health information, or payment-card data.

## Implemented foundation

- Next.js, React, and strict TypeScript landing page with a liveness endpoint
- Three public project links backed by implemented interface screenshots and explicit evidence boundaries
- Standalone production packaging with `$PORT` validation and `0.0.0.0` binding for ASteam hosting
- Desktop, tablet, and mobile browser checks covering accessibility, keyboard focus, responsive layout, and asset loading
- Public-history scanning for the worktree, index, commit history, and Git metadata
- A non-root standalone Docker image and pinned GitHub Actions workflow; remote CI results will be reported only after the branch is pushed

## Still planned for v0.1

- PostgreSQL migrations with explicit primary/demo runtime isolation
- Transactional email outbox and one-time verification links
- GitHub OAuth owner access based on an immutable numeric user ID
- Limited project inquiry and private owner review

The validated design and implementation plan are maintained in the project workspace while foundation work continues. A public architecture summary remains in [`docs/design-summary.md`](docs/design-summary.md).

## Security

Do not report a vulnerability through a public issue. See [`SECURITY.md`](SECURITY.md) for the current reporting boundary.

## License

The source code in this repository is available under the [MIT License](LICENSE). Referenced project screenshots remain subject to their source repositories' asset-specific rights notices.
