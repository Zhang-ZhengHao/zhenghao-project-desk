#!/usr/bin/env python3
"""Scan publishable Git content and metadata without printing matched values."""

from __future__ import annotations

import argparse
import hashlib
import ipaddress
import json
import os
import re
import subprocess
import sys
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path


class ScanError(RuntimeError):
    """Raised when the repository cannot be inspected safely."""


@dataclass(frozen=True, order=True)
class Finding:
    source: str
    rule: str


GITHUB_TOKEN_PATTERN = re.compile(
    r"(?<![A-Za-z0-9])(?:"
    + r"gh"
    + r"[pousr]_[A-Za-z0-9]{36,255}|"
    + r"github"
    + r"_pat_[A-Za-z0-9_]{40,255})(?![A-Za-z0-9_])"
)
AWS_ACCESS_KEY_PATTERN = re.compile(r"(?<![A-Z0-9])AKIA[0-9A-Z]{16}(?![A-Z0-9])")
NPM_TOKEN_PATTERN = re.compile(
    r"(?<![A-Za-z0-9_])npm_[A-Za-z0-9]{36,255}(?![A-Za-z0-9_])"
)
STRIPE_LIVE_KEY_PATTERN = re.compile(
    r"(?<![A-Za-z0-9_])(?:sk|rk)_live_[A-Za-z0-9]{24,255}(?![A-Za-z0-9_])"
)
RESEND_TOKEN_PATTERN = re.compile(
    r"(?<![A-Za-z0-9_])re_[A-Za-z0-9]{24,255}(?![A-Za-z0-9_])"
)
PRIVATE_KEY_PATTERN = re.compile(
    r"-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----"
)
GENERIC_SECRET_PATTERN = re.compile(
    r"\b(?:api[_-]?key|client[_-]?secret|password|passwd|"
    r"access[_-]?token|auth[_-]?token)\b[\"']?\s*[:=]\s*[\"']?"
    r"(?P<value>[A-Za-z0-9_./+=:-]{20,})",
    re.IGNORECASE,
)
EMAIL_PATTERN = re.compile(
    r"(?<![A-Za-z0-9._%+:/-])"
    r"(?P<email>[A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,62}[A-Za-z0-9])?"
    r"@(?P<domain>[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?"
    r"(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*"
    r"\.[A-Za-z]{2,63}))"
    r"(?![A-Za-z0-9.-])",
    re.IGNORECASE,
)
WORKSPACE_PATTERN = re.compile(re.escape("/work" + "space") + r"(?:[/\\]|$)")
CLUSTER_LOCAL_PATTERN = re.compile(
    r"(?<![A-Za-z0-9-])(?:[A-Za-z0-9-]+\.)*"
    + re.escape("svc." + "cluster.local")
    + r"(?![A-Za-z0-9.-])",
    re.IGNORECASE,
)
IPV4_PATTERN = re.compile(r"(?<![0-9.])(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?![0-9.])")
RFC1918_NETWORKS = tuple(
    ipaddress.ip_network(value)
    for value in (
        "10." + "0.0.0/8",
        "172." + "16.0.0/12",
        "192." + "168.0.0/16",
    )
)
RESERVED_EMAIL_DOMAINS = frozenset({"example.com", "example.net", "example.org"})
RESERVED_EMAIL_SUFFIXES = ("example", "invalid", "localhost", "test")
GITHUB_SERVICE_EMAILS = frozenset({"noreply@github.com", "support@github.com"})


def run_git(
    repository: Path, *arguments: str, input_bytes: bytes | None = None
) -> bytes:
    environment = os.environ.copy()
    environment["GIT_OPTIONAL_LOCKS"] = "0"
    result = subprocess.run(
        ["git", "-C", os.fspath(repository), *arguments],
        input=input_bytes,
        capture_output=True,
        timeout=60,
        check=False,
        env=environment,
    )
    if result.returncode != 0:
        raise ScanError("Git could not inspect the requested repository")
    return result.stdout


def repository_root(candidate: Path) -> Path:
    output = run_git(candidate, "rev-parse", "--show-toplevel")
    try:
        root = Path(os.fsdecode(output.rstrip(b"\n")))
    except (TypeError, ValueError) as error:
        raise ScanError("Git returned an invalid repository root") from error
    if not root.is_dir():
        raise ScanError("Git repository root is unavailable")
    return root


def decode_text(content: bytes) -> str | None:
    if b"\x00" in content:
        return None
    try:
        return content.decode("utf-8")
    except UnicodeDecodeError:
        return None


def generic_secret_is_high_confidence(match: re.Match[str]) -> bool:
    value = match.group("value")
    lowered = value.lower()
    placeholders = {
        "changeme",
        "example",
        "placeholder",
        "replace",
        "replace-me",
        "replace_me",
        "your_api_key",
        "your_token_here",
    }
    if lowered in placeholders:
        return False
    character_classes = sum(
        (
            any(character.islower() for character in value),
            any(character.isupper() for character in value),
            any(character.isdigit() for character in value),
            any(not character.isalnum() for character in value),
        )
    )
    return character_classes >= 3


def email_is_allowed(email: str, domain: str) -> bool:
    lowered_email = email.lower()
    lowered = domain.lower()
    if (
        lowered_email in GITHUB_SERVICE_EMAILS
        or lowered == "users.noreply.github.com"
    ):
        return True
    if any(
        lowered == reserved or lowered.endswith(f".{reserved}")
        for reserved in RESERVED_EMAIL_DOMAINS
    ):
        return True
    return any(
        lowered == suffix or lowered.endswith(f".{suffix}")
        for suffix in RESERVED_EMAIL_SUFFIXES
    )


def contains_personal_email(text: str) -> bool:
    return any(
        not email_is_allowed(match.group("email"), match.group("domain"))
        for match in EMAIL_PATTERN.finditer(text)
    )


def contains_rfc1918_address(text: str) -> bool:
    for match in IPV4_PATTERN.finditer(text):
        try:
            address = ipaddress.ip_address(match.group(0))
        except ValueError:
            continue
        if any(address in network for network in RFC1918_NETWORKS):
            return True
    return False


def matching_rules(content: bytes) -> set[str]:
    text = decode_text(content)
    if text is None:
        return set()

    rules: set[str] = set()
    direct_patterns = (
        ("secret.github_token", GITHUB_TOKEN_PATTERN),
        ("secret.aws_access_key", AWS_ACCESS_KEY_PATTERN),
        ("secret.npm_token", NPM_TOKEN_PATTERN),
        ("secret.stripe_live_key", STRIPE_LIVE_KEY_PATTERN),
        ("secret.resend_token", RESEND_TOKEN_PATTERN),
        ("secret.private_key", PRIVATE_KEY_PATTERN),
        ("path.internal_workspace", WORKSPACE_PATTERN),
        ("network.cluster_local", CLUSTER_LOCAL_PATTERN),
    )
    for rule, pattern in direct_patterns:
        if pattern.search(text):
            rules.add(rule)

    if any(
        generic_secret_is_high_confidence(match)
        for match in GENERIC_SECRET_PATTERN.finditer(text)
    ):
        rules.add("secret.generic_assignment")
    if contains_personal_email(text):
        rules.add("identity.personal_email")
    if contains_rfc1918_address(text):
        rules.add("network.rfc1918_ipv4")
    return rules


def findings_for_content(source: str, content: bytes) -> set[Finding]:
    return {Finding(source=source, rule=rule) for rule in matching_rules(content)}


def safe_path_identifier(relative_path: str) -> str:
    if not matching_rules(os.fsencode(relative_path)):
        return relative_path
    digest = hashlib.sha256(os.fsencode(relative_path)).hexdigest()[:12]
    return f"redacted-{digest}"


def worktree_findings(repository: Path) -> set[Finding]:
    findings: set[Finding] = set()
    output = run_git(
        repository,
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "-z",
    )
    for raw_path in output.split(b"\x00"):
        if not raw_path:
            continue
        relative_path = os.fsdecode(raw_path)
        candidate = repository / relative_path
        try:
            if candidate.is_symlink():
                content = os.fsencode(os.readlink(candidate))
            elif candidate.is_file():
                content = candidate.read_bytes()
            else:
                continue
        except OSError as error:
            raise ScanError("A worktree file could not be inspected") from error
        findings.update(
            findings_for_content(
                f"worktree:{safe_path_identifier(relative_path)}", content
            )
        )
    return findings


def read_object(repository: Path, object_id: str, object_type: str) -> bytes:
    if not re.fullmatch(r"[0-9a-fA-F]{40,64}", object_id):
        raise ScanError("Git returned an invalid object identifier")
    if object_type not in {"blob", "commit", "tag"}:
        raise ScanError("Git returned an unsupported object type")
    return run_git(repository, "cat-file", object_type, object_id)


def index_findings(repository: Path) -> set[Finding]:
    findings: set[Finding] = set()
    output = run_git(repository, "ls-files", "--stage", "-z")
    seen: set[tuple[str, str, str]] = set()
    for record in output.split(b"\x00"):
        if not record:
            continue
        try:
            metadata, raw_path = record.split(b"\t", 1)
            mode, raw_object_id, raw_stage = metadata.split(b" ", 2)
        except ValueError as error:
            raise ScanError("Git returned an invalid index entry") from error
        if mode == b"160000":
            raise ScanError("Gitlinks cannot be inspected safely")
        object_id = raw_object_id.decode("ascii")
        stage = raw_stage.decode("ascii")
        relative_path = os.fsdecode(raw_path)
        key = (object_id, stage, relative_path)
        if key in seen:
            continue
        seen.add(key)
        source_prefix = "index" if stage == "0" else f"index-stage-{stage}"
        findings.update(
            findings_for_content(
                f"{source_prefix}:{safe_path_identifier(relative_path)}",
                read_object(repository, object_id, "blob"),
            )
        )
    return findings


def object_paths(repository: Path, revisions: tuple[str, ...]) -> dict[str, str]:
    paths: dict[str, str] = {}
    output = run_git(repository, "rev-list", "--objects", *revisions)
    for line in output.splitlines():
        raw_object_id, separator, raw_path = line.partition(b" ")
        if separator and raw_path:
            paths.setdefault(raw_object_id.decode("ascii"), os.fsdecode(raw_path))
    return paths


def reachable_object_types(
    repository: Path, revisions: tuple[str, ...]
) -> Iterable[tuple[str, str]]:
    object_ids = run_git(
        repository,
        "rev-list",
        "--objects",
        "--no-object-names",
        *revisions,
    ).splitlines()
    if not object_ids:
        return ()
    checked = run_git(
        repository,
        "cat-file",
        "--batch-check=%(objectname) %(objecttype)",
        input_bytes=b"\n".join(object_ids) + b"\n",
    )
    entries: list[tuple[str, str]] = []
    for line in checked.splitlines():
        try:
            raw_object_id, raw_object_type = line.split(b" ", 1)
            entries.append(
                (raw_object_id.decode("ascii"), raw_object_type.decode("ascii"))
            )
        except (UnicodeDecodeError, ValueError) as error:
            raise ScanError("Git returned invalid object metadata") from error
    return entries


def history_findings(
    repository: Path, revisions: tuple[str, ...]
) -> set[Finding]:
    findings: set[Finding] = set()
    paths = object_paths(repository, revisions)
    for object_id, object_type in reachable_object_types(repository, revisions):
        if object_type == "blob":
            source = f"history:{object_id[:12]}"
            if object_id in paths:
                source += f":{safe_path_identifier(paths[object_id])}"
            content = read_object(repository, object_id, object_type)
        elif object_type in {"commit", "tag"}:
            source = f"history-meta:{object_type}:{object_id[:12]}"
            content = read_object(repository, object_id, object_type)
        else:
            continue
        findings.update(findings_for_content(source, content))
    return findings


def scan(repository: Path, *, all_refs: bool = False) -> set[Finding]:
    root = repository_root(repository)
    shallow = run_git(root, "rev-parse", "--is-shallow-repository").strip()
    if shallow != b"false":
        raise ScanError("Shallow repositories cannot prove complete history")
    revisions = ("--all",) if all_refs else ("HEAD",)
    return (
        worktree_findings(root)
        | index_findings(root)
        | history_findings(root, revisions)
    )


def parse_arguments(arguments: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scan worktree, index, and reachable Git objects before publication."
    )
    parser.add_argument(
        "--all-refs",
        action="store_true",
        help="scan every locally available Git ref instead of HEAD ancestry",
    )
    parser.add_argument("repository", nargs="?", default=".")
    return parser.parse_args(arguments)


def main(arguments: list[str] | None = None) -> int:
    options = parse_arguments(sys.argv[1:] if arguments is None else arguments)
    scope = "all-refs" if options.all_refs else "HEAD"
    try:
        findings = sorted(scan(Path(options.repository), all_refs=options.all_refs))
    except (OSError, ScanError, subprocess.SubprocessError):
        print(
            "public-history-scan: ERROR (repository inspection failed)",
            file=sys.stderr,
        )
        return 2

    if not findings:
        print(f"public-history-scan: PASS (0 findings, scope={scope})")
        return 0

    print(
        f"public-history-scan: FAIL ({len(findings)} findings, scope={scope})"
    )
    for finding in findings:
        print(
            "- rule="
            + finding.rule
            + " source="
            + json.dumps(finding.source, ensure_ascii=True)
        )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
