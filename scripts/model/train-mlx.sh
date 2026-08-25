#!/usr/bin/env bash
set -euo pipefail

MODEL="${CLEARWEB_MLX_MODEL:-mlx-community/Qwen3-1.7B-4bit}"
DATA="${CLEARWEB_MODEL_DATA:-model-data/generated}"
ADAPTER="${CLEARWEB_MLX_ADAPTER:-model-data/adapters/clearweb-qwen3-1.7b}"
ITERS="${CLEARWEB_MLX_ITERS:-600}"

if ! command -v mlx_lm.lora >/dev/null 2>&1; then
  echo 'MLX-LM training tools are missing. Run: python3 -m pip install "mlx-lm[train]"' >&2
  exit 1
fi

mlx_lm.lora \
  --model "$MODEL" \
  --train \
  --data "$DATA" \
  --adapter-path "$ADAPTER" \
  --iters "$ITERS" \
  --batch-size 1 \
  --num-layers 8 \
  --max-seq-length 1024 \
  --learning-rate 1e-5 \
  --mask-prompt \
  --grad-checkpoint
