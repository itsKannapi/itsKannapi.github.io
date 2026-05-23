// ─── CONFIG — fill these in ───────────────────────────
const CONFIG = {
  henrikBase:     'https://api.henrikdev.xyz',
  henrikKey:      'HDEV-5f053167-9c2b-4190-bdd2-793e59911bdf',
  valName:        'kan kan',        // your Riot display name
  valTag:         'izzy',            // the part after # — no # symbol
  valRegion:      'na',             // na / eu / ap / kr / latam / br

  steamProxy:     'https://steam-proxy.joey-tamondong.workers.dev', // your Cloudflare Worker URL
  faceitKey:      '75d1953f-593e-45c2-a38d-09a74ca7d050',
  faceitNickname: 't4m0n',
};

// ─── HELPER ───────────────────────────────────────────
function setEl(id, value) {
  const el = document.getElementById(id);
  if (el && value !== null && value !== undefined) el.textContent = value;
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 120)}`);
  }

  if (!res.ok || (data?.status && Number(data.status) >= 400)) {
    throw new Error(data?.errors?.[0]?.message || data?.message || `Request failed: ${res.status}`);
  }

  return data;
}

// ─── VALORANT ─────────────────────────────────────────
async function fetchValorantStats() {
  const headers = { 'Authorization': CONFIG.henrikKey };
  const { valName, valTag, valRegion } = CONFIG;

  try {
    // 1. Current rank
    const mmr = await fetchJson(
      `${CONFIG.henrikBase}/valorant/v3/mmr/${valRegion}/pc/${encodeURIComponent(valName)}/${encodeURIComponent(valTag)}`,
      { headers }
    );
    console.log('MMR response:', mmr); // check browser console to see what comes back

    if (mmr.data) {
      const current = mmr.data.current ?? mmr.data.current_data ?? mmr.data;
      const tier = current.tier?.name ?? current.currenttier_patched ?? current.currenttierpatched;
      const rr = current.rr ?? current.ranking_in_tier;
      setEl('val-rank', tier ? `${tier} · ${rr ?? '—'}RR` : '—');
    }

    // 2. Lifetime stats from last 20 competitive matches
    const matchData = await fetchJson(
      `${CONFIG.henrikBase}/valorant/v1/lifetime/matches/${valRegion}/${encodeURIComponent(valName)}/${encodeURIComponent(valTag)}?mode=competitive&size=20`,
      { headers }
    );
    console.log('Match response:', matchData);

    if (matchData.data && matchData.data.length > 0) {
      const games = matchData.data;
      let kills = 0, deaths = 0, assists = 0, hs = 0, totalShots = 0, score = 0, wins = 0, rounds = 0;

      games.forEach(g => {
        const s = g.stats ?? {};
        const shots = s.shots ?? {};
        const team = String(s.team ?? '').toLowerCase();
        const redRounds = g.teams?.red ?? g.rounds?.red ?? 0;
        const blueRounds = g.teams?.blue ?? g.rounds?.blue ?? 0;
        const gameRounds = redRounds + blueRounds;

        kills    += s.kills    ?? 0;
        deaths   += s.deaths   ?? 0;
        assists  += s.assists  ?? 0;
        hs       += shots.head ?? s.headshots ?? 0;
        totalShots += (shots.head ?? s.headshots ?? 0) + (shots.body ?? s.bodyshots ?? 0) + (shots.leg ?? s.legshots ?? 0);
        score    += s.score    ?? 0;
        rounds   += gameRounds || 20;

        if (
          g.won ||
          (team === 'red' && redRounds > blueRounds) ||
          (team === 'blue' && blueRounds > redRounds)
        ) {
          wins++;
        }
      });

      const kd      = (deaths > 0 ? kills / deaths : kills).toFixed(2);
      const hsP     = totalShots > 0 ? Math.round((hs / totalShots) * 100) + '%' : '—';
      const winRate = Math.round((wins / games.length) * 100) + '%';
      const acs     = rounds > 0 ? Math.round(score / rounds) : '—';

      setEl('val-kd',      kd);
      setEl('val-hs',      hsP);
      setEl('val-winrate', winRate);
      setEl('val-acs',     acs);
      setEl('val-hrs',     '860'); // Valorant hours aren't in this API — update manually
    }

  } catch (err) {
    console.error('Valorant fetch error:', err);
  }
}

// ─── CS2 via Steam Proxy ───────────────────────────────
async function fetchSteamStats() {
  try {
    const res  = await fetch(CONFIG.steamProxy);
    const data = await res.json();
    console.log('Steam response:', data);

    const stats = data?.playerstats?.stats;
    if (!stats) return;

    const get = name => stats.find(s => s.name === name)?.value ?? 0;

    const kills      = get('total_kills');
    const deaths     = get('total_deaths');
    const wins       = get('total_wins');
    const rounds     = get('total_rounds_played');
    const hsKills    = get('total_kills_headshot');
    const timeSecs   = get('total_time_played');

    const kd       = deaths > 0 ? (kills / deaths).toFixed(2) : kills;
    const hsP      = kills  > 0 ? Math.round((hsKills / kills) * 100) + '%' : '—';
    const winRate  = rounds > 0 ? Math.round((wins / (rounds / 15)) * 100) + '%' : '—';
    const hours    = Math.round(timeSecs / 3600);

    setEl('cs2-kd',      kd);
    setEl('cs2-hs',      hsP);
    setEl('cs2-winrate', winRate);
    setEl('cs2-hrs',     hours);

  } catch (err) {
    console.error('Steam fetch error:', err);
  }
}

// ─── FACEIT ───────────────────────────────────────────
async function fetchFaceitStats() {
  const headers = { 'Authorization': `Bearer ${CONFIG.faceitKey}` };

  try {
    // Get player ID + ELO
    const playerRes = await fetch(
      `https://open.faceit.com/data/v4/players?nickname=${encodeURIComponent(CONFIG.faceitNickname)}`,
      { headers }
    );
    const player = await playerRes.json();
    console.log('Faceit player:', player);

    const playerId = player.player_id;
    const elo      = player.games?.cs2?.faceit_elo ?? '—';
    const level    = player.games?.cs2?.skill_level ?? '—';

    setEl('faceit-elo',   elo);
    setEl('faceit-level', `Level ${level}`);

    // Get lifetime stats
    const statsRes = await fetch(
      `https://open.faceit.com/data/v4/players/${playerId}/stats/cs2`,
      { headers }
    );
    const statsData = await statsRes.json();
    console.log('Faceit stats:', statsData);

    const s = statsData?.lifetime;
    if (s) {
      // Faceit stats override Steam ones with more accurate competitive data
      setEl('cs2-kd',      s['Average K/D Ratio']     ?? '—');
      setEl('cs2-hs',      s['Average Headshots %'] ? s['Average Headshots %'] + '%' : '—');
      setEl('cs2-winrate', s['Win Rate %']           ? s['Win Rate %'] + '%'          : '—');
    }

  } catch (err) {
    console.error('Faceit fetch error:', err);
  }
}

// ─── MAIN ENTRY — called by showPage('gaming') ────────
function loadGamingStats() {
  fetchValorantStats();
  fetchSteamStats();
  fetchFaceitStats();
}

window.loadGamingStats = loadGamingStats;
