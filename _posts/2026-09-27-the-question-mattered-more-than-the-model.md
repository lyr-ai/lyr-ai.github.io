---
title: "The question mattered more than the model"
description: >-
  Jev, a new "decision model", launched with big claims. Two independent tests point
  somewhere more useful: how you ask changed the result more than which model answered.
image: /assets/img/jev-one-question-vs-five.png
date: 2026-09-27 18:00:00 -0700
---

Jev is a new kind of AI model from a startup called TypeSafe. It doesn't write text. You
give it some input and a few typed questions (pick one of these options, score this,
is this true?) and it returns answers with probabilities.

It launched with big numbers: "193.6x faster", "can't hallucinate". I skipped those and
read the independent tests instead. Two of them, by different people, point the same way:

**How you ask mattered more than which model answered.**

- Asked one broad question ("is this phishing?"), Jev scored 62.6% and a small ordinary
  LLM scored 81.3%. Given the same five narrow questions, both scored 93–95%.
- Asked "which face will this die show?", Jev was 83% confident and right 19% of the
  time. Asked "is it this face?", it said 19%, close to the true 1 in 6.

<figure>
  <img src="/assets/img/jev-one-question-vs-five.png" alt="Slope chart. Asked one question, 'is this phishing?', Jev scores 62.6% and Haiku, a small LLM, 81.3%. Given five narrow questions with weights fitted on 1,000 labelled emails, Jev scores 95.0% and Haiku 93.2%, statistically tied (p = 0.063). A dashed line shows a regex at 91.8%. Jev is about 27 times cheaper and 5 times faster here, at comparable quality." loading="lazy">
  <figcaption><b>Figure 1.</b> Splitting the question moved both models more than switching models did. On this synthetic dataset a regex already reaches 91.8%, and the five questions were written after reading how the dataset was built.</figcaption>
</figure>

## What Jev is

Jev's documentation describes three kinds of question: a **choice** from a list, a
**score** on a rubric, and a true/false question, which returns a probability. Several
questions can go in one request, and each is answered "in parallel and in isolation".
Input costs $0.042 per million tokens, and output is free.

The docs also say how it's meant to be used: "Atomic questions, composed in code." Keep
each question narrow, and combine the answers in your own code.

That advice turns out to be the whole story.

## Where would I use it?

Vercel, which serves Jev through its AI Gateway, draws the line in one sentence: "Choose
Jev for bounded decisions, code for fixed rules, and a generative model for prose." In a
real agent or app, that looks like this:

| Decision point | Jev? | Why |
|---|---|---|
| Route a request or ticket to the right team or agent | Yes | A choice from a known list |
| Review a proposed tool call: run it, or pause for approval | Yes, as one input | A yes/no with a probability; the permission itself stays in code |
| Score a generated answer against stated requirements | Yes | A bounded score |
| Write the reply to the user | No | "Jev does not generate prose"; use an LLM |
| Check a fixed rule, like `balance > 100` | No | Ordinary code is exact and free |
| Decide an open-ended plan or strategy | Probably not | My judgment: it needs reasoning that doesn't reduce to a few fixed options |

The first three rows are uses Vercel lists (alongside prioritizing tickets, categorizing
documents, moderation and choosing which model answers). Vercel also says the guardrail
doesn't replace permissions: "Enforce access rules and required approvals in application
code before executing a tool."

The short version: **use it at bounded decision points, not everywhere you'd use an LLM.**
The tests below show how well it holds up there.

## Test 1: one question or five

An independent benchmark (jev-phishing-bench) ran Jev and Claude Haiku 4.5 on 2,000
synthetic emails, half of them phishing.

Asked the single question "is this phishing?", Jev got **62.6%** right and Haiku
**81.3%**. On that framing, the ordinary LLM clearly wins.

Then the author asked both models five narrow questions (for example, whether the sender
looks generic), and fitted a small logistic regression on 1,000 labelled emails to
combine the answers. Jev reached **95.0%** and Haiku **93.2%**. The benchmark calls that
"statistically tied" (p = 0.063), and Haiku's AUROC was slightly higher.

The biggest change wasn't which model answered. It was how the task was decomposed.

What Jev kept was cost and speed. The benchmark's own summary: "about 27 times cheaper
and 5 times faster than Haiku for signals of comparable quality". That's the real case
for a model like this: it makes asking many narrow questions cheap.

Two caveats the benchmark states itself, and which matter:
- The emails are synthetic, and a plain regex rule already gets **91.8%**.
- The five questions "were written after reading its URL-evasion taxonomy". They were
  designed knowing how this dataset was built.

## Test 2: "which one?" or "is it this one?"

A second independent study (jev-does-not-play-dice) asked Jev about events nobody can
predict, like a fair die roll or a coin flip.

Asked as a **choice**, "which face will it show?", Jev was badly overconfident. Over 400
die rolls its average confidence was **82.9%** and it was right **19.0%** of the time,
about what guessing gives. On coin flips it said **92%** and was right **52%**.

Asked as a **yes/no**, "is it this face?", its answers were much closer to the truth: an
average of **19.2%** for an event with a true probability of 16.7%. It isn't perfect.
For rarer events it drifts high, saying about 15% for something that happens 5% of the
time.

<figure>
  <img src="/assets/img/jev-which-vs-is-it.png" alt="Dot plot. Asked which face a die will show, the model said 82.9% and was right 19% of the time; asked heads or tails, it said 92% and was right 52% of the time. Asked whether a die will show a given face, it said 19.2% against a true 16.7%; for a 1-in-20 event it said 15% against a true 5%." loading="lazy">
  <figcaption><b>Figure 2.</b> Same uncertainty, asked two ways. The confidence you get back depends on the form of the question.</figcaption>
</figure>

So the same model, facing the same uncertainty, gave very different confidence depending
on how the question was framed.

On a real task the picture can be much better: a separate test on 60 hand-labelled
agent tool calls got 91.7% right, and every wrong answer came with confidence below 1.
Confidence depends on the task and on the question. It has to be checked, not trusted.

## "Can't hallucinate" means "can't leave the schema"

TypeSafe says Jev "can't hallucinate". Its own launch post qualifies this: "Our number is
not empirical. Schema matching is guaranteed."

That's the precise meaning. Jev can only answer with the options you gave it. It can't
invent a category or return malformed output. But it can still pick the wrong option,
confidently, as the die shows.

## What I'd take from this

If you use a decision model like Jev:

- **Design questions, not prompts.** Narrow questions combined in code did better than
  one broad one, for both models tested.
- **Its advantage is cost and speed, not accuracy.** On this evidence, it makes the
  decomposition affordable rather than making each answer smarter.
- **Check its confidence on your own labelled data** before acting on it. The form of the
  question changed it.

## What I don't know

- Both studies are small and single-author; one uses synthetic data that a regex handles
  well.
- Nothing here measures production traffic.
- TypeSafe's speed and cost multipliers ("193.6x faster, 444.6x cheaper") are its own,
  from its own workflows, and it says they are "on the higher end of real world gains".
  I haven't used them.

---

*Sources: TypeSafe's launch post and documentation; Vercel's guides "When should you use
Jev instead of a chat model?", "7 practical Jev use cases" and "Where does Jev fit in an
AI agent loop?"; jev-phishing-bench
(github.com/anisselbd/jev-phishing-bench); jev-does-not-play-dice
(github.com/KantaHayashiAI/jev-does-not-play-dice); the tool-call risk benchmark by
webofmike on dev.to. Each number was read on the original page or repository.*
