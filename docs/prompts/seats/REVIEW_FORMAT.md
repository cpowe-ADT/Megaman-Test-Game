# Review format (every seat, every tool)

A seat review is one Markdown file, `docs/prompts/reviews/<YYYY-MM-DD>-<slice>/<seat>.md`, in exactly this shape. `npm run agents:reviews -- docs/prompts/reviews/<folder>` validates every file, merges them into `MERGED.md` (most severe first; findings two seats raised independently are marked AGREED) and appends one row per seat to `docs/prompts/reviews/SCORES.md`. A finding without evidence is rejected, so a reviewer cannot talk its way past the check.

```
Seat: <seat id, e.g. performance-engineer>
Commit: <short sha reviewed>
Scope: <what the orchestrator asked you to review, one line>
Artifacts opened: <paths you actually opened, or "none">
Tokens: <filled by whoever saves the file, from the tool's usage report; "unknown" if the tool shows none>

| Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- |
| BLOCK | <one sentence: what is wrong and what it breaks> | `src/file.ts:123` or `output/.../shot.png` | <smallest fix> |
| MAJOR | ... | ... | ... |
| MINOR | ... | ... | ... |

| Rubric | Score |
| --- | --- |
| <item from your seat file> | <1 to 5> |

Verdict: SHIP | FIX | STOP (one line why)
```

Rules:

- Severity: `BLOCK` = wrong behaviour, broken contract, lost data or a claim the evidence contradicts; the slice cannot ship. `MAJOR` = should be fixed in this slice. `MINOR` = worth a line in the handoff.
- Evidence is `path:line`, an artifact path, or a backticked command with its result. No evidence, no finding.
- Scores: 5 = nothing to add; 3 = acceptable with the MAJORs fixed; 1 = start again. Score every rubric line in your seat file.
- `SHIP` is impossible with a `BLOCK`. `STOP` means Craig must decide; add the question for `docs/prompts/DECISIONS.md` as your last line.
- Blind: do not read other seats' files for the same slice before writing yours.
- Length: at most 600 words. No preamble, no restating the task, no praise.
