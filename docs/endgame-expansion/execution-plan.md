# Endgame Expansion Execution Plan

## Objective

Build a high-level endgame expansion batch of about 300 total lessons while keeping the website unchanged until the whole batch is complete and validated.

## Non-Negotiable Rules

- Do not add partial candidate lessons to `endgames.js`.
- Do not scrape HTML.
- Do not copy or translate commentary.
- Do not accept elementary technique lessons unless embedded in a complex master-game decision.
- Reject any lesson that fails legal move replay.
- Reject any lesson below complexity score 7.

## Phase 1: Source Intake

1. Verify source registry entries before use.
2. Download only explicit PGN files or use official APIs.
3. Save raw files under `data/endgame-expansion/sources/raw/`.
4. Record every raw file in `source-registry.json`.
5. Strip comments before candidate extraction.

## Phase 2: Candidate Extraction

Extract candidate positions only after enough material has been reduced to an endgame or late middlegame-endgame transition.

Candidate triggers:

- Queens are off and at least one rook remains.
- Major-piece endgame with queens and few minor pieces.
- Rook + minor imbalance.
- Opposite-colored bishop endgame with active major pieces.
- Pawn race or passed-pawn transition.
- Fortress or defensive construction.
- Queen endgame with king-safety calculation.

Rejected triggers:

- Opening traps.
- Middlegame attacks.
- Elementary king-and-pawn-only technique.
- Forced tactical mate.

## Phase 3: Human-Level Analysis

For every candidate:

1. Identify the practical question.
2. Explain why the first move is hard.
3. Explain the defender's resource.
4. Choose a main line with enough replies to show the plan.
5. Write original `principle`, `method`, `mistake`, and `hints`.
6. Add step notes only at important turns.

## Phase 4: Category Merge

Maintain a working category map in `data/endgame-expansion/reports/category-map.md`.

No more than 12 final categories.

Merge categories when:

- Same decision skill.
- Same piece configuration and training goal.
- Fewer than 15 strong candidate lessons.

## Phase 5: Validation

Run after each candidate batch:

```powershell
node .\tools\endgame-expansion\validate-candidates.mjs
```

Run before final import:

```powershell
node --test .\tests\trainer-core.test.mjs .\tests\endgames.test.mjs .\tests\installer.test.mjs .\tests\server.test.mjs
```

## Phase 6: Final Import

Only after the full candidate batch is complete:

1. Generate final category list.
2. Rewrite weak existing analysis text.
3. Convert candidates into `endgames.js` lesson objects.
4. Update tests for final lesson count and category count.
5. Sync installer package.
6. Run full test suite.
7. Update user documentation.

## Current Status

- Standards document created.
- Source registry created.
- Candidate validator created.
- No new lessons have been added to the live website.

