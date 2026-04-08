# Generate Standup Set 5 (Week 6)

You are writing fictional daily Slack standup updates for 5 employees at Lumen Collective, a Series C UGC marketplace (180 employees, Los Angeles).

## Output Format

Return ONLY valid JSON — no markdown fences, no commentary. Exactly this structure:

```json
[
  { "employee_id": "emp_001", "day": "Monday", "text": "..." },
  { "employee_id": "emp_001", "day": "Tuesday", "text": "..." },
  ...
]
```

- Day values must be capitalized: "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"
- Plain text only. No markdown, no bold, no headers, no bullet points. Flowing sentences.
- Emojis OK mid-sentence, never as section headers/prefixes.
- Fictional brands ONLY: Northwind Athletics, Petalcrest Beauty, Harborline Foods, Ridgeway Outdoors, Cinderhouse Coffee

**IMPORTANT**: Sean (emp_003) only posts Monday and Friday this week. Only 2 updates for him. Total entries = 22.

## Employee Profiles

### Adam Ankeny (emp_001) — Creator Operations Associate
- **KPIs**: Onboard 25 new creators/week, Maintain <24hr creator response time
- **Writing style**: Concise, numbers-forward. Leads with metrics, short sentences. Consistent format daily.
- **Example**: "31 new creators today. Response time 16hr. Petalcrest creator pool at 94% utilization. Had one QC flag but resolved same-day. Wednesday queue ready — 29 in final review"

### Avery Holmseth (emp_002) — Client Success Manager
- **KPIs**: Renew 4 enterprise accounts this quarter, Drive 15% expansion revenue from existing book
- **Writing style**: Long narrative paragraphs. Buries metrics in prose. Optimistic tone ("great call," "positive energy," "feeling good"). Avoids hard numbers and dates.
- **Example**: "Northwind still pending legal, they keep saying early next week. Frustrating but normal enterprise rhythm. Petalcrest called today and tbh the tone shifted — they're pausing expansion for 'budget realignment' which is new. Still figuring out what changed. Pipeline is solid overall but keeping a close eye on these two, they're our biggest renewal plays"

### Sean Cretti (emp_003) — Performance Marketing Analyst
- **KPIs**: Reduce CAC by 20%, Launch 3 new paid social experiments/week
- **Writing style**: Dry, table-like, numbers-forward. ROAS, CPM, CTR everywhere. No fluff.
- **Example**: "week close — 3 experiments total. Cinderhouse ROAS 3.2x, CPM down 11% WoW, CAC down 7%. Petalcrest carousel best at 2.4% CTR. Harborline reels stable 11% VTR. Ridgeway still in learning phase but early signals positive. Portfolio exceeded 2.8x target. Ready for scaling next week"

### Jeff Collard (emp_004) — Sales Development Rep
- **KPIs**: 200 outbound dials/week, 8 qualified meetings booked/week
- **Writing style**: Short, breezy, casual. One-liners. Sometimes forgets to mention meetings booked.
- **Example**: "48 dials, 4 meetings — Petalcrest, Harborline, Ridgeway, plus a net-new. locked in"

### Hannah Kargman (emp_005) — Product Manager
- **KPIs**: Ship Creator Matching v2 by end of quarter, Run 5 user research sessions/week
- **Writing style**: Thoughtful, qualitative. "Alignment," "blockers," "stakeholder input," "iterating." Rarely commits to dates. Talks process more than output.
- **Example**: "Another sync with eng on the matching algorithm, they want more clarity on weighting before committing sprint capacity. Iterating on requirements, should have stakeholder input by Wednesday. Ran second research session with a brand client, good insights on creator filtering"

## This Week's Performance (Set 5 / Week 6)

Write updates that reflect these performance patterns. Each update MUST contain extractable KPI evidence (specific numbers, status words like signed/stalled/blocked/shipped, progress indicators).

- **Adam (emp_001)**: Peak week — personal best. 30-35 creators/day, response time 14-16hr. Highest and most consistent numbers across all weeks. Clean, confident updates. Everything clicking. Mentions multiple brands being fully staffed.

- **Avery (emp_002)**: Worst week. Harborline churns — confirmed lost (use words like "decided not to renew," "lost the account"). Petalcrest expansion falls through due to "budget freeze." Her updates STILL try to spin positive early in the week but the language cracks by Thursday/Friday: "still processing," "unexpected," "tough call." The optimism facade breaks down under real bad news. She tries to pivot to talking about pipeline and other accounts but the losses are significant.

- **Sean (emp_003)**: Submission collapse — ONLY posts Monday and Friday. Three missing days (Tue, Wed, Thu) is the most severe cadence violation. The numbers on the 2 days he posts are decent (ROAS around 3.0x, mentions 2 experiments), but the missing days are the main issue. Monday post is a normal start-of-week update. Friday post wraps up the week.

- **Jeff (emp_004)**: Strong close — best meeting week. Dials solid at 45-50/day. Meetings are genuinely high: total of 8-10 across the week. His confident casual tone is actually backed by real results this time. Mentions specific account names and conversions. "Crushed it" energy that's earned.

- **Hannah (emp_005)**: Shipped milestone. v2 beta launched on Wednesday — concrete shipping language ("pushed to production," "beta is live," "deployed"). Completed 4 research sessions. Minor bugs mentioned Thursday/Friday but clear forward progress. The tone shifts from her usual process-heavy language to outcome-heavy: things are actually shipping. Still thoughtful in style but content is about deliverables, not alignment.
