#!/usr/bin/env bash
# install-aimo.sh — download a tagged release binary from GitHub Releases
# and install it as `aimo` on PATH.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/agjs/ai-model-orchestrator/main/scripts/install-aimo.sh | bash
#
# Override defaults with environment variables:
#   AIMO_REPO=agjs/ai-model-orchestrator   # GitHub repo (owner/name)
#   AIMO_VERSION=latest                    # "latest" or a tag like v0.3.0
#   AIMO_INSTALL_DIR=$HOME/.local/bin      # install destination
#   AIMO_BIN_NAME=aimo                     # installed binary name
#
# Pin to a tag for serious installs. `latest` is convenient but
# follows whatever the most recent published Release is.

set -euo pipefail

REPO="${AIMO_REPO:-agjs/ai-model-orchestrator}"
VERSION="${AIMO_VERSION:-latest}"
INSTALL_DIR="${AIMO_INSTALL_DIR:-$HOME/.local/bin}"
BIN_NAME="${AIMO_BIN_NAME:-aimo}"

err() {
  printf 'install-aimo: %s\n' "$1" >&2
  exit 1
}

# Detect platform.
uname_s="$(uname -s)"
uname_m="$(uname -m)"
case "$uname_s" in
  Linux)   os="linux" ;;
  Darwin)  os="darwin" ;;
  *) err "unsupported OS: $uname_s (Linux and macOS supported)" ;;
esac
case "$uname_m" in
  x86_64|amd64) arch="x64" ;;
  arm64|aarch64) arch="arm64" ;;
  *) err "unsupported arch: $uname_m" ;;
esac

asset="aimo-${os}-${arch}"

if [ "$VERSION" = "latest" ]; then
  download_url="https://github.com/${REPO}/releases/latest/download/${asset}"
else
  download_url="https://github.com/${REPO}/releases/download/${VERSION}/${asset}"
fi

mkdir -p "$INSTALL_DIR"
target="${INSTALL_DIR}/${BIN_NAME}"
tmp="$(mktemp -t aimo.XXXXXX)"
trap 'rm -f "$tmp"' EXIT

printf 'install-aimo: downloading %s\n' "$download_url" >&2

if command -v curl >/dev/null 2>&1; then
  curl -fL --retry 3 -o "$tmp" "$download_url" \
    || err "download failed (curl exit $?)"
elif command -v wget >/dev/null 2>&1; then
  wget -q -O "$tmp" "$download_url" \
    || err "download failed (wget exit $?)"
else
  err "neither curl nor wget is available"
fi

chmod +x "$tmp"
mv "$tmp" "$target"
trap - EXIT

printf 'install-aimo: installed %s\n' "$target" >&2

if ! printf '%s' "$PATH" | tr ':' '\n' | grep -Fxq "$INSTALL_DIR"; then
  cat >&2 <<EOF
install-aimo: $INSTALL_DIR is not on PATH.
              Add this to your shell profile (e.g. ~/.bashrc or ~/.zshrc):

                export PATH="$INSTALL_DIR:\$PATH"

EOF
fi

"$target" --version
