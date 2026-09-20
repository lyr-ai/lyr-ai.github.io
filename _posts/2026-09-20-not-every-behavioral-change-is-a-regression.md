---
title: "Not every behavioral change is a regression"
date: 2026-09-20 09:00:00 -0700
description: >-
  Regression testing assumes repeated runs are stable. Agents break that
  assumption. Two experiments — four correct runs that shared no trajectory,
  and 23 of 23 fork points diverging when only the GPU changed — pushed
  AgentSeism to a different order: comparability first, outcomes decide,
  traces explain.
image: /assets/img/agentseism-two-failure-modes.png
repo: lyr-ai/agentseism
series: Agent reliability
entry: "Method note 02"
---

Software regression testing assumes repeated executions are reasonably stable.
If the same test passes before a change and fails afterward, the change is a
plausible cause.

AI agents break this assumption.

An agent can take a different path even when its code, task, and model
configuration appear unchanged. It may inspect different files, call tools in a
different order, write a different patch, or recover from an error through a
different route. Some of these changes are harmful. Many are not.

This creates a basic problem for agent development:

> When an agent behaves differently after a change, how do we determine whether
> the change is a real regression, harmless stochastic variation, or the result
> of an incomparable execution environment?

I built [AgentSeism](https://github.com/lyr-ai/agentseism) to explore this
question. The project began as a framework for detecting behavioral instability
in agent trajectories. Experiments changed that direction. They showed that
behavioral difference alone is not a reliable release signal.

The more useful design is an outcome-grounded regression layer for stochastic
agents:

1. Check whether the two evaluations are comparable.
2. Decide whether task outcomes regressed.
3. Use traces only to diagnose a regression after it has been established.

That ordering matters.

<figure>
  <img src="/assets/img/agentseism-two-failure-modes.png" alt="Two panels. Left: five bars showing steps taken by five independent runs of the same coding task at temperature zero — 31, 41, 33, 47 and 31 steps, with final patch sizes 843, 1229, 978, 1939 and 690 bytes. The first four bars are green, marked resolved; the fifth is red, not resolved. A composite trace detector fires on all six pairs of correct runs. Right: a horizontal bar chart of 23 archived fork roots. Structured actions differ on 23 of 23; zero match. The agent was held completely fixed and only the GPU and driver changed, from an A100-SXM4-80GB to an H100 PCIe." loading="lazy">
  <figcaption><b>Figure 1.</b> Two failure modes, both measured on frozen artifacts. Left: trajectory
  consistency would have rejected correct work. Right: an environment change looks exactly like an agent change.</figcaption>
</figure>

## Different trajectories can all be correct

Consider several independent runs of the same coding task under the same agent
configuration.

In one frozen batch, five runs produced five different final workspace states.
Four of the five solutions were accepted by the task evaluator; one was not.
The four correct runs took 31, 41, 33 and 47 steps and submitted patches of
843, 1229, 978 and 1939 bytes. No two shared a tool-usage profile.

This small example exposes both sides of the problem.

**Trajectory consistency would have been too strict.** The four successful runs
did not converge on one canonical trajectory or one identical final state. A
test that required them to reproduce the same commands, intermediate files, or
patch structure would have rejected valid solutions. I ran the check to see how
badly: applying the kind of distribution-shift thresholds a behavioral
fingerprint uses — trace length, tool mix, patch size — a composite detector
fires on **all six** pairs of correct runs. Ground truth: none of the six is a
regression.

**Variation cannot simply be ignored either.** The fifth run really was wrong.
"Agents are stochastic" is not an excuse to treat every output as acceptable,
and a design that merely tolerates difference would have passed it.

The useful distinction was not whether the trajectories matched. It was whether
the resulting work satisfied the task contract.

> Behavioral fingerprints can describe *how* an agent changed, but task outcomes
> must decide *whether* the change is a regression.

Trace similarity may still be valuable. A sudden increase in repeated tool
calls, malformed actions, recovery loops, or unnecessary steps can help explain
a failure. But these measurements should not silently become release gates
unless the user has explicitly declared them part of the product contract.

Otherwise an observability signal becomes an accidental definition of
correctness.

## Sometimes the comparison itself is invalid

A second experiment exposed a different failure mode.

I attempted to continue archived agent trajectories on a new GPU host. The model
identifier, model revision, vLLM version, CUDA version, prompt, and scaffold
were held constant. The original trajectories had been generated on an A100
system; the new host used an H100.

Before running the full continuation experiment, I registered a serving-stack
behavioral compatibility check. At each archived fork point, the new host was
asked to generate the next action from the frozen prefix.

There were 24 distinct fork roots. One could not be compared because the
original malformed response had not been preserved, leaving 23
archived-comparable roots.

The result was unambiguous:

- Raw responses matched on **0 of 23** roots.
- Structured actions matched on **0 of 23** roots.

In some cases both systems performed broadly similar exploration using different
commands. In others the difference was categorical — the archived agent was
writing a patch while the new host was still reading source code:

```text
B_0 @ h=16   archived  find /testbed -path "*test*" -name "*.py" -exec grep -l "caplog" ...
             new host  find /testbed -path "*testing*" -name "*.py" -type f ...

A_3 @ h=24   archived  cat > /tmp/fix_clear2.py << 'EOF' ...
             new host  sed -n '685,700p' /testbed/src/_pytest/logging.py
```

It would have been easy to call this a behavioral regression. That would have
been wrong. **The agent revision had not changed. The serving environment had.**

The appropriate result was:

```text
INCOMPARABLE — serving fingerprint changed
```

This is more than a reproducibility footnote. Without a comparability state, an
evaluation system is forced to misclassify environmental drift as agent
behavior.

A regression framework for agents therefore needs at least three possibilities:

- the candidate is comparable and did not regress;
- the candidate is comparable and did regress;
- the candidate is not comparable to the baseline.

Treating the third case as a failed test hides the actual cause and encourages
teams to debug the agent when the measurement instrument has moved.

One caveat I want to keep attached to that number: this is **one** stack change
on **one** workload. The GPU, the driver and the kernel path moved together, so
nothing here isolates a cause, and `temperature 0` is not token-level
determinism across execution stacks. What it supports is narrow and sufficient:
a serving-stack change is not safely treated as an ordinary candidate mutation.

## A better decision order

These observations led to the current AgentSeism decision flow.

<figure>
  <img src="/assets/img/agentseism-decision-order.png" alt="A three-step decision flow. Step one, the comparability check, exits to INCOMPARABLE when the serving fingerprint changed, having spent zero candidate trials; otherwise it passes to step two. Step two, the outcome gate, exits to PASS_WITH_CHANGE when no gate is crossed and the trajectory moved but the outcome held, to INSUFFICIENT_EVIDENCE when there is too little valid data — which is not a pass — and to REGRESSION when a gate is crossed. Only REGRESSION continues to step three, trace root-cause analysis, which produces a localised suspect stage." loading="lazy">
  <figcaption><b>Figure 2.</b> Each step can end the check. Only a confirmed outcome regression reaches
  root-cause analysis, and the cheapest check runs first.</figcaption>
</figure>

### 1. Check comparability before running trials

The framework first compares a serving fingerprint containing the execution
properties the user has declared invariant: model identifier and revision,
runtime and dependency versions, GPU and driver, decoding and context
parameters, prompt and scaffold versions, task image digest, evaluator version.

If a required field changes, AgentSeism returns `INCOMPARABLE` **before spending
money on candidate trials**.

This check must happen first, and the reason is not only tidiness. Running a
full evaluation and discovering afterward that the comparison was invalid
converts an inexpensive metadata check into a wasted experiment. Detected first
it costs zero trials; detected last it costs the entire budget for a comparison
nobody can use.

### 2. Ground the verdict in outcomes

For comparable evaluations, the release verdict comes from features defined in a
user contract: task success, evaluator-resolved status, safety violations,
latency or cost limits, tool reliability, completion under a declared step
budget.

Each feature has an explicit role. Some are release gates; others are warnings
or descriptive measurements. **The framework should not decide after seeing the
results which metric mattered** — which is why the contract is declared up front
and hashed into every report.

There is a usability tension here worth naming. A developer should not need to
understand risk difference or paired bootstrap to run a check, but a metric must
not be chosen after the analysis. AgentSeism resolves it by expanding a
three-line contract against versioned defaults into the complete contract that
is actually validated, hashed, and printed. Defaults are fixed in a released
version before anyone sees a number, so a default chosen in advance is not a
metric chosen afterwards — and the report shows every field, including the ones
the author never typed.

Repeated trials are sampled and analyzed at the task level rather than
pretending that multiple runs of one scenario are independent tasks.

### 3. Run trace RCA only after a regression

If the outcome gate detects a regression, traces become useful diagnostic
evidence. Did failures begin after a tool error? Did the agent exhaust its step
budget? Did recovery behavior change? Did a particular stage accumulate extra
retries? Did the candidate stop validating its work?

This is root-cause analysis, not verdict authority.

Keeping RCA off the main decision path has a practical effect: a
suspicious-looking trace cannot turn a passing outcome into a regression unless
the user explicitly placed that trace feature in the contract. In the
implementation the renderer refuses to print RCA output under any verdict other
than `REGRESSION`, because a reader would take it as a reason the merge is
risky.

## Four verdicts, not one score

| Verdict | Meaning |
|---|---|
| `PASS` / `PASS_WITH_CHANGE` | Comparable, and no registered outcome regression. Behavioral change may still be reported. |
| `REGRESSION` | A registered outcome feature crossed its threshold under comparable conditions. |
| `INSUFFICIENT_EVIDENCE` | Not enough valid independent evidence. **This is not a pass.** |
| `INCOMPARABLE` | A required execution or serving condition changed, so a behavioral comparison would mislead. |

The distinction between `PASS_WITH_CHANGE` and `REGRESSION` is central. It lets
a report say: *the agent behaved differently, but the registered product outcome
did not degrade.*

The distinction between `INSUFFICIENT_EVIDENCE` and `PASS` is equally important,
and easier to lose. A small or invalid sample should not become approval merely
because no statistically detectable failure appeared. In practice this row is
the one most likely to be read as safe, so the report states it in words:
*neither safe nor unsafe — do not read this as a pass.*

## What AgentSeism is, and is not

AgentSeism sits between an agent evaluation harness and CI. The harness executes
tasks and records outcomes. AgentSeism applies a predeclared contract, checks
comparability, compares baseline and candidate, and produces a report suitable
for a pull request.

It is not trying to replace domain-specific evaluators. A coding agent still
needs tests or a task grader; a support agent may need policy and resolution
checks; a security agent may need deterministic validation of its actions.

It is also not a generic "agent score". Compressing correctness, cost,
reliability, and trace behavior into one number would erase the distinction the
system exists to preserve — and a single number needs weights, which is how a
severe recovery regression gets averaged away by three healthy metrics.

The intended question is narrower:

> Given this declared contract, is the candidate comparable to the baseline, and
> is there enough outcome evidence to call the change a regression?

## The next test

The current evidence establishes two concrete failure modes:

1. correct agent runs can follow substantially different trajectories;
2. a serving-stack change can make apparently matched evaluations behaviorally
   incomparable.

It does not yet establish how well the complete workflow performs as a CI
method.

To test that, I have preregistered a small pilot using controlled engineering
mutations. It compares a baseline against a reduced agent step limit, and
against a weakened recovery hint following a controlled malformed-action
challenge. Three held-out tasks, three arms, two repetitions per cell —
18 runs. Its purpose is descriptive feasibility, not a general claim about all
agents or tasks.

The experiment was registered before execution: mutation values, task-selection
rules, run order and its hash, timeout handling, cost limits, and the
interpretations allowed for negative or insufficient results. Two of those
deserve mention because they are the parts most easily bent afterwards.

**Obtaining a regression is not a success condition.** If a registered mutation
produces no regression, the null result stands. The mutation is not
strengthened, the tasks are not changed, the threshold is not lowered, and
repetitions are not added to earn one.

**A timeout is not a task failure.** The pilot has a per-run wall-clock cap for
cost control. A run that hits it is censored, not failed — otherwise a budget
rule would manufacture a regression out of long tasks, and long tasks are
exactly what a reduced step limit is hypothesised to affect.

At the time of writing, the real pilot has not been run. That distinction is
deliberate. The framework should not manufacture a regression merely to complete
a demo, and this article should not turn an unobserved result into a product
claim.

## Why this matters

Stochastic systems need regression testing, but they cannot inherit
deterministic testing assumptions unchanged.

Gate on exact behavior, and you reject harmless variation. Ignore behavior
entirely, and you miss real failures. Compare runs produced by different serving
conditions without checking compatibility, and you attribute to the agent what
came from the measurement environment.

A useful Agent CI system therefore needs three separate concepts:

- **Comparability** — are these runs valid counterparts?
- **Outcome regression** — did a user-important result degrade?
- **Diagnosis** — where in the trajectory did the degradation likely arise?

The ordering is the method:

> Comparability first. Outcomes decide. Traces explain.

AgentSeism is an attempt to make that ordering executable rather than leaving it
as evaluation advice.

The project is still early. The most valuable next evidence will not be another
abstract metric. It will be whether developers can declare a small contract, run
a real agent change, and use the resulting report to make a merge decision.

That is the standard the project now has to meet.
