---
title: "When your AI supplier becomes your competitor"
description: >-
  Harvey is growing fast between frontier labs moving up into legal software and legal
  incumbents moving down. Its answer so far isn't to replace its model suppliers: it's to
  own more of the layer between models and legal work. Is that enough?
series: AI companies
image: /assets/img/harvey-supplier-and-competitor.png
date: 2026-09-27 20:00:00 -0700
---

Harvey sells AI to lawyers. It's one of the most valuable application companies built on
top of frontier models: in September 2026 it raised $550M at a $15.5B valuation, and its
co-founder said it had crossed $400M in annual recurring revenue.

This year, the companies whose models Harvey builds on started selling legal AI too.
Anthropic released its first legal plugin at the end of January and expanded it into Claude
for Legal in May. In September OpenAI released Astra for Law, a version of its newest model configured for
legal work.

So Harvey's suppliers are becoming its competitors. Yet Harvey's reported ARR continued to
rise sharply. And in the same period, rather than replacing the labs, Harvey has been
investing in more of the layer between their models and legal work: benchmarks,
post-trained models, workflows, and people inside law firms.

This piece looks at how Harvey got here, where it sits, and what its valuation assumes.
The question it ends on is whether owning more of that layer is enough.

## How Harvey got here

<figure>
  <img src="/assets/img/harvey-timeline.png" alt="Timeline from November 2022 to September 2026 in four lanes. Product: assistant on GPT-4, Vault, agents, multi-model, Shared Spaces; below the app layer, a custom model with OpenAI in 2024, then in 2026 an open benchmark (LAB), post-training projects and Tenet (research preview). The labs in legal: nothing before 2026, then a Claude legal plugin in January, Claude for Legal in May, Astra for Law in September. Reported ARR: more than $50M in February 2025, more than $100M in August 2025, $190M in January 2026, more than $400M in September 2026. Valuation: $0.7B, $1.5B, $3B, $5B, $8B, $11B, $15.5B." loading="lazy">
  <figcaption><b>Figure 1.</b> In 2026, three things moved at once: the labs entered legal, Harvey started building below the application layer, and its revenue grew fastest.</figcaption>
</figure>

For its first three years, Harvey's product remained primarily an application layer built on
other companies' foundation models.
It started as a legal assistant on GPT-4, added a document store (Vault), then agents and
workflows. In 2025 it went from one model provider to several, adding Anthropic's and
Google's models alongside OpenAI's.

Its business grew quickly. The company reported more than $50M in ARR in February 2025,
more than $100M that August, $190M in January 2026, and more than $400M in September 2026.
Each new round was priced higher: $3B, $5B, $8B, $11B and now $15.5B, all within about 19
months.

2026 is where the lanes line up. The labs had no legal products before this year; by
September both Anthropic and OpenAI had one. In the same months Harvey did things an
application company usually doesn't:

- it open-sourced a legal benchmark (LAB) in May;
- it ran post-training projects on open-weight models with partners from May to August;
- in August it released Tenet, "our first post-trained open-weight model", as a research
  preview.

The timing is striking, but it doesn't show Harvey was reacting to the labs. Harvey also
tends to disclose its ARR around funding rounds, so the business lane is partly what the
company chose to announce.

## Where Harvey sits

<figure>
  <img src="/assets/img/harvey-supplier-and-competitor.png" alt="Layered map. Top layer, models: OpenAI and Anthropic, open-weight bases (Kimi, GLM, Qwen), RELX/LexisNexis legal content. Middle layer, legal AI products: Harvey, Legora, Thomson Reuters. Bottom layer: law firms and legal teams, and in-house builds such as Freshfields on Claude. The labs supply models to Harvey, host Harvey as a plugin in ChatGPT, and sell legal products (Claude for Legal, Astra for Law) directly to law firms. Harvey sells seats and deployment to law firms. Harvey's LAB benchmark and Tenet research preview are drawn dashed. Legora and Thomson Reuters compete for the same customers; RELX licenses content to Harvey." loading="lazy">
  <figcaption><b>Figure 2.</b> The same labs play three roles around Harvey. Other competitors enter from different layers.</figcaption>
</figure>

The unusual part isn't that frontier labs compete with Harvey. It's that the same companies
now stand in three places around it at once.

**They supply its models.** Harvey's own benchmark writing describes a version of its
Assistant as "built primarily on GPT-5". OpenAI says Astra for Law will be "available soon
to API customers, including Harvey and Legora". Harvey's newest capabilities will partly
come from the same company that competes with it.

**They host it.** Alongside Astra, OpenAI launched legal plugins for ChatGPT, "26 from
vendors such as Thomson Reuters, Harvey, Legora and iManage". Harvey is now also something
you can reach from inside a lab's product.

**They sell to its customers.** Anthropic's Claude for Legal comes with legal plugins and
connectors for specific areas of law. Astra for Law is offered first to selected large
firms. Freshfields has deployed Claude across the firm and is co-building legal workflows
with Anthropic.

Around that centre, the pressure comes from other directions:

- **Legora**, another AI-native legal startup, is valued at $5.55B after its spring round,
  with more than $200M in ARR reported this month.
- **Thomson Reuters** (CoCounsel, Westlaw) and **RELX/LexisNexis** own the legal content
  and the distribution lawyers already pay for. RELX's LexisNexis also licenses content into
  Harvey.
- **Large firms can build their own.** Freshfields is working directly with Anthropic, and
  Kirkland & Ellis has reportedly committed to its own platform with Palantir.

## What Harvey actually owns

Judging by what Harvey sells and where it is hiring, it still looks primarily like an
application and deployment company:

- **Customers.** The co-founder says Harvey has more than 3,000 customers, including 80% of
  the top 100 US law firms, 20% of the Fortune 500 and half of the Fortune 10. How many of
  those are firm-wide deployments isn't disclosed.
- **Workflow product.** Assistant, Vault, agents and collaboration features. That's the
  part lawyers use every day.
- **People inside firms.** Of 304 open roles on its job board, 33 are for legal engineers,
  people who deploy Harvey into a firm's work. About six or seven are for research or model
  training.

Below the app, it owns less than the headlines suggest. It hasn't pre-trained a model. Its
post-trained models start from other companies' open weights (Moonshot's Kimi, Zhipu's GLM,
Alibaba's Qwen) and are trained with partners. Tenet is a research preview, and nothing
public shows it serving production traffic. Its benchmark is open, and its gains are
measured on that benchmark.

Harvey does give reasons for going down the stack. On its own benchmark, "reaching the top
of the closed-source leaderboard runs to roughly $50 per task and over 20 minutes of
latency", and frontier models complete "less than 10% of tasks end-to-end". Open-weight
models "can be hosted within a firm's own secure cloud environment". After the latest round,
its co-founder said the company would invest "heavily in both its harness and its own model
training".

So the honest description today is an application company with a growing bet below the
application layer. The bet is not yet a business.

## What investors are pricing in

<figure>
  <img src="/assets/img/harvey-valuation-multiples.png" alt="Dot plot on a log scale of valuation divided by revenue. Harvey by round: at most 60 times in February 2025, 50 to 67 times in June 2025, about 42 times in December 2025, about 58 times in March 2026 (denominator from an earlier date), at most 39 times in September 2026. Legora: about 55 times in spring 2026, about 42 times in reported September talks. Thomson Reuters and RELX: 5.4 to 5.8 times EV/Sales for the whole company. Not directly comparable: shown for the scale of expectations." loading="lazy">
  <figcaption><b>Figure 3.</b> Private legal-AI companies are valued at roughly 40–60 times reported revenue; the incumbents at about 5–6 times sales. The two aren't directly comparable; the gap shows how different the expectations are.</figcaption>
</figure>

At $15.5B and more than $400M in ARR, Harvey is valued at no more than about 39 times its
recurring revenue. That's lower than at its earlier rounds, because reported ARR grew faster
than the valuation, but it's still far from the incumbents. Thomson Reuters and RELX trade at
roughly 5–6 times their sales. Legora sits in the same range as Harvey.

These numbers measure different things (a private round's valuation against reported ARR,
against a public company's enterprise value over a year of total revenue), so the
comparison isn't precise. What it shows is scale: the multiples imply expectations very
different from those attached to mature legal-information businesses.

That leads to the useful question. It isn't "is Harvey worth $15.5B?" but **what has to
become true for Harvey to grow into these expectations?**

## Three paths

The evidence supports three plausible directions. None of them is decided, because the
numbers that would decide them (margins, retention, and whether Harvey's own models carry
real traffic) aren't public.

**1. A vertical intelligence layer.** Harvey's own benchmark, models and data become the
reason firms stay.
- *Must become true:* its own models serve a meaningful share of production work, and that
  shows up as better margins or prices; firms pay for firm-specific models.
- *Breaks it:* the next frontier generation beats post-trained open models at similar cost,
  or firms post-train their own.

**2. The deployment platform on other people's models.** Harvey stays model-agnostic and
wins on workflow, integration and the people it puts inside firms.
- *Must become true:* retention and expansion hold as the labs sell direct, and deployment
  depth grows faster than the labs' own legal offerings.
- *Breaks it:* firms standardise on a lab plus an internal platform, as Freshfields is doing
  with Anthropic, or usage pricing compresses revenue per seat.

**3. Beyond law.** Harvey becomes a platform for professional services more broadly. It has
bought an asset-management platform and says it works with 125+ asset managers.
- *Must become true:* non-legal revenue becomes a material, disclosed share.
- *Breaks it:* incumbents or the labs own those workflows first. The evidence here is
  mostly announcements.

## What limits every path

- **The technology isn't done.** On Harvey's own benchmark, frontier models complete less
  than 10% of long tasks end to end, and Tenet improves on its base model without getting
  close.
- **The labs move up.** Their legal products, and their models inside competitors'
  products, reduce what an application layer adds.
- **The incumbents move down.** Thomson Reuters and RELX have the content and the contracts
  lawyers already rely on.
- **Customers can build.** The largest firms have the money and, increasingly, the partners
  to do it themselves.

## The open question

We know Harvey has built distribution and revenue quickly. We know it's experimenting
below the application layer. We don't yet know whether owning more of the model stack is
necessary for its business, or even valuable to it.

The open question isn't whether Harvey can build a legal model. It's whether owning more of
the intelligence layer makes the company harder to replace than simply owning the customer
relationship.

## What we know

| Evidence level | Claim |
|---|---|
| Observed | The labs launched legal products in 2026; OpenAI's legal launch includes Harvey both as an API customer and as a ChatGPT plugin; Harvey released an open benchmark and a post-trained model in research preview; far more of its open roles are for legal engineers than for model research |
| Reported | $15.5B valuation; more than $400M ARR and 3,000+ customers (company); earlier ARR points and round valuations; competitors' valuations and ARR |
| Inferred | Harvey is hedging below the application layer rather than replacing its suppliers; the valuation prices in growth very unlike an incumbent's |
| Unknown | Margins, retention, how much work runs on Harvey's own models, what "customer" counts, contract terms with the labs and LexisNexis |

---

*Sources: Anthropic's public knowledge-work-plugins repository (the legal plugin is in its
first commit, 2026-01-29); Harvey's blog (the Tenet research preview; post-training with Baseten; BigLaw
Bench Arena); LawSites on the September 2026 round and on Astra for Law; TechCrunch and
PointBlank on Claude for Legal; Freshfields on its Anthropic partnership; Harvey's job
board (Ashby, read 2026-09-28); public-market multiples as of 2026-09-27. Revenue figures
are company-reported unless marked; where sources disagree, the research traced each figure
to its date and definition rather than picking one.*
