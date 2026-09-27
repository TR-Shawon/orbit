# Orbit — zero-cost hosted edition

Orbit is designed to run as a public static dashboard with a scheduled GitHub Actions scanner. No local `index.html` opening and no paid server are required.

## Architecture

- Dashboard: GitHub Pages
- Scanner: GitHub Actions, every 2 hours
- Data: `data/feed.json` and `data/events.json` committed by the scanner
- Sources: 87 configured source targets
- Manual scan: GitHub Actions → Orbit scanner → Run workflow

GitHub's current documentation says standard GitHub-hosted runners are free and unlimited for public repositories, and scheduled workflows support cron. The scanner is deliberately bounded to 10 minutes per run.

## One-time setup

1. Create a **public** GitHub repository, e.g. `orbit`.
2. Upload the contents of this folder to the repository root.
3. In **Settings → Pages**, set the source to **GitHub Actions**.
4. If you want the scanner to use the included Shawon profile, no secret is required; the built-in profile in `server.js` is used. For privacy, you can instead add a repository secret named `ORBIT_PROFILE` containing JSON for the profile.
5. Run **Actions → Orbit scanner → Run workflow** once manually.
6. GitHub Pages will provide the shareable URL under your GitHub account.

## Important privacy note

A public repository exposes its source code and committed `data/feed.json`. For a truly private personal profile, do not commit personal profile data; set `ORBIT_PROFILE` as a repository secret. The generated opportunity feed itself may still be visible to anyone who can access the Pages site.

## Important reliability note

The scanner monitors 87 configured sources; it does not guarantee that every source is reachable on every run. Each source is independently marked verified/unavailable, and partial failures do not erase successful matches.

GitHub scheduled workflows can be automatically disabled after 60 days of repository inactivity. Open the repository or re-run the workflow if GitHub disables the schedule.
