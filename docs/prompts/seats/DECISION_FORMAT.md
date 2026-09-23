# Decision format (delegated decisions)

Craig may delegate a class of decisions to the seats (he did on 2026-09-22 for D-001 to D-012: "you can approve it the check jsut have the tright cosnutlnts or people decide"). A delegated decision goes to a **panel**: the seats that own the question, run blind and in parallel like a review. The orchestrator never decides alone and never sits on a panel for its own work.

Each seat answers in one file, `docs/prompts/reviews/<YYYY-MM-DD>-decisions/<seat>.md`, in exactly this shape:

```
Seat: <seat id>
Round: <1, or 2 and up for a re-decision after a fix; it replaces this seat's earlier rows for those decisions>
Commit: <short sha>
Decisions: <ids this seat was asked to decide>
Artifacts opened: <paths actually opened>
Tokens: <filled by whoever saves the file, from the tool's usage report>

| Decision | Verdict | Reason | Evidence | Conditions |
| --- | --- | --- | --- | --- |
| D-001 | APPROVE | <one or two sentences> | `path/to/shot.png` or `file.md:12` | none |
```

Verdicts: `APPROVE`, `APPROVE WITH CONDITIONS` (the conditions become work, cited in the decision row), `REJECT` (the decision goes back to Craig with the reason), `ABSTAIN` (outside the seat's scope; say which seat owns it).

Rules:

- A decision is DECIDED when every panel seat approves (with or without conditions). Any REJECT keeps it OPEN for Craig, with the objection in the row.
- The decision row records Craig's delegation verbatim, the panel, each verdict, and the path of the panel files.
- Evidence is required for every verdict, as for findings in `REVIEW_FORMAT.md`.
- Some actions stay Craig's even when approved: permanent deletion (pruning git objects, emptying caches, removing data outside the repo) and anything outward-facing (push, deploy, publishing). The panel can approve the decision; the row then names the command for Craig to run.
- At most 400 words per seat. No preamble.
