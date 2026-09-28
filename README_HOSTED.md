# Orbit V14 hosted edition

Open the GitHub Pages URL on your phone. GitHub Actions performs the scheduled scan even when the phone is offline.

The dashboard is intentionally read-only with respect to the hosted scan. “Refresh latest scan” reloads the newest Pages feed; it does not start a new GitHub Actions job.

For a new scan immediately, use GitHub → Actions → Orbit — scan and deploy → Run workflow.

The scanner uses the `ORBIT_PROFILE` repository secret. The Profile screen in the browser is local to that device and is not automatically synchronized to the GitHub secret.

V14 diagnostics distinguish:
1. reachable sources
2. listing candidates inspected
3. current deadlines verified
4. profile matches

This is important when a scan returns zero matches: zero can now be traced to source reachability, extraction, deadline verification, or matching rather than appearing as an unexplained empty inbox.
