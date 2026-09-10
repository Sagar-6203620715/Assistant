# Golden evaluation set — sampling & labelling notes

## Size

**180 examples** (within the required 150–250 range).

## How examples were sampled

1. **Real tweets (11)** — every inbound customer message from the shipped `apple_support_sample.csv` slice of the Kaggle *Customer Support on Twitter* dataset (Apple Support / `@76099` conversations, October 2017 iOS 11 update period).

2. **Stratified paraphrases (169)** — hand-authored messages covering all eight intents, including:
   - routine troubleshooting (AUTO-HANDLE);
   - account/payment/safety cases (ESCALATE);
   - ambiguous or non-actionable messages (ESCALATE);
   - information-only questions (AUTO-HANDLE).

Paraphrases mirror lexical patterns seen in the real slice (battery drain after update, app crashes, DM redirects) without copying private customer data beyond the public sample.

## Labelling protocol

Each row was labelled with:

| Field | Description |
|---|---|
| `text` | Customer message |
| `intent` | One of eight brand-specific intents |
| `auto_or_escalate` | `AUTO-HANDLE` or `ESCALATE` |

**Intent rules:** Primary symptom determines intent; mixed messages use the dominant actionable issue.

**Routing rules:** Escalate when the message involves credentials, payments/refunds, physical damage, safety language, legal/media requests, or is too vague to troubleshoot safely.

## Regenerate

```bash
python scripts/seed_golden_eval.py --output data/golden_eval.csv
```

For a full-corpus golden set from Kaggle data:

```bash
python scripts/build_brand_data.py --input data/customer_support_on_twitter.csv --brand AppleSupport --output data/apple_support.jsonl
python scripts/make_golden_queue.py --input data/apple_support.jsonl --output data/golden_queue.csv --n 200
# manually label golden_queue.csv → golden_eval.csv
```
