---
title: "Memory is not a list of facts"
date: 2026-09-13 10:00:00 -0700
description: >-
  Four things building long-term agent memory taught me about state:
  confidence is not authority, observation time is not validity time, an
  audit log is not a replayable history, and there may be no universal rule
  for which memory wins.
image: /assets/img/memory-as-state-hero.png
repo: lyr-ai/typedmem
series: Agent memory
entry: "Note 02"
---

<figure>
  <img src="/assets/img/memory-as-state-hero.png" alt="One memory on two time axes. On the valid-time axis, 'lives in San Jose' runs from two years ago to a month ago and 'lives in Seattle' from a month ago onward. On the observed-time axis, the user's original statement two years ago, a model inference last week, and the user's 'I moved a month ago' yesterday. The inference, confidence 0.95 but authority 0.3, bounces off a provenance guard; the user's statement, observed yesterday, sets validity from a month ago." loading="lazy">
  <figcaption><b>Figure 1.</b> Same memory, two axes. The inference is more confident and more recent than the statement it would overwrite — and loses anyway.</figcaption>
</figure>

*What building long-term memory for agents taught me about state.*

When I started building long-term memory for agents, I thought the hard
problem was retrieval. Store memories, embed them, retrieve the relevant ones,
rank them well enough that the agent sees the right context.

That model works — until memory starts changing.

Two years ago, a user said: *"I live in San Jose."* Last week, the model
inferred from a conversation: *"The user lives in Seattle."* Which one should
the system believe?

At first this looks like a retrieval question: retrieve both, let the model
decide. But the moment an agent is expected to hold persistent state across
months, it stops being about retrieval. It is a state-management problem, and
it comes with the questions state-management problems always come with. Who
is allowed to change this? When was it true, as opposed to when did we learn
it? Can we reconstruct how we got here? Does every kind of state change the
same way?

I ran into each of those while building [TypedMem](https://github.com/lyr-ai/typedmem).
Here is what each one changed.

## 1. Confidence is not authority

The San Jose memory came from an explicit user statement. The Seattle memory
came from a model inference, with high confidence, made last week.

A policy that ranks by recency and confidence prefers Seattle. That is
uncomfortable, and the discomfort is the point: the two memories differ on a
dimension neither recency nor confidence measures.

Confidence answers *how sure are we about this claim*. Authority answers *how
entitled is this source to override another*. An explicit statement from the
user and an inference by the model are not interchangeable evidence, however
sure the model is.

So authority became its own guard: a memory with weaker provenance cannot
replace one with stronger provenance. Not folded into confidence, not weighted
into a score — checked first, on its own.

The reverse is deliberately not true. Higher authority does not automatically
win. An old high-authority statement should not overwrite a newer state just
because its source is stronger; the user may well have moved. Authority is a
veto for the weaker side, not a trump card for the stronger one.

The tempting alternative was a single number:

```text
score = a·authority + b·confidence + c·recency
```

It is attractive because it produces one ordering. It also destroys the
meaning of each term. Authority, confidence and time are different kinds of
evidence, and a conflict rule that keeps them separate is slightly more
explicit and much easier to reason about — you can say *why* a memory lost.

## 2. Observation time is not validity time

The original schema had one timestamp, and it was quietly doing three jobs:
when the memory was observed, when its content became true, and where
confidence decay starts. Those coincide often enough that one field seems
fine.

Then: yesterday, the user says *"I moved to Seattle a month ago."*

There are two times now. The memory was observed yesterday; its content has
been true for a month. And the previous state has a natural end: San Jose
stopped being true a month ago, not yesterday.

So a memory carries a validity window, half-open — `[valid_from, valid_to)` —
separate from the observation time. Half-open so that when one state ends and
the next begins at the same instant, exactly one of them is valid.

Two consequences I did not anticipate.

**Future state becomes expressible.** *"Starting October 1, I'll be using
Postgres"* is observed today and valid later. Which forces a rule: filter by
validity *first*, then pick the latest — otherwise a declared future state
shadows the current one merely because its start is later.

**"Unspecified" has to stay unspecified.** For old data with no validity
window, the observation time is the operational fallback. But the storage
keeps the distinction: a missing `valid_from` means *the writer did not say*,
not *the writer said it starts at observation*. That sounds pedantic until
you need to replay history and cannot tell which memories were declared and
which were defaulted.

## 3. History is not replay

The system already had an event log. A replacement produced an event saying
one memory replaced another, with the new version number and a fragment of
the old content. Good for auditing. Useless for reconstruction.

The gap is between *what happened* and *what the state was*. Knowing that
memory 42 was replaced at version 3 does not tell you what memory 42 looked
like before, or exactly what it became. A log of events is a history of
actions; it is not a history of state.

The fix was less clever than I expected. Every state-changing event now
carries the full logical state of the memory before and after. Not a diff —
the whole thing, twice. Creation has no *before*; deletion has no *after*.

That costs storage, and it makes replay boring: walk the events in order,
keep the *after*. No patch language, no dependency on an earlier snapshot, no
ambiguity about nested structure. Boring is the property I wanted.

One rule matters more than the format:

> Replay must not re-run conflict resolution.

Suppose the conflict policy changes six months from now. If replay feeds the
historical inputs through today's policy, the reconstructed past differs from
the past the system actually produced. Replay restores decisions; it does not
reconsider them. The same log, under any current policy, replays to the same
historical state.

That distinction — *restore what was decided* versus *re-decide from the
inputs* — turned out to be the same one I keep meeting in agent runtimes:
replaying a recorded execution and re-executing it are different products,
and a system that blurs them is wrong about both.

## 4. There may be no universal rule for who wins

Once authority and validity were explicit, one more hard-coded assumption
became visible. Under replacement, an incoming memory had to be no weaker than
the existing one on *both* validity start and confidence.

The tempting abstraction was a lexicographic ordering: compare validity start
first, then confidence as a tie-breaker. It is a natural thing to write, and
it quietly changes the semantics. Timestamps rarely tie, so confidence would
almost never be consulted. A newer memory with confidence 0.5 would replace a
day-old one with confidence 0.9. That is *newest wins* with extra steps.

What the rule actually was — and what I kept — is a **conjunctive guard**: to
replace, the incoming memory must be no weaker on *every* listed dimension.
Newer and stronger replaces; newer but weaker is ignored; older is ignored.
The order of the dimensions does not matter, because nothing is being broken
in sequence — every one is checked.

And then the question that made this a per-type decision: should every kind of
memory use the same guard? A deadline may care primarily about the latest
effective state. A biographical fact may require both recency and confidence.
Other memory types will make different trade-offs. These are different kinds
of state, and there is no reason they share update semantics. So which
dimensions guard replacement is declared by the memory type.

With one exception. In TypedMem, authority stays outside that list: a type may
choose which temporal and confidence signals guard replacement, but it cannot
silently disable provenance protection. Letting a configuration quietly turn
off a safety invariant would turn the first lesson back into a suggestion.

## What changed in my mental model

None of these are four features. They are consequences of one decision:
treating memory as state rather than as a collection of documents.

```text
retrieval asks       what is relevant to this query?
memory-as-state asks what do I currently believe, why, since when,
                     who was allowed to change it, and can I reconstruct
                     how I got here?
```

The system has more concepts now than it did — authority, validity, before
and after, per-type guards. On paper that is more machinery. But the
underlying problems existed before the concepts did. A single timestamp did
not remove temporal semantics; it forced three kinds of time into one field.
Ignoring authority did not remove provenance; it let confidence make decisions
it was never designed to make. An audit log without state did not remove the
need for replay; it made replay impossible. The distinction that matters is
not simple versus complex. It is essential versus accidental complexity, and
the test is whether each concept means exactly one thing.

## What I deliberately did not build

Automatic closing of the previous validity window. Ranking by authority.
Compaction and checkpoints for the event log. Migrating history under a new
policy. Rebuilding a store from its log. A general rule language for
resolution.

Some of these will turn out to be needed. None of them has yet, and an
abstraction looks most attractive right before there is evidence for it. So
the contract stops here: memories carry provenance, confidence, observation
time and validity; types declare how replacement is guarded; every mutation
leaves enough behind to reconstruct its result.

The next step is not another rule. It is measuring whether these semantics
actually make agents more reliable. That is a question for a benchmark, not
another design note.
