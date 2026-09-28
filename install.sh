#!/usr/bin/env sh
# dsh-plugin-dev-kit installer — copies the skill into the directory your AI
# coding tool scans. Idempotent: re-running replaces the previous copy.
set -eu

REPO_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SRC="$REPO_DIR/skills/dsh-plugin-dev"
NAME="dsh-plugin-dev"

usage() {
  cat <<EOF
Usage: ./install.sh [--tool=zcode|claude|codex|all] [--project]

  --tool     which tool's skill directory to target (default: all)
  --project  install into the current project's .agents/skills and
             .claude/skills instead of your home directory
             (Codex CLI has no project-level skill directory)

Targets (user scope):
  ZCode        ~/.agents/skills/$NAME
  Claude Code  ~/.claude/skills/$NAME
  Codex CLI    ~/.codex/skills/$NAME   (experimental skills support)
EOF
}

TOOL="all"
SCOPE="user"
while [ $# -gt 0 ]; do
  case "$1" in
    --tool=zcode|--tool=claude|--tool=codex|--tool=all) TOOL="${1#--tool=}" ;;
    --tool) [ $# -ge 2 ] || { echo "missing value for --tool" >&2; exit 1; }; TOOL="$2"; shift ;;
    --project) SCOPE="project" ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 1 ;;
  esac
  shift
done

install_to() {
  dest=$1
  label=$2
  mkdir -p "$(dirname -- "$dest")"
  [ -e "$dest" ] && rm -rf "$dest"
  cp -R "$SRC" "$dest"
  echo "installed ($label) -> $dest"
}

case "$TOOL" in
  zcode|claude|codex) ;;
  all) ;;
  *) echo "invalid --tool: $TOOL" >&2; usage >&2; exit 1 ;;
esac

case "$SCOPE" in
  user)
    base="$HOME"
    [ "$TOOL" = "all" ] || [ "$TOOL" = "zcode" ] && install_to "$base/.agents/skills/$NAME" "ZCode"
    [ "$TOOL" = "all" ] || [ "$TOOL" = "claude" ] && install_to "$base/.claude/skills/$NAME" "Claude Code"
    [ "$TOOL" = "all" ] || [ "$TOOL" = "codex" ] && install_to "$base/.codex/skills/$NAME" "Codex CLI"
    ;;
  project)
    base="$(pwd)"
    [ "$TOOL" = "all" ] || [ "$TOOL" = "zcode" ] && install_to "$base/.agents/skills/$NAME" "ZCode (project)"
    [ "$TOOL" = "all" ] || [ "$TOOL" = "claude" ] && install_to "$base/.claude/skills/$NAME" "Claude Code (project)"
    [ "$TOOL" = "codex" ] && { echo "Codex CLI has no project-level skill directory; use user scope." >&2; exit 1; }
    ;;
esac

cat <<'EOF'

Done. Next: start a fresh session in your tool and try:
  "用 dsh-plugin-dev 的流程，给我的 dsh 写一个 roll_dice 工具插件"
  or: "Build a dsh plugin that wraps my HTTP API at http://127.0.0.1:8080"

To uninstall, delete the printed directories.
EOF
