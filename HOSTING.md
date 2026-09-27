# Orbit V12 hosting

Orbit's 87-source scanner is a Node.js backend. The Android `index.html` file is only the dashboard client; Chrome cannot keep a Node scanner running in the background when the file is opened directly.

## Required for unattended 2-hour scans

Run the project on an always-on Node.js host and open the dashboard URL from Chrome.

The host should:

1. Run `npm start`.
2. Expose port `8787` (or map the host's assigned port through `PORT`).
3. Keep the process alive continuously.
4. Allow outbound HTTPS requests to the public source sites.
5. Persist the `data/` directory so the latest verified snapshot and events survive restarts.

## Scanner behavior

- 87 source targets are checked on each scheduled cycle.
- A cycle starts on server boot and then repeats every 2 hours.
- The dashboard polls only scan status every 5 minutes; it does not start a new scan during those polls.
- `POST /api/sync` starts a manual scan.
- `GET /api/scan-status` reports the last/next scan and source totals.
- `GET /api/opportunities` returns the latest fresh verified snapshot.
- `GET /api/sources` returns the full source registry.

## Local test

```bash
npm start
```

Then open `http://localhost:8787`.

For API-only testing without the startup scan:

```bash
ORBIT_SKIP_INITIAL_SCAN=1 npm start
```

## Android direct-file mode

If you extract the ZIP and tap `index.html` → Chrome, Orbit still works as a dashboard with the embedded verified snapshot. It cannot perform unattended 2-hour web scans in that mode because there is no always-on backend process.
