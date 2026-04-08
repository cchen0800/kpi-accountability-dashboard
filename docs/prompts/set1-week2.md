# Generate Standup Set 1 (Week 2)

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
- All 5 employees, all 5 days each = 25 entries total
- Plain text only. No markdown, no bold, no headers, no bullet points. Flowing sentences.
- Emojis OK mid-sentence, never as section headers/prefixes.
- Fictional brands ONLY: Northwind Athletics, Petalcrest Beauty, Harborline Foods, Ridgeway Outdoors, Cinderhouse Coffee

## Employee Profiles

### Adam Ankeny (emp_001) — Creator Operations Associate
- **KPIs**: Onboard 25 new creators/week, Maintain <24hr creator response time
- **Writing style**: Concise, numbers-forward. Leads with metrics, short sentences. Consistent format daily.
- **Example** (for tone only): "28 creators onboarded today, already past the 25/wk target. Response time at 18hr avg. Northwind campaign crew fully ramped, no issues. Tomorrow's batch of 32 apps is prepped and ready to go"

### Avery Holmseth (emp_002) — Client Success Manager
- **KPIs**: Renew 4 enterprise accounts this quarter, Drive 15% expansion revenue from existing book
- **Writing style**: Long narrative paragraphs. Buries metrics in prose. Optimistic tone ("great call," "positive energy," "feeling good"). Avoids hard numbers and dates.
- **Example**: "Really great call with Northwind today, super positive energy on the renewal. They love the creative and we're almost locked on extending another year. Petalcrest had a good sync too, strong interest in expanding Q1 budget. Feeling good about both of these"

### Sean Cretti (emp_003) — Performance Marketing Analyst
- **KPIs**: Reduce CAC by 20%, Launch 3 new paid social experiments/week
- **Writing style**: Dry, table-like, numbers-forward. ROAS, CPM, CTR everywhere. No fluff.
- **Example**: "Cinderhouse ROAS 3.2x (target 2.8x), CPM down 8% WoW. Launched 2 experiments — Petalcrest carousel ads at 1.8% CTR early, Harborline video reels looking strong on engagement. CAC down 4% vs last week. One more experiment pending creative review"

### Jeff Collard (emp_004) — Sales Development Rep
- **KPIs**: 200 outbound dials/week, 8 qualified meetings booked/week
- **Writing style**: Short, breezy, casual. One-liners. Sometimes forgets to mention meetings booked.
- **Example**: "45 dials today, 5 meetings booked. Northwind referral path converting really well. solid start to the week"

### Hannah Kargman (emp_005) — Product Manager
- **KPIs**: Ship Creator Matching v2 by end of quarter, Run 5 user research sessions/week
- **Writing style**: Thoughtful, qualitative. "Alignment," "blockers," "stakeholder input," "iterating." Rarely commits to dates. Talks process more than output.
- **Example**: "Matching v2 — still aligning with eng on algorithm requirements, speed vs accuracy tradeoff. They're reviewing infra constraints. Ran first user research session this morning with a creator cohort, really valuable feedback. Got another session tomorrow"

## This Week's Performance (Set 1 / Week 2)

Write updates that reflect these performance patterns. Each update MUST contain extractable KPI evidence (specific numbers, status words like signed/stalled/blocked/shipped, progress indicators).

- **Adam (emp_001)**: Slight dip week. Response time creeps up to ~22hr (still under 24hr target but higher than usual). Onboarding still solid at ~23-26 creators/day. Mention different brands naturally across the week.

- **Avery (emp_002)**: Genuine progress week. Actually closes the Northwind renewal (signed!). Petalcrest expansion is moving forward with real numbers mentioned for once. This is a GOOD week — the optimism is backed by actual results. Still uses her narrative style but the milestones are real.

- **Sean (emp_003)**: Full submission week — posts ALL 5 days (Monday through Friday). But numbers are mediocre: CAC is flat (no improvement), only 2 experiments launched (below 3/week target). ROAS holding but not improving. The cadence is perfect but the output is underwhelming.

- **Jeff (emp_004)**: Strong week for both metrics. Dials 40-50/day, meetings steady at 6-8 range. Both KPIs on track. Tone is his usual casual self but backed by solid numbers.

- **Hannah (emp_005)**: Breakthrough week. Eng alignment finally achieved, v2 spec is locked and approved. Completed 4 research sessions (still below 5 target but much better than last week's 2). Real progress language — "locked," "approved," "moving to implementation." Still thoughtful/qualitative in style but the content shows actual forward motion.
