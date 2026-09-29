const fs = require('fs');
const { sync, profileFrom } = require('./server');

async function main() {
  let profile = {}, profileConfigured = false;
  if (process.env.ORBIT_PROFILE) {
    try { profile = JSON.parse(process.env.ORBIT_PROFILE); profileConfigured = true; } catch (e) { console.error('Invalid ORBIT_PROFILE JSON; using built-in profile.'); }
  } else if (fs.existsSync('./data/profile.json')) {
    try { profile = JSON.parse(fs.readFileSync('./data/profile.json','utf8')); } catch {}
  }
  const result = await sync(profileFrom(profile));
  const ss = result.sourceSummary || {};
  console.log(`Orbit ${result.version}: ${ss.reachable || 0}/${ss.total || 87} reachable · ${ss.candidates || 0} candidates · ${ss.deadlineFound || 0} deadlines found · ${ss.deadlineVerified || 0} open deadlines · ${ss.matched || 0} matches`);
  console.log(JSON.stringify({
    version: result.version,
    profileConfigured,
    syncedAt: result.syncedAt,
    sources: result.sourceSummary,
    coverage: result.coverage,
    matches: result.items?.length || 0
  }, null, 2));
  if (!result.ok) console.warn('Orbit scan completed without a verified source; the dashboard will retain the latest feed.');
}
main().catch(err => { console.error(err); process.exit(1); });
