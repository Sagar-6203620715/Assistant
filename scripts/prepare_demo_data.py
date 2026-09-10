#!/usr/bin/env python3
"""
Convert the shipped Apple Support sample CSV into a JSON corpus for retrieval.

Usage:
  python scripts/prepare_demo_data.py \
    --input data/apple_support_sample.csv \
    --output data/examples.json
"""
import argparse
import csv
import json
from pathlib import Path


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--input", default="data/apple_support_sample.csv")
    p.add_argument("--output", default="data/examples.json")
    return p.parse_args()


def main():
    args = parse_args()
    rows = {}
    with open(args.input, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            rows[str(row["tweet_id"])] = row

    examples = []
    for row in rows.values():
        if row.get("inbound", "").lower() != "true":
            continue

        response_ids = [
            x.strip()
            for x in (row.get("response_tweet_id") or "").split(",")
            if x.strip()
        ]
        responses = [
            rows[rid]["text"]
            for rid in response_ids
            if rid in rows and rows[rid].get("inbound", "").lower() == "false"
        ]

        examples.append(
            {
                "tweet_id": row["tweet_id"],
                "author_id": row["author_id"],
                "inbound": True,
                "created_at": row["created_at"],
                "text": row["text"],
                "response": responses[0] if responses else None,
            }
        )

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(examples, f, ensure_ascii=False, indent=2)

    print(f"Wrote {len(examples)} inbound examples to {args.output}")


if __name__ == "__main__":
    main()
