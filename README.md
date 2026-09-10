# Hiver SDE Intern — Support Copilot

AI customer-support agent for **Apple Support** on Twitter. Classifies intent, drafts grounded replies from historical cases, and decides auto-handle vs. escalate — with evaluation to prove it works.

## Quick start (< 5 min)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Works **offline** without an API key (deterministic classifier). For live Gemini generation:

```bash
cp .env.example .env.local
# Add GEMINI_API_KEY, then restart dev server
```

## What it does

For each customer message:

| Step | Output |
|---|---|
| **Classify** | 8 brand-specific intents (battery, iOS update, app/device, account, payment, hardware, info, other) |
| **Retrieve** | Top-k similar historical Apple Support conversations |
| **Generate** | Fresh reply grounded in evidence (Gemini) or template fallback |
| **Route** | AUTO-HANDLE or ESCALATE with reason |

## Reproduce evaluation (< 10 min)

Golden set: **180 hand-labelled examples** in `data/golden_eval.csv` ([labelling notes](data/GOLDEN_SET_NOTES.md)).

```bash
python scripts/evaluate.py --golden data/golden_eval.csv
```

Optional LLM-as-judge:

```bash
set GEMINI_API_KEY=your_key   # Windows
python scripts/evaluate.py --golden data/golden_eval.csv --judge --sample 20
```

Headline results (see [REPORT.md](REPORT.md)):

| System | Intent acc | Routing acc |
|---|---:|---:|
| Majority baseline | 0.156 | 0.606 |
| Keyword baseline | 0.633 | 0.389 |
| Support Copilot | 0.633 | 0.394 |

## Full pipeline (with Kaggle dataset)

1. Download [Customer Support on Twitter](https://www.kaggle.com/datasets/thoughtvector/customer-support-on-twitter) → `data/customer_support_on_twitter.csv`

2. Extract Apple Support slice:

```bash
python scripts/build_brand_data.py \
  --input data/customer_support_on_twitter.csv \
  --brand AppleSupport \
  --output data/apple_support.jsonl
```

3. Build labelling queue (150–250 rows):

```bash
python scripts/make_golden_queue.py \
  --input data/apple_support.jsonl \
  --output data/golden_queue.csv \
  --n 200
```

4. Label manually → save as `data/golden_eval.csv`

5. Evaluate:

```bash
python scripts/evaluate.py --golden data/golden_eval.csv
```

## Project structure

```
app/                  Next.js UI + /api/agent (Gemini)
components/           SupportConsole UI
lib/                  Intent taxonomy, retrieval, offline classifier
data/                 Sample corpus, golden eval, eval results
scripts/              Data prep + evaluation harness
REPORT.md             Full assignment report
DECISIONS.md          12 non-obvious design decisions
```

## Submission documents

- [REPORT.md](REPORT.md) — problem framing, baselines, failure modes, misleading metrics
- [DECISIONS.md](DECISIONS.md) — decision log
- [data/GOLDEN_SET_NOTES.md](data/GOLDEN_SET_NOTES.md) — how the golden set was sampled and labelled

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind v4 · Python 3.10+ · Google Gemini API

## Dataset citation

Customer Support on Twitter, Thought Vector / Kaggle. Shipped sample is a public subsample for immediate demo; full corpus downloaded separately.
