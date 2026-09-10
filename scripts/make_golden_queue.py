#!/usr/bin/env python3
"""
Create a 150–250 row labelling queue from a filtered brand dataset.

This intentionally DOES NOT invent labels. A human must label the queue.
That keeps the evaluation set faithful to the challenge requirement.

Usage:
  python scripts/make_golden_queue.py \
    --input data/apple_support.jsonl \
    --output data/golden_queue.csv \
    --n 200
"""
import argparse, csv, json, random

INTENTS = [
    "battery_performance", "ios_update_issue", "app_or_device_issue",
    "account_access", "payment_or_billing", "hardware_repair",
    "information_request", "other"
]

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--n", type=int, default=200)
    args = p.parse_args()

    rows = [json.loads(x) for x in open(args.input, encoding="utf-8")]
    random.seed(42)
    random.shuffle(rows)
    rows = rows[:max(150, min(250, args.n))]

    with open(args.output, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["tweet_id", "text", "intent", "auto_or_escalate", "gold_reply_quality_note"])
        w.writeheader()
        for r in rows:
            w.writerow({
                "tweet_id": r["tweet_id"],
                "text": r["text"],
                "intent": "",
                "auto_or_escalate": "",
                "gold_reply_quality_note": ""
            })

    print(f"Created {len(rows)} unlabeled rows. Label every row before evaluation.")
    print("Allowed intents:", ", ".join(INTENTS))

if __name__ == "__main__":
    main()
