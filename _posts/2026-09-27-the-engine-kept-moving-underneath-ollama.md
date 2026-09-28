---
title: "The engine kept moving underneath Ollama"
description: >-
  Three years of Ollama's own history: everything a user relied on in 2023 still
  works, while the inference engine underneath moved four times and ended split by
  model format.
image: /assets/img/systems-seen-ollama-engine.png
series: Systems, Seen
entry: "No. 2"
date: 2026-09-27 17:30:00 -0700
---

If you installed Ollama in the summer of 2023, you typed `ollama run` and a model name,
and it worked. If you install it today, the same command is still there. Every
command and API endpoint the 2023 user had is still there.

Underneath, almost nothing stayed put. I read Ollama's full git history (5,796
commits, from the first commit in June 2023 to late September 2026) to see what
happened to the one component that does the actual work: the inference engine. It
moved four times.

<figure>
  <img src="/assets/img/systems-seen-ollama-engine.png" alt="A timeline from 2023 to 2026. On top, a green band labelled 'what users run' that only gets wider, at chat, OpenAI-compatible /v1, embed and accounts. Below, the inference engine moves between four levels of ownership: borrowed in a separate process, borrowed in-process, copied into the repo, and built by Ollama. It ends in 2026 split in two: upstream llama-server for GGUF models, and Ollama's own MLX engine for safetensors." loading="lazy">
  <figcaption><b>Figure 1.</b> Where Ollama's inference engine lived, 2023–2026. <a href="/systems-seen/ollama/">Open the interactive version</a> to step through it.</figcaption>
</figure>

## What users saw

The surface only grew. `ollama run MODEL` and the eight original endpoints
(`/api/generate`, `/api/pull`, `/api/tags` and the rest) exist at every point I
checked, including today. On top of them came `/api/chat` (December 2023), an
OpenAI-compatible API (February 2024), `/api/embed` (July 2024) and account endpoints
(September 2025).

Nothing a 2023 user relied on was removed. From the perspective of that original
surface, Ollama remained compatible while adding more.

## What moved underneath

The engine is a different story. Reading the tree and the commit messages, it went
through these places:

- **July 2023: Go bindings.** Ollama called llama.cpp in-process ("add llama.cpp go
  bindings").
- **August 2023: llama.cpp's server, as a separate process.** "subprocess llama.cpp
  server" removed the C code; Ollama now ran llama.cpp's own server and talked to it.
  From January 2024 it carried its own patches on top.
- **October 2024 (v0.4.0): llama.cpp copied into the repo.** "Remove submodule and
  shift to Go server": llama.cpp was vendored, and driven by a Go server.
- **December 2024 onwards: Ollama's own engine.** "Runner for Ollama engine", then a
  GGML-based backend and model implementations written in Go, running alongside the
  vendored llama.cpp.

Plotted by how much of the engine Ollama owned, that's a steady climb: from borrowing
llama.cpp, to copying it in, to building its own.

## It looks like build, then borrow

Then, on 29 May 2026, one commit reversed most of it:

> Remove the vendored GGML and llama.cpp backend, CGO runner, Go model implementations,
> and sample. llama-server (built from upstream llama.cpp via FetchContent) is now the
> sole inference engine for GGUF-based models.

The engine Ollama had built for GGUF models was deleted. So was the copied llama.cpp.
Ollama went back to running llama.cpp's server as a separate program, this time
upstream's own, built at build time, with a small compatibility layer so it can load
Ollama-format model files.

It is tempting to read that as a verdict: they tried to build their own engine, and it
didn't work out.

## That's the wrong conclusion

The same commit carries a parenthesis:

> (Safetensor based models continue to run on the new MLX engine.)

Ollama had been building a second engine of its own, on Apple's MLX, since February
2026. About three and a half months after the GGUF engine was removed, the MLX one was
promoted: "the only
Go inference runner left and is no longer experimental."

So in 2026 Ollama didn't stop building. It split:

| Model format | Engine | Ollama's relationship to it |
|---|---|---|
| GGUF | upstream llama.cpp server | borrows it |
| safetensors | Ollama's MLX engine | builds it |

## The decision wasn't build or borrow

"Build or buy" is usually framed as one decision for a whole component. Ollama's history
shows it made twice, and the second time it wasn't made for the whole component at all.
The line ended up being drawn by model format: GGUF moved to upstream llama.cpp, while
safetensors stayed on Ollama's own MLX engine.

The more useful question isn't "should we build our own engine?" It's "**where should
we own the engine?**"

The only reason the maintainers give is in that commit: "This allows us to more rapidly
pick up new capabilities and fixes from llama.cpp as they come out."

## What this doesn't tell us

Everything above comes from the repository itself: the file tree at different dates,
and the commit messages. So there is a lot it can't say:

- whether the switches made Ollama faster or slower, or changed anything users noticed;
- what the in-house GGML engine cost to maintain, and why exactly it was dropped,
  beyond the one sentence above;
- how the team made these decisions;
- whether the MLX engine will one day go the same way.

Commit messages are the maintainers' own framing. I've quoted them, and checked each
phase against the tree, but I haven't filled the gaps with guesses.

What the history does show is a pattern worth recognising in any system you depend on:
a surface that never broke, over an implementation boundary that kept moving.

---

*Method: a full clone of github.com/ollama/ollama (HEAD `16b4376a`, 2026-09-26), read
from the raw history; no third-party summaries. Engine phases: `6093a88c`, `42998d79`,
`b754f5a6`, `ed443a03`, `dcfb7a10`, `d8cc798c`, `9db4bdba`, `2e036e7c`. Surface
additions: `7a0899d6` (`/api/chat`), `453f572f` (`/v1`), `b9f5e16c` (`/api/embed`),
`8b894933` (accounts).*
