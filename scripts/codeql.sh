#!/usr/bin/env bash
# Runs the same CodeQL analysis as .github/workflows/codeql.yml locally.
#
#   npm run sast:codeql
#
# On first use the pinned CodeQL bundle (CLI + query packs) is downloaded into
# $FFGFUEA_CACHE_DIR/codeql (default: ~/.cache/ffgfuea/codeql) and its checksum
# verified. The SARIF report is written to reports/codeql.sarif (all languages
# combined) and reports/codeql-<language>.sarif.
#
# Exit codes: 0 = no findings at error/warning level, 1 = findings, 2 = setup error.
#
# Environment:
#   FFGFUEA_CACHE_DIR   cache root (default: ${XDG_CACHE_HOME:-~/.cache}/ffgfuea)
#   CODEQL_CACHE_DIR    CodeQL cache dir (default: $FFGFUEA_CACHE_DIR/codeql)
#   CODEQL_THREADS      threads for extraction/analysis (default: 0 = all cores)
#   CODEQL_RAM          max. memory in MB for analysis (default: CodeQL decides)
#   CODEQL_LANGUAGES    languages to analyse (default: "javascript-typescript actions")
set -euo pipefail

# Keep in sync with the bundle used by github/codeql-action in CI
# (see src/defaults.json of the pinned codeql-action release).
CODEQL_VERSION="2.27.4"
SHA256_LINUX64="89ed56c8ec6bfccef6a0d2e7fe86da0469ca24b4db08b88016ec134b942c17a4"
SHA256_LINUX_ARM64="7dd066f805dfed19c9c4323d5f2003cd24fabd6e7304cdf799b94a84509fe92b"
SHA256_OSX64="cfdf539260af57a18b50e56909ed94721844a99b195a1e492a9d901aae2899e5"

LANGUAGES="${CODEQL_LANGUAGES:-javascript-typescript actions}"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CACHE_ROOT="${FFGFUEA_CACHE_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/ffgfuea}"
CODEQL_DIR="${CODEQL_CACHE_DIR:-$CACHE_ROOT/codeql}"
INSTALL_DIR="$CODEQL_DIR/$CODEQL_VERSION"
CODEQL="$INSTALL_DIR/codeql/codeql"
# One database per checkout (worktrees must not overwrite each other's).
DB_DIR="$CODEQL_DIR/db/ffgfuea-$(printf '%s' "$ROOT_DIR" | cksum | awk '{print $1}')"
REPORT_DIR="$ROOT_DIR/reports"
SARIF="$REPORT_DIR/codeql.sarif"
CONFIG="$ROOT_DIR/.github/codeql/codeql-config.yml"

die() { echo "codeql: $*" >&2; exit 2; }

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'
  else die "neither sha256sum nor shasum found"; fi
}

platform() {
  case "$(uname -s)/$(uname -m)" in
    Linux/x86_64 | Linux/amd64) echo "linux64 $SHA256_LINUX64" ;;
    Linux/aarch64 | Linux/arm64) echo "linux-arm64 $SHA256_LINUX_ARM64" ;;
    # The macOS bundle runs on Intel and Apple Silicon.
    Darwin/*) echo "osx64 $SHA256_OSX64" ;;
    *) die "unsupported platform $(uname -s)/$(uname -m)" ;;
  esac
}

install_codeql() {
  [ -x "$CODEQL" ] && return 0
  command -v curl >/dev/null 2>&1 || die "curl is required"
  local plat
  plat="$(platform)" || exit 2
  # shellcheck disable=SC2086 # split "<name> <sha256>"
  set -- $plat
  local name="codeql-bundle-$1.tar.gz" expected="$2"
  local url="https://github.com/github/codeql-action/releases/download/codeql-bundle-v$CODEQL_VERSION/$name"
  mkdir -p "$CODEQL_DIR"
  local tmp
  tmp="$(mktemp -d "$CODEQL_DIR/download.XXXXXX")"
  trap 'rm -rf "$tmp"' EXIT
  echo "codeql: downloading CodeQL bundle $CODEQL_VERSION ($1, ~550 MB) to $CODEQL_DIR ..."
  local progress="-sS"
  [ -t 2 ] && progress="--progress-bar"
  # Large download: resume (-C -) after dropped connections instead of starting over.
  local attempt=1
  until curl -fL "$progress" -C - -o "$tmp/$name" "$url"; do
    [ "$attempt" -ge 5 ] && die "download failed: $url"
    attempt=$((attempt + 1))
    echo "codeql: download interrupted, resuming (attempt $attempt/5) ..." >&2
    sleep 2
  done
  local actual
  actual="$(sha256 "$tmp/$name")"
  [ "$actual" = "$expected" ] || die "checksum mismatch for $name (expected $expected, got $actual)"
  mkdir -p "$tmp/extract"
  tar -xzf "$tmp/$name" -C "$tmp/extract"
  rm -rf "$INSTALL_DIR"
  mv "$tmp/extract" "$INSTALL_DIR"
  rm -rf "$tmp"
  trap - EXIT
  [ -x "$CODEQL" ] || die "bundle did not contain codeql/codeql"
}

install_codeql
echo "codeql: $("$CODEQL" version --format=terse)"

THREADS="${CODEQL_THREADS:-0}"
mkdir -p "$REPORT_DIR" "$(dirname "$DB_DIR")"

# Same languages as the matrix in .github/workflows/codeql.yml. "actions" checks the
# GitHub workflows (e.g. script injection, untrusted checkout, missing permissions).
ram=()
[ -n "${CODEQL_RAM:-}" ] && ram=(--ram="$CODEQL_RAM")

sarifs=()
for lang in $LANGUAGES; do
  db="$DB_DIR-$lang"
  log="$REPORT_DIR/codeql-$lang.log"
  echo "codeql: creating database for $lang (build-mode none) ..."
  if ! "$CODEQL" database create "$db" \
    --overwrite \
    --language="$lang" \
    --build-mode=none \
    --source-root="$ROOT_DIR" \
    --codescanning-config="$CONFIG" \
    --threads="$THREADS" >"$log" 2>&1; then
    tail -n 40 "$log" >&2
    die "database creation for $lang failed (full log: $log)"
  fi

  echo "codeql: analyzing $lang with security-extended ..."
  out="$REPORT_DIR/codeql-$lang.sarif"
  "$CODEQL" database analyze "$db" "codeql/${lang%%-*}-queries:codeql-suites/${lang%%-*}-security-extended.qls" \
    --format=sarif-latest \
    --sarif-category="/language:$lang" \
    --output="$out" \
    --threads="$THREADS" \
    ${ram[@]+"${ram[@]}"} \
    --quiet 2>>"$log"
  sarifs+=("$out")
done

# One combined report (reports/codeql.sarif) plus one file per language.
node "$ROOT_DIR/scripts/sarif-summary.mjs" --merge "$SARIF" "${sarifs[@]}"
