#!/usr/bin/env bash
# Install the composer backend's Python dependencies into the active
# environment: backend/requirements.txt, Flexiv RDK (flexivrdk) and the Flexiv
# Nebula SDK (flexivpdk).
#
# Usage:
#   bash install_dependencies.sh [options]
#
# Options:
#   --test-pypi <pkgs>    take these from test.pypi.org instead of pypi.org:
#                         pdk, rdk, or pdk,rdk. For pre-release testing and
#                         patches Flexiv has published there for you.
#   --pdk-version <ver>   install exactly this flexivpdk version
#   --rdk-version <ver>   install exactly this flexivrdk version, instead of
#                         the one pinned in backend/requirements.txt
#   --pdk-wheel <path>    install flexivpdk from a local wheel file
#   --python <path>       interpreter to install into (default: python3)
#   -h, --help            show this help
#
# Examples:
#   bash install_dependencies.sh
#   bash install_dependencies.sh --test-pypi pdk --pdk-version 1.0.0.2

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REQUIREMENTS="$SCRIPT_DIR/backend/requirements.txt"
TEST_PYPI_INDEX="https://test.pypi.org/simple/"

PYTHON="python3"
TEST_PYPI=""
PDK_VERSION=""
RDK_VERSION=""
PDK_WHEEL=""

usage() { sed -n '2,23p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --test-pypi)   TEST_PYPI="$2"; shift 2 ;;
    --pdk-version) PDK_VERSION="$2"; shift 2 ;;
    --rdk-version) RDK_VERSION="$2"; shift 2 ;;
    --pdk-wheel)   PDK_WHEEL="$2"; shift 2 ;;
    --python)      PYTHON="$2"; shift 2 ;;
    -h|--help)     usage; exit 0 ;;
    *) echo "[error] Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

PDK_FROM_TEST=false
RDK_FROM_TEST=false
IFS=',' read -r -a test_pkgs <<< "$TEST_PYPI"
for p in "${test_pkgs[@]}"; do
  case "$p" in
    pdk) PDK_FROM_TEST=true ;;
    rdk) RDK_FROM_TEST=true ;;
    "") ;;
    *) echo "[error] --test-pypi takes pdk, rdk or pdk,rdk, not '$p'." >&2; exit 1 ;;
  esac
done

if [[ -n "$PDK_WHEEL" ]]; then
  if $PDK_FROM_TEST || [[ -n "$PDK_VERSION" ]]; then
    echo "[error] --pdk-wheel cannot be combined with --test-pypi pdk or --pdk-version." >&2
    exit 1
  fi
  [[ -f "$PDK_WHEEL" ]] || { echo "[error] No wheel at $PDK_WHEEL" >&2; exit 1; }
fi

pip_install() { "$PYTHON" -m pip install "$@"; }
spec() { if [[ -n "$2" ]]; then echo "$1==$2"; else echo "$1"; fi; }

# 1. requirements.txt from pypi.org, including the pinned flexivrdk.
echo "==> [1/3] backend requirements (pypi.org)"
pip_install -r "$REQUIREMENTS"

# 2. flexivrdk and flexivpdk from the requested source. Only these two come
#    from test PyPI, without dependencies: anyone can publish there.
echo "==> [2/3] flexivrdk and flexivpdk"
if $RDK_FROM_TEST; then
  pip_install --no-deps --upgrade --index-url "$TEST_PYPI_INDEX" "$(spec flexivrdk "$RDK_VERSION")"
elif [[ -n "$RDK_VERSION" ]]; then
  pip_install "flexivrdk==$RDK_VERSION"
fi

if [[ -n "$PDK_WHEEL" ]]; then
  pip_install --force-reinstall --no-deps "$PDK_WHEEL"
elif $PDK_FROM_TEST; then
  pip_install --no-deps --upgrade --index-url "$TEST_PYPI_INDEX" "$(spec flexivpdk "$PDK_VERSION")"
else
  pip_install "$(spec flexivpdk "$PDK_VERSION")"
fi

# 3. Their dependencies, from pypi.org. The installed versions are kept.
echo "==> [3/3] dependencies of flexivrdk and flexivpdk (pypi.org)"
pip_install flexivrdk flexivpdk
"$PYTHON" -m pip check

echo ""
"$PYTHON" -m pip show flexivrdk flexivpdk | grep -E '^(Name|Version):'
