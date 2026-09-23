# Brief format: how agents talk to each other

Agents never pass a session transcript to another agent. A new agent, subagent or model gets a **task card** and reads files; it answers with a **result card**. Everything else it needs is in the repo (`progress.md` Now, `npm run agents:context`, `npm run agents:packet`). This keeps a hand-off to a few hundred tokens instead of the whole session.

## Task card (sender to worker or seat, at most 200 words)

```
Role: <seat id, or worker tier: fast | standard | strong>
Goal: <one sentence: the result, not the method>
Read: <the packet or pack path, then at most five more paths with line ranges>
Constraints: <what must not change; read-only or which files it may edit>
Done when: <the check that proves it: a command and its expected result line>
Return: result card, at most <N> words
Budget: at most <N> tool calls; stop and return what you have if you hit it
```

## Result card (worker or seat to sender, at most 300 words unless the format says otherwise)

```
Outcome: DONE | PARTIAL | BLOCKED (one line why)
Changed: <paths, or "none">
Evidence: <command -> result line (artifact path)>, one per line
Open: <what the sender must decide or do next>
Tokens: <the tool's reported usage, if shown>
```

Reviews use `REVIEW_FORMAT.md` and decisions `DECISION_FORMAT.md` as their result card. A worker writes long output (logs, tables, screenshots) to a file under `output/` and puts the path in the card, never the content.

## Rules

- Cost is calls times context: every tool call re-sends everything the worker has read so far. A fast worker running gates needed 7 calls and 57K tokens; the same job through `npm run -s gate` is one call. Cap calls, not just words.
- The sender does the reading once: it builds the packet (`npm run agents:packet`) so the worker opens one file instead of making twenty tool calls.
- The session is never the hand-off, for three reasons: another model (Codex, ChatGPT) cannot read it, a reviewer who sees the author's reasoning is no longer blind, and it costs the whole session on every call. What the session knows that the repo does not (a rejected approach, Craig's words, a half-finished hunt) goes into a note first, and the card cites it under `Constraints` or `Read`.
- A follow-up goes to the same worker, which keeps its own context. A fork that inherits the session is allowed only when writing the note would cost more than the fork, and the progress entry says so.
- One card per worker. If a worker needs another worker, it returns BLOCKED with the card it would send.
- Word and tool-call caps are part of the task. A worker that needs more says so in `Open:` rather than spending it.
