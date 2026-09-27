---
title: "Why agent CI can't be treated like deterministic tests"
date: 2026-09-26 17:56:13 -0700
description: >-
  Run the same agent twice and you get two different results. So what should a
  pull request check believe? A 25-point drop that wasn't enough evidence on
  its own, a capability that failed every run, and why running your eval more
  times doesn't settle it.
image: /assets/img/agentseism-social-preview.png
repo: lyr-ai/agentseism
series: Agent reliability
entry: "Method note 03"
---

Continuous integration rests on one assumption so basic we rarely say it out
loud: **run the same code on the same input and you get the same result.** A
test that passed on `main` and fails on your branch is evidence against your
branch. That assumption is what makes a red check mean something.

AI agents break it.

Run an agent twice on the same task, with the same code, model and prompt, and
it can read different files, call tools in a different order and end
somewhere else. Sometimes it succeeds both times, sometimes once. So when a
pull request touches the agent and the eval score moves, what should the
check believe?

## A check that failed for the right reason

Here is a pull request that looks like a harmless refactor. It changes one
line in a checkout handler, and the field it now reads, `amount_cents`, does not
exist.

<figure>
  <img src="/assets/img/agentseism-example-pr-regression.png" alt="A GitHub pull request, 'checkout: use amount_cents for the receipt amount'. The github-actions bot has posted an AgentSeism report headed 'REGRESSION — do not merge without review'. Its scorecard has two rows. Task success (broad): baseline 0.93, PR 0.68, change -0.25 with interval -0.52 to -0.04, decision PASS. Task success (capability): 7 of 7 tasks monitored, 1 collapsed, checkout 8/8 to 0/8, decision REGRESSION. The evidence list shows checkout fired with p=0.0001 and a non-blocking warning on return-label, 7/8 to 3/8." loading="lazy">
  <figcaption><b>Figure 1.</b> <a href="https://github.com/lyr-ai/agentseism-example/pull/2">A public pull request</a> in an example repository. The agent there is simulated: real handler code, fixed per-task success rates, and outcomes that vary from run to run. The CI check around it is the real one.</figcaption>
</figure>

The check ran each of seven tasks eight times on `main` and eight times on the
branch. Overall success fell from **0.93 to 0.68**, and two things happened that
ordinary CI has no vocabulary for:

- **The broad reliability check passed.** The evidence supported some
  deterioration, but not a suite-wide drop of at least the 10-point threshold
  declared in advance.
- **The check still failed**, because `checkout`, which had succeeded **8 of 8**
  times on `main`, succeeded **0 of 8** times on the branch.

A third detail is easy to miss: `return-label` went from 7/8 to 3/8 and was
flagged as a *warning*, not a failure. Its success rate didn't change in this
PR, so that drop is pure run-to-run wobble, and a warning is the right amount
of alarm for it.

A single pass/fail test cannot express any of that. Neither can a single eval
score.

## One run is a sample, not a replay

A deterministic test is a *replay*: run it again and you learn nothing new. An
agent run is a *sample* from a distribution of possible runs. That changes what
a comparison between two branches can tell you, in three ways.

<figure>
  <img src="/assets/img/agentseism-three-cases.svg" alt="Three cards. Normal noise: task success 91% to 86%, PASS, ordinary run-to-run wobble. Capability collapse: 91% to 77%, REGRESSION, checkout 8/8 to 0/8. Not enough evidence: 100% to 83%, NEED EVIDENCE, 3 tasks with 2 runs per side." loading="lazy">
  <figcaption><b>Figure 2.</b> The three situations a stochastic check has to tell apart. These come from <code>seism demo</code>, which feeds fixed, stated outcomes through the real decision engine. They illustrate the cases and are not evidence.</figcaption>
</figure>

### 1. Scores move when nothing changed

On a real coding agent (mini-swe-agent with Claude Haiku 4.5, on five SWE-bench
tasks run five times each), we ran an **unchanged** candidate against its own
baseline. Success went from **0.92 to 0.88**. One task went from 3/5 to 2/5 with
no code change at all.

A deterministic mindset reads that as "the PR made it worse". It didn't. There
was no PR. A check that blocks on this trains developers to click "re-run"
until it goes green, and after that nobody trusts it.

### 2. Averages hide breakage

The opposite failure is quieter. In the pull request above, the average fell 25
points, but not evenly: most of it was one task collapsing completely. Averaged
over the suite, a total failure of one capability looks like a moderate,
uncertain drop.

<figure>
  <a href="/agentseism/explorer/?s=collapse"><img src="/assets/img/agentseism-explorer-preview.png" alt="A measurement plate of seven capabilities, each with eight runs on main and eight on the pull request. Standing marks are successful runs; dots on the floor are failures. Six capabilities barely change. Checkout goes from eight standing marks on main to eight red dots on the pull request, 8/8 to 0/8. Beneath, a seismic trace shows small tremors across the suite and then a sharp fall at checkout. The average fell 14 points; checkout fell 100." loading="lazy"></a>
  <figcaption><b>Figure 3.</b> The average fell 14 points. One capability disappeared.
  <a href="/agentseism/explorer/?s=collapse"><b>▶ Explore what happened</b></a>: an interactive version of the <code>seism demo</code> collapse scenario, where every mark is one run.</figcaption>
</figure>

This isn't hypothetical for us. The first version of our own check measured only
the suite-wide average, and on a real agent it passed a change that cut success
from 0.92 to 0.52, with two tasks collapsing. The statistics were computed
correctly. They were answering the wrong question. That failure deserves its own
post.

### 3. Sometimes the honest answer is "not enough evidence"

Three tasks, run twice each, going from 100% to 83% is not a regression and not
a pass. It is too little data. A binary pass/fail setup has no honest way to
represent that, so it gets rounded to whichever side of the threshold it falls
on.

## Why not just run your eval more times?

Running more repetitions is the obvious fix, and it helps, but it doesn't
answer the question on its own. More numbers still leave four decisions open:

- **What counts as independent evidence?** Fifty reruns of one task tell you a
  lot about that task and almost nothing about the others. For a claim about
  the whole suite, the task is the unit, not the run.
- **How big a change matters?** A 2-point drop can be real and still not worth
  blocking a merge over. You have to say how much you care about before
  looking.
- **How do you avoid false alarms across many capabilities?** Watch 50 tasks
  with a simple per-task rule ("block if a task that passed at least 7/8 drops
  to at most 2/8") and some healthy PR will eventually trip it by chance. In our
  simulations of a flaky agent, that rule false-blocks about 1.4% of unchanged
  PRs at 5 tasks and **13.4% at 50**. A rule that corrects for the number of
  tasks stays under 1%
  ([computation](https://github.com/lyr-ai/agentseism/blob/master/analysis/CI_V1_BASELINE_CHALLENGE.md),
  table C6).
- **What do you do when there isn't enough data?** You need a third answer
  besides pass and fail.

Repeating the eval gives you the evidence. Something still has to turn that
evidence into a merge decision.

## Turning repeated runs into a merge decision

That is what [AgentSeism](https://github.com/lyr-ai/agentseism) does. You give
it a command that runs your agent on a task and one that checks the result. It
runs your base branch and your PR several times each, keeps each task's results
together, and returns one of four verdicts:

| Verdict | Meaning |
|---|---|
| **PASS** | Neither gate found enough evidence of a material regression. |
| **REGRESSION** | The suite as a whole is confidently worse by at least your threshold, **or** a task that reliably worked has collapsed. |
| **INSUFFICIENT EVIDENCE** | Too little data to decide. It blocks the merge, but it is not reported as a regression. |
| **INCOMPARABLE** | The model, runtime or dependencies differ between the two sides, so nothing is compared. |

The two gates behind REGRESSION answer different questions, which is why they
are separate: *did the suite get broadly worse?* and *did something that used to
work stop working?* The pull request above is the case where the answers
differ.

One correction to [the previous note in this series](/not-every-behavioral-change-is-a-regression/).
It ended on "Comparability first. Outcomes decide. Traces explain." The first
two became the product. The third, localising a regression to a stage of the
agent's trajectory, did not, and AgentSeism does not claim it.

## How much should you trust it?

We froze the decision rule before testing it, then ran it on seven SWE-bench
tasks it had never seen, with a pre-registered protocol: 224 real agent runs, 0
invalid, $38.49 in API cost. It passed an unchanged agent, and it caught both
degradations that had been predicted in advance, a capability collapse and a
broad collapse.

That evidence is narrow, and it is worth saying how:

- **One agent, one model, one kind of regression.** All of it is mini-swe-agent
  with Claude Haiku 4.5, and every degradation was made by cutting the agent's
  step budget.
- **Moderate regressions are hard to catch.** The rule is built to avoid
  blocking healthy PRs, so a task falling from 100% to 75% usually won't block
  a merge.
- **It isn't cheap yet.** Eight runs per task on each side is a validation
  design, not an optimised CI budget.
- **No one outside the project has used it yet.**

The [full protocol and results](https://github.com/lyr-ai/agentseism/blob/master/analysis/ci_v1/stageC/RESULTS.md),
including what the study did *not* establish, are in the repository.

## Try it

If your agent's eval score has ever moved on a PR and you couldn't tell whether
to believe it:

```bash
git clone https://github.com/lyr-ai/agentseism.git && cd agentseism
python3.11 -m venv .venv && source .venv/bin/activate
pip install -e .
seism demo
```

It takes about a second, with no API key and no Docker. Then look at the two
public pull requests in
[agentseism-example](https://github.com/lyr-ai/agentseism-example/pulls): one
docs-only change that passes, and the one-line bug above.

Or run your own eval eight times on an unchanged branch, and see how stable it
really is.

If this is a problem you have too, a ⭐ on
[the repo](https://github.com/lyr-ai/agentseism) tells me it's worth continuing.
An issue telling me where it breaks on your agent is worth even more.
