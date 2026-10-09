from __future__ import annotations

import os
import subprocess
import tempfile
import unittest
from pathlib import Path

PRODUCT_ROOT = Path(__file__).resolve().parents[2]
SCAN_PROGRAM = PRODUCT_ROOT / "scripts" / "scan_public_history.py"
SCAN_WRAPPER = PRODUCT_ROOT / "scripts" / "scan-public-history.sh"


class TemporaryGitRepository:
    def __init__(self) -> None:
        self._temporary_directory = tempfile.TemporaryDirectory(
            prefix="project-desk-public-scan-", dir="/var/tmp"
        )
        self.path = Path(self._temporary_directory.name)
        self.git("init", "--quiet", "--initial-branch=main")
        self.git("config", "user.name", "Scan Test")
        noreply = "123456+scan-test" + "@users." + "noreply.github.com"
        self.git("config", "user.email", noreply)

    def cleanup(self) -> None:
        self._temporary_directory.cleanup()

    def git(self, *arguments: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["git", *arguments],
            cwd=self.path,
            capture_output=True,
            text=True,
            timeout=10,
            check=True,
        )

    def write_text(self, relative_path: str, content: str) -> Path:
        destination = self.path / relative_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(content, encoding="utf-8")
        return destination

    def write_bytes(self, relative_path: str, content: bytes) -> Path:
        destination = self.path / relative_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)
        return destination

    def commit_all(self, message: str) -> None:
        self.git("add", "--all")
        self.git("commit", "--quiet", "--message", message)


class PublicHistoryScanTest(unittest.TestCase):
    def setUp(self) -> None:
        self.repository = TemporaryGitRepository()

    def tearDown(self) -> None:
        self.repository.cleanup()

    def run_scan(self, repository: Path | None = None) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [
                "python3",
                str(SCAN_PROGRAM),
                str(self.repository.path if repository is None else repository),
            ],
            cwd=PRODUCT_ROOT,
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )

    @staticmethod
    def output(result: subprocess.CompletedProcess[str]) -> str:
        return result.stdout + result.stderr

    def seed_clean_commit(self) -> None:
        self.repository.write_text("README.md", "# Public scan fixture\n")
        self.repository.commit_all("seed clean repository")

    def test_clean_repository_passes_and_skips_ignored_and_binary_files(self) -> None:
        fake_token = "gh" + "p_" + ("A1" * 20)
        allowed_email = "123456+scan-test" + "@users." + "noreply.github.com"
        self.repository.write_text("README.md", f"Maintainer: {allowed_email}\n")
        self.repository.write_text(".gitignore", "ignored.private\n")
        self.repository.write_bytes(
            "asset.bin", b"binary\x00payload=" + fake_token.encode("ascii")
        )
        self.repository.commit_all("add clean and binary fixtures")
        self.repository.write_text("ignored.private", fake_token)
        self.repository.write_text("notes.txt", "ordinary untracked notes\n")

        result = self.run_scan()

        self.assertEqual(result.returncode, 0, self.output(result))
        self.assertIn("PASS", result.stdout)
        self.assertNotIn(fake_token, self.output(result))

    def test_non_email_at_signs_and_reserved_domains_are_allowed(self) -> None:
        npm_version = "npm" + "@11.19.0"
        reserved_emails = [
            "client" + "@example.com",
            "client" + "@sub.example.com",
            "client" + "@example.net",
            "client" + "@example.org",
            "client" + "@mail.test",
            "client" + "@mail.invalid",
            "client" + "@mail.localhost",
            "client" + "@mail.example",
            "noreply" + "@github.com",
        ]
        self.repository.write_text(
            "package-examples.txt",
            "import plugin from '"
            + "@vitejs/plugin-react'\n"
            + 'path = "node_modules/'
            + "@testing-library/react"
            + '"\n'
            + "database = postgresql://demo_user:demo_password"
            + "@db.invalid/example\n"
            + f"packageManager = {npm_version}\n"
            + "\n".join(reserved_emails)
            + "\n",
        )
        self.repository.commit_all("add safe at-sign examples")

        result = self.run_scan()

        self.assertEqual(result.returncode, 0, self.output(result))
        self.assertIn("PASS", result.stdout)

    def test_supported_service_tokens_are_reported_without_echoing_values(self) -> None:
        self.seed_clean_commit()
        fixtures = {
            "npm-token.txt": ("npm_" + ("A1" * 18), "secret.npm_token"),
            "stripe-token.txt": (
                "sk_" + "live_" + ("B2" * 16),
                "secret.stripe_live_key",
            ),
            "resend-token.txt": ("re_" + ("C3" * 16), "secret.resend_token"),
        }
        for path, (value, _) in fixtures.items():
            self.repository.write_text(path, value + "\n")

        result = self.run_scan()
        output = self.output(result)

        self.assertEqual(result.returncode, 1, output)
        for value, rule in fixtures.values():
            self.assertIn(rule, output)
            self.assertNotIn(value, output)

    def test_secret_like_value_containing_example_is_not_broadly_exempted(self) -> None:
        self.seed_clean_commit()
        fake_secret = "example" + "SuperSecretA1!Extra"
        self.repository.write_text(
            "settings.ini", ("api_" + "key=") + fake_secret + "\n"
        )

        result = self.run_scan()
        output = self.output(result)

        self.assertEqual(result.returncode, 1, output)
        self.assertIn("secret.generic_assignment", output)
        self.assertNotIn(fake_secret, output)

    def test_untracked_secret_fails_without_echoing_the_secret_value(self) -> None:
        self.seed_clean_commit()
        fake_token = "gh" + "p_" + ("B2" * 20)
        self.repository.write_text("local-config.txt", fake_token + "\n")

        result = self.run_scan()
        output = self.output(result)

        self.assertEqual(result.returncode, 1, output)
        self.assertIn("secret.github_token", output)
        self.assertIn("worktree:local-config.txt", output)
        self.assertNotIn(fake_token, output)

    def test_private_key_header_is_a_high_confidence_secret(self) -> None:
        self.seed_clean_commit()
        fake_header = "-----BEGIN " + "PRIVATE KEY-----"
        self.repository.write_text("local-signing-material.txt", fake_header + "\n")

        result = self.run_scan()
        output = self.output(result)

        self.assertEqual(result.returncode, 1, output)
        self.assertIn("secret.private_key", output)
        self.assertNotIn(fake_header, output)

    def test_staged_content_is_scanned_when_worktree_copy_is_clean(self) -> None:
        self.seed_clean_commit()
        fake_secret = "Ab3" * 10
        staged_path = self.repository.write_text(
            "staged-settings.ini", ("api_" + "key=") + fake_secret + "\n"
        )
        self.repository.git("add", "staged-settings.ini")
        staged_path.write_text("feature_enabled=true\n", encoding="utf-8")

        result = self.run_scan()
        output = self.output(result)

        self.assertEqual(result.returncode, 1, output)
        self.assertIn("secret.generic_assignment", output)
        self.assertIn("index:staged-settings.ini", output)
        self.assertNotIn(fake_secret, output)

    def test_deleted_secret_in_reachable_history_still_fails(self) -> None:
        self.seed_clean_commit()
        fake_access_key = "AK" + "IA" + ("A1" * 8)
        retired_path = self.repository.write_text(
            "retired-credentials.txt", fake_access_key + "\n"
        )
        self.repository.commit_all("add credential slated for removal")
        retired_path.unlink()
        self.repository.commit_all("remove credential from current tree")

        result = self.run_scan()
        output = self.output(result)

        self.assertEqual(result.returncode, 1, output)
        self.assertIn("secret.aws_access_key", output)
        self.assertIn("history:", output)
        self.assertNotIn(fake_access_key, output)

    def test_detached_head_commit_is_scanned(self) -> None:
        self.seed_clean_commit()
        self.repository.git("checkout", "--quiet", "--detach")
        fake_token = "gh" + "p_" + ("D4" * 20)
        self.repository.write_text("detached.txt", fake_token + "\n")
        self.repository.commit_all("detached review commit")

        result = self.run_scan()
        output = self.output(result)

        self.assertEqual(result.returncode, 1, output)
        self.assertIn("secret.github_token", output)
        self.assertIn("history:", output)
        self.assertNotIn(fake_token, output)

    def test_annotated_tag_metadata_is_scanned(self) -> None:
        self.seed_clean_commit()
        internal_location = "/work" + "space/release-system"
        self.repository.git(
            "tag",
            "--annotate",
            "unsafe-metadata",
            "--message",
            f"release source {internal_location}",
        )

        result = self.run_scan()
        output = self.output(result)

        self.assertEqual(result.returncode, 1, output)
        self.assertIn("path.internal_workspace", output)
        self.assertIn("history-meta:tag:", output)
        self.assertNotIn(internal_location, output)

    def test_commit_metadata_is_scanned_without_echoing_values(self) -> None:
        personal_email = "reviewer" + "@private." + "dev"
        fake_token = "gh" + "p_" + ("C3" * 20)
        self.repository.git("config", "user.email", personal_email)
        self.repository.write_text("README.md", "# Metadata fixture\n")
        self.repository.git("add", "README.md")
        self.repository.git("commit", "--quiet", "--message", f"retire {fake_token}")

        result = self.run_scan()
        output = self.output(result)

        self.assertEqual(result.returncode, 1, output)
        self.assertIn("identity.personal_email", output)
        self.assertIn("secret.github_token", output)
        self.assertIn("history-meta:commit:", output)
        self.assertNotIn(personal_email, output)
        self.assertNotIn(fake_token, output)

    def test_internal_locations_are_reported_by_rule(self) -> None:
        self.seed_clean_commit()
        personal_email = "operator" + "@personal." + "dev"
        internal_path = "/work" + "space/private/cache"
        cluster_address = "orders.default.svc." + "cluster.local"
        private_address = "192." + "168.50.4"
        fixtures = {
            "contact.txt": personal_email,
            "path.txt": internal_path,
            "service.txt": cluster_address,
            "address.txt": private_address,
        }
        for relative_path, value in fixtures.items():
            self.repository.write_text(relative_path, value + "\n")

        result = self.run_scan()
        output = self.output(result)

        self.assertEqual(result.returncode, 1, output)
        expected = {
            "contact.txt": "identity.personal_email",
            "path.txt": "path.internal_workspace",
            "service.txt": "network.cluster_local",
            "address.txt": "network.rfc1918_ipv4",
        }
        for relative_path, rule in expected.items():
            self.assertIn(rule, output)
            self.assertIn(f"worktree:{relative_path}", output)
            self.assertNotIn(fixtures[relative_path], output)

    def test_symlink_target_is_scanned(self) -> None:
        self.seed_clean_commit()
        internal_target = "/work" + "space/private/target"
        (self.repository.path / "internal-link").symlink_to(internal_target)

        result = self.run_scan()
        output = self.output(result)

        self.assertEqual(result.returncode, 1, output)
        self.assertIn("path.internal_workspace", output)
        self.assertIn("worktree:internal-link", output)
        self.assertNotIn(internal_target, output)

    def test_sensitive_filename_is_redacted_from_output(self) -> None:
        self.seed_clean_commit()
        fake_token = "gh" + "p_" + ("E5" * 20)
        sensitive_name = f"leaked-{fake_token}.txt"
        self.repository.write_text(sensitive_name, fake_token + "\n")

        result = self.run_scan()
        output = self.output(result)

        self.assertEqual(result.returncode, 1, output)
        self.assertIn("secret.github_token", output)
        self.assertIn("redacted-", output)
        self.assertNotIn(fake_token, output)
        self.assertNotIn(sensitive_name, output)

    def test_gitlink_fails_closed(self) -> None:
        self.seed_clean_commit()
        self.repository.git(
            "update-index",
            "--add",
            "--cacheinfo",
            "160000," + ("1" * 40) + ",vendor/external",
        )

        result = self.run_scan()

        self.assertEqual(result.returncode, 2, self.output(result))
        self.assertIn("ERROR", result.stderr)

    def test_shallow_repository_fails_closed(self) -> None:
        self.seed_clean_commit()
        self.repository.write_text("second.txt", "second commit\n")
        self.repository.commit_all("add second commit")

        with tempfile.TemporaryDirectory(
            prefix="project-desk-shallow-", dir="/var/tmp"
        ) as temporary_directory:
            shallow = Path(temporary_directory) / "repository"
            subprocess.run(
                [
                    "git",
                    "clone",
                    "--quiet",
                    "--depth",
                    "1",
                    f"file://{self.repository.path}",
                    str(shallow),
                ],
                capture_output=True,
                text=True,
                timeout=20,
                check=True,
            )

            result = self.run_scan(shallow)

        self.assertEqual(result.returncode, 2, self.output(result))
        self.assertIn("ERROR", result.stderr)

    def test_shell_entrypoint_is_executable_and_uses_the_same_scanner(self) -> None:
        self.seed_clean_commit()
        self.assertTrue(SCAN_WRAPPER.is_file(), "scan wrapper must exist")
        self.assertTrue(
            os.access(SCAN_WRAPPER, os.X_OK), "scan wrapper must be executable"
        )

        result = subprocess.run(
            [str(SCAN_WRAPPER), str(self.repository.path)],
            cwd=PRODUCT_ROOT,
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )

        self.assertEqual(result.returncode, 0, self.output(result))
        self.assertIn("PASS", result.stdout)


if __name__ == "__main__":
    unittest.main()
