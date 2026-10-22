# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Engineering managers and tech leads** look at where their team's PRs stall (pickup, review, deploy) and decide what to change, typically in a regular team review.
- **Developers** check their own and their team's open PRs and review queue day to day (Review Stacks, the per-person workload page).
- **TechTalk consultants** use the same screens with client teams while supporting their development-process improvement, putting the data in front of the team to discuss it.

## Product Purpose

Upflow reads pull request data from GitHub and shows how long work takes to get from first commit to production: coding, pickup, review, and deploy time, plus throughput, open-PR inventory, and review workload. Success is a team that can see where time goes and agree on a concrete change to how they work.

## Positioning

Upflow is provided to the clients of TechTalk's development-organization support, not sold as a standalone SaaS. The numbers are a starting point for a conversation the consultant and the team have together, so the product cares about what to do after seeing a number (`docs/practices/` maps metrics to established practices), not only about the number.

## Operating Context

- Each client organization has its own space at `upflow.team/<org>`, backed by its own SQLite database.
- PR data arrives from an hourly crawl and from GitHub App webhooks, so it can be up to an hour behind GitHub.
- Org admins manage repositories, teams, the GitHub integration, and PR filters. Members view the dashboards.
- Users are Japanese teams; member names and PR titles are often in Japanese.

## Capabilities and Constraints

- Screens: Review Stacks and per-person workload, throughput (ongoing / merged / deployed), cycle time, review bottleneck, open-PR inventory, PR size feedback, and settings.
- PRs are classified by rule into normal / release / template merge / dependency. Dashboards count normal PRs by default and say how many PRs are hidden and why.
- Admins can register title and source-branch patterns to hide PRs from dashboards.
- PR size is classified by an LLM (Gemini); users can correct it.
- **UI language:** English for now. Japanese text appears only as data (names, PR titles). Japanese/English switching (i18n) is planned but not built; until then new UI copy is written in English, not mixed. Some older strings in Japanese (e.g. parts of the PR popover and error messages) are leftovers, not the rule.
- The repository is public: customer names, org slugs, and customer-derived numbers must not appear in code, docs, or UI fixtures (`docs/agent-rules/confidentiality.md`).

## Evidence on Hand

- `docs/practices/`: vendor-neutral write-ups of PR flow, code review, delivery, and DORA / SPACE / DevEx metrics that the product refers to.
- `docs/rdd/`: requirement and design docs per issue.
- No public testimonials, case studies, or customer metrics may be quoted; client data is confidential.

## Product Principles

1. **Structure, not blame.** Show where work stalls as a property of the team's flow, so it can be discussed without singling people out.
2. **Every number leads to an action.** A metric earns its place when it points to something a team can change.
3. **Say what is excluded.** When the dashboard hides PRs (by type, draft, or filter), it shows how many and why, and lets the viewer undo it.
4. **Trustworthy over clever.** Prefer rules a user can predict and check (e.g. seeing a PR's branch) over opaque scoring.
