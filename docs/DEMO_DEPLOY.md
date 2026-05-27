# Public demo deployment

The `demo` branch is the public-facing build that ships at
[leveragedxlabs.com/demos/kpi-dashboard](https://leveragedxlabs.com/demos/kpi-dashboard).
It diverges from `main` only in ways that make the app safe to expose:

| Change vs. main | Where | Why |
|---|---|---|
| `$PORT` binding | `Dockerfile` | Render injects `$PORT`; hardcoding 5100 breaks ingress |
| Env-var Telegram creds | `api/routes/auth.py` | `main` had a real bot token in source; demo defaults disabled |
| Per-IP rate limit on `/api/pipeline/run*` | `api/routes/pipeline.py` | Each pipeline run is 3–12+ GPT calls; unguarded = budget hole |
| Demo banner | `src/App.jsx` | Identifies the deploy as a sandboxed showcase |
| `render.yaml` | repo root | Blueprint Render reads to provision the web service |

`APP_PASSWORD` is intentionally left unset on the Render service so the demo
is publicly browsable. The app's auth middleware no-ops when no password is
configured.

## Deploying for the first time

1. **Push the demo branch** to GitHub:
   ```bash
   git push -u origin demo
   ```

2. **Create the Render service** from the Blueprint:
   - [render.com/dashboard](https://render.com/dashboard) → "New +" → "Blueprint"
   - Connect the `kpi-accountability-dashboard` repo, select the `demo` branch
   - Render reads [`render.yaml`](../render.yaml) and provisions a Starter
     ($7/mo) Docker web service

3. **Set the two secrets** in the Render service's Environment tab:
   - `OPENAI_API_KEY` — your OpenAI project key
   - `SECRET_KEY` — any 32+ char random string
     (e.g. `python3 -c 'import secrets; print(secrets.token_hex(32))'`)

4. **Set a hard spend cap on OpenAI** as a backstop to the in-app rate limit:
   - [platform.openai.com/settings](https://platform.openai.com/settings) →
     Billing → Limits → set a monthly soft + hard cap (e.g. $25 / $50)
   - Optionally create a dedicated project + key just for this demo

5. **Wire the site rewrite**. Once Render reports "Live", grab the
   `https://<service>.onrender.com` URL and update `vercel.json` in the
   [leveragedxlabs-site](https://github.com/cchen0800/leveragedxlabs-site)
   repo — replace the `RENDER_DEMO_URL` placeholder in the rewrite block.

## Updating the demo

Any push to the `demo` branch triggers a Render redeploy (`autoDeploy: true`
in [render.yaml](../render.yaml)). To pull in fixes from `main`:

```bash
git checkout demo
git merge main         # resolve conflicts; the diff vs main is small
git push origin demo
```

## Operational notes

- The SQLite database is on Render's ephemeral filesystem. It survives
  restarts but resets on every redeploy. That's intentional — demo state
  shouldn't accumulate cruft.
- A nightly cron to wipe state isn't necessary at the current traffic level;
  add one if drift becomes visible.
- If you ever see unexpected OpenAI spend, the in-app rate limit
  (`PIPELINE_RATE_MAX`, default 5/hr/IP) is the first throttle to tighten.
  Set it to `0` in the Render env to fully block pipeline triggers without
  taking the demo down.
