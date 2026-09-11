---
layout: default
title: About
permalink: /about/
description: Ruxi Zhang — machine learning engineer working on reliable AI systems, agent execution, and ML infrastructure.
---

<section class="about" markdown="1">

# About

I'm **Ruxi Zhang**, a machine learning engineer interested in reliable AI
systems, agent execution, and ML infrastructure. `lyr.ai` is where I publish
experiments and the open-source systems I build around those questions.

The thread running through all of it: agents are stochastic systems, and most of
what varies between two runs does not matter. Finding the part that *does* — early
enough to act on it — is the problem I keep coming back to.

## Writing

Experiments and research notes are on the [front page]({{ '/' | relative_url }}),
or by [RSS]({{ '/feed.xml' | relative_url }}).

## Systems

- **[AgentSeism](https://github.com/lyr-ai/agentseism)** — measuring when
  execution variation becomes consequential, and testing whether agents can be
  steered before failure. State-level instrumentation, replay, fork, controlled
  intervention.
- **[TypedMem](https://github.com/lyr-ai/typedmem)** — schema-aware typed memory
  for AI agents: what an agent carries between steps, and what that does to its
  behavior.
- **[ReliAgent Bench](https://github.com/lyr-ai/reliagent-bench)** — a
  reproducible reliability benchmark for memory-enabled agents; the harness whose
  failures drove the memory work.
- **[LYR](https://github.com/lyr-ai/lyr)** — a layered knowledge engine.

## Elsewhere

[GitHub](https://github.com/lyr-ai) ·
[RSS]({{ '/feed.xml' | relative_url }}) ·
[Medium]({{ site.medium_url }})

</section>
