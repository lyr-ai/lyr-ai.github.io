---
title: "27B parameters, 48 GB of VRAM, and the things I got wrong about LLM inference"
date: 2026-09-11 16:00:00 -0700
description: >-
  A practical mental model for weights, context memory, prefill, decode,
  batching and prefix caching — from deploying a 27B FP8 model for an agent
  workload with vLLM, and finding out which of my intuitions were wrong.
image: /assets/img/inference-hero.jpg
series: AI systems
entry: "Inference notes 01"
math: true
---

<figure>
  <img src="/assets/img/inference-hero.jpg" alt="A 48 GB budget bar split into model weights, sequence state, runtime and headroom, next to two measurements: a 28.5k-token request going from 12.1s to 0.43s with a cached prefix, and the 32k to 128k context change that moved the deployment to an A100." loading="lazy">
  <figcaption><b>Figure 1.</b> Weights are the first capacity check, not the capacity question.</figcaption>
</figure>

I spent a while serving [Qwen3.6-27B-FP8](https://huggingface.co/Qwen/Qwen3.6-27B-FP8)
with vLLM for an agent workload, first on an A40 and then on an A100. Several
things I believed at the start turned out to be wrong, and each one was wrong in
a way that taught me something about how inference actually behaves.

These are those five corrections. I am not an inference expert; I am someone who
deployed one model carefully enough to find out where my intuitions broke.

## 1. "27B × 1 byte < 48 GB, so it fits"

**What I thought.** For an FP8 model, a useful first approximation is

$$M_{\text{weights}} \approx N_{\text{parameters}} \times 1\ \text{byte},$$

which puts a 27B model at roughly 27 GB. An A40 has 48 GB. Comfortable.

**What I learned.** A serving GPU does not contain only model weights:

$$M_{\text{GPU}} = M_{\text{weights}} + M_{\text{sequence state}} + M_{\text{runtime}} + M_{\text{headroom}}.$$

Once context length and concurrency enter the problem, "does the model fit?" and
"does my workload fit?" stop being the same question.

> **Capacity is a workload property, not just a model property.**

This became concrete when I moved from a 32k serving configuration to 128k. The
obvious intuition is that a longer context means more sequence-dependent state,
usually introduced through the KV cache. But that simple model has to be applied
carefully to modern architectures.

Qwen3.6-27B is not a plain full-attention dense Transformer. Its model card
describes 64 layers arranged as `16 × (3 × Gated DeltaNet → 1 × Gated
Attention)`: three linear-attention layers for every gated full-attention layer.
The full-attention layers use 24 query heads and 4 KV heads with head dimension
256, and the native context length is 262,144 tokens, extensible further.

So multiplying "64 layers × traditional KV bytes per token" would have given me a
number that describes a model I was not running. vLLM has its own hybrid cache
management for exactly this class of architecture.

> **Use the simple cache formula to understand scaling. Use the real
> architecture and the serving engine to size the deployment.**

That is why the 128k experiment moved to an A100 80 GB rather than treating
`--max-model-len 131072` as a free configuration change.

## 2. "Tokens per second is the model's speed"

**What I thought.** A model has a speed, measured in tokens per second.

**What I learned.** A request has two phases that stress hardware differently.

```text
INPUT TOKENS                          OUTPUT TOKENS

██████████████████████████            ● → ● → ● → ● → ● → ●
            │                                     │
            ▼                                     ▼
         PREFILL                                DECODE
 process the context in parallel        generate sequentially
```

Prefill processes the input context and benefits heavily from parallel matrix
computation. Decode produces tokens one at a time, repeatedly reading model
state and weights. "Tokens per second" without saying which phase is
underspecified, so I now separate at least three numbers:

- **TTFT** — time to first token;
- **decode rate** — generation speed after prefill;
- **aggregate throughput** — total work served across concurrent requests.

A system can be good at one and mediocre at another. That distinction matters
enormously for agents, whose requests tend to be long histories followed by
short incremental additions.

There is a second version of the same confusion. If one request decodes at 20
tokens/s, that does **not** mean the GPU's throughput is 20 tokens/s. Serving
systems schedule many requests together so the GPU does useful work across a
batch of active sequences:

```text
Request A ─┐
Request B ─┤
Request C ─┼──→ continuous batching ──→ GPU
Request D ─┘
```

which turns the question into a three-way tradeoff between latency, throughput
and memory pressure.

This is also why my AgentSeism experiments are not a good serving benchmark. I
deliberately ran trajectories sequentially, because changing batch composition
could alter the stochastic process I was studying. That is the right call
scientifically, and it leaves GPU throughput on the table. A production
summarization workload with many independent requests has completely different
economics on the same card.

## 3. "An A40 obviously beats my laptop"

**What I thought.** Datacenter GPU versus laptop. Not a close contest.

**What I learned.** In one local experiment, a smaller mixture-of-experts model
on an M4 Pro decoded substantially faster than the 27B model I was serving on an
A40. The wrong conclusion is "the M4 Pro is faster for LLM inference." The
useful conclusion is that I was not comparing the same inference workload.

For decode, a first-order intuition is

$$\text{tokens/s} \lesssim \frac{\text{effective memory bandwidth}}{\text{active weight bytes per token}}.$$

A dense model may need to stream a large fraction of its weights for every
generated token. A mixture-of-experts model can hold many total parameters while
activating a much smaller subset per token. So two different numbers matter:
**total parameters** for capacity, and **active parameters per token** for
compute and weight traffic.

Hardware comparisons that omit model architecture are close to meaningless.

## 4. "Every agent turn pays for its whole context"

**What I thought.** Each step of an agent sends a longer prompt, so each step
pays to process all of it.

**What I learned.** In one measurement, a roughly 28.5k-token request took about
**12.1 seconds** on a cold prefill. The same request with a reusable cached
prefix came back in about **0.43 seconds**. That is one workload measurement,
not a universal 28× claim — but it changed how I think about agent serving.

An agent sends something like:

```text
Step 1  ████████████████████ A
Step 2  ████████████████████ A B
Step 3  ████████████████████ A B C
        └─────────┬────────┘
             reusable prefix
```

Most of the next prompt is old information. vLLM's
[Automatic Prefix Caching](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/)
"caches the KV cache of existing queries, so that a new query can directly reuse
the KV cache if it shares the same prefix," and names multi-round conversations
and repeated queries over long documents as the workloads that benefit.

The documentation is also explicit about the limit, which is the part worth
remembering: "APC only reduces the time of processing the queries (the
prefilling phase) and does not reduce the time of generating new tokens (the
decoding phase)." If your agent's cost is dominated by generating long outputs,
prefix caching will not save you.

Agent serving is not a sequence of independent chat requests. The structure of
the workload is itself a performance property.

## 5. "I documented the CUDA requirement, so the deployment is reproducible"

**What I thought.** My first cloud deployment pinned the model revision, the
vLLM version, the dtype, the reasoning parser and the tool parser. Everything
relevant was written down.

**What I learned.** It failed before inference began, because the host driver
was too old for the installed PyTorch CUDA build:

```text
torch 2.13.0+cu130
CUDA 13.0
torch.cuda.is_available() = False
```

The stack has to agree end to end:

```text
GPU driver → CUDA compatibility → PyTorch build → vLLM → model
```

The lesson was not "remember to check the driver." I had recorded the driver
version in my notes. The lesson was:

> **Recording a dependency is different from enforcing a dependency.**

The fix was a preflight gate that refuses to load the model unless the whole
chain checks out:

```text
driver      ✓
GPU         ✓
torch/CUDA  ✓
vLLM        ✓
       ↓
safe to load model
```

That turned a line in a deployment document into an executable invariant, which
is a systems lesson I expect to reuse well outside inference.

## Four numbers I now ask about

I no longer start from "which GPU is faster?" I ask four narrower questions.

**VRAM capacity** — do weights, sequence state, runtime allocations and the
concurrency I want actually fit?

**Memory bandwidth** — decode-heavy workloads live here. NVIDIA lists the
[A100 80GB SXM](https://www.nvidia.com/en-us/data-center/a100/) at 2,039 GB/s
with 80 GB of HBM2e.

**Compute throughput** — this is what prefill and batched matrix work consume.

**Interconnect bandwidth** — relevant as soon as a model or workload spans GPUs;
NVIDIA lists up to 600 GB/s of NVLink connectivity for the A100 SXM platform.

Together these are a better way to choose hardware than memorising the ranking
A40 < A100 < H100. The right GPU depends on what is limiting the workload.

## A five-minute checklist

Given a model, a GPU and a workload, this is the order I now reason in.

**Model.** How many parameters, and is it dense, MoE or hybrid? What precision
are weights stored and executed in? How much is active per generated token?

**Memory.** How large are the weights at runtime? What sequence state does this
architecture actually require? What context length and concurrency do I need?
How much headroom is left?

**Workload.** Input-heavy or output-heavy? Interactive or batch? Do requests
share long prefixes? Is the objective latency, throughput or cost?

**Performance.** Cold TTFT, decode rate, aggregate throughput under realistic
concurrency. Is the GPU compute-bound, bandwidth-bound, capacity-bound, or just
underutilised?

**Scaling.** Can batching or prefix caching buy more than another GPU would?
Would quantisation help? If I add GPUs, which parallelism strategy, and what
communication cost does it bring?

**Economics.** In the end I care less about raw tokens per second than

$$\text{cost per useful task} = \frac{\text{GPU hours} \times \text{\$/GPU hour}}{\text{successful tasks}}.$$

Self-hosting became attractive for my agent experiments because I could keep the
model busy across many repeated trajectories. For a workload with three requests
a day, the arithmetic goes the other way.

## Conclusion

The change in my understanding was moving from

> Will this model fit on this GPU?

to

> Will this workload fit this serving system at the context length, concurrency,
> latency, throughput and cost I need?

Weights are only the first capacity check. Context introduces sequence state.
Prefill and decode stress hardware differently. Architecture changes what a
parameter count means. Batching changes throughput. Prefix caching changes the
economics of repeated context — and none of it matters if the driver, CUDA
runtime, PyTorch build and serving engine disagree.

I am still learning this area, which is exactly why I wrote the corrections
down. The goal is not to memorise every GPU specification or serving flag. It is
to build a mental model strong enough that when a deployment behaves
unexpectedly, I know which layer to look at next.
