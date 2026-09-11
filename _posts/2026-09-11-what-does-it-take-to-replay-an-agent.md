---
title: "What does it take to actually replay an AI agent?"
date: 2026-09-11 15:00:00 -0700
description: >-
  Saving the prompt and the code is not enough. Reliable replay requires
  reconstructing the execution state the agent actually carried — tracked
  source, workspace artifacts, carried history, and a coherent resume point.
image: /assets/img/replay-hero.jpg
repo: lyr-ai/agentseism
series: Agent runtime
entry: "Field note 01"
math: true
---

<figure>
  <img src="/assets/img/replay-hero.jpg" alt="Three runs with an identical tracked diff hash but different scratch files; restoring one run's diff under another run's history produces a message referring to a file that does not exist." loading="lazy">
  <figcaption><b>Figure 1.</b> Restoring the diff restores the files. It does not restore the execution.</figcaption>
</figure>

## Abstract

Replaying an AI agent sounds straightforward: save its conversation, restore the
repository, and continue execution from the same point. In practice, I found
that this is not enough.

While building controlled replay and fork experiments for
[AgentSeism](https://github.com/lyr-ai/agentseism), I needed to reconstruct
coding-agent executions at an intermediate state and continue them under
different experimental conditions. The requirement was stronger than ordinary
tracing: a restored execution had to represent the same state that the original
agent actually experienced.

This exposed several subtle problems. Repository state and agent state are
different. Tracked source files and scratch workspace artifacts have different
lifecycles. An environment step is not necessarily an agent step. A checkpoint
can pass a source-state validation while silently losing files that later model
messages refer to.

The resulting lesson is simple:

> **A trace tells you what happened. A replayable checkpoint must contain enough
> state to make the execution continue coherently.**

This post describes what that required in practice, and proposes a minimal model
for replayable long-running agents.

## 1. Why replay matters

Replay becomes useful as soon as an agent does more than answer a single prompt.

A long-running coding agent may inspect files, create reproduction scripts,
modify source code, run tests, reject hypotheses, and accumulate observations
over dozens of model calls. When such an execution fails, we often want to ask
whether the failure can be reproduced, when the execution first became
recoverable or unrecoverable, whether a different intervention from an earlier
point would have changed the result, or whether a production incident can be
resumed after infrastructure failure.

All of these require something stronger than logging.

```text
A conventional trace provides        A replayable execution requires

messages                             messages
tool calls                           tool calls
observations                         observations
timestamps                                  +
                                     environment state
                                     workspace artifacts
                                     source state
                                     execution boundary
                                            ↓
                                     coherent continuation
```

The difference became concrete when I tried to fork two agent executions from
the same repository state.

## 2. Same source state is not same agent state

In one repeated SWE-bench experiment, several independent executions reached
exactly the same tracked repository state. The canonical Git diff was identical.
Their workspaces were not.

Different runs had independently created scratch files such as:

```text
Run A    test_repro.py
Run B    reproduce_issue.py
Run C    repro.py
```

Their message histories also differed, because each execution had taken a
different investigative path.

If I reconstructed only the Git diff from Run A but resumed using Run B's
conversation, the restored agent might contain a message saying "I created
`reproduce_issue.py`. Let's inspect its output." while `reproduce_issue.py` did
not exist.

The source-state hash would still be correct. The replay would still be wrong.

<figure class="wide">
  <img src="/assets/img/replayable-checkpoint.png" alt="Agent state at step t decomposed into tracked source, workspace, history and execution boundary, all feeding a replayable checkpoint that enables a coherent continuation." loading="lazy">
  <figcaption><b>Figure 2.</b> Source state is only part of replay state.</figcaption>
</figure>

This distinction matters beyond coding agents. Any agent that modifies an
external environment can carry state outside its transcript.

## 3. A minimal replayable checkpoint

For the AgentSeism experiment, I ended up separating the checkpoint into three
state layers.

**Source state.** The tracked repository modifications are stored as a canonical
diff and independently fingerprinted:

$$S_t = H(\text{canonical tracked diff}_t)$$

This answers a narrow but useful question: are two executions looking at exactly
the same tracked source modifications?

**Workspace state.** The source fingerprint deliberately excludes untracked
artifacts, because scratch files and source changes mean different things
analytically. Replay, however, cannot ignore them. I therefore archive the
untracked workspace separately and fingerprint it too. That gives two checks
rather than one:

```text
tracked_diff_hash      → what source changed?
workspace_diff_hash    → what execution artifacts exist?
```

Keeping these separate turned out to be more useful than collapsing everything
into one hash.

**Carried context.** Finally, the agent needs the message prefix it had actually
accumulated at the checkpoint, including observations generated by previous tool
calls. The replay system records both the prefix and a digest, so a continuation
can verify it received the exact archived context rather than another history of
the same length.

The resulting checkpoint looks conceptually like:

```text
Checkpoint(t)
├── tracked.diff
├── tracked_diff_hash
├── untracked.tar
├── workspace_fingerprint
├── messages.json
├── messages_digest
└── execution metadata
```

This is not a universal agent-state schema. It is the minimum state required for
the coding-agent environment I was trying to reconstruct — and that
qualification is the point: **replay state should be defined by the
environment's causal surface, not by a generic list of fields.**

## 4. The hardest bug: an agent step is not an environment step

One of the less obvious implementation problems came from the meaning of a
"step."

An assistant message can contain multiple tool actions. The environment may
therefore transition several times before the agent receives another observation
and produces its next message. If a checkpoint is taken between two actions
belonging to the same assistant turn, the archived conversation may end with an
assistant message rather than an observation. Resuming from that point can
effectively ask the agent to speak twice.

```text
Agent turn A
     │
     ├── action 1
     │      ↓
     │     S₁      observable ✓   resume ✗
     │
     ├── action 2
     │      ↓
     │     S₂
     │      ↓
     └── observation
            ↓
        checkpoint S₂   observable ✓   resume ✓
            ↓
       Agent turn B
```

The intermediate checkpoint represents a valid environment state, but not a
valid **agent continuation boundary**. This forced a distinction between
**observable state** and **coherent fork point**: a state can be useful for
trajectory measurement without being safe to resume from.

In the implementation, message history is therefore archived only at coherent
agent boundaries, while environment states can still be recorded after every
action. It sounds like a small piece of bookkeeping. Without it, a replay
experiment silently changes the protocol being studied.

## 5. Replay must be validated without the model

Another lesson: the model should not be used to test whether replay
infrastructure works.

Before spending inference on a fork experiment, I built a zero-model replay
validation. Given an archived execution, the validator reconstructs the
checkpoint in a fresh container and verifies that the reconstructed state
matches the original archive. For two experimental arms sharing the same tracked
source state, it looks like this:

```text
                 Shared source state S
                      400ed4047a82…
                    ╱              ╲
              Arm A                  Arm B
          workspace A              workspace B
          history A                history B
               │                        │
               ▼                        ▼
        fresh container          fresh container
               └──────────┬─────────────┘
                          ▼
                  validate invariants
```

The gate checks that the tracked source fingerprint equals the intended shared
state, that each workspace fingerprint equals its archived donor, that each
message prefix matches its archived digest, and that the checkpoint is a
coherent continuation boundary. Only after all of those pass does a model
continuation become scientifically meaningful.

The principle generalizes beyond research:

> **Infrastructure determinism should be validated independently from model
> behavior whenever possible.**

Otherwise a failed replay gets attributed to model stochasticity when the actual
problem is missing state.

## 6. Replay and re-execution are different

Several distinct operations get called "replay."

**Trace playback** displays recorded events and requires almost no
reconstruction. **Re-execution** starts the original task again with the same
configuration, which measures reproducibility from the beginning but restores no
intermediate state. **Environment replay** reconstructs the sequence of external
state transitions produced by recorded actions. **Agent continuation** restores
an intermediate execution state and asks the model to continue from there.
**Counterfactual fork** restores the same controlled state several times while
deliberately changing one component of the carried context or the intervention.

The last two are substantially harder, because their validity depends on the
fidelity of the reconstructed checkpoint.

<figure class="wide">
  <img src="/assets/img/levels-of-replay.png" alt="A progression from trace playback to re-execution, environment replay, agent continuation and counterfactual fork, annotated view, repeat, reconstruct, resume, intervene." loading="lazy">
  <figcaption><b>Figure 3.</b> Levels of replay. The amount of state that must be preserved increases from left to right.</figcaption>
</figure>

## 7. Why this matters for production agents

The immediate motivation was a controlled experiment, but the same problem
appears in production.

Suppose a coding agent runs for forty minutes and the worker disappears. A
system that stored only the original prompt and the current Git diff may
technically be able to restart the task, but it cannot necessarily resume the
execution the agent was performing.

The same applies to customer-support agents, browser agents, research agents and
workflow agents. Their relevant state may include browser tabs, downloaded
files, tool results, intermediate plans, external object identifiers, temporary
credentials, or changes already made to remote systems.

A useful production checkpoint therefore has to answer:

> **What state must be reconstructed so that the resumed agent's next decision
> is conditioned on the same world it previously observed?**

That is a much stronger requirement than persistence. It also suggests that
agent runtimes should make checkpoint boundaries explicit, rather than treating
arbitrary trace events as resumable states.

## 8. From replay to steering

Replay becomes particularly interesting when it is combined with outcome labels.

Suppose repeated executions reveal that an agent is moving toward a region
associated with higher failure probability — the question
[Experiment 01](/agents-diverge-at-temperature-zero/) ends on. If a previous
state can be faithfully reconstructed, the runtime can intervene rather than
simply report the failure afterwards:

```text
observe → checkpoint → predict failure risk → rollback / fork
       → intervene → continue → measure outcome
```

<figure class="wide">
  <img src="/assets/img/replay-to-steering.png" alt="From a running agent to a checkpoint, then rising failure risk branching into control, nudge, rollback with new context and fork alternatives, each measured against an external outcome." loading="lazy">
  <figcaption><b>Figure 4.</b> Replay turns observability into intervention: every arm is measured against an external outcome, including the untreated control.</figcaption>
</figure>

This is why replay infrastructure has become central to the direction of
AgentSeism. The long-term goal is not to reproduce an agent's mistake. It is to
create a controlled point from which alternative futures can be tested.

## Conclusion

I originally thought replaying a coding agent would mostly involve restoring its
conversation and its repository. The implementation forced a more precise
definition.

A replayable agent state is the set of information required to reconstruct a
coherent continuation boundary: not only the artifact being modified, but the
relevant environment state, workspace artifacts, carried observations, and
execution protocol.

The most dangerous replay bugs are not crashes. They are restorations that
appear valid because one fingerprint matches, while another part of the state
was silently dropped.

For long-running agents, the useful distinction is therefore:

> **A trace records the past. A checkpoint preserves a possible future.**

That matters for debugging today, and it matters more if agent runtimes
eventually use replay, rollback and counterfactual forks to steer executions
before they fail.
