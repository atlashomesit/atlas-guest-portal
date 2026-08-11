#!/usr/bin/env bash
# TASK-7211: smoke-test scripts/hooks/commit-msg → shared validator task-attribution guard.
# Run from repo root (Git Bash): bash scripts/hooks/tests/test-commit-msg-task-attribution.sh
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK="$SCRIPT_DIR/../commit-msg"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [[ ! -f "$HOOK" ]]; then
  echo "FAIL: hook not found at $HOOK"
  exit 1
fi

GIT_COMMON_DIR="$(git -C "$REPO_ROOT" rev-parse --git-common-dir 2>/dev/null)"
PRIMARY_ROOT="$(cd "$GIT_COMMON_DIR/.." && pwd)"
VALIDATOR="$PRIMARY_ROOT/../atlas-e2e/scripts/git-hooks/commit-msg-validator.sh"
if [[ ! -f "$VALIDATOR" ]]; then
  echo "SKIP: sibling atlas-e2e validator not found at $VALIDATOR"
  exit 0
fi

SCRATCH="$REPO_ROOT/.hook-test-scratch-task7211"
trap 'cd "$REPO_ROOT" && git rm -rq --cached .hook-test-scratch-task7211 2>/dev/null || true; rm -rf "$SCRATCH"' EXIT
rm -rf "$SCRATCH"
mkdir -p "$SCRATCH"
cd "$REPO_ROOT"

pass=0
fail=0

stage_n() {
  local i f
  rm -rf "$SCRATCH"/*
  git rm -rq --cached .hook-test-scratch-task7211 2>/dev/null || true
  for i in $(seq 1 "$1"); do
    f=".hook-test-scratch-task7211/f$i.ts"
    mkdir -p "$SCRATCH"
    printf 'x\n' > "$f"
    git add -- "$f"
  done
}

run_case() {
  local name="$1"; shift
  local expected_exit="$1"; shift
  local msg="$1"; shift
  local msg_file
  msg_file=$(mktemp -t atlas-guest-tasktag-msg-XXXX)
  printf '%s\n' "$msg" > "$msg_file"
  env "$@" bash "$HOOK" "$msg_file" >/dev/null 2>&1
  local actual_exit=$?
  rm -f "$msg_file"
  if [[ "$actual_exit" == "$expected_exit" ]]; then
    echo "PASS  $name (exit=$actual_exit)"
    pass=$((pass+1))
  else
    echo "FAIL  $name (expected=$expected_exit got=$actual_exit)"
    fail=$((fail+1))
  fi
}

stage_n 9
run_case "REFUSES 9 untagged source files" 1 "refactor(guest): rename booking status enum"
stage_n 9
run_case "ACCEPTS 9 source files once attributed" 0 "refactor(TASK-4321): rename booking status enum"
stage_n 9
run_case "ACCEPTS No-Task: trailer escape hatch" 0 "$(printf 'chore: lockfile refresh\n\nNo-Task: Dependabot conflict resolution\n')"

echo ""
echo "commit-msg task-attribution guard: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]] || exit 1
