# Orbit 14 — zero-cost GitHub Pages deployment — zero-cost GitHub Pages deployment

This edition is designed for a **public GitHub repository + GitHub Pages + GitHub Actions**. The phone only opens the final URL; the scanner runs in GitHub Actions.

## What the workflow does

- Runs on every push to `main`.
- Can be started manually from **Actions → Orbit — scan and deploy → Run workflow**.
- Runs automatically every 2 hours using Asia/Dhaka timezone.
- Scans the configured 87 source targets independently.
- Writes the latest scan to `data/feed.json` inside the Pages artifact.
- Deploys the dashboard to GitHub Pages after the scan.
- A failed source does not erase successful sources.

GitHub documents that Pages is available for public repositories on GitHub Free and that custom GitHub Actions workflows can deploy Pages artifacts. GitHub also supports scheduled workflows with cron and IANA time zones. See the official GitHub documentation.

## Phone-only setup

1. Create a **public** repository named `orbit`.
2. Upload the contents of this package to the repository root.
3. If Android hides `.github`, create the workflow manually at:
   `.github/workflows/orbit.yml`
   using the copy included in this package.
4. Open **Settings → Pages** and set **Source = GitHub Actions**.
5. Open **Settings → Secrets and variables → Actions → New repository secret**.
6. Create `ORBIT_PROFILE` with your private matching profile JSON.
7. Open **Actions → Orbit — scan and deploy → Run workflow**.
8. After the run succeeds, GitHub Pages will show the Orbit URL.

## Privacy

The scanner profile is supplied through the `ORBIT_PROFILE` Actions secret. The generated public feed does not publish the user's name, date of birth, education or work-history profile. The Profile page on the phone is a separate local copy; saving it does not modify the GitHub secret. If you change matching preferences, update the `ORBIT_PROFILE` secret in GitHub Settings → Secrets and variables → Actions.

V14 also reports the scan pipeline in stages: source reachability → listing candidates → deadline-verified listings → profile matches. This makes a zero-match scan diagnosable instead of simply showing “0 matches”.

Do not commit passwords, API keys, cookies or personal access tokens to the repository.

## Important free-tier limitation

GitHub scheduled workflows in public repositories can be automatically disabled after 60 days without repository activity. Open the repository occasionally or manually run the workflow to keep the project active.
