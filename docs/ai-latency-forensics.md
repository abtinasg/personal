# AI Latency Forensics — یک‌درصد (Coach) Production RCA

> Forensic root-cause analysis of high/inconsistent latency in the AI coach path.
> Scope: this report is grounded in the **actual** code of this repo, not a generic
> template. Every claim below points at a real file/line so it is verifiable, falsifiable,
> and fixable. Where I am reasoning past the available evidence I say so explicitly and
> list the exact telemetry needed to close the gap (see §4 and the Appendix).

---

## 0. System under test (what this actually is)

This is **not** a classic RAG+vector-DB+GPU stack. It is a **Next.js 15 (App Router,
`runtime = "nodejs"`) monolith deployed on ArvanCloud Container Service (Iran)**, talking
to:

- **Postgres on Arvan DBaaS (in-region, TLS-disabled)** via a hand-rolled Supabase-shim
  query builder — `src/lib/pg.ts`, pool `max: 10`, `ssl: false`.
- **An OpenAI-compatible LLM endpoint** — `src/lib/openrouter.ts`. Default
  `openai/gpt-4o-mini` over **OpenRouter (US/EU egress)**; production is intended to switch
  to the **Arvan AI gateway** (`https://arvancloudai.ir/gateway/...`, model `GPT-5.5`) to
  survive filtering (see `.env.example`).

So the "model" is remote and reached over a **cross-border, filtered, long-haul link**, and
the "RAG/vector DB" is replaced by **`userSnapshot()` — 11 parallel Postgres queries**
(`src/lib/coach.ts:62`). The streaming chat path is `src/app/api/coach/chat/route.ts`.

**There is no GPU in your blast radius. Do not chase GPU saturation.** The latency is
dominated by (a) cross-border network to the LLM and (b) a serialized pre-flight chain of
DB round-trips and — in the worst case — a *second, synchronous LLM call* that runs to
completion **before the first streamed token is ever produced**.

---

## 1. Executive Summary (sharp)

The chat endpoint streams (good — SSE with `X-Accel-Buffering: no`, correct for the Arvan
proxy), but **TTFT is gated by a long serial prefix that has nothing to do with model
speed**. Before `streamText()` is even called, a single chat request does, *in sequence*:

1. `getSession()` JWT verify, then a **`users` existence SELECT** (`src/lib/api.ts:36`).
2. `guardAI()` — **4–6 sequential DB round-trips** (flag check, global daily COUNT,
   per-minute abuse COUNT, subscription lookup, free-quota COUNT, possibly a `spend_credit`
   RPC, then an `ai_usage` INSERT) — `src/lib/aiGuard.ts`. These are **awaited one after
   another**, not batched.
3. **If the message looks like an intake** (text) or has an image, a **full blocking
   second LLM call** (`captureFromText` / `captureMealFromImage` → `aiJSON`, cross-border,
   run to completion) — `src/app/api/coach/chat/route.ts:37-44`.
4. `userSnapshot()` — **11 concurrent DB queries** (`src/lib/coach.ts:62`), which on its own
   can momentarily **consume the entire 10-connection pool**.
5. *Only then* the streaming LLM call opens its cross-border connection.

**The three things actually killing you, ranked:**

1. **Synchronous "capture" LLM call serialized in front of the chat stream.** For any
   "I ate/spent…" message (and *every* image), you pay **two sequential cross-border LLM
   round-trips** before the user sees a single token. This is the single largest, most
   variable TTFT contributor and the most likely cause of p95/p99 blow-ups and the 25s
   timeouts.
2. **Cross-border long-haul to the LLM** (Iran → US/EU OpenRouter, through filtering/DPI).
   High, jittery RTT + TLS + possible packet loss on every token. This is your TTFT floor
   and your streaming-stall source.
3. **Self-inflicted connection-pool exhaustion / head-of-line blocking.** A single chat
   request fans `userSnapshot` out to **11 parallel queries against a pool of `max: 10`**
   (`src/lib/pg.ts:createPgClient`). Under concurrency, one user's snapshot starves every
   other request's `authed()`/`guardAI()` queries → queueing, tail-latency cliffs, and the
   "unstable under load" symptom.

**There are no retries anywhere in the LLM client** — so you don't have a *retry storm*, but
you also have **zero resilience**: a single cross-border hiccup surfaces directly to the
user as a hard error/timeout (`OPENROUTER_TIMEOUT_MS`, default **25s**).

**Brutal-honesty caveat:** you currently log **only AI call *counts*, not tokens or
timings** (`src/lib/metrics.ts` says so explicitly). So `ttft_ms`, `tokens_per_second`, and
per-stage spans **do not exist yet**. The numbers in §2 are **engineering estimates derived
from the code structure and known Iran↔US RTT**, not measured production values. §4 lists
exactly what to instrument to replace estimates with facts.

---

## 2. Full Trace Breakdown (the real chat request)

`POST /api/coach/chat` → `authed()` → `guardAI()` → [optional capture LLM] →
`userSnapshot()` (11 DB) → `streamText()` (cross-border LLM) → SSE stream.

Estimates assume in-region Arvan Postgres (~2–8 ms/query healthy) and Iran→US OpenRouter
(~250–500 ms RTT, jittery). **These are estimates — see §1 caveat and §4.**

| # | Stage | Code | Est. avg | Est. p95 | Est. p99 | Blocking? | Retry | Failure mode |
|---|-------|------|---------:|---------:|---------:|-----------|-------|--------------|
| 1 | Edge/Arvan proxy + TLS to app | Arvan ingress | 5–20 ms | 60 ms | 150 ms | sync | proxy | buffering if `X-Accel-Buffering` lost |
| 2 | Session JWT verify | `auth.ts` `getSession` | <2 ms | 5 ms | 10 ms | sync | none | bad/expired cookie → 401 |
| 3 | `userExists` SELECT | `api.ts:36` | 3–8 ms | 25 ms | 120 ms | **sync** | none | pool wait under load |
| 4 | `guardAI` serial DB chain (4–6 RTT) | `aiGuard.ts` | 15–50 ms | **150 ms** | **400 ms** | **sync, serial** | none | each query waits on pool; `spend_credit` RPC stalls |
| 5 | **Capture LLM (text)** `aiJSON` | `capture.ts:68` | **0.8–2.5 s** | **5 s** | **timeout(25s)** | **SYNC, cross-border** | none | full stall; blocks stream start |
| 5b | **Capture LLM (image/vision)** | `capture.ts:172` | **2–6 s** | **9 s** | **timeout** | **SYNC, cross-border** | none | base64 upload + vision prefill, worst case |
| 6 | `userSnapshot` 11 parallel DB | `coach.ts:62` | 8–30 ms | **120 ms** | **600 ms** | sync (Promise.all) | none | **fans to 11 conns vs pool 10 → exhaustion/HOL** |
| 7 | LLM connect + TLS (cross-border) | `openrouter.ts` `streamText` fetch | 150–500 ms | **900 ms** | **1.8 s** | sync | **none** | filtering/DPI reset → AbortError at 25s |
| 8 | **TTFT: LLM prefill → first token** | upstream model | 200–700 ms | 1.5 s | 3 s | sync | none | provider queue/cold model |
| 9 | Token streaming (gen + transit) | `streamText` loop | 8–25 tok/s eff. | — | — | async (good) | none | **long idle gaps between tokens** from cross-border jitter |
| 10 | SSE encode + Arvan passthrough | `route.ts` `sse()` | <1 ms | 5 ms | 20 ms | async | proxy | proxy re-buffering ⇒ "slow streaming" |

**Effective TTFT the user feels** = Σ stages 1–8.
- *Plain text, no intake:* ~**0.4–1.3 s** healthy → **~3 s p99**.
- *Intake text (capture fires):* ~**1.3–4 s** → **p99 = hard 25 s timeout**.
- *Image message:* ~**2.5–7 s** → **p99 = hard timeout**, *two* cross-border LLM calls.

The **delta between those rows is the bug**: TTFT variance is dominated by whether the
synchronous capture call fires, not by the chat model.

### Hidden sequential dependencies (the trace smoking guns)
- Stages **3 → 4 → 5 → 6 → 7** are a **strictly serial critical path**. 4 and 6 *could*
  overlap with 5/7; today they don't.
- Stage **5 is a complete LLM request nested in front of stage 7** — a sequential fan
  that no trace would forgive. This is "synchronous tool chaining" in the classic sense.
- Stage **6's fan-out (11) exceeds pool capacity (10)** — a fan-out/fan-in inefficiency
  that also creates cross-request contention (§5).

---

## 3. Bottleneck Classification & Ranking

Ranked by **probability × impact** on the observed symptoms (high TTFT, slow streaming,
p95/p99 spikes, instability under load, stalls/timeouts).

| Rank | Bottleneck | Class | Evidence (file) | Impact | Prob. |
|------|-----------|-------|-----------------|--------|-------|
| **1** | **Synchronous capture LLM before stream** | C. Architectural (sync tool chaining + "no stream until ready") | `coach/chat/route.ts:37-44`, `capture.ts` | TTFT 2–3×, p99 timeouts | **High** |
| **2** | **Cross-border long-haul to LLM** (Iran→US/EU + filtering) | B. Network | `openrouter.ts` BASE_URL, `.env.example` | TTFT floor + token-gap stalls | **High** |
| **3** | **Pool exhaustion / HOL: 11 fan-out vs `max:10`** | A/D. Compute(DB) + Architectural | `pg.ts:createPgClient`, `coach.ts:62` | Tail-latency cliff under load | **High** |
| **4** | **Serial `guardAI` DB chain (4–6 RTT) + `userExists`** | C. Architectural (N+1 internal calls) | `aiGuard.ts`, `api.ts:36` | +150–400 ms p95 every request | Med-High |
| **5** | **No retry/hedge on cross-border LLM** | B/C. Resilience | `openrouter.ts` (no retry) | single hiccup ⇒ user-visible stall/timeout | Med |
| **6** | **Oversized/!cached prompt + snapshot rebuilt every turn** | E. Product logic | `coach/chat/route.ts` (snapshot per message), `coach.ts` | extra DB + prompt tokens each turn | Med |
| **7** | **No caching layer anywhere** (no Redis/edge; flags cached in-proc only) | C. Architectural | repo-wide; `flags.isEnabled` ~30s in-proc | repeated identical work | Med |
| **8** | **`spend_credit` RPC + `ai_usage` INSERT on hot path** | D. Data layer | `aiGuard.ts` | write amplification under load | Low-Med |

**Explicitly de-ranked:** raw model inference speed (E/A) and "batching inefficiency" —
you don't own the GPU/batcher; the model is behind an API. Optimizing prompt/model helps
token-rate but is **not** your top lever. **GPU saturation: not applicable.**

---

## 4. Evidence: metrics / logs / traces (and what's MISSING)

### What the code already gives you
- `/api/healthz` measures and returns **DB ping `latencyMs`** (`healthz/route.ts`). This is
  your *only* existing latency signal. Trend it — a rising healthz latency is your
  early-warning for stage 3/4/6 pool contention.
- `ai_usage` table logs **call counts per endpoint** — usable for QPS and the abuse/quota
  COUNTs, but **no duration, no tokens** (`metrics.ts` comment confirms).

### Metrics you MUST add before trusting any p99 claim (Prometheus-style)
These **do not exist today**. I need them to convert §2 estimates into facts:

- `ttft_ms{endpoint}` — time from request receipt to first `event: token`.
- `capture_llm_ms{kind=text|image}` and a boolean `capture_fired` — to *prove* finding #1.
- `llm_connect_ms` (fetch start → response headers) vs `llm_first_token_ms` — splits
  cross-border connect (stage 7) from provider prefill (stage 8).
- `tokens_per_second` and `inter_token_gap_ms` (histogram) — to localize stage-9 stalls.
- `db_query_ms{op,table}` + `pg_pool_in_use` / `pg_pool_wait_ms` — to prove finding #3.
- `guard_ms` (whole `guardAI`) and per-sub-query timing — to prove finding #4.
- `llm_error_rate{status}`, `timeouts_count` (AbortError @25s), `cache_hit_ratio`
  (after a cache exists).

### Logs to grep for *right now*
- **Long idle gaps between tokens** → cross-border jitter (stage 9). Pattern: timestamps on
  consecutive `sse("token", …)` enqueues.
- **`AbortError` / "هوش مصنوعی به‌موقع پاسخ نداد"** → the 25s timeout firing (stage 5 or 7).
- **`خطا از OpenRouter (5xx/4xx)`** bursts → upstream/filtering cascades.
- **`PGRST116` or pool `connect_timeout` (10s)** errors clustering under load → finding #3.

### Traces to capture (OTel spans to add)
Wrap each numbered stage in §2 as a span: `auth`, `guard`, `capture`, `snapshot`,
`llm.connect`, `llm.ttft`, `llm.stream`. The **longest span will be `capture` (when it
fires) or `llm.connect/ttft`** — that single picture ends the debate.

> **I am not guessing about the *structure* — that's read directly from code. I am
> estimating the *magnitudes*. The five `*_ms` metrics above are the minimum needed to
> replace estimates with measurements.**

---

## 5. Regional / Infrastructure Analysis

This is the highest-leverage *infrastructure* axis because the LLM is the only remote hop
and it's **cross-border out of Iran**.

### Where the latency actually lives geographically
- **App ↔ DB: in-region (Arvan ↔ Arvan DBaaS).** Low RTT, *but* the team deliberately
  **disabled TLS** because Arvan DBaaS resets SSL probes (documented in `pg.ts`: "prefer"
  caused ~8× slower, fragile-under-load connects). **Keep SSL off** — re-enabling it is a
  latency regression, not a fix. Good call already made.
- **App ↔ LLM: cross-border, the dominant variable cost.** Two regimes:
  - **OpenRouter (US/EU) default:** long-haul RTT + **filtering/DPI** on the path → high,
    jittery TTFT, token-gap stalls, and the 25s timeouts. Worst case.
  - **Arvan AI gateway (`arvancloudai.ir`):** terminates **in-region**, so the *connect*
    leg (stage 7) collapses toward in-country RTT and you stop fighting the filter. The
    gateway still forwards to an upstream model, so *provider prefill* (stage 8) and
    *token transit* may still traverse a long-haul link **server-side** — but off your
    critical TLS/filter path. **Switching prod to the Arvan gateway is your single biggest
    network win and is already half-wired in `.env.example`.**

### Moving inference closer to users
- **Benefit:** eliminating the client-side cross-border TLS + filter hop (stage 7) plausibly
  removes **hundreds of ms and most of the jitter/stall behavior**. For a Persian, Iran-based
  user base this is the right call.
- **Tradeoffs:**
  - *Speed vs quality:* in-region/local models (or Arvan-hosted) may be weaker than
    `gpt-4o-mini`/frontier. Mitigate with a **two-tier policy**: fast in-region model for
    chat + capture; reserve the strong remote model for the *heavy* async endpoints
    (`workout`, `nutrition`, `weekly`, `missions/generate`) where latency is hidden.
  - *Compliance/data residency:* routing PII (meal/health/financial text) abroad has
    privacy implications you already flag in `docs/legal/ai-disclaimer.md`. In-region
    inference is *better* for compliance — a rare case where latency and compliance align.
  - *Cost vs multi-region:* you don't need multi-region *compute* — your users are
    geographically concentrated. You need **one well-placed in-region inference endpoint**,
    not a global fleet. Don't over-build.
- **DNS/geo-routing:** confirm the app resolves the LLM host to the **nearest** PoP and that
  Arvan egress isn't hairpinning. Add `llm_connect_ms` (stage 7) — a bimodal distribution is
  the signature of inconsistent geo-routing / intermittent filtering.

---

## 6. Quick Wins (0–72 h) — high impact, low risk

Ordered by impact. All are local code changes in this repo.

1. **De-serialize the capture LLM from TTFT (the #1 win).** In
   `coach/chat/route.ts`, do **not** `await` `captureFromText`/`captureMealFromImage`
   before `streamText`. Two options:
   - *Best:* start the chat stream immediately; run capture **in parallel**, and emit the
     `saved` SSE event when it resolves (you already send a `saved` metadata event first —
     make it async-fill instead of pre-blocking). The model prompt already handles
     "if something was logged" gracefully.
   - *Minimum:* only block on capture for **image** messages (where the user expects a
     logging result); for text intake, fire-and-forget and reconcile via the existing
     `saved` event. Removes a whole cross-border round-trip from text-chat TTFT.
2. **Switch production `OPENROUTER_BASE_URL` to the Arvan in-region gateway** (already
   templated in `.env.example`). Collapses stage-7 connect latency and dodges the filter.
   Measure `llm_connect_ms` before/after.
3. **Raise the pool above the snapshot fan-out, or shrink the fan-out.** Either set
   `postgres({ max: 20+ })` in `pg.ts` (cheap, in-region DB) **or** collapse
   `userSnapshot`'s 11 queries into **1–2 SQL statements** (`UNION ALL` / CTEs / a single
   `coach_snapshot` SQL function). Removes the 11-vs-10 pool starvation and the HOL blocking.
   *Recommended: do the SQL collapse — it fixes both latency and contention.*
4. **Cache hot, slow-changing reads on the guard path.** `getActiveSubscription` and the
   global/abuse COUNTs change slowly; memoize per-uid for a few seconds (you already cache
   `ai_enabled` ~30s). Cuts stage-4 from 4–6 RTT toward 1–2.
5. **Cap/trim the snapshot prompt + history.** History is already `slice(-8)` and content
   `slice(0,1000)` — good. Verify `snap.text` length; truncate aggressively. Fewer input
   tokens = faster prefill (stage 8) and lower cost.
6. **Add a short LLM connect timeout + 1 hedge/retry** on `streamText` *connect only*
   (not on token stream). One fast retry on AbortError/5xx before 25s turns many hard
   timeouts into a +500 ms blip. Guard against duplicate billable calls.

**Expected:** intake/image TTFT roughly **halved** (removing the serial capture call),
text-chat TTFT down by the cross-border connect delta after #2, and the load-instability
("p99 cliff") materially reduced after #3.

---

## 7. Mid-Term Fixes (1–2 weeks)

- **Async pipeline redesign for chat.** Formalize: `stream-first` — the route opens the SSE
  stream and the model connection *first*, and side-effects (capture, snapshot enrichment,
  `ai_usage` insert) run concurrently and post results as discrete SSE events
  (`saved`, `context_ready`). The user sees tokens at the earliest physically possible time.
- **Single-statement snapshot.** Promote `userSnapshot` to a Postgres function /
  materialized projection (`coach_snapshot(uid)`), refreshed on writes or short-TTL cached.
  Turns 11 round-trips into 1 and makes it cacheable.
- **Redis (or in-region KV) cache layer.** Cache: per-uid snapshot (short TTL, invalidate on
  habit/meal/mission writes), subscription/quota state, and **embedding/estimate results for
  identical inputs** (capture already uses `seed` for determinism — perfect cache key).
  Add `cache_hit_ratio`.
- **Request coalescing / idempotency.** Coalesce duplicate in-flight chat sends (double-tap,
  retries) by `(uid, last-message-hash)` so you never pay two LLM calls for one intent.
- **Move heavy endpoints fully off the interactive path.** `workout`, `nutrition`,
  `weekly`, `missions/generate`, image `meals/estimate` → background jobs / the existing
  cron+queue pattern (`deploy/cron`), returning a job id and pushing the result (you already
  have web-push in `lib/push.ts`). Keeps the strong/slow model out of TTFT.
- **Full OTel instrumentation** of the §2 spans + the §4 metrics, wired to your dashboard.

---

## 8. Long-Term Architecture (streaming-first, observability-first)

```
                 ┌──────────────────────────── Iran region (Arvan) ────────────────────────────┐
                 │                                                                              │
  User (IR) ──▶ Arvan Ingress ──▶ Next.js Coach API ──┬─▶ [SSE stream opens IMMEDIATELY]        │
   (Persian)     (no buffering)    (runtime=nodejs)    │                                         │
                                                       │   token stream ◀──────────────┐         │
                                                       │                               │         │
                 ┌── concurrent, non-blocking ─────────┤                               │         │
                 │                                     │                               │         │
                 ▼                                     ▼                               │         │
        ┌─────────────────┐                  ┌───────────────────┐          ┌──────────────────┐ │
        │ Context service │                  │ Guard/quota svc   │          │ In-region LLM     │ │
        │ snapshot(uid)   │                  │ (Redis-cached)    │          │ gateway (Arvan)   │ │
        │ 1 SQL fn + cache│                  │ token-bucket      │          │ chat + capture    │ │
        └────────┬────────┘                  └─────────┬─────────┘          └────────┬─────────┘ │
                 │                                     │                             │  (1 hedge) │
                 ▼                                     ▼                             ▼            │
        ┌─────────────────────────────────────────────────────┐            (server-side long-    │
        │ Arvan Postgres (in-region, TLS off, pool ≥ fan-out)  │             haul to strong model │
        │  + Redis/KV cache  + outbox for ai_usage writes      │             ONLY if needed)      │
        └─────────────────────────────────────────────────────┘                                  │
                 ▲                                                                                │
                 │  heavy/async (workout, nutrition, weekly, vision-estimate)                     │
        ┌────────┴─────────┐        ┌──────────────────────┐                                      │
        │ Job queue (cron/ │ ─────▶ │ Worker pool ──▶ push  │  (latency fully hidden from chat)   │
        │  Arvan jobs)     │        │ result via web-push   │                                      │
        └──────────────────┘        └──────────────────────┘                                      │
                 └──────────── OTel spans + Prometheus metrics on every hop ─────────────────────┘
```

Principles:
1. **Streaming-first:** the SSE channel and the LLM connection open before any side-effect.
   Nothing that can be made concurrent ever blocks the first token.
2. **Separation of concerns:** RAG/context (snapshot), inference (LLM), and tools (capture,
   heavy generators) are independently scaled and independently cached. Heavy = async.
3. **In-region inference by default**, remote strong model only for latency-tolerant async
   work — resolving speed/quality/compliance simultaneously.
4. **Caching at every repeatable boundary** (snapshot, quota, deterministic estimates).
5. **Observability-first:** every hop in §2 is a span; the §4 metrics are first-class. You
   can't defend a p99 you don't measure.
6. **Writes off the hot path:** `ai_usage`/audit via outbox/fire-and-forget, never a
   blocking INSERT in front of a token.

---

## Appendix — Exact telemetry to collect (so we stop estimating)

Add these and re-run this RCA with real numbers:

1. Per-request span timings for stages 1–10 (OTel).
2. `capture_fired` (bool) + `capture_llm_ms` split by text/image — **proves finding #1**.
3. `llm_connect_ms` vs `llm_first_token_ms` — **isolates cross-border (finding #2)**.
4. `pg_pool_in_use`, `pg_pool_wait_ms`, `db_query_ms{op}` — **proves finding #3**.
5. `inter_token_gap_ms` histogram — localizes streaming stalls (stage 9).
6. `timeouts_count` (AbortError@25s) + `llm_error_rate{status}` — quantifies stalls.
7. A/B of `OPENROUTER_BASE_URL` (OpenRouter vs Arvan gateway) on `llm_connect_ms`.

Until 1–4 exist, treat §2 magnitudes as **structural estimates**, not measurements. The
*ordering* of bottlenecks in §3, however, follows directly from the code and is robust.
