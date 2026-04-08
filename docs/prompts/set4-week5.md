# Generate Standup Set 4 (Week 5)

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

**IMPORTANT**: Sean (emp_003) SKIPS Wednesday this week. Only 4 updates for him (Mon, Tue, Thu, Fri). Total entries = 24.

## Employee Profiles

### Adam Ankeny (emp_001) — Creator Operations Associate
- **KPIs**: Onboard 25 new creators/week, Maintain <24hr creator response time
- **Writing style**: Concise, numbers-forward. Leads with metrics, short sentences. Consistent format daily.
- **Example**: "28 creators onboarded today, already past the 25/wk target. Response time at 18hr avg. Northwind campaign crew fully ramped, no issues. Tomorrow's batch of 32 apps is prepped and ready to go"

### Avery Holmseth (emp_002) — Client Success Manager
- **KPIs**: Renew 4 enterprise accounts this quarter, Drive 15% expansion revenue from existing book
- **Writing style**: Long narrative paragraphs. Buries metrics in prose. Optimistic tone ("great call," "positive energy," "feeling good"). Avoids hard numbers and dates.
- **Example**: "Northwind still in legal review, honestly a good sign that they're taking it seriously. They said it's almost there. Petalcrest feels like standard back and forth on terms. Had another encouraging call about their expansion plans. Really optimistic about how these are shaping up"

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
- **Example**: "Still in alignment phase on Matching v2 architecture. Eng has concerns about current proposal so doing another round of stakeholder input. Research sessions pushed to next week, had to prioritize internal alignment. Should have clearer direction by Friday"

## This Week's Performance (Set 4 / Week 5)

Write updates that reflect these performance patterns. Each update MUST contain extractable KPI evidence (specific numbers, status words like signed/stalled/blocked/shipped, progress indicators).

- **Adam (emp_001)**: Mixed week. Onboarding numbers are strong (27-32 creators/day) but response time is consistently above 20hr — some days hitting 22-23hr. Still technically under the 24hr target but noticeably slower than his best weeks. He reports the numbers honestly in his usual concise style.

- **Avery (emp_002)**: Stalling again — same pattern as the original week but with DIFFERENT accounts. Ridgeway Outdoors and Cinderhouse Coffee are both "almost there" for 5 straight days. Language is pure optimism with zero concrete milestones: "great momentum," "really positive signals," "should close soon." No signed deals, no specific dates, no concrete progress. The AI should be able to detect the same optimism-reality gap pattern.

- **Sean (emp_003)**: SKIPS Wednesday only. Posts Mon, Tue, Thu, Fri (4 days). Only 2 experiments launched (below 3/week target), and one underperforms. CAC is flat — no improvement. ROAS holding but not growing. Decent but unimpressive numbers on the days he posts.

- **Jeff (emp_004)**: Dials look inflated. Reports 50-55 dials/day but his language hints at padding: "including follow-up attempts," "redials counted," "cleared the callback queue." Meetings flat at only 3/day despite the high dial numbers. The disconnect between high dials and low meetings should be detectable.

- **Hannah (emp_005)**: Regression. QA found critical bugs in Matching v2, so she's back to "alignment" and "stakeholder input" meetings with eng. Research drops to just 1 session for the whole week. Same stuck language as the original week — "iterating," "working through concerns," "should have clarity soon." No forward motion despite the prior week's progress.
