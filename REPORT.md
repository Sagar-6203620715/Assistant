# Hiver SDE Intern — Support Copilot Report

## Problem framing

The product chooses **Apple Support** (`@AppleSupport` / `@76099`) and turns an incoming customer message into:

1. a small intent label (8 categories derived from the brand's Twitter support history);
2. a historical-evidence-grounded draft reply;
3. an auto-handle or human-escalation decision with a stated reason.

The key product constraint is **trust**: when evidence is weak or the topic is sensitive, the system should escalate rather than confidently invent an answer.

### What "good" means for Apple Support

A good answer is a concise troubleshooting response that asks for the same type of diagnostic information visible in similar historical conversations (device model, iOS version, when the issue started), while **never** requesting credentials or resolving payments in public tweets.

### What I chose not to build

- Multi-brand routing (scope reduction for measurable grounding).
- A generic chatbot persona unrelated to observed support patterns.
- Full-dataset fine-tuning (subsample + evaluation harness instead).
- Claiming LLM judge scores as human ground truth.

---

## Results vs. baselines

Evaluated on **180 hand-labelled examples** (`data/golden_eval.csv`). See `data/GOLDEN_SET_NOTES.md` for sampling protocol.

| System | Intent accuracy | Routing accuracy | Escalation F1 | Macro recall |
|---|---:|---:|---:|---:|
| Majority baseline | 0.156 | 0.606 | 0.000 | 0.125 |
| Keyword baseline | 0.633 | 0.389 | 0.560 | 0.624 |
| Support Copilot (deterministic) | 0.633 | 0.394 | 0.566 | 0.624 |
| **Gemini agent (live UI)** | — | — | — | — |

The live Gemini agent adds generative reply quality; deterministic metrics above isolate classification and routing. Run `python scripts/evaluate.py --golden data/golden_eval.csv` to reproduce.

### Per-intent recall (Support Copilot)

| Intent | Recall |
|---|---:|
| battery_performance | 0.852 |
| ios_update_issue | 0.815 |
| app_or_device_issue | 0.615 |
| account_access | 0.750 |
| payment_or_billing | 0.474 |
| hardware_repair | 0.188 |
| information_request | 0.357 |
| other | 0.941 |

Keyword overlap drives strong performance on battery/update tweets (dominant in the Kaggle slice) but struggles on hardware and information intents.

---

## Top 5 failure modes

### 1. Keyword collision on "how / what" questions

**Example:** "How much is Apple One subscription?" → misclassified as `information_request` ✓ but "How do I backup iPhone?" overlaps with generic keywords.

**Hypothesis:** Information intent shares tokens with troubleshooting messages; needs intent-specific patterns or learned classifier.

### 2. Payment vs. information ambiguity

**Example:** "Where do I see purchase history?" labelled `information_request` but keyword rules match `payment_or_billing`.

**Hypothesis:** Billing vocabulary triggers false payment intent; context features (question form) would help.

### 3. Hardware repair under-recall (18.8%)

**Example:** "Fan noise loud on MacBook Pro" → predicted `battery_performance` (keyword: "slow"/"performance" noise).

**Hypothesis:** Hardware intents are underrepresented in the iOS-heavy sample; retrieval + LLM helps but deterministic rules fail.

### 4. Over-escalation (routing accuracy 39%)

**Example:** "AirPods left bud no longer charges" labelled AUTO-HANDLE but copilot escalates (hardware_repair intent).

**Hypothesis:** Safety-first policy trades routing accuracy for **zero missed escalations** (recall = 1.0). Precision is only 0.39 — most escalations are conservative.

### 5. Vague / emotional messages

**Example:** "This is ridiculous." → `other` + ESCALATE; keyword baseline predicts `other` + AUTO-HANDLE (low keyword score → high confidence paradox).

**Hypothesis:** Short messages need explicit ambiguity detection, not keyword counting.

---

## What is misleading about the headline number?

**63.3% intent accuracy** can hide:

1. **Class imbalance** — battery/update intents dominate the golden set; majority baseline looks better on routing than intent.
2. **Poor rare-intent performance** — hardware (18.8%) and information (35.7%) recall are far below headline accuracy.
3. **Unsafe auto-handling** — keyword baseline auto-handles payment messages that should escalate; headline intent accuracy ignores safety.
4. **Over-confident escalation** — 100% escalation recall means we almost never miss a risky case, but ~60% of AUTO-HANDLE gold labels are over-escalated.
5. **Reply quality not in intent metric** — Gemini replies can sound good while misrouting; LLM judge (`--judge`) is required for reply evaluation.

Always report confusion matrix, per-intent recall, and escalation precision/recall alongside any single accuracy number.

---

## What I would build with one more week

1. **Conversation-level retrieval** — use full threads, not isolated tweets.
2. **Learned intent classifier** — fine-tune on brand-labelled data instead of keyword rules.
3. **Calibration** — map confidence scores to empirical accuracy on held-out set.
4. **Human review queue** — capture agent corrections as training signal.
5. **Blind human reply evaluation** — 50-example spot-check vs. LLM judge agreement (Cohen's κ).

---

## LLM-as-judge rubric

Score each reply 1–5 on: groundedness, correctness, completeness, safety, escalation fit.

```bash
python scripts/evaluate.py --golden data/golden_eval.csv --judge --sample 20
```

Requires `GEMINI_API_KEY`. Judge scores are **auxiliary** — compare against human spot-checks before trusting.

---

## Reproduce in under 15 minutes

```bash
npm install && npm run dev          # UI demo
python scripts/evaluate.py --golden data/golden_eval.csv   # metrics
```

See `README.md` for full pipeline with Kaggle dataset.
