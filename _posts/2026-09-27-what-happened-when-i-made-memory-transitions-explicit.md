---
title: "What happened when I made agent memory transitions explicit"
description: >-
  New information isn't one memory operation, and memory history isn't
  reasoning history. What running a complete scenario through explicit
  memory transitions taught me about where the memory layer ends.
repo: lyr-ai/typedmem
series: Agent memory
entry: "Note 03"
date: 2026-09-27 12:00:00 -0700
image: /assets/img/memory-transitions-filing.png
---


Two weeks ago, in [From retrieval to state]({% post_url 2026-09-11-from-retrieval-to-state %}),
I argued that long-lived agent memory should be modeled as state and the
transitions between states, not only as retrieval.

Then I implemented those transitions in TypedMem and ran a complete scenario
through them: an agent investigating a production incident. Two things became
clearer than they were in that post.

**First, "new information arrived" is not one memory operation.**

**Second, recording how memory changed is not the same as recording why an agent
changed its mind.** I had blurred that distinction myself.

## One write, several possible meanings

An operations agent is investigating why clients can't connect to a logging
service. Information arrives from runtime telemetry, support cases, a
certificate validation system, and later telemetry.

The scenario uses three kinds of memory, each with its own transition rule:

| Memory type | When another record hits the same subject |
|---|---|
| `evidence` | **reinforce**: one record, more sources |
| `assessment` | **flag**: keep both, mark them as conflicting |
| `decision` | **supersede**: keep the old one in history, the new one is current |

Here is what happened in the run:

- **Telemetry** reports that certificate errors are associated with the
  failures, and the agent stores it as `evidence`. **Support cases** report the
  same thing. TypedMem doesn't create a second record: it keeps **one record
  with two sources**, and its confidence rises from 0.60 to 0.72.
- **The agent** stores its own `assessment`: the certificate is causing the
  failures. **The validation system** reports that the certificate is valid,
  stored as an `assessment` on the same subject. Both are kept and marked as
  conflicting. The conflict **stays open**: nothing later resolves it, and the
  memory layer doesn't pretend otherwise.
- **The agent decides** to investigate the certificate. Later, telemetry shows
  that failures correlate with lost connectivity to the logging service, and the
  agent revises its decision. The new decision **supersedes** the old one: the
  old one stays in history, and only the new one is current.

<figure>
  <img src="/assets/img/memory-transitions-filing.png" alt="New information arrives and the application files it by type and subject; TypedMem doesn't read the text. Filed as evidence, it reinforces: one record with two sources (telemetry, support), confidence 0.60 to 0.72. Filed as an assessment, it is flagged: the agent's 'causing it' and validation's 'it's valid' are both kept, marked as conflicting, still unresolved. Filed as a decision, it supersedes: the connectivity decision is current and the certificate decision is kept as history. Below, the wrong turn: the same 'certificate is valid' filed as evidence is merged as a second supporting source, one record, confidence 0.60 to 0.72, no conflict." loading="lazy">
  <figcaption><b>Figure 1.</b> The same input can become a conflict or support, depending on how the application files it.</figcaption>
</figure>

### TypedMem didn't discover any of these relationships

The text never decided anything. I did, when I told the system which kind of
memory each piece of information was:
- telemetry and support cases are `evidence`;
- the two judgments about the certificate are `assessment`s about the same
  subject;
- the investigation path is a `decision`.

TypedMem then applied the rule each type declares. It doesn't read the text: it
matches records by type and subject, and the type's rule decides what happens.

While writing this I ran the obvious mistake. I filed the validation result as
another `evidence` record on the same subject as the agent's assessment. There was
no conflict. The store kept **one** record, whose text was still "The certificate
is causing client failures". The validation system became its **second
supporting source**, and confidence rose from 0.60 to 0.72. The disagreement
disappeared into agreement.

That isn't a bug in the policy engine. It shows the boundary: **the memory layer
can enforce semantics, but the application has to assign the right semantics
first.**

## Authority is a policy, not the truth

In an early outline of this post I wrote that picking the more trusted source
"silently turns authority into a truth oracle". That was too strong.

Sometimes authority is exactly the rule you want. For TypedMem's replace-style
memory types, a newer record from a weaker source can't displace an existing one
from a stronger source: it is ignored. In an [earlier measurement](https://github.com/lyr-ai/reliagent-bench/blob/measure/states-0.9.3/external/results/states-0.9.3.md),
typed memory with that rule scored 1.00 on the authority cases.

Other kinds of memory want disagreement to stay visible. That's what the flag rule
is for. And evidence wants agreement to accumulate.

```text
        the same incoming information
                     │
                     ▼
       depends on the memory's contract
         ┌───────────┼───────────┐
         ▼           ▼           ▼
       veto         flag      reinforce
```

The point isn't that authority is bad. It's that different kinds of memory need
different transition rules, not one universal resolver of truth.

## What the event log recorded

Every transition is recorded. Grouped by what it means, the run's history is:

1. evidence added (telemetry)
2. evidence reinforced (support cases)
3. assessment added (the agent: the certificate is causing failures)
4. competing assessment stored; both records flagged (validation)
5. decision added (investigate the certificate)
6. evidence added (connectivity)
7. decision superseded (investigate connectivity)

The raw log is more detailed. Flagging and superseding touch both records, so they
write paired events: nine events for these seven steps.

Replaying the whole log rebuilds the store exactly: the same six records. Replaying
only the events before step 7 rebuilds the earlier state, in which the current
decision was still "investigate the certificate".

## Memory history is not reasoning history

This is the part I got wrong.

The main figure of the first post had this caption:

> The important object is not an isolated memory item. It is the transition
> structure that explains how the present emerged from the past.

I would phrase that differently now. Here is what the implementation actually
knows:

| Kind of provenance | Question | Recorded? |
|---|---|---|
| **Source** | Where did this record come from? | Yes |
| **Transition** | What happened to stored memory? | Yes |
| **Reasoning** | Which evidence caused this decision? | Only if the application records it |

The event log can tell me that the connectivity evidence was stored before the
investigation decision changed. It cannot tell me that the evidence **caused**
the change. In the run, the new decision's only source is the agent, and nothing
links it to the evidence.

**Time order is not causal explanation.**

It's tempting to draw the investigation as one chain (telemetry → hypothesis →
conflict → new evidence → decision revised). That drawing would claim knowledge
the system never stored.

Replay has the same boundary. It answers "what did memory contain at this point?",
not "why did the agent decide that?"

<figure>
  <img src="/assets/img/memory-provenance-kinds.png" alt="Three kinds of provenance. Source (where did this record come from?) and transition (what happened to stored memory?) are recorded, as sources on every record and as the event log and replay. Reasoning (which evidence led to this decision?) is not recorded unless the application writes it. Below, steps 6 and 7 of the run: evidence added (failures correlate with lost connectivity), then the decision superseded (investigate connectivity), with no link stored between them. Time order is not causal explanation." loading="lazy">
  <figcaption><b>Figure 2.</b> Two of the three are recorded. Steps 6 and 7 are adjacent in the log, but nothing links them: the new decision's only source is the agent.</figcaption>
</figure>

## Where the memory layer ends

I started with the idea that long-lived memory needs explicit state
transitions. Implementing it made the boundary sharper:

- **The application assigns meaning.**
- **The memory layer enforces the declared transition.**
- **The event log records what changed.**
- **None of these, by itself, records why the agent reasoned from A to B.**

That leaves the question I don't know the answer to yet. How much decision
provenance belongs in a general memory layer? Should links from evidence to
decisions be first-class memory structure, or stay application-specific?

If you've built long-running agents and had to answer "why did it decide
that?", I'd like to know where you ended up putting that link.

---

*The scenario is a runnable example,
[`examples/incident_investigation.py`](https://github.com/lyr-ai/typedmem/blob/main/examples/incident_investigation.py).
It uses TypedMem's public API, and a test pins its output, so the run described
here is the run you get.*
