---
title: "The model isn't the system"
description: >-
  On one coding benchmark, switching from a minimal harness to each model's vendor harness
  changed scores by as much as +14 points for one model and −13 for another. Benchmark
  numbers are partly system numbers, and changing the model means re-testing the harness.
series: New tech, explained
image: /assets/img/harness-same-model-two-harnesses.png
date: 2026-09-27 18:30:00 -0700
---

We keep benchmarking models. Often, we're benchmarking systems.

When a leaderboard says a model solves 62.9% of tasks, it's easy to read that as the
model's ability. But an AI coding agent is a model inside a **harness**: the tools it
can call, its prompts, how it manages context, the loop it runs in, the checks around
it. The score belongs to the pair.

How much does the harness matter? One benchmark ran the same models in different
harnesses, and the answer is: enough to flip the result.

On Terminal-Bench 2.0, **switching from a minimal harness to each model's vendor harness
changed scores by as much as +14 points for one model and −13 for another.** And the
direction depended on which harness it was.

<figure>
  <img src="/assets/img/harness-same-model-two-harnesses.png" alt="Dumbbell chart from Terminal-Bench 2.0. Each model is shown in a minimal harness (Terminus 2) and in its vendor's own harness. With Codex CLI, GPT-5 goes from 35.2% to 49.6% (+14.4), GPT-5.2 from 54.0% to 62.9% (+8.9), GPT-5-Mini from 24.0% to 31.9% (+7.9). With Claude Code, Opus 4.5 goes from 57.8% to 52.1% (−5.7), Opus 4.1 from 38.0% to 34.8% (−3.2), Sonnet 4.5 from 42.8% to 40.1% (−2.7), Haiku 4.5 from 28.3% to 27.5% (−0.8); these are within noise. With Gemini CLI, Gemini 2.5 Pro goes from 32.6% to 19.6% (−13.0), Gemini 2.5 Flash from 16.9% to 15.4% (−1.5)." loading="lazy">
  <figcaption><b>Figure 1.</b> Every model that Terminal-Bench 2.0 ran both in a minimal harness and in its vendor's own. Faded differences are within the benchmark's reported uncertainty.</figcaption>
</figure>

## What the table shows

The benchmark's authors ran each model-and-harness pair at least five times and report
the uncertainty. Nine models were run both in **Terminus 2**, a deliberately minimal agent,
and in their vendor's own harness:

- **Codex CLI** helped every OpenAI model: +14.4 points for GPT-5, +8.9 for GPT-5.2,
  +7.9 for GPT-5-Mini.
- **Claude Code** came out slightly below the minimal harness for every Claude model,
  from −0.8 to −5.7 points. Each of those gaps on its own is within the reported
  uncertainty; it's the consistent direction that stands out.
- **Gemini CLI** cost Gemini 2.5 Pro 13 points, and Gemini 2.5 Flash 1.5.

The authors draw their own conclusion from it: "model selection is usually more
important than agent scaffold." That's true on average. But for a single model, the
scaffold was worth anything from −13 to +14 points.

## What it doesn't show

It isn't a ranking of harness quality. **Terminus 2 was built by the benchmark's own
authors**, for this benchmark, so it plays at home. Claude Code trailing it here doesn't
mean Claude Code is badly built, and Codex CLI's gains here don't transfer automatically
to your tasks.

It's also one benchmark, made of terminal tasks.

What it does show is narrower and more useful: **a harness has no fixed value on its
own.** Its effect depends on the model inside it, and can change sign.

## So when the model changes, re-test the harness

If the value of a harness depends on the pairing, then upgrading the model breaks your
knowledge of that pairing. The harness that helped last month's model may be neutral, or
in the way, for this month's.

The practical rule is simple: when you switch or upgrade the model, re-run the
comparison. Try your full harness against a simpler one. Remove components one at a
time. Keep what still helps.

And when you read a leaderboard, ask what system the number came from.

### An ablation, not a comparison

Comparing model A in harness X with model B in harness Y tells you which pair is better,
not why. To learn what your harness is worth, hold the model fixed and take the harness
apart:

```text
model fixed, same tasks, several runs each

full harness                 → score, cost, time
minimal baseline             → score, cost, time
full − planning step         → ?
full − retry loop            → ?
full − custom tools          → ?
full − context rules         → ?
full − checks                → ?
```

Two things from the evidence above are worth building in:

- **Run each configuration several times.** Terminal-Bench ran every pair at least five
  times and still reports roughly ±3 points. A difference smaller than that is noise.
- **Record cost and time, not just the score.** A component that no longer changes
  accuracy may still pay for itself by saving tokens, as the planning study found.

Keep a component only if taking it out makes things measurably worse. Then run the same
table again when the model changes.

## Harnesses also age (a separate, weaker signal)

There are other signs that particular scaffolding loses its value as models improve,
though none of them come from the table above, which is a snapshot, not a history:

- A study of agent design choices found that planning "shifts from an accuracy scaffold
  for weaker models to a cost saver for stronger models".
- METR compared Claude Code with a simple scaffold for Opus 4.5. Claude Code came out
  ahead in 50.7% of their bootstrap samples: a coin flip.
- Anthropic, describing how it builds harnesses for long-running work, puts it this way:
  "every component in a harness encodes an assumption about what the model can't do on
  its own, and those assumptions are worth stress testing."

That fits the idea that a harness moves with the model rather than simply growing. But
it's supported by a handful of reports, not established.

## What might last: a hypothesis

If some scaffolding goes stale, what doesn't? Practitioners and vendors keep pointing at
**verification**: tests, checks and other feedback the agent can run on its own work. It's
plausible that this ages more slowly than prompts and workflow tricks. On the evidence I
found, though, it's a hypothesis. Nobody I found has measured it across model
generations.

## Summary

| How strong | Claim |
|---|---|
| Measured (one benchmark) | The same model can get better or worse depending on the harness, and the direction varies |
| Supported by several reports | Some scaffolding loses value as models improve |
| Hypothesis | Verification may last longer than other parts of the harness |

The model isn't the system. When you change one, re-test the other.

---

*Sources: Terminal-Bench 2.0 (arxiv.org/abs/2601.11868, appendix Table 2); METR,
"Measuring time horizon using Claude Code and Codex" (February 2026); the empirical study
of agent design choices (arxiv.org/abs/2609.20804); Anthropic, "Harness design for
long-running application development". Each quote and number was read on the original page.*
