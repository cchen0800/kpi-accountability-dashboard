# Generate Standup Set 3 (Week 4)

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
- ALL 5 employees post ALL 5 days this week = 25 entries total
- Plain text only. No markdown, no bold, no headers, no bullet points. Flowing sentences.
- Emojis OK mid-sentence, never as section headers/prefixes.
- Fictional brands ONLY: Northwind Athletics, Petalcrest Beauty, Harborline Foods, Ridgeway Outdoors, Cinderhouse Coffee

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
- **Example**: "Cinderhouse ROAS 3.2x (target 2.8x), CPM down 8% WoW. Launched 2 experiments — Petalcrest carousel ads at 1.8% CTR early, Harborline video reels looking strong on engagement. CAC down 4% vs last week. One more experiment pending creative review"

### Jeff Collard (emp_004) — Sales Development Rep
- **KPIs**: 200 outbound dials/week, 8 qualified meetings booked/week
- **Writing style**: Short, breezy, casual. One-liners. Sometimes forgets to mention meetings booked.
- **Example**: "45 dials today, 5 meetings booked. Northwind referral path converting really well. solid start to the week"

### Hannah Kargman (emp_005) — Product Manager
- **KPIs**: Ship Creator Matching v2 by end of quarter, Run 5 user research sessions/week
- **Writing style**: Thoughtful, qualitative. "Alignment," "blockers," "stakeholder input," "iterating." Rarely commits to dates. Talks process more than output.
- **Example**: "Matching v2 — still aligning with eng on algorithm requirements, speed vs accuracy tradeoff. They're reviewing infra constraints. Ran first user research session this morning with a creator cohort, really valuable feedback. Got another session tomorrow"

## This Week's Performance (Set 3 / Week 4)

This is a STRONG week across the board. Write updates that reflect these performance patterns. Each update MUST contain extractable KPI evidence (specific numbers, status words like signed/stalled/blocked/shipped, progress indicators).

- **Adam (emp_001)**: Strong rebound. 30+ creators/day consistently. Response time back to 15hr. Clears backlog from the prior week's outage. Mentions wrapping up the backlog early in the week, then cruising. Clean confident updates.

- **Avery (emp_002)**: Strong week with real results. Two accounts renewed — Cinderhouse Coffee and Northwind extensions both signed. Expansion conversation with Harborline includes concrete revenue numbers for once (e.g., "15% upsell on their Q2 buy"). Still uses her narrative optimistic style, but the milestones are backed by facts this time.

- **Sean (emp_003)**: All 5 days posted. Best week yet — CAC down 12%, 4 experiments launched (above 3/week target). Strong ROAS across portfolio. Numbers are excellent and he reports them in his typical dry, metrics-heavy style.

- **Jeff (emp_004)**: Meetings rebound across the week. Dials consistent at 42-48/day. Meetings climb day by day: 3, 4, 5, 6, 7. He's back on track and his casual tone reflects genuine confidence. Mentions specific accounts and conversions.

- **Hannah (emp_005)**: Strong execution. Feature is in QA (real milestone). Hit 5 research sessions for the first time. Uses concrete progress language — "in QA," "shipped to staging," "test results look good." Still thoughtful in style but the content shows clear forward motion and delivered outcomes.
