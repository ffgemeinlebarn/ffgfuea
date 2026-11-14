#!/usr/bin/env bash
# Prüft die GitHub-Workflows und die lokale Composite-Action:
#   actionlint  Syntax, Ausdrücke, Job-Abhängigkeiten, Shell-Skripte (mit shellcheck, falls installiert)
#   zizmor      Sicherheit (Template-Injection, zu weite Rechte, ungepinnte Actions, Credentials …)
#
#   npm run lint:actions                  # beide
#   bash scripts/actions-lint.sh actionlint
#   bash scripts/actions-lint.sh zizmor
#
# Beim ersten Aufruf werden die gepinnten Releases nach $FFGFUEA_CACHE_DIR/<tool>
# (Standard: ~/.cache/ffgfuea/<tool>) geladen und per SHA-256 geprüft.
# zizmor läuft offline, außer GH_TOKEN ist gesetzt (dann auch Online-Prüfungen wie
# bekannte Schwachstellen in Actions). In GitHub Actions werden Befunde als Annotationen ausgegeben.
# Exit: 0 = keine Befunde, 1 = Befunde, 2 = Einrichtungsfehler.
set -euo pipefail

ACTIONLINT_VERSION="1.7.12"
# Aus actionlint_${ACTIONLINT_VERSION}_checksums.txt des GitHub-Releases
ACTIONLINT_SHA256_LINUX_X64="8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8"
ACTIONLINT_SHA256_LINUX_ARM64="325e971b6ba9bfa504672e29be93c24981eeb1c07576d730e9f7c8805afff0c6"
ACTIONLINT_SHA256_DARWIN_X64="5b44c3bc2255115c9b69e30efc0fecdf498fdb63c5d58e17084fd5f16324c644"
ACTIONLINT_SHA256_DARWIN_ARM64="aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f"

ZIZMOR_VERSION="1.31.1"
# Digests der Release-Assets (GitHub-API: assets[].digest)
ZIZMOR_SHA256_LINUX_X64="d185f726bdaf92df78273217dfdd24ebcd6b0ef48cf3ce776ff5762b6e138c99"
ZIZMOR_SHA256_LINUX_ARM64="37eebbd5762a44f262d94875431b14a6d2402991e90a685113ea97b8b41be833"
ZIZMOR_SHA256_DARWIN_X64="72ae63bb85b67229c06242f04195cb43927e9fab5f43803c6434dc701a517d61"
ZIZMOR_SHA256_DARWIN_ARM64="ad5aa633cd56215b11e6c51d51f90c7e6b22904a75047d1215abbd422f61d698"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CACHE_ROOT="${FFGFUEA_CACHE_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/ffgfuea}"

die() { echo "actions-lint: $*" >&2; exit 2; }

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'
  else die "neither sha256sum nor shasum found"; fi
}

# Gibt "<plattform-schlüssel>" aus: linux_x64 | linux_arm64 | darwin_x64 | darwin_arm64
platform() {
  case "$(uname -s)/$(uname -m)" in
    Linux/x86_64 | Linux/amd64) echo linux_x64 ;;
    Linux/aarch64 | Linux/arm64) echo linux_arm64 ;;
    Darwin/x86_64) echo darwin_x64 ;;
    Darwin/arm64) echo darwin_arm64 ;;
    *) die "unsupported platform $(uname -s)/$(uname -m)" ;;
  esac
}

# install <tool> <version> <asset> <url> <sha256>  → Pfad zum Binary auf stdout
install() {
  local tool="$1" version="$2" asset="$3" url="$4" expected="$5"
  local dir="$CACHE_ROOT/$tool/$version" bin="$CACHE_ROOT/$tool/$version/$tool"
  if [ ! -x "$bin" ]; then
    command -v curl >/dev/null 2>&1 || die "curl is required"
    mkdir -p "$dir"
    local tmp
    tmp="$(mktemp -d "$dir/download.XXXXXX")"
    echo "actions-lint: downloading $tool $version to $dir ..." >&2
    curl -fsSL --retry 3 -o "$tmp/$asset" "$url" || { rm -rf "$tmp"; die "download failed: $url"; }
    local actual
    actual="$(sha256 "$tmp/$asset")"
    [ "$actual" = "$expected" ] || { rm -rf "$tmp"; die "checksum mismatch for $asset (expected $expected, got $actual)"; }
    tar -xzf "$tmp/$asset" -C "$tmp"
    local found
    found="$(find "$tmp" -type f -name "$tool" | head -n 1)"
    [ -n "$found" ] || { rm -rf "$tmp"; die "$tool not found in $asset"; }
    mv "$found" "$bin"
    chmod +x "$bin"
    rm -rf "$tmp"
  fi
  echo "$bin"
}

actionlint_bin() {
  local plat asset sha
  plat="$(platform)"
  case "$plat" in
    linux_x64) asset="linux_amd64"; sha="$ACTIONLINT_SHA256_LINUX_X64" ;;
    linux_arm64) asset="linux_arm64"; sha="$ACTIONLINT_SHA256_LINUX_ARM64" ;;
    darwin_x64) asset="darwin_amd64"; sha="$ACTIONLINT_SHA256_DARWIN_X64" ;;
    darwin_arm64) asset="darwin_arm64"; sha="$ACTIONLINT_SHA256_DARWIN_ARM64" ;;
  esac
  asset="actionlint_${ACTIONLINT_VERSION}_${asset}.tar.gz"
  install actionlint "$ACTIONLINT_VERSION" "$asset" \
    "https://github.com/rhysd/actionlint/releases/download/v$ACTIONLINT_VERSION/$asset" "$sha"
}

zizmor_bin() {
  local plat asset sha
  plat="$(platform)"
  case "$plat" in
    linux_x64) asset="x86_64-unknown-linux-gnu"; sha="$ZIZMOR_SHA256_LINUX_X64" ;;
    linux_arm64) asset="aarch64-unknown-linux-gnu"; sha="$ZIZMOR_SHA256_LINUX_ARM64" ;;
    darwin_x64) asset="x86_64-apple-darwin"; sha="$ZIZMOR_SHA256_DARWIN_X64" ;;
    darwin_arm64) asset="aarch64-apple-darwin"; sha="$ZIZMOR_SHA256_DARWIN_ARM64" ;;
  esac
  asset="zizmor-${asset}.tar.gz"
  install zizmor "$ZIZMOR_VERSION" "$asset" \
    "https://github.com/zizmorcore/zizmor/releases/download/v$ZIZMOR_VERSION/$asset" "$sha"
}

run_actionlint() {
  local bin
  bin="$(actionlint_bin)" || exit 2
  echo "▶ actionlint $ACTIONLINT_VERSION" >&2
  if [ -n "${GITHUB_ACTIONS:-}" ]; then
    # Annotationen im PR plus lesbare Zeile im Log
    "$bin" -color=false -format '{{range $err := .}}::error file={{$err.Filepath}},line={{$err.Line}},col={{$err.Column}},title=actionlint {{$err.Kind}}::{{$err.Message}}
{{$err.Filepath}}:{{$err.Line}}:{{$err.Column}}: {{$err.Message}} [{{$err.Kind}}]
{{end}}'
  else
    "$bin"
  fi
}

run_zizmor() {
  local bin
  bin="$(zizmor_bin)" || exit 2
  echo "▶ zizmor $ZIZMOR_VERSION" >&2
  local args=(--no-progress)
  [ -n "${GH_TOKEN:-}" ] || args+=(--offline)
  [ -n "${GITHUB_ACTIONS:-}" ] && args+=(--format github)
  # Exit-Codes von zizmor: 0 = ok, 10-14 = Befunde je Schweregrad, sonst Fehler
  local code=0
  "$bin" "${args[@]}" .github/ || code=$?
  if [ "$code" -ge 10 ] && [ "$code" -le 14 ]; then return 1; fi
  [ "$code" -eq 0 ] || exit 2
}

cd "$ROOT_DIR"
status=0
case "${1:-all}" in
  actionlint) run_actionlint || status=1 ;;
  zizmor) run_zizmor || status=1 ;;
  all)
    run_actionlint || status=1
    run_zizmor || status=1
    ;;
  *) die "usage: bash scripts/actions-lint.sh [actionlint|zizmor]" ;;
esac
exit "$status"
