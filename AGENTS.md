# Atlas PMS — Agent Guidelines (C:\AtlasHomestays\code)

## Repo Inventory (Release Train: 4 deployed app repos + `atlas-e2e` on `dev` only)

These 4 application repos are on the **release train** (they have a `qa` and `main` branch and are deployed to QA/Production). `atlas-e2e` is **NOT** deployed anywhere (`TASK-103062`) and runs exclusively from `dev` (with `train/<date>` tags pinned at cut time — **never** check out `qa` or cherry-pick to `qa` in `atlas-e2e`).

| Repo | Branches | Notes |
|---|---|---|
| `atlas-api` | `dev`, `main`, `qa`, plus feature/fix/rescue/revert branches | Core API (deployed) |
| `atlas-admin-portal` | `dev`, `main`, `qa` | Admin UI (deployed) |
| `atlas-guest-portal` | `dev`, `main`, `qa` | Guest-facing UI (deployed) |
| `atlas-pms-landing` | `dev`, `main`, `qa` | PMS landing page (deployed) |
| `atlas-e2e` | `dev` only (`TASK-103062`: no `qa`/`main` promotion; never deployed) | End-to-end test suite & docs |

**Non-train repos** (no `qa` branch, different semantics):
- `atlas-sales-portal` — has `dev`/`main` only
- `atlas-host-docs` — has `dev`/`main` only
- `sreekaratla` — personal, exclude from Atlas sweeps

## Release Train Cut Bar Invariant
- **Steps 1 to 8**: Zero tolerance (100% green). Never run Step 9 or cut QA if Steps 1–8 fail.
- **Local Step 9 Cut Bar**: 0 `@ari` failures and fewer than 10 non-ARI failures (< 10 non-ARI).
- **Founder Ruling (2026-10-12 — Rerun Failure Fixes Invariant)**: Whenever a rerun or repair attempt is undertaken to fix failures, agents must NOT deliberately aim merely to squeak under the `< 10 non-ARI` bar. The deliberate attempt must always be to **fix all failures (100% green)**. The `< 10 non-ARI` bar exists to speed up QA cut on runs where only a few stragglers occur, but whenever the bar itself is not met, the rerun must aggressively target and fix ALL failures.
- Cut to QA immediately once the local bar is met. Never cut QA without passing local gate first.


## Hard Rule — git boundary

**Never** run `git init`, `git add`, `git commit`, or any other git command from the root folder `C:\AtlasHomestays\code`. Always target one of the subfolders (e.g. `git -C atlas-api status`).

**Why**: On 2026-07-15 an agent ran git commands from the root, which silently initialized a new repo, swept up ~960 MB of orphaned objects, and left a phantom unborn branch (`feature/task-4563-cert-gate`). Delete any `.git` that reappears at the root after confirming it's empty/orphaned.

## Enumerating repos

- `.git` is a **directory** → real repo
- `.git` is a **file** → a linked worktree of another repo, so skip it
- A root-level worktree can appear at any time (e.g. `atlas-api-fix` until 2026-08-12); "does a `.git` exist" checks will misread it

## Hard Rule — Gemini 4 Argon (High) disabled on this machine (2026-11-01) & Argon Low Default (2026-11-04)

**Gemini 4 Argon (High)** (`gemini-4-argon-high` / `MODEL_PLACEHOLDER_M417` / enum `1417`) is **disabled on this machine in Antigravity**.
- **Gemini 4 Argon (Low)** (`1419`) is the **default model** going forward (Founder Ruling 2026-11-04: *"use low going forward"*). **Gemini 4 Argon (Medium)** (`1418`) remains enabled and permitted.
- When Argon is selected for agents, subagents, or sidecars, use `gemini-4-argon-low` (or `Model: "inherit"` when the UI selector is set to Low) — never dispatch `high`.

## HARD RULE — Targeted Verification & Report Reconciliation Standard for Stage 4/5/6 Tail Repairs (FOUNDER RULING 2026-11-04)

Once a full suite run completes in **Stage 4 (Step 9 Browser E2E Scout)**, **Stage 5 (Step 7 API Integration Slices 7a–7d)**, or **Stage 6 (Step 1 Unit/Lint Validation)** and only tail failures remain:
- **Do NOT re-run the entire multi-hour suite from scratch** after subagents fix and merge the failing tests.
- Instead:
  1. Dispatch parallel domain-bundled subagents in isolated worktrees to fix the failing specs/tests, verify each fix in isolation (rebuilding/restarting local API if backend code changed), and merge to `origin/dev`.
  2. Fast-forward the primary checkouts to `origin/dev`, run targeted verification on just the repaired specs/tests, reconcile the suite report (`test-results/report.json`, slice logs / `.gate/step7-slices.json`, or `.gate/step1-units.json`) with the verified green results, run `verify-pipeline-stage.mjs --stage <N>`, and advance immediately to the next stage.

## HARD RULE — Founder Ruling (2026-10-25: Autonomous Velocity & Silent Bundled Execution)

1. **Mandatory Domain-Bundled Parallel Subagent Fanout (Pool = 6 to 8 Subagents / System CPU Cores ($env:NUMBER_OF_PROCESSORS = 8 Cores on this host))**:
   - **Zero Serial Execution Across ALL Stages**: Sequential task repair in the parent orchestrator is strictly barred. The moment pickable tasks or test failures exist, partition them into **large domain bundles (drain tasks: 4–6 tasks / 6–8 effort points, migration bundles = 3 tasks run in sequence; Stage 4–6 repair: ALL failures of a domain in ONE agent, no spec cap) sharing the same repo and pool, preferring the same controller/service/portal area; every bundle lands as ONE PR per repo, one commit per fix (FOUNDER 2026-10-29, atlas-domain-bundled-subagents §C)** (Founder ruling 2026-10-28: "63 in 49 bundles is almost sequential"; sizing rule and evidence live in `atlas-e2e/skills/atlas-domain-bundled-subagents/SKILL.md`). Land each task as soon as it is green; box a bundle at ~90 minutes / ~600 steps.
   - **Continuous Rolling Pool (6 to 8 Subagents on this machine, or System CPU Cores on another host) & Zero Priority-Tier Barrier Stalls (Founder Ruling 2026-10-25 & 2026-10-28)**: Maintain an active pool of 6 to 8 concurrent subagents in isolated worktrees (`C:\AtlasWork\wt\...`). The instant any subagent completes, merges its PR, and exits, immediately dispatch the next pre-staged cluster into the freed slot. Priority order (`P0 -> P1 -> P2 -> P3`) governs **which unclaimed cluster takes the next free slot first** — NEVER a hard barrier that leaves 5–7 CPU slots idle while 1–2 straggler subagents finish the tail of `P0` or `P1`. Whenever all remaining `P0`/`P1` tasks are already in flight inside active subagents, **immediately backfill all remaining governor-allowed slots (`6–8` total active) with non-overlapping next-tier (`P1`/`P2`/`P3`) clusters**.
   - **Permanent Invariant Across All Stages & Preflight Fixers**: This domain-bundled parallel execution rule is remembered and enforced across all drain campaigns (`atlas-p0-drain`, `atlas-p1-drain`, `atlas-drain`, `atlas-overnight-chain`), Step 9 Browser E2E Scout (`atlas-step9-e2e-scout`), Step 7 API Integration Lane (`atlas-step7-integration-lane`), Step 1 Quick Validation Preflight Fixers, and all 6 stages of `atlas-cpo-qa-drain-pipeline`.
   - **Strict Ban on Ungoverned Multi-Agent Spawns (Founder Ruling 2026-10-28)**: NEVER launch 20+ subagents at once (e.g. during Stage 1 CPO or Stage 2 QA Bug Hunt). The orchestrator must run `check-vbcs.ps1` before every wave and launch in rolling waves strictly bounded by host headroom (at most 6 to 8 concurrent subagents / host CPU cores).
   - **Domain Bundling as the Primary Driver**: Running single tasks across dozens of worktrees causes git rebase thrash and compilation locks. Domain bundling reduces rebuilds, amortizes git synchronization, and delivers massive 5x+ velocity gains (~25+ tasks/hour).

2. **Silent Autonomous Execution (Zero Chat Spam / Heartbeat Cron Overturn)**:
   - **Overturned 2026-10-25**: The mandatory recurring 2-minute chat cron is cancelled for drain and development sessions. Never arm a recurring chat cron during autonomous runs.
   - **Silent Background Logging**: Write all test counts, status updates, and progress directly to disk (`C:\AtlasHomestays\logs\heartbeat.jsonl` or local ledger). The agent must run silently without interrupting the user in chat, speaking only upon complete backlog drain (100% green) or major phase transition.

3. **Pre-Staged Worktree Pipeline & Fast Compilation**:
   - Worktrees must be pre-created and updated with `git pull --rebase origin dev` in background tasks *while* subagents are executing, so new subagents launch with zero checkout lag.
   - **AMENDED 2026-10-29 (founder): no `node_modules` junctions** (they break the workspace HARD RULE and emptied the primary checkout's `node_modules` at least nine times, again on 2026-10-28). Duplicate `npm install` is avoided with a pool of WARM worktrees created once by `scripts/agent-worktree.ps1` and handed to one agent at a time (`fetch` + `checkout --detach origin/dev` + `clean -fd`, `npm ci` only when the lockfile changed). The same ruling lets guardrail and non-guardrail tasks share an agent at the same model tier, puts the API and portal halves of one feature in ONE agent, and gives each agent a test budget (one union RED/GREEN, one ≤500-test adjacent run, no broad or whole-suite runs; one designated sweep agent per wave runs the full suites). Rules: `atlas-e2e/skills/atlas-domain-bundled-subagents/SKILL.md` §A/§C.
   - Mandatory `-p:UseSharedCompilation=false` and single-class/targeted test filters (`--filter 'FullyQualifiedName~<WaveTests>'`) to prevent Roslyn compiler locks and redundant full-suite executions.
   - Autonomous Host Resource Governor (**AMENDED by FOUNDER RULING 2026-11-03**): the orchestrator may terminate orphaned `VBCSCompiler`, stale node workers or hung test runners **that its own session started**. It may **never** stop a process another live session started. Before stopping any `node`/`pwsh`/`dotnet`/`chrome` process you did not start, run `pwsh -NoProfile -File atlas-e2e/scripts/test-stack-lock.ps1 who-owns -TargetPid <pid>`; exit 4 means **DO NOT STOP IT**. (2026-11-03 07:13: a subagent `taskkill`ed another session's live Stage 4 Playwright run as "orphaned" under the old wording of this line.)

## HARD RULE — Zero Polling & Zero Timer Loops in Antigravity (FOUNDER RULING 2026-11-08 / ANTI-QUOTA-EXHAUSTION STANDARD)

Antigravity operates on **Reactive Wakeup (No Polling Needed)**: the system automatically resumes agent execution when:
- A message arrives from a subagent or peer agent (`send_message`)
- A background task completes or sends a notification (`<SYSTEM_MESSAGE> [Message] Task id "..." finished`)
- A user-queued message arrives

**Strict Invariants for All Agents, Orchestrators, and Subagents:**
1. **Zero `manage_task(status)` Polling:** NEVER call `manage_task` with `Action: 'status'` or `Action: 'list'` in a loop to check if a command (e.g. Playwright, integration slices, dotnet build, release-gate) is running or finished.
2. **Zero `schedule(DurationSeconds)` Timer Loops:** NEVER call `schedule` with `DurationSeconds` as a sleep/wait timer.
3. **End Your Turn Immediately:** When a command continues in the background (`Tool is running as a background task`) or when subagent waves are dispatched: output a one-line status and call **ZERO more tools** to end your turn. Antigravity will notify you the exact millisecond the task finishes.
4. **Why:** Each polling turn resends the entire conversation context (500KB–750KB+), burning ~150k+ tokens per call. A 100-turn polling loop burns 50M+ tokens and exhausts 60%+ of the machine's daily quota in hours. Polling is mechanically audited and blocked by pipeline stage verifiers.

## HARD RULE — never `gh pr merge --admin`, orchestrators included (FOUNDER, 2026-11-03)

No agent passes `--admin` to `gh pr merge`, or uses any other admin override, to land a PR: not a subagent, not an orchestrator, not the release train. Merge with plain `gh pr merge --merge`. If GitHub refuses the merge, the PR is not ready: fix what it names, and never toggle or bypass branch protection (HARD RULE 17).
- `main` already enforces its checks for admins on all five repos (`enforce_admins` on, checked 2026-11-03), so `--admin` cannot get past `Pre-prod GO` or `PR source must be qa` anyway. On `dev` it skips nothing. The ban is about the habit, which reaches the branches where it would matter.
- 2026-11-03: an orchestrator merged five PRs with `--admin`, following two lines of this file that told it to. Both lines are now fixed.

## HARD RULE — one session at a time on the local test stack (FOUNDER RULING 2026-11-03)

The local test stack is the API on `:5120`, the portals on `:5173`–`:5175`, `(localdb)\AtlasE2E`, and anything that builds or runs from a shared primary checkout or switches one off `dev`. Only one session (Antigravity or Claude, scheduled or manual) uses it at a time; the second **waits its turn**. A release (dev → qa → prod) **jumps the queue**: it never cancels a run in progress, but it goes next.
- The lock is `atlas-e2e/scripts/lib/test-stack-lock.ps1`. `start-servers.ps1`, `run-step9-e2e-scout.ps1`, `run-local-e2e.ps1`, `release-gate.ps1`, `run-integration-slices.ps1`, `deploy-qa-api.ps1` and every local `npx playwright test` (via `scripts/global-setup.ts`) take it themselves. A run that prints `TEST-STACK-LOCK: waiting` is working as designed: wait, never work around it.
- `pwsh -NoProfile -File atlas-e2e/scripts/test-stack-lock.ps1 status` shows who holds the stack and who is queued.
- Never improvise a watchdog that restarts the API, and never write to the local test database by hand during a run. The only sanctioned cleanup is `prune-local-e2e-listings.sql`, run by the Step 9 runner and the gate.

## Skills (quick reference)

| Skill | When to use |
|---|---|
| `atlas-bnb-guesthouse-cpo` | B&B and Guest Houses CPO (`bnb-guesthouse.md` `BNB-NNN`): YCS Card #3 — Morning Breakfast & Kitchen Dietary Manifest (`CP`/`MAP`/`AP`), Home-Cooked Meal Pre-Order, Extra Mattress Upsells, B&B Onboarding Preset & `atlas-showcase` demo proof |
| `atlas-channel-shape` | "VR or hotel" provisioning decision for a new host |
| `atlas-cluster-listings-cpo` | Vacation Rentals & Parent-Child / Cluster / Lock-Off Listings CPO (`cluster-listings.md` `CLU-NNN`): YCS Card #5 — Whole Villa (`PARENT`) + Individual Rooms (`CHILD`) bidirectional Channex OTA sync, bundle pricing, occupancy math, VR fees/deposits/smart-locks & `atlas-showcase` demo proof |
| `atlas-channex-watch` | Monthly Channex distribution/onboarding audit |
| `atlas-conversion-scout` | Who can be converted, call sheet, churn risk |
| `atlas-dev-loop` | Hands-on session: merges, branch hygiene, dev→main promotion |
| `atlas-draft-to-board` | Convert draft requirements to board tasks |
| `atlas-dynamic-pricing-cpo` | OTA Revenue, Dynamic Pricing (Selected Dates -> Forever), Airbnb Color-Coded Rule-Sets (Multi-Tier 1–28d Last-Minute ladder, LOS, Early-Bird, CTA/CTD), PriceLabs Write-Lockout (`409`), Gap-Night Auto-Filler & OTA Promos CPO (`dynamic-pricing.md` `DYN-NNN`) |
| `atlas-drain` / `atlas-p0-drain` / `atlas-p1-drain` | Multi-agent board campaigns (P0→P1→P2→P3) |
| `atlas-drain-core` | Shared procedure body for drain skills |
| `atlas-drain-liveness` | Is a drain campaign currently alive? (exit codes) |
| `atlas-gap-scout` | Find defects that ship GREEN but reach customers |
| `atlas-growth-loop` | Growth/GTM strategy decisions |
| `atlas-hostels-cpo` | Hostels & Dormitories CPO (`hostels.md` `HSL-NNN`): YCS Card #2 — Dorm Bed-by-Bed Inventory (`HostelDorm`), Multi-Bed Booking Claims (`BedsBooked`), Gender Dorm Enforcement (`Mixed`/`FemaleOnly`/`MaleOnly`), Bunk-Bed Map Calendar, Rapid Per-Bed ID Scan & `atlas-showcase` demo proof |
| `atlas-hotel-chains-cpo` | Chain of Hotels & Multi-Property Groups CPO (`hotel-chains.md` `CHN-NNN`): YCS Card #4 — Chain Command Center, Per-Property State `GSTIN`/Entity/Invoice Prefix, CRO Multi-Property Booking, Chain VIP Recognition, Sister-Property Spillover & `atlas-showcase` 5-Property-Type Switcher |
| `atlas-hotels-cpo` | Hotels CPO (`hotels.md` `HTL-NNN`): YCS Card #1 — Multi-Room-Type Pools, Per-Room Out-of-Order (`OOO`), Expandable Tape Chart (`101..110` + `Unassigned`), Multi-Room Group Bookings (`GroupBookingId`) & Corporate BTC GST Folios, Housekeeping Matrix & `atlas-showcase` demo proof |
| `atlas-hotfix` | Urgent fix into production (author on dev, cherry-pick to qa, PR qa→main) |
| `atlas-improve-loop` | Autonomous bug/perf/NFR discovery, logs to board |
| `atlas-keep-going` | Founder delegates product/tech decisions — arms for session |
| `atlas-nightly-prep` | Release-prep hygiene pass |
| `atlas-numbers-check` | Recount host screen numbers (Today strip, calendar Occ. row, ₹ to collect, OTA prepaid balances) against bookings |
| `atlas-cpo-qa-drain-pipeline` | Daily 13:00 IST & on-demand sequential 6-stage pipeline: Unified Product CPO (Gemini 3.8) → QA Bug Hunt (Gemini 3.8) → Overnight Drain Chain (Flash/Pro until 100% closed) → Step 9 Browser E2E Scout (Pro parallel repair) → Step 7 API Integration Lane (Pro parallel slices) → Step 1 Quick Validation Preflight Green (Option A stand-down) |
| `atlas-overnight-chain` | Chain P0→P1→board→quick-wins unattended |
| `atlas-p0-drain` | P0 campaign only |
| `atlas-p1-drain` | P1 campaign only |
| `atlas-payments-cpo` | Payment Gateway & Payment Experience CPO: guest checkout (Razorpay/UPI/QR/15m hold/deposits/links/refunds/OAuth) & PMS subscriber renewals (10s No-Login Magic Renewal Links, UPI Autopay, `<2s` unlock) |
| `atlas-performance-cpo` | Full-stack Performance, Latency, Throttles & Test Speed CPO (`performance.md` `PERF-NNN`) |
| `atlas-pos-cpo` | Unified Hospitality POS CPO (`pos.md` `POS-NNN`) |
| `atlas-pms-pmo` | Board-hygiene pass, task prioritization |
| `atlas-pre-prod-release-gate` | ARI-hardened go/no-go before dev→prod promotion |
| `atlas-prod-promotion-sequence` | Promote qa→main and deploy to production |
| `atlas-qa-fix-cycle` | Land fixes on dev then re-measure QA |
| `atlas-quick-wins` | Full-depth board-truth pass, merge small safe fixes |
| `atlas-rate-plans-cpo` | Multi Rate Plan CPO: drives revenue growth through rate plan derivations, meal plans, cancellation policies, OBP ladders, channel markups, and direct booking engine selection (revenue focus; no daily task quota) |
| `atlas-replenish-backlog` | Autonomous replenishment: files 400+ tasks (200 UI/UX + 200 bugs) across 20 domains |
| `atlas-retro-session` | Post-run retrospective over transcript |
| `atlas-run-release-train` | "run release train" — interactive driver: classifies state across 5 repos, advances dev bar/cut/QA gate, halts at human qa→main gate, then deploys/verifies prod |
| `atlas-slow-or-stuck` | Diagnose if a slow command is working/blocked/lying |
| `atlas-standup` | Daily read-only standup — what landed, backlog movement |
| `atlas-step7-integration-lane` | 00:30 IST independent API integration runner & autonomous fixer (slices 7a-7d via run-integration-slices.ps1) |
| `atlas-step9-e2e-scout` | Independent browser E2E test runner & parallel fixer (autonomous, gate-independent) |
| `atlas-tenancy-site-check` | Pre-handover check: live site contextualized to tenant's data |
| `atlas-train-recovery` | On-demand standby driver for release train when down |
| `atlas-verify-e2e-fix` | Is an e2e spec fix actually verified before landing? |
| `atlas-verify-gate-steps` | Did gate STEP 7/9 actually run, or vacuous pass? |
| `atlas-visible-browser` | Headed, visible Chrome pair-browsing on user's desktop with slowMo & element highlight |
| `browser-automation` | Load a web page headless, report what happened |
| `customize-opencode` | Editing opencode's own config/agents/skills |
| `live-updates` | Standing preference for progress reporting on long-running work |
| `release-gate-live-updates` | Gate‑specific live progress (per‑slice test counts from heartbeat JSONLs) |

## Drain workflow order

`atlas-p0-drain` → `atlas-p1-drain` → `atlas-drain` (whole-board) → `atlas-quick-wins` (tail in every slot, bounded board-truth)

Since 2026-09-09, `atlas-quick-wins` is a BOUNDED BOARD-TRUTH TAIL run in EVERY overnight-chain slot, because ordering it fourth made it structurally unreachable (phase 2 must close ~40 P1s at ~2/slot before phase 3 may start).

## Release train promotion order

`dev` → `qa` → `main` → production

The API deploys BEFORE the portals. "Main is ahead of qa" is usually a lie — verify the SHAs match across repos before promoting.

## Pre-prod release gate (narrower than full gate)

Five workstreams: (A) blast-radius analysis of origin/main..origin/dev diff, (B1) ARI adversarial suite, (B2) ARI silent-failure analysis, (C) replay recorded incidents, (D) deploy-time failures not yet written up, (E) deploy-time preflight.

Two modes: normal gate scales to the diff (near-free when no ARI surface); DEEP SWEEP every 4th run/weekly ignores diff entirely to find PRE-EXISTING defects. A REPRODUCED ARI finding is a HARD BLOCK.

## Git worktree notes

- `.git` as file → linked worktree, skip it
- Worktrees under `.worktrees/` or similar are linked from primary checkouts
- Never recursively delete under `C:\AtlasWork`, `C:\AtlasQuickWin`, or second Windows profile — those contain junctions into primary checkouts. Use `atlas-disk-reclaim` skill first, which RESCUES before delete (saves HEAD to `refs/rescue/*`, dirty trees as patches).

### Unified Release Train Protocol (dev -> qa -> main -> prod) — 100% Autonomous (Zero Human Intervention)

When the user says **"run release train"** (or during the scheduled train run), execute these 4 steps end-to-end **without stopping for human intervention**:

1. **Run release gate & keep fixing failures until green:**
   - Run `release-gate.ps1` locally against `dev` branch tip (silent execution logging to `C:\AtlasHomestays\logs\e2e\heartbeat.jsonl`).
   - Steps 1–8 must be 100% green; local Step 9 satisfies the cut bar: **0 ARI failures and < 10 non-ARI failures**.
   - **Never Re-Run Step 0 or Green Units from Scratch**: After the initial launch of the night, always resume with `-FromStep 1` (which skips Step 0 and reuses recorded GREEN Step 1 units via `STEP1-RECORD`) or `-FromStep <failedStep>` when earlier steps are already 100% green.
   - **Founder Ruling (2026-10-14 / 2026-10-18 / 2026-10-25 — Domain-Bundled Parallel Subagent Fanout & Continuous Rolling Pool of 6)**: The moment ANY failure occurs in **Step 1 (Build/Unit/Lint)**, **Step 7 (Integration)**, **Step 9 (E2E)**, or during **any drain campaign (atlas-p0-drain, atlas-p1-drain, atlas-drain, atlas-overnight-chain, atlas-cpo-qa-drain-pipeline)**, the orchestrator is **STRICTLY BANNED** from fixing tasks serially in the parent conversation turn. You MUST enumerate ALL pickable tasks / failed units, partition them into **domain bundles of 4–6 tasks (6–8 effort points; 3 per migration bundle) per subagent, same repo and pool, preferring the same controller/service/area**, and immediately dispatch a continuous rolling pool of parallel subagents equal to the machine core count (8 on this host) via `invoke_subagent` into **isolated git worktrees (C:\AtlasWork\wt\...)**. Each subagent implements its cluster and runs targeted verification **ONCE** per bundle, eliminating duplicate compilation, Roslyn file locks, and git rebase churn. As each subagent merges and exits, the next cluster is launched immediately into the freed slot.
   - **Verify in Isolation & Land Before Rerun**: Every repair subagent MUST verify its fix passes in isolation (`npm --prefix <repo> run lint`, targeted `dotnet test --filter`, or targeted Playwright spec) and land it on `origin/dev` BEFORE the orchestrator launches the next gate run. Never start a gate rerun while any failure from the previous run remains unverified or unpushed.
   - **Autonomous Git Commit, Rebase & Push Loop (Never Ask User to Push)**:
     - If `git commit` or `git rebase` fails in a sandboxed shell due to `ssh-keygen` signing or `.githooks`, automatically pass `-c commit.gpgsign=false --no-verify` and, if `.git/objects` has `ReadOnly` attributes set, clear them (`attrib -r "<repo>\.git\objects\*" /s /d; attrib -r "<repo>\.git\objects"`).
     - Before pushing to `dev`, always integrate peer commits via `git -C <repo> pull --rebase origin dev && git -C <repo> push origin dev` (or push a fix branch and merge it via `gh pr create` + plain `gh pr merge --merge` — **never `--admin`**, see the HARD RULE below), then fast-forward all 5 train repos (`git pull --ff-only origin dev`) so `dev == origin/dev` before launching the gate.

2. **Do QA cut based on bar:**
   - Run `scripts/cut-qa-train.ps1` to fast-forward `dev -> qa` across the 5 train repos immediately once the bar is met.

3. **Do hosted QA E2E:**
   - Deploy QA API (`deploy-qa-api.ps1`), scale `atlasdb-qa` to S2 (50 DTU) and `atlas-qa-asp-linux` (`atlas-homes-api-qa-lx`) to B3 (4 vCores), and run hosted QA E2E (`run-qa-e2e.ps1`).
   - **Cost invariant**: Revert `atlasdb-qa` to Basic tier (`--max-size 2GB`) and `atlas-qa-asp-linux` to B1 immediately in `finally` when E2E finishes.
   - **Hosted QA & Dev Concurrency & Worker Pool Invariant (Founder Ruling 2026-11-01, superseding 2026-10-27 3-worker cap)**:
     - Never launch multi-process parallel runners (`run-qa-e2e-parallel.ps1`) against the shared QA environment.
     - The canonical hosted QA runner is single-process `run-qa-e2e.ps1` (and `run-dev-e2e.ps1` on Dev) executing slices (`Q9a1..Q9d`) sequentially at **`--workers=6`** (`targets.qa.workers = 6`, `targets.dev.workers = 6` in `atlas-e2e/.gate-config/hosted-e2e-workers.json`), backed by:
       1. **Per-Worker Tenant & Listing Pool (`E2E_WORKER_POOL_SIZE=6`, slots `W0..W5`)**: Upfront pre-provisioning of 6 isolated worker tenants (`atlas-w0..atlas-w5`) and 6 per-worker listing sets (`W0..W5` across `Calendar`, `MultiPlan`, `SinglePlan`, `Pricing`) in setup (`auth-admin-dev.setup.ts` / `e2e-env-dev.setup.ts`).
       2. **QA Database Tier (`atlasdb-qa` on `S2` / 50 DTU)**: Raised from `Basic` to `S2` before `qa-readiness-preflight.ps1` and restored to `Basic` in `finally`.
       3. **QA App Service Plan (`atlas-qa-asp-linux` on `B3` / 4 vCores)**: Temporarily scaled from `B1` (1 vCore) to `B3` (4 vCores, 7 GB RAM) during `run-qa-e2e.ps1` and restored to `B1` in `finally` (`Set-HostedE2eAppServicePlanForRun` / `Restore-HostedE2eAppServicePlan`). (Dev App Service and Dev serverless SQL remain unscaled.)
     - Use `-ResumeFrom` / `-ReMeasureFrom` or `-SliceId` to reuse green slices and avoid redundant reruns.
   - Threshold: 0 ARI, < 10 non-ARI. File remaining non-ARI failures as P0 tasks before promotion.

4. **Remaining steps of release train:**
   - Pre-promotion check (`npm run ari-gate`).
   - Auto-merge `qa -> main` PRs with plain `gh pr merge --merge` once `Pre-prod GO` and `PR source must be qa` are green. Never `--admin` (HARD RULE below).
   - Production deployment: deploy core API first (`https://api.atlaspms.in/health`), then portals (`admin`, `guest`, `landing`), non-train surfaces (`sales`, `host-docs`), and mobile builds (Android & iOS TestFlight).
   - Post-deploy live ARI verification and Slack announcement.

*Automated driver:* `pwsh -File atlas-e2e/scripts/run-autonomous-release-train.ps1`


## Author

This file is the canonical reference for all Atlas agents. Do not rederive repo membership, git boundaries, or skill triggers from scratch — read this file first.