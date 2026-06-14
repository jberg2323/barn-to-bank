/** Public config, no secrets. Client checks if cloud sync is available. */
module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.status(200).json({
    enabled: Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)),
    teamId: process.env.MOAT_TEAM_ID || 'barn-to-bank-team',
    bundleVersion: 1,
  });
};