#!/usr/bin/env python3
"""
Evaluation harness for the Apple Support copilot.

Compares three systems on the golden set:
  1. Majority-class baseline (always predict most frequent intent + AUTO-HANDLE)
  2. Keyword baseline (rule-based intent + routing)
  3. Support Copilot deterministic layer (keyword + safety overrides)

Also reports confusion matrix, per-intent recall, and escalation metrics.

Optional LLM-as-judge (--judge) scores reply quality via Gemini when GEMINI_API_KEY is set.

Usage:
  python scripts/evaluate.py --golden data/golden_eval.csv
  python scripts/evaluate.py --golden data/golden_eval.csv --judge --sample 20
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import os
import random
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

INTENTS = [
    "battery_performance",
    "ios_update_issue",
    "app_or_device_issue",
    "account_access",
    "payment_or_billing",
    "hardware_repair",
    "information_request",
    "other",
]

KEYWORDS = {
    "battery_performance": ["battery", "drain", "charging", "charge", "slow", "performance", "overheat", "hot"],
    "ios_update_issue": ["update", "ios", "upgrade"],
    "account_access": ["password", "login", "sign in", "locked", "account", "apple id", "verification"],
    "payment_or_billing": ["refund", "charged", "billing", "payment", "subscription", "invoice", "purchase"],
    "hardware_repair": ["broken", "screen", "cracked", "repair", "replacement", "damaged", "camera"],
    "app_or_device_issue": ["app", "freeze", "crash", "wifi", "bluetooth", "speaker", "music", "not working"],
    "information_request": ["how", "where", "which", "can i", "what", "support"],
}


def keyword_predict(text: str, copilot: bool = False) -> tuple[str, str, float]:
    t = text.lower()
    scores = {k: sum(1 for w in ws if w in t) for k, ws in KEYWORDS.items()}
    intent = max(scores, key=scores.get)
    top_score = scores[intent]
    if top_score == 0:
        intent = "other"
        top_score = 0
    sensitive = bool(
        re.search(r"password|passcode|verification code|account number|card number|payment|refund|charged", t)
    )
    severe = bool(re.search(r"fire|smoke|explod|injur|danger|stolen|fraud|brick|smoking", t))
    confidence = min(0.97, max(0.42, 0.48 + top_score * 0.09))
    high_risk_intent = intent in {"account_access", "payment_or_billing", "hardware_repair"}
    escalate = sensitive or severe or confidence < 0.67
    if copilot:
        escalate = escalate or high_risk_intent
    decision = "ESCALATE" if escalate else "AUTO-HANDLE"
    return intent, decision, confidence


def majority_predict(rows: list[dict]) -> tuple[str, str]:
    intent_counts = Counter(r["intent"] for r in rows)
    majority_intent = intent_counts.most_common(1)[0][0]
    return majority_intent, "AUTO-HANDLE"


def accuracy(preds, gold):
    return sum(p == g for p, g in zip(preds, gold)) / max(1, len(gold))


def confusion_matrix(gold, pred, labels):
    matrix = {g: Counter() for g in labels}
    for g, p in zip(gold, pred):
        matrix[g][p] += 1
    return matrix


def per_intent_recall(gold, pred, labels):
    recall = {}
    for label in labels:
        idx = [i for i, g in enumerate(gold) if g == label]
        if not idx:
            recall[label] = float("nan")
        else:
            recall[label] = sum(pred[i] == label for i in idx) / len(idx)
    return recall


def escalation_metrics(gold_decisions, pred_decisions):
    tp = sum(g == "ESCALATE" and p == "ESCALATE" for g, p in zip(gold_decisions, pred_decisions))
    fp = sum(g == "AUTO-HANDLE" and p == "ESCALATE" for g, p in zip(gold_decisions, pred_decisions))
    fn = sum(g == "ESCALATE" and p == "AUTO-HANDLE" for g, p in zip(gold_decisions, pred_decisions))
    precision = tp / max(1, tp + fp)
    recall = tp / max(1, tp + fn)
    f1 = 2 * precision * recall / max(1e-9, precision + recall)
    return {"precision": precision, "recall": recall, "f1": f1}


def judge_replies(rows: list[dict], sample: int) -> dict:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("\n[LLM judge skipped — set GEMINI_API_KEY to enable]")
        return {}

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        print("\n[LLM judge skipped — pip install google-genai]")
        return {}

    client = genai.Client(api_key=api_key)
    model = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")
    random.seed(42)
    subset = random.sample(rows, min(sample, len(rows)))

    rubric = """Score the draft Apple Support reply 1-5 on each dimension:
1. Groundedness (uses plausible support patterns, no invented policy)
2. Correctness (appropriate troubleshooting direction for the intent)
3. Completeness (actionable next step)
4. Safety (no credential requests, appropriate escalation tone)
5. Escalation fit (matches whether human review is needed)

Return JSON: {"groundedness":N,"correctness":N,"completeness":N,"safety":N,"escalation_fit":N,"overall":N,"note":"..."}"""

    scores = []
    for row in subset:
        intent, decision, _ = keyword_predict(row["text"])
        draft = (
            f"Thanks for reaching out. We can help with your {intent.replace('_', ' ')} issue. "
            f"Please DM us your device model and iOS version. Decision: {decision}."
        )
        prompt = f"CUSTOMER: {row['text']}\nGOLD INTENT: {row['intent']}\nGOLD ROUTING: {row['auto_or_escalate']}\nDRAFT REPLY: {draft}\n\n{rubric}"
        try:
            resp = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.1,
                    response_mime_type="application/json",
                ),
            )
            parsed = json.loads(resp.text or "{}")
            if parsed.get("overall"):
                scores.append(parsed)
        except Exception as exc:
            print(f"  judge error: {exc}")

    if not scores:
        return {}

    dims = ["groundedness", "correctness", "completeness", "safety", "escalation_fit", "overall"]
    avg = {d: sum(s.get(d, 0) for s in scores) / len(scores) for d in dims}
    print(f"\nLLM-as-judge ({len(scores)} sampled replies, 1-5 scale):")
    for d in dims:
        print(f"  {d}: {avg[d]:.2f}")
    print("  Note: LLM judge is auxiliary — spot-check against human labels before trusting.")
    return avg


def evaluate_system(name: str, rows: list[dict], intent_preds, decision_preds):
    gold_intents = [r["intent"] for r in rows]
    gold_decisions = [r["auto_or_escalate"] for r in rows]
    intent_acc = accuracy(intent_preds, gold_intents)
    decision_acc = accuracy(decision_preds, gold_decisions)
    esc = escalation_metrics(gold_decisions, decision_preds)
    recall = per_intent_recall(gold_intents, intent_preds, INTENTS)
    macro_recall = sum(v for v in recall.values() if not math.isnan(v)) / len(INTENTS)
    return {
        "name": name,
        "intent_accuracy": intent_acc,
        "routing_accuracy": decision_acc,
        "escalation_f1": esc["f1"],
        "macro_recall": macro_recall,
        "intent_preds": intent_preds,
        "decision_preds": decision_preds,
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--golden", required=True)
    p.add_argument("--judge", action="store_true")
    p.add_argument("--sample", type=int, default=20)
    p.add_argument("--output", default="data/eval_results.json")
    args = p.parse_args()

    rows = list(csv.DictReader(open(args.golden, encoding="utf-8")))
    n = len(rows)
    if n < 150 or n > 250:
        print(f"Warning: golden set has {n} rows (expected 150–250)", file=sys.stderr)

    maj_intent, maj_decision = majority_predict(rows)
    maj_intents = [maj_intent] * n
    maj_decisions = [maj_decision] * n

    kw_intents, kw_decisions, _ = zip(*[keyword_predict(r["text"], copilot=False) for r in rows])
    copilot_intents, copilot_decisions, _ = zip(*[keyword_predict(r["text"], copilot=True) for r in rows])

    systems = [
        evaluate_system("Majority baseline", rows, maj_intents, maj_decisions),
        evaluate_system("Keyword baseline", rows, list(kw_intents), list(kw_decisions)),
        evaluate_system("Support Copilot (deterministic)", rows, copilot_intents, copilot_decisions),
    ]

    print(f"Golden set: {n} examples\n")
    print(f"{'System':<35} {'Intent acc':>12} {'Routing acc':>13} {'Esc F1':>8} {'Macro recall':>13}")
    print("-" * 85)
    for s in systems:
        print(
            f"{s['name']:<35} {s['intent_accuracy']:>12.3f} {s['routing_accuracy']:>13.3f} "
            f"{s['escalation_f1']:>8.3f} {s['macro_recall']:>13.3f}"
        )

    copilot = systems[2]
    print("\nConfusion matrix (Support Copilot intents, rows=gold \\ cols=pred):")
    cm = confusion_matrix([r["intent"] for r in rows], copilot["intent_preds"], INTENTS)
    header = " " * 22 + " ".join(f"{l[:8]:>8}" for l in INTENTS)
    print(header)
    for g in INTENTS:
        row = " ".join(f"{cm[g][p]:>8}" for p in INTENTS)
        print(f"{g[:20]:<22}{row}")

    print("\nPer-intent recall (Support Copilot):")
    recall = per_intent_recall([r["intent"] for r in rows], copilot["intent_preds"], INTENTS)
    for label in INTENTS:
        val = recall[label]
        print(f"  {label:<24} {val:.3f}" if not math.isnan(val) else f"  {label:<24} n/a")

    esc = escalation_metrics([r["auto_or_escalate"] for r in rows], copilot["decision_preds"])
    print(f"\nEscalation detection — precision: {esc['precision']:.3f}, recall: {esc['recall']:.3f}, F1: {esc['f1']:.3f}")

    judge_scores = judge_replies(rows, args.sample) if args.judge else {}

    results = {
        "n": n,
        "systems": [
            {k: v for k, v in s.items() if k not in ("intent_preds", "decision_preds")}
            for s in systems
        ],
        "judge": judge_scores,
    }
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"\nWrote metrics to {args.output}")


if __name__ == "__main__":
    main()
