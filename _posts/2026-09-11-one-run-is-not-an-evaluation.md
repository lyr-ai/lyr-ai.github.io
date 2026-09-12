---
title: "One run is not an evaluation"
date: 2026-09-11 17:00:00 -0700
description: >-
  What repeated agent experiments taught me about variance, censoring,
  measurement bugs, and knowing whether a result is real — five evaluation
  assumptions that broke, and the protocol that replaced them.
image: /assets/img/evaluation-hero.jpg
repo: lyr-ai/agentseism
series: Agent reliability
entry: "Method note 01"
math: true
---

<figure>
  <img src="/assets/img/evaluation-hero.jpg" alt="run arrow score, struck through, above the words is not an evaluation; a chain reading protocol, repeat, classify, measure, label, uncertainty; and a list of five assumptions that broke." loading="lazy">
  <figcaption><b>Figure 1.</b> Repeated runs reveal variance. Valid measurement tells you what varied. External outcomes tell you whether the variation mattered.</figcaption>
</figure>

## Abstract

I used to think evaluating an AI agent was conceptually straightforward: freeze
a task and configuration, run the agent, record the outcome, compare scores.

Repeated executions changed that view.

The same agent, task, model and `temperature=0` configuration can produce
materially different executions. More importantly, the evaluation system itself
can create artifacts that look like model behavior: a context-window limit can
selectively remove long trajectories, a reasonable-looking state definition can
create false reconvergence, an infrastructure timeout can masquerade as agent
failure, and an obviously "cold" benchmark run can already have been warmed by
an earlier failed measurement.

These are not implementation annoyances. They change what an evaluation result
means.

My current view is that agent evaluation needs at least five separate layers: a
frozen execution protocol, repeated runs, explicit termination and censoring
semantics, validated behavioral measurements, and an external task-level
outcome. Only after those are separated does it make sense to compare agents, or
to claim that a behavioral difference matters.

This post records the evaluation assumptions that broke while I was building
[AgentSeism](https://github.com/lyr-ai/agentseism), and the protocol I use now.

## 1. "One run represents the agent"

Suppose Agent A solves a benchmark task and Agent B fails it. Which agent is
better? With one execution each, we barely know.

A long-running agent is not a single model call. It repeatedly generates
actions, modifies an environment, observes the result, and folds those
observations into subsequent context, so small differences propagate through the
execution.

In my coding-agent experiments, repeated executions used the same task, model,
agent configuration and `temperature=0`, and still did not reliably follow the
same trajectory. Some differences disappeared, some persisted, and some
executions diverged, reached the exact same repository state, and diverged
again.

A single execution therefore measures something closer to

$$Y_{i,r}$$

— the outcome of run \\(r\\) on task \\(i\\) — than an intrinsic property of the agent.
What we usually care about is a distribution:

$$P(Y \mid \text{agent}, \text{task}, \text{protocol}).$$

Repeated execution is not simply a way to make an average more precise. It is
how you find out whether the thing being evaluated has meaningful run-to-run
variance at all.

<figure class="wide">
  <img src="/assets/img/outcome-distribution.png" alt="A task with a frozen protocol fanning out into runs one through N, each producing an outcome, all feeding a single outcome distribution." loading="lazy">
  <figcaption><b>Figure 2.</b> From a score to a distribution. Before comparing two agents, understand the variance of each under the protocol being used.</figcaption>
</figure>

## 2. "A failed run is an agent failure"

Repeated runs immediately raise another question: what counts as an outcome?

In one experiment I configured the serving system with a 32k context limit.
Several trajectories terminated with `ContextWindowExceeded`. One task — Seaborn
— lost all three of its runs that way.

It would have been easy to record `success: false` and fold those into the
agent's accuracy. But the model itself supported a much longer context. The 32k
boundary was an infrastructure choice I had made. Those executions answered
"can this agent complete the task under my 32k serving constraint?" — not "can
this agent solve the task?"

The distinction got sharper when I noticed *which* executions were being
removed. Long trajectories involve more exploration and accumulate more context,
so context-window censoring was not random. The experiment was preferentially
deleting a particular kind of execution: a missing-not-at-random pattern.

I now separate at least four termination classes.

| Termination | Interpretation |
|---|---|
| Completed / submitted | agent produced a terminal outcome |
| Agent failure | the agent itself terminated unsuccessfully |
| Infrastructure failure | endpoint, container, transport or runtime failed |
| Censored | an experimental boundary stopped the trajectory |

The exact taxonomy depends on the system. Collapsing these into `success=0` can
distort an evaluation badly.

```text
                       EXECUTION ENDS
                             │
             ┌───────────────┼───────────────┐
             │               │               │
             ▼               ▼               ▼
         COMPLETED      AGENT FAILURE    NOT AN AGENT FAILURE
                                         ┌──────┴──────┐
                                         ▼             ▼
                                  INFRA FAILURE     CENSORED
                                  endpoint died     context limit
                                  container crash   step limit
                                  transport error   time boundary
```

**Figure 3.** Failure is not one bucket. The question is not "did this run
finish?" but "what process caused observation to stop?"

## 3. "Measurement code cannot manufacture a finding"

The most uncomfortable evaluation bugs are not crashes. They are measurements
that produce plausible numbers. I hit three.

### A "cold" run that was already warm

While measuring prefix caching, a script assumed `repeat == 0 → cold` and
`repeat == 1 → warm`. Reasonable enough. But earlier executions had already sent
the request and populated the cache before the script crashed while printing its
results. On rerun, the nominally first measurement was already warm.

The eventual data made it visible: a genuinely cold ~28.5k-token prefill took
about 12.1 seconds, while a cached repetition took about 0.43 seconds. Earlier
~14k measurements that had looked inexplicably fast were not evidence of
exceptional cold-prefill performance — the cache was already populated.

The bug was not in vLLM. It was in the assumption that **the first recorded
measurement is the first system exposure.** Experimental state can survive a
failed measurement.

### A reconvergence that never happened

AgentSeism compares trajectories by repository source state. The first
implementation treated two runs as reconverged if they shared a source-state
hash after diverging, and the analysis produced a lot of apparently anomalous
pairs.

The reason was embarrassing. The hash `e3b0c442…` is SHA-256 of the empty diff.
Every execution occupies that state before it modifies anything, so two
trajectories could "reconverge" purely by both having changed nothing yet. Once
the empty state was excluded, the anomalies largely disappeared.

Nothing about the agent changed. Only the measurement did.

### Two "different outcomes" that were the same source state

Another pair appeared to finish with different patches even though their final
tracked source hashes were identical. One submission contained roughly 18 KB of
extra untracked scratch content; the actual tracked modification was the same
~720-byte code change in both.

Two different objects had been compared: a **submission string** and a
**canonical tracked repository state**. Both are legitimate measurements of
different questions. If the question is whether the agent produced the same
source repair, the tracked state is the right outcome; if it is whether the
agent submitted the same artifact, the string may be. The bug was silently
treating the two as interchangeable.

<figure class="wide">
  <img src="/assets/img/construct-to-result.png" alt="A chain from research question to construct, metric, instrumentation, validation and result." loading="lazy">
  <figcaption><b>Figure 4.</b> The chain I now make explicit for any metric that carries weight in an argument.</figcaption>
</figure>

## 4. "Fixing a measurement is a neutral act"

There is a dangerous moment in any exploratory experiment: the data look
strange, you find a flaw in the analysis, you fix it, the results look cleaner —
and then another strange result appears, and you fix that too. At some point
"debugging the measurement" becomes indistinguishable from adjusting the
analysis until the data tell a satisfying story.

I ran into exactly this.

The empty-state reconvergence issue was clearly a measurement bug: an unmodified
repository should not count as meaningful reconvergence. But another pattern
survived the fix — some trajectories reached the same **non-empty** source state
and later diverged again.

My original classification treated that as anomalous, because it implicitly
assumed that once trajectories reconverge they stay reconverged. The data showed
the assumption was false. Changing the instrumentation to make those cases
disappear would no longer have been fixing a measurement; it would have been
deleting a real topology my conceptual model failed to represent.

So I kept the observation and expanded the representation to a triple \\((D, R, F)\\) — divergence, non-empty reconvergence, final convergence — which describes
the three observed cases directly:

```text
absorbed        1 1 1
persistent      1 0 0
re-divergence   1 1 0
```

> **Fix instrumentation when it fails to measure the construct you defined.
> Change the construct only when you are willing to say the original hypothesis
> or representation was incomplete.**

Those are different scientific operations and should leave different records.

## 5. "Writing the design down makes it reproducible"

Preregistration sounds excessive for an engineering project. I found it useful
for a blunt practical reason: it stopped me from making dozens of individually
reasonable decisions *after* seeing the data.

For one experiment I froze, in advance: task-selection rules, run count, model
and serving configuration, state representation, divergence and reconvergence
definitions, treatment arms, outcome metric, stop conditions, and the handling
of infrastructure failures.

It did not prevent mistakes. One donor-selection rule later produced two
experimental arms with identical terminal targets, which made the planned
treatment contrast unidentifiable.

What mattered was what happened next. There were other runs in the same dataset
that would have produced different terminal targets, and picking one of those
would have been easy. The gate returned `UNIDENTIFIABLE`, Phase B did not run,
the rule was amended and documented, and the amendment was applied only to a new
sample.

Preregistration did not make the original design correct. It made the design
failure visible, which turned out to be the more useful property.

## 6. Repetition does not rescue a bad metric

Suppose I run an agent 100 times and precisely estimate how often it produces
different patches. If all of those patches are correct, I have precisely
measured a behavioral difference that may not matter.

This was the most important conceptual correction in the AgentSeism work.
Initially I focused on trajectory variation: do executions diverge, do they
reconverge, do they finish in different source states? Those are useful
behavioral measurements. They are not task outcomes.

For coding agents the stronger outcome is externally measurable —
`FAIL_TO_PASS` and `PASS_TO_PASS` give a correctness label independent of the
agent's own reasoning. That creates two layers: **behavioral variation** and
**consequential variation**. Different trajectories with the same correctness may
be harmless diversity; similar trajectories that repeatedly fail may be stable
unreliability.

```text
             REPEATED EXECUTIONS
                     │
                     ▼
         How much does behavior vary?
                     │
              trajectory metrics
                     ▼
        ┌─────────────────────────┐
        │ Behavioral variation    │
        └────────────┬────────────┘
                     │  + external labels
                     ▼
        ┌─────────────────────────┐
        │ Consequential variation │
        │ Did the variation       │
        │ change correctness?     │
        └─────────────────────────┘
```

**Figure 5.** More repetitions reduce uncertainty about the metric you chose.
They do not make the metric more meaningful.

This is the direction of the next experiments: attach correctness labels to
repeated trajectories, and find out which execution differences actually
correlate with — or cause — failure. It is the same question
[Experiment 01](/agents-diverge-at-temperature-zero/) ended on.

## 7. "Evaluation measures the model"

An agent evaluation result belongs to an entire protocol. "Agent X achieves 72%
accuracy" is incomplete without knowing what execution process produced the
number: model and exact revision, sampling configuration, tool definitions,
agent implementation, context-window limit, step limit, retry policy, container
version, serving engine, concurrency policy, termination semantics, scoring
implementation.

Some of those look like infrastructure trivia. They still change the
distribution being measured.

I considered running several AgentSeism trajectories concurrently to cut GPU
rental time. From a serving perspective that is obviously right — continuous
batching improves utilization. But the experiment was studying run-to-run
variation under temperature-zero inference, and changing concurrency changes
batch composition and potentially the numerical execution path. A serving
optimization would have altered the stochastic process under study.

In production I would enable concurrency. For that experiment I kept runs
sequential. The correct configuration depends on the question.

## 8. The protocol I use now

The pipeline I want looks less like `run → score`:

<figure class="wide">
  <img src="/assets/img/evaluation-pipeline.png" alt="Freeze protocol, repeated executions, classify termination into completed, agent failure, infrastructure failure and censored; completed and agent failures flow into validated measurements, external labels, variance estimation and comparison, while infrastructure failures and censored runs are reported separately." loading="lazy">
  <figcaption><b>Figure 6.</b> Infrastructure failures and censored runs leave the main path, but they are reported rather than dropped.</figcaption>
</figure>

In practice, six questions before I trust an agent-evaluation result:

1. **Is the protocol frozen?** Can I state exactly what system produced these
   executions?
2. **Do I have repeated runs?** Have I measured run-to-run variability rather
   than assuming it away?
3. **Do termination classes have explicit semantics?** Can I separate agent
   failure from infrastructure failure and censoring?
4. **Has the measurement been validated?** Do the hashes, state representations
   or judge scores correspond to the construct I claim to measure?
5. **Is there an external outcome?** Am I measuring task success, or only
   behavioral difference?
6. **Is uncertainty visible?** Does the reported result reflect the distribution
   I actually observed?

If I cannot answer these, adding more benchmark tasks is usually not the first
thing I need.

## 9. What I still don't know

This protocol solves part of the problem. Repeated executions get expensive, and
the right number of repetitions depends on the agent's variance and on the
decision being made. Some evaluations have deterministic external labels; others
need human or model judges, which introduce another layer of measurement noise.
Production agents also operate on non-stationary task distributions, which makes
any fixed benchmark an incomplete proxy for deployed behavior.

The question I care about next is more specific: once repeated executions carry
external correctness labels, can we identify **where successful and failed
trajectories begin to become distinguishable, before termination?**

If so, evaluation stops being only retrospective. Instead of "which agent scored
higher?", the question becomes "when did this execution become more likely to
fail, and could an intervention at that point have changed the outcome?" That is
the bridge between agent evaluation and agent reliability.

## Conclusion

The biggest change is that I no longer treat the benchmark score as the
beginning of the analysis. It is the end of a measurement pipeline.

Before trusting the score I want to know what protocol generated it, how much
executions vary, why each run terminated, whether the instrumentation measures
what I think it measures, and whether behavioral differences are grounded in an
external outcome.

So the principle is not simply *run the agent more than once*. It is:

> **Repeated runs reveal variance. Valid measurement tells you what varied.
> External outcomes tell you whether the variation mattered.**

Only then does it seem fair to call the result an evaluation.
