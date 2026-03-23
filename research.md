# trip-optimizer: Deep Codebase Research Report

## 1. Project Overview

**trip-optimizer** is an autonomous travel itinerary optimization system built in TypeScript. It uses the "autoresearch" pattern — an iterative loop where an LLM generates mutations to a travel plan, scores them adversarially, and keeps only improvements. All state is git-backed: accepted mutations are commits, rejected ones are hard-reset. Over dozens of iterations, the plan ratchets toward a high-scoring, personalized itinerary.

**Tech Stack:** Node.js 22+, TypeScript, Commander.js, Inquirer, PDFKit, simple-git, Anthropic/Vertex AI SDKs, tsup (bundler), vitest (tests).

---

## 2. Project Structure

```
trip-optimizer/
├── src/                              # ~42 TypeScript source files
│   ├── cli.ts                        # Main CLI entry point (Commander.js)
│   ├── i18n.ts                       # Bilingual support (English / Simplified Chinese)
│   ├── index.ts                      # Package exports
│   ├── commands/                     # CLI command handlers
│   │   ├── init.ts                   # Trip creation + profile setup
│   │   ├── run.ts                    # Optimizer (standalone or agent mode)
│   │   ├── run-agent.ts             # Claude Code agent spawner
│   │   ├── research.ts              # Manual research sprint
│   │   ├── score.ts                 # One-off scoring
│   │   ├── plan.ts                  # Display/export plan to PDF
│   │   ├── debrief.ts              # Post-trip feedback collection
│   │   ├── config.ts               # API key / settings management
│   │   ├── profile.ts              # View travel profile
│   │   ├── status.ts               # Optimization progress summary
│   │   ├── dashboard.ts            # Live progress visualization
│   │   ├── chart.ts                # ASCII score progression chart
│   │   └── history.ts              # View past trip debriefs
│   ├── data/                        # Data models and file I/O
│   │   ├── schemas.ts              # All TypeScript interfaces
│   │   ├── config.ts               # config.json management
│   │   ├── profile.ts              # profile.json (user preferences)
│   │   ├── trip.ts                 # Trip scaffolding
│   │   └── paths.ts                # Global data directories (~/.trip-optimizer/)
│   ├── llm/                         # LLM provider abstraction
│   │   ├── provider.ts             # Provider interface
│   │   ├── factory.ts              # Provider selection logic
│   │   ├── anthropic.ts            # Anthropic API client
│   │   ├── vertex.ts               # Google Vertex AI client
│   │   ├── openai-compatible.ts    # OpenAI-compatible APIs (Kimi, DeepSeek, Ollama)
│   │   └── json-parser.ts          # Robust JSON extraction from LLM output
│   ├── generators/                  # Prompt-based content generation
│   │   ├── constraints.ts          # constraints.yaml from user input
│   │   ├── rubrics.ts              # Scoring rubric generation
│   │   ├── plan.ts                 # Initial itinerary generation
│   │   └── program.ts              # Agent instructions (program.md)
│   ├── optimizer/                   # Core optimization loop
│   │   ├── loop.ts                 # Main iteration loop
│   │   ├── mutations.ts            # Mutation generation logic
│   │   └── logger.ts               # results.tsv tracking
│   ├── scoring/                     # Three-pass scoring pipeline
│   │   ├── scorer.ts               # Main scorer orchestrator
│   │   ├── dimension-scorer.ts     # Individual dimension scoring
│   │   ├── critic.ts               # Adversarial penalty detection
│   │   ├── holistic.ts             # Cross-dimension adjustments
│   │   └── prompts.ts              # All scoring prompts
│   ├── research/                    # City research and database
│   │   └── researcher.ts           # Research generation + merging
│   └── memory/                      # Trip learning system
│       ├── debrief-processor.ts    # Process trip ratings
│       └── learned-generator.ts    # Extract preference signals
├── taiwan-2026-10/                  # Example: 7-day Taiwan trip (English)
├── 中国北疆-2026-10/                # Example: 14-day Xinjiang trip (Chinese)
├── tests/                           # Unit tests (vitest)
├── docs/plans/                      # Design documentation
├── dist/                            # Compiled output
├── package.json
└── tsconfig.json
```

---

## 3. End-to-End Data Flow

### Phase 0: Initialization (`trip-optimizer init <name>`)

1. **Profile collection** (first-time only): language preference, API key/provider, hotel loyalty program, dietary restrictions. Saved to `~/.trip-optimizer/config.json` and `~/.trip-optimizer/profile.json`.

2. **Trip questionnaire**: start/end dates, travelers, origin, cities (in order), route style (deep dive vs. wide coverage vs. balanced), budget, travel vibes, anti-patterns, must-visit places, hard constraints. Optionally runs a **preference interview** where the LLM generates 3-5 follow-up questions based on answers.

3. **LLM generation** of four files:
   - `constraints.yaml` — structured version of user answers
   - `rubrics.yaml` — 5-7 custom scoring dimensions with anchors + adversarial penalty rules
   - `plan.md` — baseline itinerary (YAML frontmatter + schedule overview table + day-by-day breakdown)
   - `program.md` — Claude Code agent operating instructions

4. **Git scaffold**: initializes git repo, commits all files as "Initial trip scaffold", creates `.gitignore`.

### Phase 1: Research (`trip-optimizer research [city]`)

For each destination city, the LLM researches activities, restaurants, neighborhoods, tourist traps, and seasonal highlights. Results are structured JSON merged into `activities_db.json` (deduplicated by name). Each entry includes scores (1-10), metadata (cost, duration, location, authenticity), and a `source` field tracking provenance (`llm_knowledge`, `web_search_verified`, etc.).

### Phase 2: Optimization Loop (`trip-optimizer run`)

The core loop:

```
ITERATION N:
  1. Pick mutation type (rotate through SWAP, UPGRADE, REORDER, SIMPLIFY, REALLOCATE;
     or RESEARCH if 5+ consecutive discards)
  2. LLM generates mutation → returns full new plan.md
  3. Write new plan.md, git add + commit
  4. Score: absolute (every 10 iterations, full 3-pass) or comparative (quick delta)
  5. Verdict: if score improved → keep; else → git reset --hard HEAD~1
  6. Log to results.tsv
  7. Repeat until Ctrl+C
```

Two execution modes:
- **Standalone** (`--standalone`): runs directly via LLM API calls
- **Agent** (default): spawns a Claude Code session that reads `program.md` and operates autonomously (can use browser, web search, file system)

### Phase 3: Post-Trip Learning (`trip-optimizer debrief`)

Collects day-by-day ratings (1-5) and surprise levels, overall rating, skip list, highlights, and new anti-patterns. Saves to `~/.trip-optimizer/trip-history.json`. An LLM then extracts "learned signals" — preference patterns, activity calibration deltas, anti-patterns, source reliability — saved to `~/.trip-optimizer/learned.json` and folded into the user profile.

---

## 4. Scoring Pipeline (3-Pass + Source Confidence)

This is the heart of the system. Each absolute scoring run involves:

**Pass 1 — Dimensional Scoring:** For each dimension in `rubrics.yaml`, the LLM scores the plan on 0-100 per sub-dimension using defined anchors. Sub-dimensions are averaged to produce a dimension score. Max tokens: 4,000 per dimension.

**Pass 2 — Adversarial Critic:** A strict critic LLM call evaluates the plan against all adversarial penalty rules (from `rubrics.yaml`). It explicitly audits every day against every rule. Returns penalties like `{ category, day, issue, penalty }`. Examples: "unconfirmed restaurant booking" (-3), "6+ hour transit day with 4 activities" (-10). Max penalty per dimension capped at -20. Max tokens: 8,000.

**Pass 3 — Holistic Adjustment:** Reviews all dimension scores for cross-dimension interactions. Example: "food scored high but logistics shows 10hr transit — food deserves +2 for smart station eating." Adjustments capped at +/-5 per dimension. Max tokens: 4,000.

**Pass 4 — Source Confidence Dampening:** Counts the percentage of activities sourced from `llm_knowledge` (vs. verified sources). If >80% unverified: caps `food_score` and `experience_quality` at 85.

**Composite score:** `composite = sum(dimension.score * dimension.weight)`, clamped to 0-100.

**Comparative scoring** (non-absolute iterations): a single LLM call compares old vs. new plan for the specific mutation, returning sub-dimension deltas (+/- 0-5). Faster but approximate; prevents score drift via periodic recalibration.

---

## 5. Mutation Types

| Type | What It Does |
|------|-------------|
| **SWAP** | Replace the lowest-scored activity with a higher-scored alternative from `activities_db.json` |
| **UPGRADE** | Replace a generic restaurant reference with a specific, authentic local choice |
| **REORDER** | Rearrange a day's activities for better geographic clustering (eliminate zigzag patterns) |
| **SIMPLIFY** | Remove an activity from a packed day, replace with free wandering/unstructured time |
| **REALLOCATE** | Move a day between cities (within min/max day bounds from constraints) |
| **RESEARCH** | Triggered after 5+ consecutive discards. Identify weak city, research 5-8 new options, add to DB, attempt a SWAP |

Selection: `MUTATION_ROTATION[iteration % 5]`, except RESEARCH overrides on plateau.

---

## 6. LLM Provider Architecture

Abstract `LLMProvider` interface with `complete(prompt, maxTokens)` method. Three implementations:

1. **Anthropic** (default) — `claude-sonnet-4-20250514` via `@anthropic-ai/sdk`. Streaming, 3 automatic retries on rate limit.
2. **Google Vertex AI** — same Claude model via `@anthropic-ai/vertex-sdk`. Auto-detected from `GOOGLE_CLOUD_PROJECT` env var.
3. **OpenAI-Compatible** — for Kimi, DeepSeek, local Ollama. Custom `base_url` + API key. Supports `thinking: { type: "disabled" }`. Only works in standalone mode.

Token budgets vary by task: 32,000 for plan/mutation generation, 8,000 for critic, 4,000 for dimension scoring/research/rubrics/holistic, 2,000 for preference interview.

---

## 7. Data Models

### constraints.yaml
Defines trip metadata (dates, travelers, origin), city list with roles (`destination` vs. `transit`) and min/max day allocations, hard requirements, must-visit places, preferences (priority vibes, anti-patterns, pro-patterns), dietary restrictions, loyalty program, and budget (amount + currency).

### rubrics.yaml
5-7 scoring dimensions, each with a weight (sum = 1.0) and sub-dimensions. Each sub-dimension has a description and score anchors (60/80/90). Also contains adversarial penalty rules grouped by category, each with a rule description and penalty amount, plus a `max_penalty_per_dimension` cap.

### plan.md
YAML frontmatter (trip name, dates, total days) followed by a schedule overview table and day-by-day sections with Morning/Afternoon/Evening/Dinner/Hotel/Transit sub-sections. Specific names, prices, times, and locations throughout.

### activities_db.json
Keyed by city (lowercase). Each city has arrays of activities, restaurants, neighborhoods for wandering, tourist traps, and seasonal highlights. Activities include name, type, score, authenticity, uniqueness, cost, duration, location, best time, and source.

### results.tsv
Tab-separated log: iteration, commit hash, score before/after, delta, status (keep/discard), mutation type, description. Gitignored — survives `git reset`.

### score.json
Latest scoring output with mode, composite score, per-dimension breakdown (scores, weights, sub-dimensions with notes), penalties, holistic adjustments, timestamp, and model used.

---

## 8. Bilingual (i18n) Support

Full English/Chinese bilingual operation. Language is selected during `trip-optimizer init`.

- `src/i18n.ts` contains a `messages` record mapping `MessageKey → { en, zh }` for all CLI prompts
- `getLlmLanguageInstruction()` appends a language directive to every LLM prompt (e.g., "Generate ALL output in Simplified Chinese")
- Chinese trips prioritize Chinese platforms in research (Dianping, Xiaohongshu, Mafengwo)
- PDF generation downloads Google Noto Sans SC font (cached at `~/.trip-optimizer/fonts/NotoSansSC.ttf`) for CJK rendering
- Trip folders can use Chinese names (e.g., `中国北疆-2026-10/`)

---

## 9. PDF Generation

Uses PDFKit to generate exportable itineraries:
- Strips emoji from text
- Renders Markdown tables
- Cover page with trip metadata
- Page breaks and proper margins
- CJK font support (Noto Sans SC, downloaded on first use)
- Works for both English and Chinese itineraries

---

## 10. Claude Code Agent Integration

Default mode spawns a Claude Code session:

1. Generates `program.md` with detailed agent instructions covering:
   - Setup (read all .yaml and .json files)
   - Phase 1: Research sprint with source priorities (browser > web search > LLM knowledge)
   - Phase 2: Optimization loop with mutation rotation
   - Mutation guidelines (respect constraints, leave free time, etc.)
   - Crash recovery and plateau handling
   - Context management tips

2. Spawns `claude` CLI with `--dangerously-skip-permissions` (YOLO mode) or `--safe` flag
3. Agent operates autonomously — reads/writes files, runs git, executes CLI commands, uses browser/web search

---

## 11. Crash Recovery & State Management

- `results.tsv` is gitignored, survives `git reset --hard` operations
- On startup, reads last best score from `results.tsv` to resume correctly
- If interrupted mid-iteration, the loop picks up from the next iteration with the correct baseline
- 10+ consecutive discards triggers a warning but doesn't auto-exit (switches to RESEARCH mutations)
- `score_history.jsonl` provides line-delimited JSON snapshots for charting

---

## 12. Global User State

Stored at `~/.trip-optimizer/`:

| File | Purpose |
|------|---------|
| `config.json` | API key, provider, search API settings |
| `profile.json` | Loyalty program, dietary restrictions, learned vibes, trip count |
| `trip-history.json` | Array of all trip debriefs |
| `learned.json` | Aggregated preference signals from debriefs |
| `fonts/NotoSansSC.ttf` | Cached CJK font for PDF |

---

## 13. CLI Commands

| Command | Purpose |
|---------|---------|
| `init <name>` | Create new trip (interactive Q&A, LLM generation) |
| `config [set <key> <value>]` | Manage API keys and settings |
| `profile` | View travel preferences and learned patterns |
| `run [--standalone] [--headless] [--safe]` | Run optimization loop |
| `research [city]` | Manual research sprint for a city |
| `score` | One-off full 3-pass scoring |
| `status` | Show optimization progress summary |
| `dashboard [--watch]` | Live progress visualization |
| `chart` | ASCII score progression chart |
| `plan [--pdf] [-o <path>]` | Display plan or export to PDF |
| `debrief` | Post-trip feedback collection |
| `history` | View past trip debriefs |

---

## 14. Example Trips

### taiwan-2026-10/ (English, 7-day)
Taipei-centric trip with day trips to Jiufen, Pingxi, Beitou, Keelung. Contains a fully optimized `plan.md` (15KB), a large `activities_db.json` (~200+ activities), optimization history in `results.tsv`, and a generated `plan.pdf` (61KB).

### 中国北疆-2026-10/ (Chinese, 14-day)
Deep dive through northern Xinjiang: Urumqi → Keketuohai → Kanas → Baihaba → Hemu → Wuerhe → Urumqi. All content in Simplified Chinese. Includes seasonal highlights (October silvergrass, fall colors), Uyghur cuisine, costs in CNY, a `web_research_report.md`, and a CJK-rendered `plan.pdf` (222KB).

---

## 15. Key Architectural Insights

### Why the autoresearch pattern works here:
1. **Constrained search space** — only 1 mutation per iteration, no combinatorial explosion
2. **Clear scalar metric** — composite score 0-100, unambiguous accept/reject
3. **Ratchet property** — gains locked via git commits, losses discarded via reset
4. **Compounding knowledge** — each iteration builds on growing activities_db + score history
5. **Self-correcting** — consecutive failures trigger RESEARCH to break plateaus

### Adversarial scoring prevents gaming:
- Pass 1 rates honestly, Pass 2 hunts for violations, Pass 3 reconciles
- This prevents "average-sounding" plans from scoring artificially high
- Specific penalty rules (e.g., tourist traps, scheduling conflicts) enforce concrete quality

### Memory creates personalization across trips:
- Trip 1 debriefs reveal what users *actually* liked vs. what they *said* they'd like
- Learned signals adjust scoring dimensions and activity preferences over time
- Eventually, rubrics become person-specific, not generic

### Source confidence prevents hallucination spiraling:
- If >80% of research is from LLM knowledge (no web verification), scores are capped at 85
- This incentivizes using browser/web search during the research phase
- Prevents the optimizer from confidently building on unverified restaurant names and activity details

---

## 16. Testing

Tests use vitest, located in `/tests/`. Coverage areas:
- Data layer: config, profile, paths, trip scaffolding
- LLM: JSON parser (handles malformed LLM responses)
- Optimizer: logger (results.tsv parsing), mutations
- Scoring: critic penalty logic, prompt construction
- Memory: debrief processing, learned signal generation
- Research: activity database merging and deduplication

Run with `npm test` or `npm run test:watch`.

---

## 17. Build & Distribution

- Built with tsup → `dist/cli.js` + `dist/commands/run-agent.js`
- Entry point: `#!/usr/bin/env node dist/cli.js`
- Published to npm as `trip-optimizer`
- Install: `npm install -g trip-optimizer` or `npx trip-optimizer`
