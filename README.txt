ORBIT V14 — HOSTED CAREER INTELLIGENCE

V14 is the hosted GitHub Pages edition of Orbit.

Architecture:
GitHub Actions -> 87-source scan -> data/feed.json -> GitHub Pages -> Android browser

V14 changes:
- Better deadline extraction, including structured dates and common date formats.
- Bounded detail-page checks when a listing is visible but its deadline is not on the source page.
- Source diagnostics: reachable sources, listing candidates, deadline-verified listings, profile matches.
- Per-source diagnostics show listings/deadlines/matches instead of only a match count.
- Clear separation between the private GitHub Actions ORBIT_PROFILE secret and the local browser profile.
- Hosted buttons say Refresh latest scan rather than implying the phone can run the scanner.
- Private-bank written-exam detection and preparation flow retained.
- Government/private/private-bank study/interview stats remain workflow-gated.
- Engineering-title hard exclusion for private-sector matching retained.

Privacy:
The public Pages site does not receive the full personal profile from the GitHub secret. The scanner uses ORBIT_PROFILE inside Actions; the public feed keeps only non-sensitive scan configuration needed by the UI. The Profile page on the phone is a separate local copy.

See DEPLOY_FREE.md for setup.
