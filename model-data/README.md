# Clearweb model data

`generated/` contains reproducible MLX-LM training, validation, and test files. Rebuild it with `pnpm model:data`.

The seed generator creates reviewed synthetic scenarios. Real browsing metadata can be added with `--captured`, but captured third-party cases without strong deterministic evidence are routed to `review.jsonl` rather than silently treated as ground truth.

Files ending in `-cases.jsonl` retain ground-truth metadata for evaluation. The corresponding `train.jsonl`, `valid.jsonl`, and `test.jsonl` files use MLX-LM chat format.

Never commit local captures, trained adapters, or evaluation output containing unreviewed browsing metadata.
