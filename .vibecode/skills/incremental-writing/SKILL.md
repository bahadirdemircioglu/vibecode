---
name: incremental-writing
description: "Write long documents section-by-section to minimize token usage. Use when creating architecture plans, design docs, API specs, or any multi-section document."
---

# Incremental Writing Skill

## Purpose

Minimize token waste when producing multi-section documents (architecture plans,
design docs, API specs, ADRs, etc.) by writing one section at a time instead of
drafting the entire document in conversation and then writing it all at once.

---

## Protocol

### Step 1 — Create Skeleton Immediately

As soon as the document scope is agreed upon, create the file with the full
structure. Every section header is present, but bodies contain only a placeholder.

```markdown
## Section Title
[To be designed]
```

This gives both the user and Claude a table of contents and a progress tracker.

### Step 2 — Draft ONE Section at a Time

Discuss, iterate, and finalize a single section in conversation. Do not move to
the next section until the current one is approved by the user.

### Step 3 — Write to File Immediately

As soon as a section is approved, use the Edit tool to replace the
`[To be designed]` placeholder with the final content. Do not accumulate
multiple sections in conversation before writing.

### Step 4 — Update HANDOFF.md

After each section write, update HANDOFF.md with:
- Which sections are complete
- Which section is next
- Any open questions from the discussion

### Step 5 — Compact Safely

Previous conversation about completed sections can be safely compacted.
The content is already persisted in the file. Only the current in-progress
section needs to stay in context.

### Step 6 — Recovery

On session recovery (after `/vibe-compact` or new session):
1. Read the document file
2. Scan for sections that still contain `[To be designed]`
3. Resume at the next empty section
4. Read HANDOFF.md for any open questions from the previous session

---

## Token Savings

| Approach | Tokens per document |
|----------|---------------------|
| Draft full document in conversation, then write | 30-50K |
| Incremental section writing | 3-5K per active section |

The savings come from never holding the full document in conversation context.
Each section is written to disk and forgotten.

---

## When to Use

- Architecture plans (`docs/architecture/*.md`)
- Design documents
- API specifications
- ADRs (`docs/decisions.md` entries)
- Any document with 5+ sections
- Any document expected to exceed 2000 words

---

## Anti-patterns

```
NEVER draft the full document in conversation, then write it all at once.
  -> This wastes 30-50K tokens holding content that could already be on disk.

NEVER skip the skeleton step.
  -> Without a skeleton, there is no progress tracker and recovery is harder.

NEVER write multiple sections to file in a single Edit call after discussing
them all in conversation.
  -> Write each section as soon as it is approved.

NEVER forget to update HANDOFF.md after writing a section.
  -> This is the recovery mechanism. Without it, context loss = progress loss.
```
