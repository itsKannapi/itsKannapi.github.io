// ─── CONFIG ───────────────────────────────────────────
const CONFIG = {
  // Cloudflare Worker URL (hides your Steam key)
  steamProxy: 'https://steam-proxy.joey-tamondong.workers.dev',

  // Faceit — read-only public key, safe in client JS
  faceitKey: '75d1953f-593e-45c2-a38d-09a74ca7d050',
  faceitNickname: 't4m0n',

  // Valorant — no key needed for Henrik's API
  valName: 'kan kan',   // e.g. Kannapi
  valTag:  'izzy',    // e.g. NA1  (the part after #)
};

// ─── VALORANT ─────────────────────────────────────────
async function fetchValorantStats() {
  try {
    const [mmrRes, matchRes] = await Promise.all([
      fetch(`https://api.henrikdev.tech/valorant/v2/mmr/na/pc/${CONFIG.valName}/${CONFIG.valTag}`),
      fetch(`https://api.henrikdev.tech/valorant/v1/lifetime/matches/na/${CONFIG.valName}/${CONFIG.valTag}?mode=competitive&size=20`)
    ]);

    const mmr   = await mmrRes.json();
    const match = await matchRes.json();

    if (mmr.data) {
      const rank = mmr.data.current_data?.currenttierpatched ?? '—';
      const rr   = mmr.data.current_data?.ranking_in_tier   ?? '—';
      setEl('val-rank', `${rank} · ${rr}RR`);
    }

    if (match.data && match.data.length > 0) {
      const games  = match.data;
      const wins   = games.filter(g => g.stats.team.toLowerCase() === g.teams[g.stats.team.toLowerCase()]?.won ? true : false).length;
      const kills  = games.reduce((a, g) => a + g.stats.kills, 0);
      const deaths = games.reduce((a, g) => a + g.stats.deaths, 0);
      const hs     = games.reduce((a, g) => a + g.stats.headshots, 0);
      const shots  = games.reduce((a, g) => a + g.stats.headshots + g.stats.bodyshots + g.stats.legshots, 0);
      const acs    = games.reduce((a, g) => a + g.stats.score,  0) / games.length / (games[0]?.rounds ?? 20);

      setEl('val-kd',   (kills / Math.max(deaths, 1)).toFixed(2));
      setEl('val-hs',   shots > 0 ? `${Math.round((hs / shots) * 100)}%` : '—');
      setEl('val-acs',  Math.round(acs));
      setEl('val-hrs',  '860'); // Steam doesn't track Valorant hours, keep manual
    }
  } catch (e) {
    console.warn('Valorant stats unavailable:', e);
  }
}

// ─── CS2 STEAM ────────────────────────────────────────
async function fetchSteamStats() {
  try {
    const res  = await fetch(CONFIG.steamProxy);
    const data = await res.json();
    const stats = data?.playerstats?.stats;
    if (!stats) return;

    const get = name => stats.find(s => s.name === name)?.value ?? 0;

    const kills     = get('total_kills');
    const deaths    = get('total_deaths');
    const wins      = get('total_wins');
    const rounds    = get('total_rounds_played');
    const hs        = get('total_kills_headshot');
    const timePlayed = get('total_time_played'); // in seconds

    const kd      = (kills / Math.max(deaths, 1)).toFixed(2);
    const hsPercent = kills > 0 ? `${Math.round((hs / kills) * 100)}%` : '—';
    const winRate = rounds > 0 ? `${Math.round((wins / (rounds / 15)) * 100)}%` : '—';
    const hours   = Math.round(timePlayed / 3600);

    setEl('cs2-kd',      kd);
    setEl('cs2-hs',      hsPercent);
    setEl('cs2-winrate', winRate);
    setEl('cs2-hrs',     hours);
  } catch (e) {
    console.warn('Steam stats unavailable:', e);
  }
}

// ─── FACEIT ───────────────────────────────────────────
async function fetchFaceitStats() {
  try {
    const headers = { 'Authorization': `Bearer ${CONFIG.faceitKey}` };

    const playerRes = await fetch(
      `https://open.faceit.com/data/v4/players?nickname=${CONFIG.faceitNickname}`,
      { headers }
    );
    const player = await playerRes.json();
    const playerId = player.player_id;
    const eloRaw   = player.games?.cs2?.faceit_elo ?? '—';
    const lvl      = player.games?.cs2?.skill_level ?? '—';

    setEl('faceit-elo',   eloRaw);
    setEl('faceit-level', `Level ${lvl}`);

    const statsRes = await fetch(
      `https://open.faceit.com/data/v4/players/${playerId}/stats/cs2`,
      { headers }
    );
    const statsData = await statsRes.json();
    const s = statsData?.lifetime;

    if (s) {
      setEl('cs2-kd',      s['Average K/D Ratio'] ?? '—');
      setEl('cs2-hs',      s['Average Headshots %'] ? `${s['Average Headshots %']}%` : '—');
      setEl('cs2-winrate', s['Win Rate %'] ? `${s['Win Rate %']}%` : '—');
      setEl('faceit-matches', s['Matches'] ?? '—');
    }
  } catch (e) {
    console.warn('Faceit stats unavailable:', e);
  }
}

// ─── HELPER ───────────────────────────────────────────
function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// ─── INIT ─────────────────────────────────────────────
// Runs when the gaming page is opened
function loadGamingStats() {
  fetchValorantStats();
  fetchSteamStats();
  fetchFaceitStats();
}