#!/usr/bin/env bash
# Blind seat reviews through Codex, in parallel, one read-only `codex exec` per seat.
#   scripts/agents/run-seats.sh [--format review|decision] [--diff a..b] <slice> "<scope line>" <seat> [<seat> ...]
#   --diff builds one packet per seat (npm run agents:packet, 20K-token budget) and the seat reads only that.
#   CODEX_MODEL=<model> picks the tier (docs/prompts/seats/README.md, "Model tiers"); unset uses Codex's default.
#   e.g. scripts/agents/run-seats.sh 05a-motor "git diff 1a2b3c..HEAD: player motor drag removal" qa-eval principal-engineer game-director
# Each seat reads only docs/prompts/seats/<seat>.md and REVIEW_FORMAT.md plus what its scope needs, and writes
# docs/prompts/reviews/<date>-<slice>/<seat>.md. The merge step validates and scores them.
# Uses Codex's documented flags (--sandbox read-only, --output-last-message). Not exercised on 2026-09-22:
# the Codex CLI on this Mac was broken (missing binary; `npm i -g @openai/codex` reinstalls it).
set -euo pipefail
format=review
range=
while [ "${1:-}" = "--format" ] || [ "${1:-}" = "--diff" ]; do
  if [ "$1" = "--format" ]; then format=$2; else range=$2; fi
  shift 2
done
case "$format" in
  review) brief=REVIEW_FORMAT.md; words=600 ;;
  decision) brief=DECISION_FORMAT.md; words=400 ;;
  *) echo "unknown format: $format (review or decision)" >&2; exit 2 ;;
esac
if [ $# -lt 3 ]; then
  echo 'usage: scripts/agents/run-seats.sh <slice> "<scope line>" <seat> [<seat> ...]' >&2
  exit 2
fi
slice=$1
scope=$2
shift 2
dir="docs/prompts/reviews/$(date +%F)-${slice}"
logs="output/seat-logs/$(date +%F)-${slice}"
mkdir -p "$dir" "$logs"
commit=$(git rev-parse --short HEAD)
pids=()
for seat in "$@"; do
  if [ ! -f "docs/prompts/seats/${seat}.md" ]; then
    echo "unknown seat: ${seat} (see docs/prompts/seats/README.md)" >&2
    exit 2
  fi
  if [ -n "$range" ]; then
    npm run -s agents:packet -- --seat "$seat" --scope "$scope" --diff "$range" --format "$format" --name "$(date +%F)-${slice}"
    packet="output/packets/$(date +%F)-${slice}-${seat}.md"
    prompt="You are the ${seat} review seat for this repository. The packet below holds your seat brief, the answer format, the scope and the diff; it is your whole context. Open another file only when a finding needs it, at most 5 commands in all. Commit: ${commit}. Do not read other seats' files in ${dir}. Never edit files. Reply with your answer only, in that exact format, at most ${words} words.

$(cat "$packet")"
  else
    prompt="You are the ${seat} review seat for this repository. Read docs/prompts/seats/${seat}.md and docs/prompts/seats/${brief} first; they are your whole brief. Scope: ${scope}. Commit: ${commit}. Do not read other seats' files in ${dir}. Never edit files. Reply with your answer only, in that exact format, at most ${words} words."
  fi
  codex exec ${CODEX_MODEL:+-m "$CODEX_MODEL"} --sandbox read-only --output-last-message "${dir}/${seat}.md" "${prompt}" > "${logs}/${seat}.log" 2>&1 &
  pids+=("$!")
done
failed=0
for index in "${!pids[@]}"; do
  if ! wait "${pids[$index]}"; then
    echo "seat $(( index + 1 )) failed; see ${logs}/" >&2
    failed=1
  fi
done
expect=$(IFS=,; echo "$*")
if [ "$format" = decision ]; then
  npm run -s agents:decisions -- "${dir}" --expect "${expect}"
else
  npm run -s agents:reviews -- "${dir}" --expect "${expect}"
fi
exit "${failed}"
