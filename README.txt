ORBIT V13 — SHAWON
==================

V13 turns Orbit into an 87-source career-monitoring engine with a light Solar Orbit dashboard.

SCANNER ENGINE
--------------
- 87 configured source targets:
  - 11 public/specialized bank portals
  - 52 private/foreign bank portals
  - 16 selected MNC/corporate portals
  - 3 selected AI/technology portals
  - BPSC, Alljobs by Teletalk, Bangladesh Bank noticeboard, Bdjobs
  - LinkedIn is discovery-only; Orbit does not request or scrape credentials.
- Scheduled live scan every 2 hours.
- Initial scan starts automatically when the Node server starts.
- Source-level health is retained so one blocked portal does not blank the whole dashboard.
- Scan status exposes total, verified, failed and matched counts.
- Manual “Scan now” remains available.
- Browser dashboard polls the server for scan completion; it does NOT trigger a new scan every 5 minutes.
- Scheduled scans intentionally avoid search-engine discovery so the 87-source cycle remains bounded and auditable. A source can be marked unavailable if its direct public page cannot be reached.

DASHBOARD
---------
- New Solar Orbit scanner card shows:
  - source count
  - verified source count
  - current matches
  - source issues
  - scan progress
  - last scan
  - next scheduled scan
- Jobs remain visible from the latest verified server snapshot while the next scheduled cycle is pending.
- Source health in Profile lists the complete source registry returned by the server.

ANDROID DIRECT-OPEN MODE
------------------------
Opening index.html directly in Chrome from a file/content URI cannot run Node.js in the background.
In this mode Orbit loads the embedded verified snapshot and clearly labels the scanner as ready but not connected to the live server.
For an actual unattended 2-hour 87-source scan, the Node backend must stay running on a server/host that is reachable by the phone.

LOCAL SERVER
------------
npm start
Open: http://localhost:8787

The backend scans immediately on startup and then every 2 hours.

TESTING
-------
Set ORBIT_SKIP_INITIAL_SCAN=1 to start the server without the startup scan while testing the API.

IMPORTANT
---------
“Real-time” here means scheduled live source verification on the configured 2-hour cycle plus manual scans. It is not a continuous second-by-second scrape.

PRIVATE-BANK EXAM MODE
---------------------
Private-bank listings can be classified for written/aptitude/MCQ/selection-test pathways. Starting Exam preparation unlocks the separate bank-exam study workflow and daily plan.

SOLAR ORBIT UI
--------------
Light warm-white background, observatory navy, solar amber, orbital cyan and calm teal; circular solar/orbital mark, softer controls, lighter navigation and low-contrast cards.

HOSTED ZERO-COST MODE
See DEPLOY_FREE.md. Orbit can be deployed as a public GitHub Pages site with a GitHub Actions scanner scheduled every two hours. This removes the Android index.html problem entirely.
