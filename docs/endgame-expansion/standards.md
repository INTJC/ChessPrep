# Endgame Expansion Standards

This document is the working contract for expanding the endgame trainer. New lessons stay outside `endgames.js` until the whole batch has passed these gates.

## Goal

- Final endgame course target: about 300 high-level lessons total, but only after every public-PGN lesson has passed final source-line review.
- Category limit: at most 12 categories after merging overlapping themes.
- Current 91-book lessons remain in scope, but their teaching text must be rewritten as original training analysis over time.
- New lessons must target strong tournament players, not basic endgame technique. A famous player name is not enough; every lesson must still pass the position-quality and analysis-quality gates below.

## Legal And Source Rules

Allowed sources:

- Official downloadable PGN feeds or APIs.
- Explicitly public downloadable PGN archives.
- User-provided PGN files.
- Public-domain or factual game scores used only as raw move data.

Preferred sources:

- Lichess Broadcast Database, especially official broadcast PGNs released under CC BY-SA 4.0.
- TWIC PGN downloads, used as factual game-score input only.
- PGN Mentor free PGN files, used as factual game-score input only.
- Official event PGN downloads from tournament organizers.

Forbidden sources:

- Scraping HTML pages for games.
- Browser automation to bypass site UI.
- Login-only databases, paid databases, or copyrighted annotated files unless the user provides them and has rights to use them.
- Copying or translating third-party commentary.
- Importing PGN comments, NAG prose, or engine annotations as teaching text.

Source record requirements:

- `sourceId`
- `sourceName`
- `sourceUrl`
- `sourceType`
- `accessMethod`
- `licenseOrUseBasis`
- `downloadedAt`
- `rawFile`
- `notes`

Any candidate without a source record is rejected.

## Player And Game Quality

Required game quality:

- For the PGN rebuild, prefer games with at least one 2700+ player and the opponent at least 2600+, unless the game is a historically elite world-championship-cycle game.
- Prefer games from world championship cycles, candidates-level events, super-tournaments, FIDE Grand Prix, Grand Swiss, World Cup, Olympiads, or equivalent classical elite events.
- Classical games are the default. Rapid games require explicit manual justification; online preliminaries, blindfold, Armageddon, blitz, and bullet are excluded from the strict PGN rebuild.
- Bullet is excluded.
- Engine-vs-engine games are excluded unless explicitly chosen for a technical tablebase-like point.
- Casual, simul, odds, handicap, puzzle-composed, anonymous, or training-only games are rejected.

Quality tiers:

- Tier A: World champion, candidates-level, 2700+ elite, or championship-cycle game. Preferred for final lessons.
- Tier B: GM/master game from a serious event with rich endgame content. Accepted when the position is clearly instructional.
- Tier C: Public online or lower-metadata game. Used only as a temporary candidate until player/event quality is verified.
- Rejected: unverifiable player strength, casual context, elementary technique, or unclear provenance.

Game metadata requirements:

- `white`
- `black`
- `event`
- `site`
- `date`
- `result`
- `sourceId`
- `timeControl` when available
- `playerQualityReason`

## Lesson Selection Standards

A lesson must teach a real high-level decision, not a basic rule.

Required lesson qualities:

- The starting position must be a practical decision point.
- The best move must not be a one-move tactic only.
- The line must show a plan, defensive resource, conversion method, fortress attempt, transition, or calculation branch.
- If a lesson is presented as coming from a public PGN game, its required answer line must follow the actual game continuation from `startPly` without divergence. Engine improvements may be recorded only as separate analysis notes, not as the main training line.
- The position must have enough material or strategic tension for a high-level player.
- The lesson must not duplicate another lesson's starting position or trivial continuation position.

Complexity score: 0 to 10.

Minimum score to enter the final course: 7.

Minimum score to enter final import from a non-Tier-A game: 8.

Minimum score for the strict public-PGN rebuild shortlist: 9.

Minimum manual review score: 4 of 5. The five manual review points are:

- Practical decision is genuinely hard for a strong player.
- First move is explained by concrete positional features, not only engine preference.
- Defender has a meaningful resource or practical trap.
- The line teaches a reusable high-level skill.
- The lesson is not merely a later position from an already selected task.

Scoring rubric:

- Material imbalance or unusual material: 0-2.
- King activity and safety tension: 0-2.
- Pawn-race or passed-pawn calculation: 0-2.
- Defensive resource or fortress possibility: 0-2.
- Conversion technique beyond a simple tablebase win: 0-2.

Automatic rejection:

- Pure Lucena, Philidor, Vancura, opposition, square-of-the-pawn, or elementary wrong-bishop technique unless embedded in a complex master game.
- Any "basic technique" standalone lesson. The high-level course no longer contains a basic-technique section.
- Obvious single-move tactic without follow-up.
- Too few legal continuations to be useful.
- A forced mate puzzle rather than an endgame lesson.
- A continuation of an existing lesson already represented as the same task.
- A second candidate from the same source game, unless the earlier candidate was rejected and the later position is manually approved as a genuinely different task.
- A candidate whose only justification is that the source game is famous.
- A candidate from an unverified or legally unclear source.
- A public-PGN candidate whose main lesson line diverges from the source game continuation, unless it is explicitly relabeled as an engine study and manually approved under a separate source record.

## Category Rules

Target maximum: 12 categories.

Existing categories may be preserved or merged:

- Rook activity.
- King activity.
- Practical themes.
- Single-rook defense.
- Rook and minor-piece activity.
- Rook bishop vs rook knight.
- Queen endgames.
- Queen and minor-piece endgames.

Possible new/merged high-level categories:

- Pawn races and transition endgames.
- Fortress and defensive construction.
- Opposite-colored bishop and initiative.
- Conversion under counterplay.

Category creation gate:

- A category needs at least 15 final lessons unless it is a specialist category essential to the course.
- Similar categories are merged if the training questions overlap.

## Original Analysis Requirements

Every lesson must include:

- `principle`: a general concept in original wording.
- `method`: a concrete plan explaining why the chosen move order works.
- `mistake`: a realistic high-level mistake and why it fails.
- `hints`: two or three short hints.
- `steps`: UCI main line, with replies where needed.
- Important step notes for critical moments.

Forbidden analysis:

- Direct translation from a book or website.
- Slightly paraphrased third-party commentary.
- Blind engine line without human explanation.
- Generic text that could apply to any position.

Analysis quality gate:

- The first move must be explained by position features.
- At least one plausible alternative must be implicitly or explicitly rejected.
- The defensive side's idea must be described, not only the winning side's plan.
- The lesson must say what can go wrong in practical play.

## Technical Validation

Every candidate must pass these checks before final import:

- FEN is valid.
- Orientation equals side to move.
- Every UCI move is legal from the current FEN.
- Every reply is legal.
- For public-PGN lessons, the flattened lesson `steps` line equals the source PGN continuation from `startPly`.
- Public-PGN drafts must carry `sourceLine`; analysis drafts and publishable candidates without it are not valid for final promotion.
- Final FEN is recorded.
- No lesson starts from a position inside another lesson's main line.
- `id` is unique.
- `sourceId + game + startPly` is unique.
- `fen + firstMove` is unique.
- Category id exists.
- Teaching fields are non-empty and sufficiently specific.

Required tests before final import:

- Candidate JSON schema test.
- Legal move replay test.
- Duplicate starting-position test.
- Duplicate continuation-position test.
- Source compliance test.
- Public-PGN source-continuation test.
- Category count test: `<= 12`.
- Final lesson count target test.
- Installer sync test.
- Full app test suite.

## Batch Workflow

No candidate enters `endgames.js` until the full batch is ready.

Workflow:

1. Build source registry.
2. Download or import allowed PGN files.
3. Strip comments and annotations from raw PGN.
4. Parse games into local normalized game records.
5. Detect candidate endgame segments.
6. Apply strict player/event gates before shortlist creation.
7. Score candidate complexity and keep only score-9+ public-PGN rebuild candidates.
8. Keep at most one candidate per source game.
9. Build context windows with `sourceLine` before any analysis is written.
10. Run engine assistance only as a sanity check on the source move; never replace the main line with an engine PV.
11. Write original analysis against the actual game continuation.
12. Validate all candidate lines against `sourceLine`.
13. Merge categories to at most 12.
14. Rewrite weak existing analyses.
15. Generate a final import file with `importReady: true` only after source-continuation and manual difficulty review pass.
16. Run full validation.
17. Only then add the batch to the website.

## Working Files

- `docs/endgame-expansion/standards.md`: this standard.
- `data/endgame-expansion/sources/source-registry.json`: allowed sources.
- `data/endgame-expansion/candidates/*.json`: candidate lessons outside the app.
- `data/endgame-expansion/reports/*.md`: review reports and rejection logs.
- `tools/endgame-expansion/*.mjs`: validation and extraction tools.
