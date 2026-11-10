<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Comment conventions

Comments here explain **why**, never what. The code already says what it does; a
comment earns its place by recording something the code cannot: a constraint, a
past incident, a rejected alternative, or a trap waiting for the next reader.

### Use the right form for the scope

| Form | Use for | Rule |
|---|---|---|
| `/** */` at top of file | What the module is and the guarantees it makes | One per file, max ~12 lines |
| `/** */` above an export | Non-obvious return shape, throw conditions, params | Required when callers branch on the result |
| `//` inline, 1–3 lines | Why *this* line is the way it is | Sits directly above the code it describes |

Never stack more than about four `//` lines in a row. A long `//` wall is a
module-level block that has not been written as one — convert it to `/** */`.

### Keep a comment adjacent to its subject

This is the rule most often broken, and the only one that actively misleads.
`mailer.js` once opened with a 21-line `//` wall covering five topics, four of
which described functions defined 15–130 lines below. A reader arriving at
`smtpUser()` met the sentence "This function never throws" and had every reason
to believe it was about `smtpUser`.

That wall grew one comment at a time, each appended during an unrelated fix. So:
when adding a comment, put it against the code it explains, and when a header
has collected a second unrelated topic, move it rather than extending the wall.

### Write these

```js
// Gemini reports an invalid key as HTTP 400, not 401, so treating every 400 as
// a refusal let one typo'd key hold every message as a draft.

// Not awaited: a failing mail server must not hold the response open. The
// token is already stored, so the link is valid either way.
```

### Do not write these

```js
// Set the user's email          <- restates the assignment
// Loop over the topics          <- restates the loop
// Returns the base URL          <- restates the function name
// Added for the invite flow     <- belongs in the commit message; rots
// TODO: refactor later          <- either do it or open an issue
```

Delete a comment when the code it described is gone. A stale comment outranks
the code in a reader's mind and is worse than no comment at all.

### Checks

```
grep -rnE '^\s*//.*(get|set|return|loop|iterate)s? the' src/   # restatement
grep -rn  'TODO\|FIXME\|XXX' src/                              # should be empty
```
And after editing any file, re-read the comment immediately above your change
and confirm it still describes what is now there.
