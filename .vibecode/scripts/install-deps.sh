#!/usr/bin/env bash
# install-deps — installs what vibecode needs, run by /vibecode:init (never by a hook):
#   1. Node.js >= 18 with npm/npx  (vibecode hooks, vibe-init.js, Context7 via npx)
#   2. uv / uvx                    (Serena MCP server)
#   3. Serena itself, run once so it sits in the uv cache and the first session's MCP start is fast
#
# Idempotent: present + new enough → "OK", nothing installed. System packages need root or
# passwordless sudo; without either the script prints the exact command to run and exits 1.
# Node: distro package when it is >= 18, else NodeSource (the Node.js project's apt/rpm builds).
# uv: brew/pacman package, else Astral's official installer — as root into /usr/local/bin (on PATH
# for Claude Code), otherwise into ~/.local/bin.
#
# Output: one line per component — OK | INSTALLED | FAIL — then `RESTART: …` when something was
# installed (Claude Code only picks up new binaries / MCP servers on restart).
# Exit: 0 everything present, 1 something could not be installed.

set -uo pipefail

MIN_NODE=18
NODESOURCE_MAJOR=22
SERENA_SRC="git+https://github.com/oraios/serena"
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"

INSTALLED=0
UID_NOW="${VIBE_DEPS_UID:-$(id -u)}"   # overridable for tests only
FAILED=0

have() { command -v "$1" >/dev/null 2>&1; }

PM=""
for c in brew apt-get dnf yum apk pacman; do
  if have "$c"; then PM="$c"; break; fi
done

# Privilege for the system package manager (brew must NOT run as root / via sudo).
SUDO=""
CAN_ROOT=1
if [[ "$PM" != "brew" && "$UID_NOW" -ne 0 ]]; then
  if have sudo && sudo -n true 2>/dev/null; then SUDO="sudo"; else CAN_ROOT=0; fi
fi

fetch() {  # fetch URL to stdout
  if have curl; then curl -fsSL "$1"; elif have wget; then wget -qO- "$1"; else return 1; fi
}

node_major() { node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/'; }

node_ok() {
  have node && have npx && [[ "$(node_major)" =~ ^[0-9]+$ ]] && (( $(node_major) >= MIN_NODE ))
}

install_node() {
  if node_ok; then echo "OK node $(node -v)"; return 0; fi
  if [[ -z "$PM" ]]; then
    echo "FAIL node: no supported package manager (brew/apt/dnf/yum/apk/pacman) — install Node.js >= $MIN_NODE from https://nodejs.org"
    return 1
  fi
  if (( ! CAN_ROOT )); then
    echo "FAIL node: installing system packages needs root — run: sudo bash \"$SELF\""
    return 1
  fi

  case "$PM" in
    apt-get)
      $SUDO apt-get update -qq >/dev/null 2>&1
      local cand
      cand="$(apt-cache policy nodejs 2>/dev/null | sed -nE 's/^[[:space:]]*Candidate:[[:space:]]*([0-9]+:)?([0-9]+)\..*/\2/p' | head -1)"
      if [[ "$cand" =~ ^[0-9]+$ ]] && (( cand >= MIN_NODE )); then
        $SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs npm >/dev/null 2>&1
      else
        # Distro Node too old / missing → NodeSource (its nodejs package ships npm itself).
        fetch "https://deb.nodesource.com/setup_${NODESOURCE_MAJOR}.x" | $SUDO bash - >/dev/null 2>&1
        $SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs >/dev/null 2>&1
      fi
      ;;
    dnf|yum)
      $SUDO "$PM" install -y nodejs npm >/dev/null 2>&1
      if ! node_ok; then
        fetch "https://rpm.nodesource.com/setup_${NODESOURCE_MAJOR}.x" | $SUDO bash - >/dev/null 2>&1
        $SUDO "$PM" install -y nodejs >/dev/null 2>&1
      fi
      ;;
    apk)    $SUDO apk add --no-cache nodejs npm >/dev/null 2>&1 ;;
    pacman) $SUDO pacman -S --noconfirm --needed nodejs npm >/dev/null 2>&1 ;;
    brew)   brew install node >/dev/null 2>&1 ;;
  esac
  hash -r
  if node_ok; then
    echo "INSTALLED node $(node -v) (via $PM)"; INSTALLED=1; return 0
  fi
  echo "FAIL node: installation via $PM did not produce node >= $MIN_NODE with npx — install it manually (https://nodejs.org)"
  return 1
}

install_uv() {
  if have uvx; then echo "OK uv $(uv --version 2>/dev/null | awk '{print $2}')"; return 0; fi
  case "$PM" in
    brew) brew install uv >/dev/null 2>&1 ;;
    pacman) (( CAN_ROOT )) && $SUDO pacman -S --noconfirm --needed uv >/dev/null 2>&1 ;;
  esac
  if ! have uvx; then
    local script
    if ! script="$(fetch https://astral.sh/uv/install.sh)"; then
      echo "FAIL uv: could not download https://astral.sh/uv/install.sh (needs curl or wget + network)"
      return 1
    fi
    if [[ "$UID_NOW" -eq 0 ]]; then
      printf '%s\n' "$script" | env UV_INSTALL_DIR=/usr/local/bin UV_NO_MODIFY_PATH=1 sh >/dev/null 2>&1
    else
      printf '%s\n' "$script" | sh >/dev/null 2>&1
      export PATH="$HOME/.local/bin:$PATH"
    fi
  fi
  hash -r
  if have uvx; then
    echo "INSTALLED uv at $(command -v uvx)"; INSTALLED=1
    case ":$(bash -lc 'echo $PATH' 2>/dev/null):" in
      *":$(dirname "$(command -v uvx)"):"*) ;;
      *) echo "WARN uv: $(dirname "$(command -v uvx)") is not on your login PATH — add it, or Claude Code will not find uvx" ;;
    esac
    return 0
  fi
  echo "FAIL uv: installer ran but uvx is not on PATH"
  return 1
}

prefetch_serena() {
  # A git source is always re-resolved (uv --offline cannot run it), so just run it once:
  # the first run downloads Serena + a managed Python into the uv cache, later runs are quick.
  have uvx || { echo "FAIL serena: uvx missing"; return 1; }
  if uvx --from "$SERENA_SRC" serena --help >/dev/null 2>&1; then
    echo "OK serena (runnable, in the uv cache)"; return 0
  fi
  echo "FAIL serena: 'uvx --from $SERENA_SRC serena' failed (needs git + network)"
  return 1
}

install_node || FAILED=1
if install_uv; then prefetch_serena || FAILED=1; else FAILED=1; fi

if (( INSTALLED )); then
  echo "RESTART: restart Claude Code so the new binaries and the Serena/Context7 MCP servers are picked up"
fi
exit "$FAILED"
