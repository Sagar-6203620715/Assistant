# Decision log

1. **One brand first** — reduces scope and makes historical grounding measurable.
2. **AppleSupport** — the supplied public sample contains several Apple Support conversations with linked replies.
3. **Eight intents** — small, explainable taxonomy instead of copying a huge generic banking taxonomy.
4. **Historical retrieval** — directly connects reply generation to observed support behaviour.
5. **Escalate on sensitive topics** — avoids asking users for credentials or pretending to verify transactions.
6. **Escalate on low evidence** — uncertainty is preferable to fabricated troubleshooting.
7. **No full dataset in git** — the primary corpus is large and has licensing considerations.
8. **Demo sample included** — keeps the repository runnable without credentials.
9. **Golden set is human-labelled** — synthetic labels would undermine the evaluation.
10. **Metrics separated** — intent accuracy and routing accuracy measure different failure modes.
11. **LLM judge is secondary** — a judge model can assist evaluation but should not be treated as human ground truth.
12. **No invented headline results** — metrics come from `scripts/evaluate.py` on the 180-example golden set.
13. **Safety-first escalation** — prefer over-escalation (100% recall) to missing a payment/account case.
14. **Gemini with offline fallback** — live generation when API key present; deterministic path for reproducible demos.
15. **JSON corpus from CSV** — `scripts/prepare_demo_data.py` keeps retrieval data in sync with the Kaggle sample.
