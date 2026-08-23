# Clearweb Local AI

AI Web Intelligence is default-on in the MVP, but must fail open and must not block the network path.

## Default model target

Qwen3-1.7B, quantized for local inference. Model weights are deliberately not committed to this repository.

## Pipeline

```text
DOM -> candidate extraction -> cheap heuristics -> ambiguous candidates -> local model -> typed classification -> confidence policy -> Clean Web
```

The model should not receive an entire raw page when a compact candidate representation is sufficient.

## Classification contract

```json
{
  "type": "sponsored_content",
  "confidence": 0.96,
  "reason": "Promotional card with sponsorship disclosure and outbound commercial CTA",
  "action": "remove"
}
```

Types: `content`, `navigation`, `advertising`, `sponsored_content`, `social_widget`, `engagement_bait`, `newsletter`, `overlay`, `clutter`, `unknown`.

## Safety policy

- >= 0.90: automatic Clean Web action may be allowed for known-safe removable categories.
- 0.65–0.89: surface classification but do not automatically remove solely because of AI.
- < 0.65: treat as unknown.
- Never automatically remove form controls, authentication UI, checkout/payment UI, or primary navigation based solely on model output.

## Runtime

The initial implementation should expose a local inference adapter so the browser is not coupled to one runtime. Apple Silicon can use an optimized local backend; other platforms can use an appropriate GGUF/ONNX runtime. No remote inference is required for normal MVP operation.
