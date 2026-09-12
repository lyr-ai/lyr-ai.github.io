---
title: "Restoring the code is not resuming the agent"
date: 2026-09-12 14:00:00 -0700
description: >-
  What agent replay taught me about durable execution: checkpoint consistency,
  execution ownership, fencing, and why resume is a continuation rather than a
  replay.
image: /assets/img/recovery-vs-replay.png
repo: lyr-ai/agentseism
series: Agent runtime
entry: "Field note 02"
---

*What agent replay taught me about durable execution.*

While building replay support for
[AgentSeism](https://github.com/lyr-ai/agentseism), I tried to resume two
coding-agent executions from exactly the same repository state. The source
fingerprint matched byte for byte. The executions did not.

One carried a different scratch file. Their message histories were different.
Restoring the repository gave me a state that looked correct according to my
instrumentation, but it was not the same agent execution.

That failure changed how I think about long-running agents. Once an agent
executes tools, modifies an environment, accumulates context, and runs for
minutes or hours — on one fixed task I measured runs from three minutes to
over six hours — recovery stops looking like "reload the prompt and workspace"
and starts looking like a distributed-systems problem.

I had started with a simple question: "How do I save the workspace?" The
experiment forced a harder one: **"What does it actually mean to resume an
agent?"** Following it led quickly into checkpoint consistency, execution
ownership, fencing, idempotency, replay semantics, and external side effects.

## 1. Repository state is only part of agent state

For a coding agent, the repository is an obvious piece of execution state and
one of the easiest pieces to measure objectively. In AgentSeism, tracked source
state is represented using a canonical Git diff, so two executions can be
compared without interpreting model reasoning.

That is what made the pair in the opening measurable in the first place: the
same canonical diff, byte for byte. Everything the diff does not cover —
scratch files, message history — was different. The source code was identical;
the complete execution state was not.

<figure class="wide">
  <img src="/assets/img/agent-execution-state.png" alt="Agent execution state decomposed into message history, tracked repository state, untracked scratch workspace, tool observations, step/token/cost budgets, and external-effect state." loading="lazy">
  <figcaption><b>Figure 1.</b> The repository is one component of agent execution state, not the state itself.</figcaption>
</figure>

The repository is therefore one component of agent state rather than the agent
state itself. **Restoring repository state is not the same as resuming the
agent execution.**

Restore the transcript and the tracked source but drop the scratch files, and
you get an agent whose memory contradicts what it can see: it remembers writing
`repro.py`, reads it back, and is told the file does not exist. What follows is
not a resumed job. It is a confused one.

## 2. A checkpoint is a recoverable boundary

A more useful definition is: **a checkpoint is a recoverable boundary in the
execution state machine.**

For a long-running coding agent, that boundary may include conversation
context, tracked and untracked workspace, tool state, execution step, remaining
token/time/cost budgets, model configuration, and progress of externally
visible operations. The exact schema is application-dependent. The important
property is that the runtime can give a precise meaning to recovery from that
checkpoint.

Restarting a fresh agent from an old Git diff may be useful, but it is a
restart from source state, not a resume of the original execution. The two are
different products, and a runtime should say which one it offers.

## 3. Partial checkpoints are more dangerous than missing checkpoints

Suppose an agent begins creating a checkpoint at step 100. Messages and
workspace are stored, but the worker crashes before tool state is durable.
Restoring the pieces that happen to exist would create a mixed state that never
existed in the original execution.

This is worse than having no checkpoint at all, because it looks legitimate. A
missing checkpoint costs work; a half-written one costs trust, and the failure
surfaces much later as agent behaviour nobody can explain.

A safer design writes checkpoint components as immutable objects first and
publishes a small manifest only after every required component is durable.

<figure class="wide">
  <img src="/assets/img/data-first-pointer-last.png" alt="An agent at step 100 writes messages, workspace and tool-state blobs to an object store; only when all required objects are durable is a checkpoint manifest atomically published as a valid recovery point, otherwise nothing is published." loading="lazy">
  <figcaption><b>Figure 2.</b> Data first, pointer last. Recovery honours committed manifests only; loose blobs are never a checkpoint.</figcaption>
</figure>

Recovery recognizes only a committed manifest. Partially uploaded objects are
harmless orphans until garbage collection or later deduplication. The goal is
to make invalid mixed states impossible to express, rather than merely
detectable after the fact.

This is not two-phase commit. It is the much cheaper pattern — *data first,
pointer last* — that Git uses for objects and refs, and that filesystem
journals and object-store table formats use for the same reason: make the only
mutable thing a single small atomic write.

## 4. Immutable data and execution authority are different problems

Suppose Worker A owns an execution under generation 7. A network partition
causes its lease to expire, and Worker B takes ownership under generation 8.
Worker A may still be alive.

If A finishes uploading an immutable, content-addressed workspace blob, little
harm occurs. What A must not be allowed to do is declare a new recovery point
after it has lost ownership.

This leads to a useful principle: **separate immutable data-plane writes from
ownership-sensitive metadata publication.** Blob writes can be independent;
publishing a checkpoint manifest or advancing the recovery pointer requires the
current fencing generation.

## 5. The architecture naturally splits into a control plane and a data plane

As the recovery requirements accumulated, the control-plane/data-plane boundary
became the architectural abstraction I found most useful.

The **control plane** owns execution intent and authority: job lifecycle,
scheduling, leases, fencing generations, recovery lineage, quota, policy, and
checkpoint publication authority.

The **data plane** performs the work: workers, sandboxes, the agent loop, model
and tool calls, workspace mutation, immutable checkpoint production, and trace
emission.

<figure>
  <img src="/assets/img/control-plane-data-plane.svg" alt="Control plane (job API, durable queue, scheduler, lease/fencing, checkpoint metadata, recovery head) above a data plane (worker, sandbox, agent runtime, tool/effect service, model gateway). Three edges cross the boundary: the scheduler issues a lease with a generation to the worker; the agent runtime writes immutable blobs to the checkpoint blob store from any generation; and the agent runtime publishes a manifest to checkpoint metadata, fenced by generation." loading="lazy">
  <figcaption><b>Figure 3.</b> Control plane and data plane for a durable agent runtime. The blob write is unconditional; the manifest publish is a request the control plane may refuse.</figcaption>
</figure>

Two edges cross the boundary upward, and they are different in kind. The blob
write is unconditional: content-addressed, immutable, harmless from any
generation. The manifest publish is a request that the control plane may
refuse, and refuses whenever the generation is stale.

The distinction is not merely organizational. The data plane is where risky and
failure-prone execution happens. A buggy agent or crashed worker should not be
able to redefine execution ownership or declare an arbitrary checkpoint
authoritative.

**The data plane may produce candidate state; the control plane decides which
state is authoritative.**

## 6. Lease, fencing, and recovery preserve authority

A lease defines time-bounded execution ownership, but it cannot prove that an
old worker has stopped. During a network partition, a stale worker may continue
running even after the control plane has reassigned the job. For a while, two
workers are physically executing the same job.

Fencing therefore protects ownership-sensitive writes. Each assignment receives
a monotonically increasing generation, and durable services reject mutations
from stale generations. The store does the rejecting, not the worker, because a
partitioned worker cannot be trusted to know it has been fenced.

Worker-side self-termination is still useful because it reduces wasted
computation, but it is not the correctness boundary. **Self-fencing is an
optimization; server-side fencing is the correctness boundary.**

The four mechanisms solve different problems, and each catches what the one
above it cannot:

| mechanism | catches | cannot catch |
|---|---|---|
| lease | a dead worker | a live, partitioned one |
| fencing | its writes to our stores | what it already sent outside |
| idempotency | duplicate external effects | providers that cannot deduplicate |
| self-fencing | continued waste | anything, as a correctness claim |

The bottom row is the trap: self-fencing is the only one of the four that is
not a correctness mechanism, and it is the one that looks most like a fix.

## 7. "Latest" is not one thing

Suppose an agent reaches step 120 but its newest durable checkpoint is step
100. The worker crashes, and a replacement resumes from step 100 under a higher
generation. Ownership moved forward while logical execution progress moved
backward. Both statements are correct, and a design with one sequence number
has to lie about one of them.

A runtime should therefore distinguish three orderings, and use each for what
it is for:

- **generation** — who owns execution now. Strictly monotonic. Recovery
  selection uses this first.
- **checkpoint sequence** — which checkpoint within this attempt. Monotonic
  within a generation. Recovery selection uses this second.
- **agent step** — how far this branch has got. *Not* monotonic across
  recovery. Billing and budgets use it; recovery selection never does.

Choosing a recovery point by agent step is how a stale branch gets adopted
because it happened to get further. I prefer **recovery_head** over
`latest_checkpoint`: it means the newest durable recovery point on the
currently authoritative execution lineage, not the largest historical step
number.

The user-facing consequence is small but real: a progress indicator derived
from the recovery head goes `120 → 100` after a recovery, which reads as data
loss for a system that behaved correctly. Report the high-water mark and the
current branch position as two numbers, and do not invent a percentage — an
agent's step count is not distance-to-completion.

## 8. Checkpointing does not make external effects transactional

The control plane can protect state it owns. The external world is harder.

Suppose an agent checkpoints, calls `send_email()`, the provider accepts the
email, and the worker crashes before recording success. A replacement restores
the previous checkpoint. The runtime cannot know whether retrying will
duplicate the message.

No better workspace snapshot removes this ambiguity. A durable runtime
therefore needs a separate effect protocol: write-ahead intent, durable logical
operation identity, effect execution, result commitment, and reconciliation
when the outcome is uncertain.

The write-ahead intent is what turns an unknown into a known unknown. On
recovery, `pending` means *this may or may not have happened* — not a solution,
but the precondition for every one that follows. The cheapest discharge is
often to trade readability for idempotency: embed the operation id in the
message itself, and on recovery search the provider's sent items before
deciding whether to send. Where no read path exists, the tool declares whether
it prefers at-least-once or at-most-once, and for the latter the platform parks
the job for a human rather than guessing.

**Checkpointing recovers computation state; it does not make external side
effects transactional.**

## 9. Recovery and replay can want different observations

Read-only tools avoid duplicate effects but introduce another problem. Suppose
an expensive search returns observation O1 after the last checkpoint, and the
worker later crashes. Re-running the search may cost money and may now return
O2.

Replay asks, "What did the agent observe then?" and usually wants O1. Recovery
asks, "What should the live job observe now?" and may prefer O2.

<figure>
  <img src="/assets/img/recovery-vs-replay.png" alt="An original observation O1 recorded at time t0 feeds two paths: replay, which reproduces historical execution and prefers the recorded O1; and recovery, which continues live execution and asks whether freshness is semantically important — if not, reuse O1; if so, re-observe O2 and record the divergence." loading="lazy">
  <figcaption><b>Figure 4.</b> Replay and recovery can require different semantics for the same observation.</figcaption>
</figure>

For expensive observations, persistence can be decoupled from checkpoint
cadence: record the result at the moment of the call, keyed by its semantic
input, so that a crash does not force a high checkpoint frequency on a system
that did not otherwise need one. Semantic cache identity must include all
result-changing context, including tool version, canonical arguments,
repository revision, and tenant or authorization scope. Omitting authorization
scope can turn a performance optimization into a cross-tenant data leak.

Retention is also part of the contract. Recovery-critical payloads cannot be
sampled away while recovery promises to use them. Observability payloads may
use sampling or tiered retention. Digests can be kept broadly to detect that an
observation changed even when the payload is no longer available.

**If recovery is expected to provide a payload, its retention period is a
correctness property, not merely a storage optimization.**

## 10. Resume is a continuation, not a replay

Everything above restores the starting point. None of it restores the future,
because the next model call is a fresh sample from a system that is not
deterministic.

I measured this directly. Forking continuations from an identically
reconstructed state — same tracked source, same scratch files, same
transcript, temperature 0:

```
14 of 16 continuations reproduced the donor's next three actions exactly
 0 of 15 reached the donor's final state
```

Short-horizon behaviour is near-deterministic; long-horizon behaviour is not.
The checkpoint guarantees the agent restarts from the same state, not that it
does the same thing.

The same applies to a retried model call. A response lost in transit and
re-requested is a new sample, not a repeat — even at temperature 0 the serving
stack does not reproduce itself, and in one batch of 333 model calls, 12 were
sampled more than once because of transport failures alone, one of them six
times. A silent retry does not redo the same work slightly wastefully; it
branches the trajectory, and the trajectory has to record that it did.

Two consequences follow. Idempotency keys cannot be derived from trajectory
position, because the resumed trajectory diverges from the original. And if a
product genuinely needs replay — audit, regression testing — it needs recorded
*outputs*, every tool result and every model response, replayed from the log
instead of re-executed. Replay from recorded outputs, yes; reproduce by
re-execution, no.

## 11. Long-running agents start looking like durable workflows

A short agent can often be retried from the beginning. A two-hour agent cannot.
As runtime increases, so does accumulated context, completed tool work,
modified environment state, external effects, and compute already invested. The
probability of an infrastructure failure during the run also increases.

At that point, durability stops being optional. The system begins to resemble a
durable distributed workflow: a job has an owner, runs in an isolated worker,
advances an agent state machine, produces checkpoints and effects, and may
transfer ownership after failure.

This is why I expect agent infrastructure to borrow increasingly from workflow
engines, distributed schedulers, transactional systems, and sandboxed compute
platforms rather than only from model-serving APIs.

## 12. What I would build next

AgentSeism's current replay and fork infrastructure is experimental rather than
a production runtime. Its purpose is to reconstruct execution states precisely
enough to study agent variation and intervention. But the work suggests a
concrete production direction.

I would make the control-plane/data-plane boundary explicit; make checkpoints
crash-consistent through immutable objects and atomic manifest publication;
route consequential external operations through a guarded effect service;
separate live recovery semantics from deterministic replay; and add stronger
sandbox isolation plus a shared inference layer.

I would then test the design with deliberate failure injection: worker crashes,
network partitions, stale owners, interrupted checkpoint publication, model
timeouts, and ambiguous tool effects.

The key metric would not be whether a resumed agent follows exactly the same
future trajectory. Section 10 says it will not. The stronger durability
question is whether the system can resume from a well-defined state without
corrupting execution, duplicating consequential effects, or losing information
required for correctness.

## Conclusion

I started with what looked like a small implementation task: reconstruct an
agent at a previous step so I could replay and fork its execution. The first
surprise was that restoring the repository was not enough.

Following that observation led naturally into checkpoint consistency, execution
ownership, fencing, idempotency, observation persistence, and recovery
semantics. None of these problems are unique to AI, but agents combine them in
an unusual way because they mix long-running computation, stochastic model
calls, mutable environments, and potentially irreversible tools.

The mental model I now use is simple:

**An agent checkpoint is not a saved workspace. It is a durable boundary in an
execution state machine.**

Once an agent becomes long-running enough to deserve recovery, that distinction
matters.
