# Generate Standup Set 2 (Week 3)

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

**IMPORTANT**: Sean (emp_003) SKIPS Monday and Tuesday this week. Only 3 updates for him (Wed, Thu, Fri). Total entries = 23.

## Employee Profiles

### Adam Ankeny (emp_001) — Creator Operations Associate
- **KPIs**: Onboard 25 new creators/week, Maintain <24hr creator response time
- **Writing style**: Concise, numbers-forward. Leads with metrics, short sentences. Consistent format daily.
- **Example**: "28 creators onboarded today, already past the 25/wk target. Response time at 18hr avg. Northwind campaign crew fully ramped, no issues. Tomorrow's batch of 32 apps is prepped and ready to go"

### Avery Holmseth (emp_002) — Client Success Manager
- **KPIs**: Renew 4 enterprise accounts this quarter, Drive 15% expansion revenue from existing book
- **Writing style**: Long narrative paragraphs. Buries metrics in prose. Optimistic tone ("great call," "positive energy," "feeling good"). Avoids hard numbers and dates.
- **Example**: "Really great call with Northwind today, super positive energy on the renewal. They love the creative and we're almost locked on extending another year. Petalcrest had a good sync too, strong interest in expanding Q1 budget. Feeling good about both of these"

### Sean Cretti (emp_003) — Performance Marketing Analyst
- **KPIs**: Reduce CAC by 20%, Launch 3 new paid social experiments/week
- **Writing style**: Dry, table-like, numbers-forward. ROAS, CPM, CTR everywhere. No fluff.
- **Example**: "catching up on tue/wed — Petalcrest carousel hit 2.1% CTR, Harborline reels at 12% VTR. Launched third experiment wed, Ridgeway static ads audience test. CPM dropped another 3% on Cinderhouse. Portfolio ROAS 3.2x, CAC down 7% WTD. All three experiments performing"

### Jeff Collard (emp_004) — Sales Development Rep
- **KPIs**: 200 outbound dials/week, 8 qualified meetings booked/week
- **Writing style**: Short, breezy, casual. One-liners. Sometimes forgets to mention meetings booked.
- **Example**: "45 dials today, 5 meetings booked. Northwind referral path converting really well. solid start to the week"

### Hannah Kargman (emp_005) — Product Manager
- **KPIs**: Ship Creator Matching v2 by end of quarter, Run 5 user research sessions/week
- **Writing style**: Thoughtful, qualitative. "Alignment," "blockers," "stakeholder input," "iterating." Rarely commits to dates. Talks process more than output.
- **Example**: "Matching v2 — still aligning with eng on algorithm requirements, speed vs accuracy tradeoff. They're reviewing infra constraints. Ran first user research session this morning with a creator cohort, really valuable feedback. Got another session tomorrow"

## This Week's Performance (Set 2 / Week 3)

Write updates that reflect these performance patterns. Each update MUST contain extractable KPI evidence (specific numbers, status words like signed/stalled/blocked/shipped, progress indicators).

- **Adam (emp_001)**: Rough patch. Platform outage causes onboarding backlog Tuesday-Wednesday (only 10-12 creators/day those days instead of usual 25+). Response time spikes to 28hr mid-week. Recovers Thursday-Friday (back to 25+/day, response time dropping). Monday is normal. He mentions the outage matter-of-factly in his numbers-forward style.

- **Avery (emp_002)**: Mixed signals. Harborline renewal is signed (concrete win, mention it clearly). But Ridgeway is going dark — no response since Tuesday. Avery's updates stay optimistic about Ridgeway ("I'm sure they'll come back," "just busy season for them") even as the silence grows. Classic optimism gap but on different accounts than week 1.

- **Sean (emp_003)**: SKIPS Monday and Tuesday entirely — only posts Wednesday, Thursday, Friday. When he does post, numbers are strong: 3 experiments launched, CAC down 5%. Wednesday post catches up on Mon/Tue activity. Different skip pattern than week 1 (which was Tue/Wed).

- **Jeff (emp_004)**: Both metrics declining. Dials drop to 30-35/day (below the ~40/day needed for 200/week). Meetings only 1-2/day. But his tone is still casual and upbeat — doesn't acknowledge the decline. "Slow day but quality convos" type language.

- **Hannah (emp_005)**: Partial progress. Ships a matching algorithm component mid-week (real concrete deliverable). But a new blocker emerges on the data pipeline integration. Completed 3 research sessions (better than week 1's 2, still below 5 target). Mix of real progress and new obstacles.
