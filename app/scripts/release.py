"""Build or promote the ERA bundle, preserving the displaced release as a ZIP."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
from shutil import which
import subprocess
from tempfile import TemporaryDirectory
from zipfile import BadZipFile, ZIP_DEFLATED, ZipFile


APP = Path(__file__).resolve().parents[1]
BUNDLE = "bundle.js"
LICENSE = "bundle.js.LICENSE.txt"
VERSION = r"(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)"
BANNER = re.compile(rb"^/\*! ERA v(" + VERSION.encode() + rb") \*/\n")


def read_bundle(path: Path) -> dict[str, bytes]:
    files = {BUNDLE: path.read_bytes()}
    license_path = path.with_name(LICENSE)
    if license_path.is_file():
        files[LICENSE] = license_path.read_bytes()
    return files


def release_version(bundle: bytes) -> str | None:
    banner = BANNER.match(bundle)
    return banner[1].decode() if banner else None


def legacy_archive_name(path: Path, bundle: bytes) -> str:
    # Reuse a commit ID only when its tracked bundle is byte-for-byte identical.
    if path == APP / "artifact" / BUNDLE and which("git"):
        commit = subprocess.run(
            ["git", "log", "-1", "--format=%H", "--", "app/artifact/bundle.js"],
            cwd=APP.parent, capture_output=True,
        ).stdout.decode().strip()
        if commit:
            tracked = subprocess.run(
                ["git", "show", f"{commit}:app/artifact/bundle.js"],
                cwd=APP.parent, capture_output=True,
            )
            if tracked.returncode == 0 and tracked.stdout == bundle:
                return f"era-build-{commit[:7]}.zip"
    return f"era-build-{hashlib.sha256(bundle).hexdigest()[:12]}.zip"


def verify_archive(path: Path, files: dict[str, bytes]) -> None:
    with ZipFile(path) as archive:
        if sorted(archive.namelist()) == sorted(files) and all(
            archive.read(name) == data for name, data in files.items()
        ):
            return
    raise ValueError(f"归档 {path.name} 已存在且内容不同，请保留原文件并使用新的版本号。")


def archive_previous(path: Path, files: dict[str, bytes], staging: Path) -> None:
    if path.exists():
        verify_archive(path, files)
        return
    path.parent.mkdir(exist_ok=True)
    staged_archive = staging / path.name
    with ZipFile(staged_archive, "w", ZIP_DEFLATED) as archive:
        for name, data in files.items():
            archive.writestr(name, data)
    try:
        os.link(staged_archive, path)
    except FileExistsError:
        verify_archive(path, files)


def install_bundle(output: Path, staging: Path, candidate: dict[str, bytes], previous: dict[str, bytes]) -> None:
    # The JS rename makes the new release visible. Restore the license if that rename fails.
    license_changed = candidate.get(LICENSE) != previous.get(LICENSE)
    if license_changed:
        if LICENSE in candidate:
            (staging / LICENSE).replace(output / LICENSE)
        else:
            (output / LICENSE).unlink(missing_ok=True)
    try:
        (staging / BUNDLE).replace(output / BUNDLE)
    except OSError:
        if license_changed:
            if LICENSE in previous:
                (output / LICENSE).write_bytes(previous[LICENSE])
            else:
                (output / LICENSE).unlink(missing_ok=True)
        raise


def publish(source: Path, output: Path, staging: Path, version: str) -> None:
    candidate = read_bundle(source)
    embedded_version = release_version(candidate[BUNDLE])
    if embedded_version and embedded_version != version:
        raise ValueError(f"输入包为 ERA {embedded_version}，当前项目版本为 {version}。")
    if embedded_version is None:
        candidate[BUNDLE] = f"/*! ERA v{version} */\n".encode() + candidate[BUNDLE]

    for name, data in candidate.items():
        (staging / name).write_bytes(data)
    subprocess.run(["node", "--check", str(staging / BUNDLE)], check=True)

    latest = output / BUNDLE
    previous = read_bundle(latest) if latest.exists() else {}
    if previous == candidate:
        print(f"ERA {version} 已是当前版本，内容一致。")
        return
    previous_version = release_version(previous[BUNDLE]) if previous else None
    if previous_version == version:
        raise ValueError(f"ERA {version} 已发布且内容不同，请更新 app/package.json 中的版本号。")
    archive_dir = output / "archive"
    existing = archive_dir / f"era-v{version}.zip"
    if existing.exists():
        verify_archive(existing, candidate)
    if previous:
        name = f"era-v{previous_version}.zip" if previous_version else legacy_archive_name(latest, previous[BUNDLE])
        archived = archive_dir / name
        archive_previous(archived, previous, staging)
        print(f"上一版已归档到 {archived}")
    install_bundle(output, staging, candidate, previous)
    print(f"ERA {version} 已生成到 {latest}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, help="显式使用已有构建产物，适用于发布已验收的包")
    parser.add_argument("--output-dir", type=Path, default=APP / "artifact", help="最新版及历史归档的输出目录")
    args = parser.parse_args()
    version = json.loads((APP / "package.json").read_text(encoding="utf-8")).get("version")
    if not isinstance(version, str) or not re.fullmatch(VERSION, version):
        parser.error("app/package.json 的 version 必须使用 major.minor.patch 格式。")
    output = args.output_dir.resolve()
    output.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix=".release-", dir=output) as temporary:
        staging = Path(temporary)
        source = args.bundle.resolve() if args.bundle else staging / "webpack" / BUNDLE
        if args.bundle is None:
            build_tmp = staging / "tmp"
            build_tmp.mkdir()
            env = {**os.environ, "TMPDIR": str(build_tmp), "TMP": str(build_tmp), "TEMP": str(build_tmp)}
            subprocess.run(["pnpm", "build:workflows"], cwd=APP, env=env, check=True)
            subprocess.run(
                ["pnpm", "exec", "webpack", "--mode", "production"], cwd=APP,
                env={**env, "ERA_RELEASE_OUTPUT": str(source.parent)}, check=True,
            )
        publish(source, output, staging, version)


if __name__ == "__main__":
    try:
        main()
    except (BadZipFile, OSError, ValueError, subprocess.CalledProcessError) as error:
        raise SystemExit(f"ERA 发布失败：{error}") from error
