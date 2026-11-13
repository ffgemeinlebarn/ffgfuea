#!/usr/bin/env bash
# Scans for committed secrets with a pinned gitleaks release (config: .gitleaks.toml).
#
#   npm run secrets:scan                  # git history (all refs) + working tree
#   bash scripts/gitleaks.sh --history    # git history only (used in CI)
#   bash scripts/gitleaks.sh --dir        # working tree only (incl. untracked files)
#   bash scripts/gitleaks.sh --staged     # staged changes only (for pre-commit hooks)
#   bash scripts/gitleaks.sh --files a b  # only the given files (for Claude Code hooks)
#
# On first use the binary is downloaded into $FFGFUEA_CACHE_DIR/gitleaks
# (default: ~/.cache/ffgfuea/gitleaks) and its SHA-256 checksum verified.
# Findings are always printed redacted. Exit codes: 0 = clean, 1 = leaks found,
# 2 = setup error. Extra arguments after the mode are passed on to gitleaks
# (with --files they are the files to scan instead).
#
# Environment:
#   FFGFUEA_CACHE_DIR   cache root (default: ${XDG_CACHE_HOME:-~/.cache}/ffgfuea)
#   GITLEAKS_CACHE_DIR  gitleaks cache dir (default: $FFGFUEA_CACHE_DIR/gitleaks)
set -euo pipefail

GITLEAKS_VERSION="8.30.1"
# From gitleaks_${GITLEAKS_VERSION}_checksums.txt of the GitHub release.
SHA256_LINUX_X64="551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb"
SHA256_LINUX_ARM64="e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080"
SHA256_DARWIN_X64="dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709"
SHA256_DARWIN_ARM64="b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CACHE_ROOT="${FFGFUEA_CACHE_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/ffgfuea}"
GITLEAKS_DIR="${GITLEAKS_CACHE_DIR:-$CACHE_ROOT/gitleaks}"
GITLEAKS="$GITLEAKS_DIR/$GITLEAKS_VERSION/gitleaks"
CONFIG="$ROOT_DIR/.gitleaks.toml"

die() { echo "gitleaks: $*" >&2; exit 2; }

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'
  else die "neither sha256sum nor shasum found"; fi
}

platform() {
  case "$(uname -s)/$(uname -m)" in
    Linux/x86_64 | Linux/amd64) echo "linux_x64 $SHA256_LINUX_X64" ;;
    Linux/aarch64 | Linux/arm64) echo "linux_arm64 $SHA256_LINUX_ARM64" ;;
    Darwin/x86_64) echo "darwin_x64 $SHA256_DARWIN_X64" ;;
    Darwin/arm64) echo "darwin_arm64 $SHA256_DARWIN_ARM64" ;;
    *) die "unsupported platform $(uname -s)/$(uname -m)" ;;
  esac
}

install_gitleaks() {
  [ -x "$GITLEAKS" ] && return 0
  command -v curl >/dev/null 2>&1 || die "curl is required"
  local plat
  plat="$(platform)" || exit 2
  # shellcheck disable=SC2086 # split "<platform> <sha256>"
  set -- $plat
  local name="gitleaks_${GITLEAKS_VERSION}_$1.tar.gz" expected="$2"
  local url="https://github.com/gitleaks/gitleaks/releases/download/v$GITLEAKS_VERSION/$name"
  mkdir -p "$GITLEAKS_DIR"
  local tmp
  tmp="$(mktemp -d "$GITLEAKS_DIR/download.XXXXXX")"
  trap 'rm -rf "$tmp"' EXIT
  echo "gitleaks: downloading gitleaks $GITLEAKS_VERSION ($1) to $GITLEAKS_DIR ..." >&2
  curl -fsSL --retry 3 -o "$tmp/$name" "$url" || die "download failed: $url"
  local actual
  actual="$(sha256 "$tmp/$name")"
  [ "$actual" = "$expected" ] || die "checksum mismatch for $name (expected $expected, got $actual)"
  tar -xzf "$tmp/$name" -C "$tmp" gitleaks
  mkdir -p "$(dirname "$GITLEAKS")"
  mv "$tmp/gitleaks" "$GITLEAKS"
  chmod +x "$GITLEAKS"
  rm -rf "$tmp"
  trap - EXIT
}

mode="all"
case "${1:-}" in
  --history | --dir | --staged | --files | --all) mode="${1#--}"; shift ;;
  -h | --help) sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
esac

files=()
if [ "$mode" = "files" ]; then
  [ $# -gt 0 ] || die "--files needs at least one file"
  # Paths relative to the repo root, so the path allowlists in .gitleaks.toml apply
  for file in "$@"; do
    [ -f "$file" ] || die "not a file: $file"
    abs="$(cd "$(dirname "$file")" && pwd -P)/$(basename "$file")"
    files+=("${abs#"$(cd "$ROOT_DIR" && pwd -P)"/}")
  done
  set --
fi

install_gitleaks
cd "$ROOT_DIR"
common=(--config "$CONFIG" --redact --no-banner --exit-code 1)

case "$mode" in
  history)
    "$GITLEAKS" git "${common[@]}" --log-opts=--all --verbose "$@" .
    ;;
  staged)
    "$GITLEAKS" git "${common[@]}" --staged --verbose "$@" .
    ;;
  dir)
    "$GITLEAKS" dir "${common[@]}" --verbose "$@" .
    ;;
  files)
    status=0
    for file in "${files[@]}"; do
      "$GITLEAKS" dir "${common[@]}" --verbose --no-color --log-level warn "$file" || status=$?
    done
    exit "$status"
    ;;
  all)
    status=0
    echo "== git history (all refs)"
    "$GITLEAKS" git "${common[@]}" --log-opts=--all --verbose "$@" . || status=$?
    echo "== working tree"
    "$GITLEAKS" dir "${common[@]}" --verbose "$@" . || status=$?
    exit "$status"
    ;;
esac
