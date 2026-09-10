# Apple Support Copilot

Hiver SDE intern take-home: a single-brand support agent that classifies a customer message, drafts a reply from historical Apple Support tweets, and decides **AUTO-HANDLE** vs **ESCALATE**.

**Live demo:** [https://assistant-seven-rho.vercel.app/](https://assistant-seven-rho.vercel.app/)

## What it does

1. Classify into 8 intents (battery, iOS update, app/device, account, payment, hardware, info, other)
2. Retrieve similar past conversations
3. Draft a reply grounded in those cases
4. Route with a stated reason

## Run locally

```bash
npm install
cp .env.example .env.local
```

Add your Gemini key to `.env.local`:

```
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-3.6-flash
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without a key, the app still runs using the offline classifier.

## Reproduce evaluation (< 10 min)

Golden set: 180 labelled examples in `data/golden_eval.csv`. Sampling notes: [data/GOLDEN_SET_NOTES.md](data/GOLDEN_SET_NOTES.md).

```bash
python scripts/evaluate.py --golden data/golden_eval.csv
```

| System | Intent acc | Routing acc |
|---|---:|---:|
| Majority baseline | 0.156 | 0.606 |
| Keyword baseline | 0.633 | 0.389 |
| Support Copilot | 0.633 | 0.394 |

Full write-up (baselines, failure modes, misleading metrics): [REPORT.md](REPORT.md). Decision log: [DECISIONS.md](DECISIONS.md).

Optional LLM-as-judge (needs `GEMINI_API_KEY`):

```bash
python scripts/evaluate.py --golden data/golden_eval.csv --judge --sample 20
```

## Full Kaggle pipeline

Download [Customer Support on Twitter](https://www.kaggle.com/datasets/thoughtvector/customer-support-on-twitter) to `data/customer_support_on_twitter.csv`, then:

```bash
python scripts/build_brand_data.py --input data/customer_support_on_twitter.csv --brand AppleSupport --output data/apple_support.jsonl
python scripts/make_golden_queue.py --input data/apple_support.jsonl --output data/golden_queue.csv --n 200
```

Label the queue by hand, save as `data/golden_eval.csv`, and re-run `evaluate.py`.

## Layout

```
app/            UI + /api/agent
lib/            retrieval, intents, offline classifier
data/           sample tweets + golden eval
scripts/        data prep + evaluation
REPORT.md       assignment report
DECISIONS.md    15 design decisions
```

Dataset: Customer Support on Twitter (Thought Vector / Kaggle). This repo ships a small public Apple Support slice, not the full corpus.
