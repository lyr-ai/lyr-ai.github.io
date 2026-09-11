---
title: "12 of 13 runs reached the exact same code state, then ended 11 different ways — even at temperature 0"
date: 2026-09-11
description: >-
  Twelve of thirteen executions of the same coding agent, same model,
  temperature 0, reached an identical intermediate repository state — and then
  ended in eleven distinct final states. The useful question is not whether runs
  differ, but which differences reach the outcome.
image: /assets/img/same-state-different-futures.webp
repo: lyr-ai/agentseism
syndicated_to: https://medium.com/@ruxiz2005/ai-agents-still-diverge-at-temperature-0-when-does-it-matter-f5abac008e17
math: true
---

## Abstract

I ran the same coding agent on the same task repeatedly, using the same model,
configuration, and `temperature=0`. Twelve of thirteen executions reached the
exact same intermediate repository state. Those twelve runs subsequently ended
in eleven distinct source states.

At first, I thought the problem was variation itself. I no longer think that is
the right framing. Different executions may still produce equally correct
solutions. The more useful question is whether we can identify when harmless
exploration becomes consequential divergence — and intervene before the agent
fails.

<figure>
  <img src="/assets/img/same-state-different-futures.webp" alt="Same state, different futures: 12 of 13 executions reached one identical source state, and 11 distinct endings among them." loading="lazy">
  <figcaption><b>Figure 1.</b> Twelve of thirteen executions reached one identical source state, and eleven distinct endings among them. All values computed from recorded agent executions; no correctness labels are used here — a different ending is not a wrong ending.</figcaption>
</figure>

## 1. Observation: temperature zero does not make an agent execution deterministic

An agent is not a single model invocation. It is a closed-loop system in which
model outputs produce actions, actions change an environment, environmental
changes produce new observations, and those observations become part of
subsequent model context. Even a small difference early in this loop can
therefore alter later tool calls and observations and eventually produce a
substantially different execution.

To study this behavior, I repeatedly ran the same coding agent on SWE-bench
tasks using the same model and `temperature=0`. Rather than interpreting the
model's reasoning text, AgentSeism records an objective environment-level
representation after each action. For coding tasks, a source state is the
canonical tracked Git diff of the repository against the task's base commit.
Scratch files and other untracked workspace artifacts are recorded separately.

This representation revealed three recurring trajectory topologies. In
**absorption**, two executions diverge but later reconverge and finish in the
same source state. In **persistence**, they diverge and remain different through
termination. In **re-divergence**, they diverge, later reach exactly the same
non-empty source state, and subsequently separate again.

<figure>
  <img src="/assets/img/variation-topologies.webp" alt="Three observed fates of execution variation: re-divergence, persistence, and absorption." loading="lazy">
  <figcaption><b>Figure 2.</b> Three observed fates of execution variation: re-divergence, persistence, and absorption.</figcaption>
</figure>

The important observation is not simply that executions differ. In one Pytest
task, independent runs repeatedly reached the exact same non-empty source state
and subsequently produced different final source states. Across the executions
summarized in Figure 1, 12 of 13 runs reached that shared intermediate state,
yet those runs ended in 11 distinct final states. This suggests that
repository-source convergence does not imply convergence of the complete agent
state, because different executions can arrive with different message histories,
observations, and scratch workspace artifacts.

## 2. Reframing the problem: variation is not failure

My initial framing treated persistent or re-divergent trajectories as evidence
of instability. That interpretation is too strong. Two executions may follow
different paths and produce different patches while both satisfy the task
specification. Conversely, an agent can behave very consistently and repeatedly
produce the same incorrect answer. Behavioral reproducibility and task
reliability are therefore different quantities.

For coding agents, this distinction can be measured without relying on another
LLM as a judge. SWE-bench provides external test-based signals through
`FAIL_TO_PASS` and `PASS_TO_PASS`, allowing each terminal execution to receive
an independent correctness label. The next stage of the analysis is therefore to
augment trajectory measurements with these labels and ask whether particular
forms of execution variation are associated with mixed outcomes on the same
task.

This motivates a narrower definition of the problem:

> **Consequential divergence** is execution variation that propagates into a
> task-relevant outcome difference.

<figure>
  <img src="/assets/img/harmless-vs-consequential.webp" alt="Four executions of the same task take different trajectories; three are correct and one is not. Only the last is consequential variation." loading="lazy">
  <figcaption><b>Figure 3.</b> Four executions of the same task take different trajectories. Three reach correct solutions; only the fourth makes the variation consequential.</figcaption>
</figure>

Correctness is the first outcome I plan to study because it has an external
label, although the same framework could later include latency, cost, safety
violations, or other application-specific outcomes.

Under this definition, the goal is explicitly **not** to make agents
deterministic. A system that produces many different trajectories but succeeds
reliably may be preferable to a deterministic system that consistently makes the
same mistake. The useful question is which execution differences provide
evidence that an agent is moving toward failure.

## 3. From measurement to intervention

Adding outcome labels changes AgentSeism from a trajectory-analysis problem into
a sequential reliability problem. For a trajectory observed through step \\(t\\),
the quantity of interest becomes conceptually

$$P(Y = \text{failure} \mid \tau_{\leq t}),$$

where \\(\tau_{\leq t}\\) represents the execution history observed so far. This
formulation creates two separate engineering questions: where should an agent be
steered, and how should it be steered?

### 3.1 Where to steer

The first divergence from a common or previously successful trajectory is not
necessarily a useful intervention point, because the difference may later be
absorbed or may lead to another correct solution. Intervention should instead
occur only when enough evidence has accumulated that the current execution has
an elevated probability of failure.

Waiting until failure probability is maximal is also insufficient, because by
then the execution may be difficult or expensive to recover. The useful
intervention region is therefore the intersection between predictability and
recoverability: failure has become distinguishable from normal exploration, but
changing the trajectory can still improve the outcome.

A practical experiment would begin with repeated executions carrying external
correctness labels. At every observed state or transition, AgentSeism can
compare prefixes from successful and failed runs and ask how early their outcome
distributions become distinguishable. This produces a failure-risk estimate over
the trajectory rather than a binary anomaly detector.

Recoverability must then be measured separately. Candidate states can be
archived and replayed, and controlled continuations can test whether
interventions from that point still change the success probability. A state with
high predicted failure risk but no effective intervention is useful for
diagnosis but too late for steering. A state with moderate predictive power and
a large intervention effect may be a substantially better control point.

$$\text{SteerValue}(t) \propto \text{FailureRisk}(t) \times \text{Recoverability}(t),$$

although the exact scoring function should be learned from experiments rather
than assumed in advance.

```text
                        FINAL FAILURE
                             ✕
                             ▲
                             │
trajectory ──●────●────●────●────●────●──→
             │    │    │    │    │
             │    │    │    │    └─ too late
             │    │    │    │       risk high
             │    │    │    │       recovery low
             │    │    │    │
             │    │    └────┴──── STEERING WINDOW
             │    │              failure predictable
             │    │              recovery still possible
             │    │
             └────┴─ too early
                    insufficient evidence
```

```text
 probability

1.0 |                         Failure risk
    |                       ╭──────────────
    |                    ╭──╯
    |                 ╭──╯
0.5 |──────────────╭──╯
    |              │
    | ╲
    |  ╲_____________________ Recoverability
0.0 +────────────────────────────────────→ step
             █████████
             STEERING
              WINDOW
```

### 3.2 How to steer

Once a candidate intervention point is identified, the next problem is causal
rather than predictive. Knowing that a trajectory is likely to fail does not
tell us which action will improve it.

AgentSeism already has the primitives needed to begin studying this question.
Its archival layer records canonical tracked source state, message history, and
untracked workspace artifacts; replay reconstructs an execution state; and
`ForkAgent` can create controlled continuations from a common source state.
These mechanisms allow different interventions to be compared from the same
starting point.

The simplest experimental design is to retain an untreated continuation as a
control and compare it with increasingly strong interventions. A **nudge** can
ask the agent to re-check a particular assumption or piece of evidence without
providing a solution. A **context intervention** can alter carried execution
context when there is evidence that previous history is contributing to failure.
A **rollback** can restore a previously observed state with a better empirical
outcome distribution. A **fork-and-select** intervention can generate several
short continuations from a recoverable state and continue the branch with the
lowest estimated failure risk.

The relevant metric is not whether the intervention makes trajectories look more
similar. It is the change in externally measured success:

$$\begin{aligned}
\Delta_{\text{success}} &= P(Y = \text{correct} \mid do(I)) \\
&\quad - P(Y = \text{correct} \mid do(\text{no intervention})).
\end{aligned}$$

This distinction is important because an intervention that reduces trajectory
variance without increasing correctness has not improved reliability. Similarly,
a fork-and-select strategy that improves correctness but doubles inference cost
may only be useful for sufficiently high-value tasks. Steering should therefore
eventually be evaluated jointly on outcome improvement and intervention cost.

<figure class="wide">
  <img src="/assets/img/steering-decision-flow.webp" alt="Proposed AgentSeism reliability loop: observe state and trajectory prefix, estimate outcome risk, estimate recoverability, apply a controlled intervention, and evaluate against an external outcome label." loading="lazy">
  <figcaption><b>Figure 4.</b> Proposed AgentSeism reliability loop: observe the state and trajectory prefix, estimate outcome risk, estimate recoverability, apply a controlled intervention, and evaluate it against an external outcome label.</figcaption>
</figure>

The research program implied by this loop is straightforward even though the
individual problems are not. First, existing trajectories need external
correctness labels so that harmless and consequential variation can be
separated. Second, larger sets of labeled repeated executions can be used to
estimate when failure becomes predictable. Third, archived states can be
replayed to measure where failure remains recoverable. Finally, randomized or
otherwise controlled interventions can estimate which steering actions actually
increase success.

## 4. Relationship to harness engineering

Harness engineering already provides many of the mechanisms needed to improve
long-running agents, including context management, verification, retries,
evaluators, structured planning, and recovery. AgentSeism is not intended to
replace this layer. The narrower problem I am interested in is deciding *when*
these mechanisms should be invoked, *which* intervention should be used, and
*whether* the intervention actually improves an externally measured outcome.

<figure>
  <img src="/assets/img/reliability-loop.webp" alt="AgentSeism as a measurement and decision layer around an agent harness." loading="lazy">
  <figcaption><b>Figure 5.</b> AgentSeism as a measurement and decision layer around an agent harness, rather than a replacement for it.</figcaption>
</figure>

This distinction matters because execution variation is not necessarily failure.
An agent taking an unfamiliar path may still reach a correct solution, while an
unnecessary retry, context reset, or rollback may destroy useful exploration. I
therefore see AgentSeism as a potential measurement and decision layer within an
agent harness: it observes execution trajectories, identifies variation
associated with outcome risk, estimates when intervention remains useful, and
evaluates interventions against an untreated continuation.

## 5. Practical implications today

Even before automatic steering is solved, these experiments suggest several
practical design principles for long-running agents. Setting `temperature=0`
should not be treated as an end-to-end reproducibility mechanism. Systems that
need meaningful replay should preserve execution context and relevant workspace
state rather than storing only the model configuration or final artifact. A
different trajectory should not automatically be classified as anomalous,
because behavioral diversity may be harmless. Most importantly, intervention
should be grounded in task outcomes rather than distance from a canonical
trajectory.

These principles also change how I think about agent observability. A trace
viewer can explain what happened after an execution finishes. A reliability
system should eventually answer a harder question while the execution is still
running: given what has happened so far, is this agent becoming more likely to
fail, is it still recoverable, and which intervention is most likely to improve
the outcome?

## 6. Next experiments

The immediate next step is intentionally simpler than building an online
controller. I plan to attach SWE-bench correctness labels to the completed
trajectories and determine whether the behavioral structures already measured by
AgentSeism correspond to meaningful outcome variance. In particular, the
important cases are tasks where repeated executions under the same configuration
produce a mixture of correct and incorrect outcomes, because those tasks provide
the data needed to study consequential divergence.

In parallel, the current fork experiment tests a narrower causal question raised
by re-divergence: when two executions reach the same repository source state but
carry different histories and workspace artifacts, does that carried context
causally change their subsequent repair distribution? Exact terminal-state
matching is useful for understanding the mechanism, but correctness will
ultimately be the more important outcome. If different histories produce
different patches but all patches are correct, the variation is mechanistically
interesting but not yet a reliability problem.

If these experiments establish both mixed outcome variance and recoverable
intermediate states, the next stage will be a controlled steering benchmark.
Each candidate state would be forked into an untreated control and one or more
intervention arms, with success rate and intervention cost measured
independently. That experiment would directly test the product hypothesis behind
AgentSeism: not whether agent trajectories can be made identical, but whether
consequential divergence can be detected early enough, and corrected reliably
enough, to improve end-to-end task success.

## Conclusion

Repeated long-horizon agent executions can vary substantially even at
`temperature=0`, and identical intermediate source states do not necessarily
imply identical futures. Those observations are useful measurements, but they
are not themselves evidence of unreliability.

The more important distinction is between behavioral variation and consequential
variation. The next phase of AgentSeism is therefore centered on external
outcome labels, early failure prediction, recoverability, and controlled
intervention. The long-term objective is not deterministic agents; it is an
execution system that permits useful exploration while recognizing when an agent
is genuinely going off track and steering it back when doing so measurably
improves the outcome.
