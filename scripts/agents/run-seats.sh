#!/usr/bin/env bash
# Blind seat reviews through Codex, in parallel, one read-only `codex exec` per seat.
#   scripts/agents/run-seats.sh <slice> "<scope line>" <seat> [<seat> ...]
#   e.g. scripts/agents/run-seats.sh 05a-motor "git diff 1a2b3c..HEAD: player motor drag removal" qa-eval principal-engineer game-director
# Each seat reads only docs/prompts/seats/<seat>.md and REVIEW_FORMAT.md plus what its scope needs, and writes
# docs/prompts/reviews/<date>-<slice>/<seat>.md. The merge step validates and scores them.
# Uses Codex's documented flags (--sandbox read-only, --output-last-message). Not exercised on 2026-09-22:
# the Codex CLI on this Mac was broken (missing binary; `npm i -g @openai/codex` reinstalls it).
set -euo pipefail
if [ $# -lt 3 ]; then
  echo 'usage: scripts/agents/run-seats.sh <slice> "<scope line>" <seat> [<seat> ...]' >&2
  exit 2
fi
slice=$1
scope=$2
shift 2
dir="docs/prompts/reviews/$(date +%F)-${slice}"
mkdir -p "$dir"
commit=$(git rev-parse --short HEAD)
for seat in "$@"; do
  if [ ! -f "docs/prompts/seats/${seat}.md" ]; then
    echo "unknown seat: ${seat} (see docs/prompts/seats/README.md)" >&2
    exit 2
  fi
  prompt="You are the ${seat} review seat for this repository. Read docs/prompts/seats/${seat}.md and docs/prompts/seats/REVIEW_FORMAT.md first; they are your whole brief. Review only this scope: ${scope}. Commit: ${commit}. Do not read other reviews in ${dir}. Never edit files. Reply with the review only, in that exact format, at most 600 words."
  codex exec --sandbox read-only --output-last-message "${dir}/${seat}.md" "${prompt}" > "${dir}/.${seat}.log" 2>&1 &
done
wait
npm run -s agents:reviews -- "${dir}"
