#!/usr/bin/env python3
"""
Filter one brand from the full Customer Support on Twitter CSV and reconstruct
inbound -> outbound historical support examples.

Usage:
  python scripts/build_brand_data.py \
    --input data/customer_support_on_twitter.csv \
    --brand AppleSupport \
    --output data/apple_support.jsonl
"""
import argparse, csv, json
from pathlib import Path

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True)
    p.add_argument("--brand", default="AppleSupport")
    p.add_argument("--output", required=True)
    return p.parse_args()

def main():
    args = parse_args()
    rows = {}
    with open(args.input, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            rows[str(row["tweet_id"])] = row

    brand = args.brand.lower()
    brand_aliases = {brand, "@76099", "applesupport", "@applesupport"}
    inbound = [
        r for r in rows.values()
        if r.get("inbound", "").lower() == "true"
        and any(alias in r.get("text", "").lower() for alias in brand_aliases)
    ]

    out = []
    for r in inbound:
        response_ids = [x.strip() for x in (r.get("response_tweet_id") or "").split(",") if x.strip()]
        responses = [rows[x]["text"] for x in response_ids if x in rows and rows[x].get("inbound","").lower() == "false"]
        out.append({
            "tweet_id": r["tweet_id"],
            "author_id": r["author_id"],
            "created_at": r["created_at"],
            "text": r["text"],
            "responses": responses[:3]
        })

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        for item in out:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")

    print(f"Wrote {len(out)} inbound Apple Support examples to {args.output}")

if __name__ == "__main__":
    main()
