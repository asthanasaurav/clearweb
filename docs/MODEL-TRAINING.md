# Local model training and evaluation

## Safety boundary

Clearweb's deterministic blocker remains authoritative. The local model is trained for classification and explanation of ambiguous requests; it does not sit directly on the network fast path. Unknown cases fail open to `review`.

Training capture is off by default. When enabled from the protection dashboard, Clearweb stores only:

- page hostname
- request hostname
- categorical resource type
- first/third-party relationship
- coarse user context
- deterministic list evidence and observed outcome

Paths, query strings, headers, cookies, request bodies, form values, tokens, exact timestamps, and page content are never written to the capture file.

## Build the initial dataset

```sh
pnpm model:data
pnpm model:validate
```

This generates 448 reviewed seed cases across 32 held-out page-domain groups. Splits are assigned deterministically by page domain so that one site cannot leak across training, validation, and test data.

To include local capture data:

```sh
pnpm model:data -- --captured "$HOME/Library/Application Support/Clearweb/model-data/captured.jsonl"
```

Review ambiguous cases through the local review interface:

```sh
pnpm model:review
pnpm model:data
```

The reviewer can accept or correct the action, category, and reason. Approved records are stored locally in `model-data/human-reviewed.jsonl`, excluded from Git, and automatically included on the next dataset build.

## Install MLX-LM on an Apple Silicon Mac

```sh
python3 -m venv .mlx-venv
source .mlx-venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install "mlx-lm[train]"
```

## Fine-tune Qwen with QLoRA

```sh
pnpm model:train
```

Defaults are intentionally conservative for a 16 GB Mac: Qwen3 1.7B 4-bit, batch size 1, eight adapted layers, 1,024-token sequences, prompt masking, and gradient checkpointing. Override with environment variables:

```sh
CLEARWEB_MLX_ITERS=300 CLEARWEB_MLX_ADAPTER=model-data/adapters/experiment-1 pnpm model:train
```

## Serve and evaluate

```sh
mlx_lm.server \
  --model mlx-community/Qwen3-1.7B-4bit \
  --adapter-path model-data/adapters/clearweb-qwen3-1.7b \
  --port 8080
```

In another terminal:

```sh
pnpm model:evaluate
```

The report includes action accuracy, category accuracy, valid-JSON rate, false-block rate, per-action precision/recall/F1, latency percentiles, and individual failures.

## Promotion gate

Do not promote an adapter unless:

- valid JSON rate is at least 99.5%
- false-block rate is below 0.5% on the representative test set
- no payment or authentication challenge case is incorrectly blocked
- performance is measured on a fresh held-out domain set
- deterministic browser tests still pass

The thresholds are initial Clearweb product policy, not claims about universal model quality. Tighten them as the test corpus grows.
