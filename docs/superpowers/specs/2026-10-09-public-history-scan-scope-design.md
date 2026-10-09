# Public-history scan scope design

## Context

The public-history scanner currently enumerates Git objects with `git rev-list
--all`. In GitHub Actions, `actions/checkout` with `fetch-depth: 0` fetches
remote-tracking branches in addition to the explicitly selected commit. A
verification run for `main` can therefore fail because an unrelated automated
branch contains different history.

The first observed case involved Dependabot branches created before a corrected
`main` history. Those branches retained the superseded commits and their bot
commit messages used GitHub's documented support service identity. Neither is
part of the `main` commit being published, but both were included by `--all`.

## Goals

- Prove that the current worktree, index, `HEAD` commit metadata, and every Git
  object reachable through the complete `HEAD` ancestry are safe to publish.
- Keep unrelated branches from changing the result of a commit's required CI
  check.
- Preserve an explicit repository-wide mode for release and manual audits.
- Allow only GitHub's exact documented service identities; continue rejecting
  personal or broadly matched `github.com` addresses.
- Keep shallow repositories as a hard failure because they cannot prove complete
  ancestry.

## Options considered

### 1. Scope the scanner to `HEAD` by default

Use `HEAD` rather than `--all` for both path discovery and object enumeration.
Expose `--all-refs` as an explicit repository-wide mode. This gives each push or
pull request an isolated proof while retaining a stronger manual release audit.

This is the selected option because it makes the scanner's scope match the
commit under verification without weakening that commit's ancestry coverage.

### 2. Replace checkout's fetch behavior

Keep `--all`, but shallow-check out the selected commit and manually unshallow
only its ancestry. This couples security behavior to GitHub fetch refspecs and
has additional edge cases for fork pull requests and unadvertised commits.

### 3. Keep `--all` and continually repair every remote branch

Rebase or delete any unrelated branch that makes required checks fail. This
keeps a repository-wide scope but makes `main` availability depend on concurrent
automation and does not scale to future bot branches.

## Selected behavior

The command will continue scanning the worktree and index independently of Git
history. History traversal will use one shared revision scope:

- default: `HEAD` and all objects reachable from its complete ancestry;
- `--all-refs`: every locally available reference, matching the previous
  behavior.

Both the object-to-path map and the object type enumeration must receive the
same revision arguments. A mismatch could label objects incorrectly or omit an
object from inspection.

The email allowlist will add only a case-insensitive exact match for GitHub's
documented support address. It will not allow arbitrary addresses at that
domain or its subdomains. Existing GitHub noreply and reserved example-domain
behavior stays unchanged.

`npm run scan:public` remains the required per-commit CI check.
`npm run scan:public:all` will expose the repository-wide audit and must be run
before a future public release or annotated release tag. The existing
`workflow_dispatch` entry point and version-tag pushes will run this
repository-wide mode as a release gate; ordinary branch and pull-request checks
will use the isolated `HEAD` mode.

The scanner will print only the selected scope (`HEAD` or `all-refs`) alongside
its pass/fail count. It will not print revision contents or matched values.

## Failure behavior

- A shallow repository fails before any success claim.
- Missing or invalid Git revisions fail with the scanner's sanitized Git error.
- Findings report rule names and safe object identifiers, never secret values or
  raw private email addresses.
- `--all-refs` is expected to fail when any fetched public branch is unsafe; that
  is the purpose of the stronger manual mode.

## Test design

- A personal email in `HEAD` ancestry still fails.
- A personal email reachable only from a sibling branch does not fail the
  default scan.
- The same sibling branch is detected with `--all-refs`.
- GitHub's documented support address is allowed case-insensitively.
- Similar forms such as `person [at] github.com`, `support+alias [at]
github.com`, and `support [at] sub.github.com` remain blocked.
- A supported service email appearing beside a fake secret still reports the
  secret rule.
- Existing worktree, index, deleted-history, detached-HEAD, token, path, and
  network fixtures continue to pass unchanged.
- An unrelated annotated tag does not affect the default `HEAD` scan, while
  `--all-refs` still detects unsafe tag metadata.

## Acceptance criteria

- The new regression tests fail against the old scanner and pass after the
  change.
- All scanner and application tests pass locally.
- Required pull-request and `main` jobs pass without weakening the secret or
  personal-email rules.
- The repository-wide command remains available and its stricter scope is
  documented.
