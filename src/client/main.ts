import "./styles.css";
import { MAPS } from "../shared/maps.ts";
import type { HistoryEntry, Profile, RoomListing, RoomView, SaveStatus, ServerMessage } from "../shared/protocol.ts";
import { AVAILABLE_MODES, DURATIONS, MODE_NAMES, MULTIPLIERS, TEAM_MODES } from "../shared/settings.ts";
import type { MatchResult, RoomSettings } from "../shared/types.ts";
import { api, esc, hex, toast } from "./dom.ts";
import { GameSession } from "./game.ts";
import { Net } from "./net.ts";
import { TEAM_COLORS, TEAM_NAMES } from "./render.ts";

const PALETTE = [0xe0603c, 0x3c8de0, 0x4caf50, 0xc9a227, 0x9b59b6, 0x1abc9c, 0xe91e63, 0xff9800];
const app = document.getElementById("app")!;
const net = new Net();

let profile: Profile;
let room: RoomView | null = null;
let game: GameSession | null = null;
let results: { result: MatchResult; save: SaveStatus } | null = null;
let screen: "home" | "lobby" | "game" | "results" | "waiting" = "home";
let autoStart = false;
let roomPoll: number | undefined;
let historyCursor: string | null = null;

const isHost = (): boolean => !!room && room.members.some((m) => m.key === room!.you && m.host);
const reducedShake = (): boolean => profile?.prefs?.reducedShake === true;
const mapName = (id: string): string => MAPS[id]?.name ?? id;

function setScreen(s: typeof screen): void {
  screen = s;
  document.body.dataset.screen = s;
  if (roomPoll !== undefined && s !== "home") {
    clearInterval(roomPoll);
    roomPoll = undefined;
  }
}

function setPath(path: string): void {
  if (location.pathname !== path) history.replaceState(null, "", path);
}

// ---------- home ----------

function renderHome(): void {
  setScreen("home");
  setPath("/");
  const kd = profile.deaths > 0 ? (profile.kills / profile.deaths).toFixed(2) : String(profile.kills);
  app.innerHTML = `
    <header class="brand">
      <h1>Jet Skirmish</h1>
      <p>A 2D jetpack arena shooter for up to eight pilots.</p>
    </header>
    <main class="home">
      <section class="card play">
        <h2>Play</h2>
        <button id="quick" class="primary big">Quick play</button>
        <button id="practice" class="big">Practice against bots</button>
        <form id="join-form" class="row">
          <label class="grow">Room code <input name="code" required minlength="5" maxlength="5" autocomplete="off" autocapitalize="characters" placeholder="ABCDE"></label>
          <button>Join</button>
        </form>
        <details id="create">
          <summary>Create a room</summary>
          <form id="create-form" class="stack">
            <label>Room name <input name="name" maxlength="24" placeholder="Optional"></label>
            <label>Mode <select name="mode">${AVAILABLE_MODES.filter((m) => m !== "training")
              .map((m) => `<option value="${m}" ${m === "tdm" ? "selected" : ""}>${MODE_NAMES[m]}</option>`)
              .join("")}</select></label>
            <label>Map <select name="map">${Object.values(MAPS)
              .map((m) => `<option value="${m.id}">${esc(m.name)}</option>`)
              .join("")}</select></label>
            <label class="check"><input type="checkbox" name="isPublic" checked> List publicly</label>
            <button class="primary">Create room</button>
          </form>
        </details>
      </section>
      <section class="card profile">
        <h2>Your pilot</h2>
        <form id="profile-form" class="stack">
          <label>Name <input name="name" required maxlength="16" value="${esc(profile.name)}"></label>
          <fieldset class="swatches"><legend>Colour</legend>
            ${PALETTE.map(
              (c) =>
                `<label style="--c:${hex(c)}"><input type="radio" name="color" value="${c}" ${c === profile.color ? "checked" : ""}><span class="sr">${hex(c)}</span></label>`,
            ).join("")}
          </fieldset>
          <label class="check"><input type="checkbox" name="reducedShake" ${reducedShake() ? "checked" : ""}> Reduce screen shake</label>
          <button>Save</button>
        </form>
        <p class="stats"><span><b>${profile.matches}</b> matches</span><span><b>${profile.wins}</b> wins</span><span><b>${kd}</b> K/D</span><span><b>${profile.mvps}</b> MVPs</span></p>
        <p class="muted small">Stats count player-versus-player matches. Your pilot is remembered in this browser.</p>
      </section>
      <section class="card rooms">
        <h2>Open rooms</h2>
        <ul id="room-list" class="list"><li class="muted">Looking…</li></ul>
      </section>
      <section class="card history">
        <h2>Your matches</h2>
        <ul id="history" class="list"><li class="muted">Loading…</li></ul>
        <button id="more" hidden>Load more</button>
      </section>
    </main>
    <footer class="foot"><a href="/readme/">About this game</a></footer>`;

  app.querySelector("#quick")!.addEventListener("click", async () => {
    try {
      const { code } = await api<{ code: string }>("/api/quickjoin", { method: "POST" });
      joinRoom(code);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  });
  app.querySelector("#practice")!.addEventListener("click", async () => {
    try {
      const { code } = await api<{ code: string }>("/api/rooms", {
        method: "POST",
        body: { name: "Practice", isPublic: false, settings: { mode: "training", bots: 2, botDifficulty: "easy" } },
      });
      autoStart = true;
      joinRoom(code);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  });
  app.querySelector<HTMLFormElement>("#join-form")!.addEventListener("submit", (e) => {
    e.preventDefault();
    const code = String(new FormData(e.target as HTMLFormElement).get("code")).trim().toUpperCase();
    joinRoom(code);
  });
  app.querySelector<HTMLFormElement>("#create-form")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    try {
      const { code } = await api<{ code: string }>("/api/rooms", {
        method: "POST",
        body: { name: fd.get("name"), isPublic: fd.get("isPublic") === "on", settings: { mode: fd.get("mode"), map: fd.get("map") } },
      });
      joinRoom(code);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  });
  app.querySelector<HTMLFormElement>("#profile-form")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    try {
      const { profile: p } = await api<{ profile: Profile }>("/api/me", {
        method: "PATCH",
        body: { name: fd.get("name"), color: Number(fd.get("color") ?? profile.color), prefs: { ...profile.prefs, reducedShake: fd.get("reducedShake") === "on" } },
      });
      profile = p;
      toast("Saved.");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  });
  app.querySelector("#more")!.addEventListener("click", () => void loadHistory(false));

  void loadRooms();
  roomPoll = window.setInterval(() => void loadRooms(), 4000);
  historyCursor = null;
  void loadHistory(true);
}

async function loadRooms(): Promise<void> {
  const list = document.getElementById("room-list");
  if (!list) return;
  try {
    const { rooms } = await api<{ rooms: RoomListing[] }>("/api/rooms");
    list.innerHTML =
      rooms.length === 0
        ? `<li class="muted">No open rooms. Quick play makes one.</li>`
        : rooms
            .map(
              (r) => `<li class="room-row">
                <span><b>${esc(r.name)}</b><small>${MODE_NAMES[r.mode]} · ${esc(mapName(r.map))} · ${r.state === "playing" ? "in a match" : r.state}</small></span>
                <span class="count">${r.players}/${r.capacity}</span>
                <button data-code="${r.code}" ${r.players >= r.capacity ? "disabled" : ""}>Join</button>
              </li>`,
            )
            .join("");
    for (const b of list.querySelectorAll<HTMLButtonElement>("button[data-code]")) b.addEventListener("click", () => joinRoom(b.dataset.code!));
  } catch {
    list.innerHTML = `<li class="muted">Couldn't load rooms.</li>`;
  }
}

const OUTCOME: Record<string, string> = { interrupted: "Interrupted", abandoned: "Abandoned", live: "In progress" };

async function loadHistory(reset: boolean): Promise<void> {
  const list = document.getElementById("history");
  const more = document.getElementById("more") as HTMLButtonElement | null;
  if (!list || !more) return;
  try {
    const q = historyCursor && !reset ? `?before=${encodeURIComponent(historyCursor)}` : "";
    const { matches, next } = await api<{ matches: HistoryEntry[]; next: string | null }>(`/api/me/matches${q}`);
    historyCursor = next;
    const rows = matches
      .map((m) => {
        const outcome = m.status === "completed" ? (m.won ? "Won" : "Lost") : OUTCOME[m.status];
        const when = new Date(m.startedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
        return `<li class="match-row ${m.status === "completed" && m.won ? "won" : ""}">
          <span><b>${outcome}</b>${m.mvp ? ' <span class="mvp">MVP</span>' : ""}<small>${MODE_NAMES[m.mode as RoomSettings["mode"]] ?? esc(m.mode)} · ${esc(mapName(m.map))} · ${when}</small></span>
          <span class="kda">${m.kills}/${m.deaths}/${m.assists}<small>K/D/A</small></span>
        </li>`;
      })
      .join("");
    if (reset) list.innerHTML = rows || `<li class="muted">No matches yet. They'll be listed here after you play.</li>`;
    else list.insertAdjacentHTML("beforeend", rows);
    more.hidden = !next;
  } catch {
    list.innerHTML = `<li class="muted">Couldn't load your matches.</li>`;
  }
}

// ---------- rooms ----------

function joinRoom(code: string): void {
  if (!/^[A-Z0-9]{5}$/.test(code)) {
    toast("Room codes are five letters or digits.", "error");
    return;
  }
  net.roomCode = code;
  if (net.open) net.send({ t: "join", code });
  setScreen("waiting");
  app.innerHTML = `<div class="waiting"><p>Joining room ${code}…</p></div>`;
}

function leaveRoom(): void {
  net.send({ t: "leave" });
  net.roomCode = null;
  room = null;
  game?.destroy();
  game = null;
  results = null;
  autoStart = false;
  renderHome();
}

function settingSelect(name: keyof RoomSettings, options: [string | number, string][], value: unknown, disabled: boolean): string {
  return `<label>${SETTING_LABELS[name]} <select data-setting="${name}" ${disabled ? "disabled" : ""}>${options
    .map(([v, l]) => `<option value="${v}" ${String(v) === String(value) ? "selected" : ""}>${esc(l)}</option>`)
    .join("")}</select></label>`;
}

function settingCheck(name: keyof RoomSettings, value: boolean, disabled: boolean): string {
  return `<label class="check"><input type="checkbox" data-setting="${name}" ${value ? "checked" : ""} ${disabled ? "disabled" : ""}> ${SETTING_LABELS[name]}</label>`;
}

const SETTING_LABELS: Partial<Record<keyof RoomSettings, string>> = {
  mode: "Mode",
  map: "Map",
  durationMin: "Round length",
  scoreLimit: "Score limit",
  bots: "Bots",
  botDifficulty: "Bot skill",
  respawnSec: "Respawn delay",
  gravity: "Gravity",
  moveSpeed: "Run speed",
  thrust: "Jet thrust",
  fuelCapacity: "Fuel tank",
  recharge: "Fuel recharge",
  health: "Health",
  damage: "Damage",
  flight: "Jetpacks on",
  unlimitedFuel: "Unlimited fuel",
  unlimitedAmmo: "Unlimited ammo",
  friendlyFire: "Friendly fire",
  mapPickups: "Map pickups",
};

function renderLobby(): void {
  if (!room) return;
  setScreen("lobby");
  setPath(`/r/${room.code}`);
  const r = room;
  const host = isHost();
  const me = r.members.find((m) => m.key === r.you);
  const s = r.settings;
  const teamMode = TEAM_MODES.includes(s.mode);
  const member = (m: RoomView["members"][number]) =>
    `<li class="${m.key === r.you ? "me" : ""}"><i class="dot" style="background:${hex(m.color)}"></i>${esc(m.name)}${m.host ? ' <span class="tag">host</span>' : ""}${
      m.connected ? "" : ' <span class="tag away">reconnecting</span>'
    }${m.ready ? ' <span class="tag ready">ready</span>' : ""}</li>`;
  const membersHtml = teamMode
    ? `<div class="teams">${[0, 1]
        .map(
          (t) => `<div class="team" style="--team:${hex(TEAM_COLORS[t])}">
            <h3>${TEAM_NAMES[t]}</h3>
            <ul class="list">${r.members.filter((m) => m.team === t).map(member).join("") || '<li class="muted">Nobody yet</li>'}</ul>
            ${me && me.team !== t ? `<button data-team="${t}">Join ${TEAM_NAMES[t]}</button>` : ""}
          </div>`,
        )
        .join("")}</div>`
    : `<ul class="list">${r.members.map(member).join("")}</ul>`;
  const dis = !host;
  const multOpts = MULTIPLIERS.map((m): [number, string] => [m, `${m}×`]);
  const link = `${location.origin}/r/${r.code}`;
  app.innerHTML = `
    <header class="lobby-head">
      <div>
        <h1>${esc(r.name)}</h1>
        <p class="muted">${MODE_NAMES[s.mode]} on ${esc(mapName(s.map))} · ${r.isPublic ? "listed publicly" : "private"}</p>
      </div>
      <div class="invite">
        <span>Room code <b class="code">${r.code}</b></span>
        <button id="copy">Copy invite link</button>
      </div>
    </header>
    <main class="lobby">
      <section class="card members">
        <h2>Pilots <small>${r.members.length}/${s.capacity}${s.bots ? ` + ${s.bots} bot${s.bots > 1 ? "s" : ""}` : ""}</small></h2>
        ${membersHtml}
        <div class="row">
          <button id="ready" class="${me?.ready ? "on" : ""}" aria-pressed="${me?.ready ? "true" : "false"}">${me?.ready ? "Ready ✓" : "I'm ready"}</button>
        </div>
      </section>
      <section class="card settings">
        <h2>Room settings ${host ? "" : '<small>(set by the host)</small>'}</h2>
        <div class="settings-grid">
          ${settingSelect("mode", AVAILABLE_MODES.map((m) => [m, MODE_NAMES[m]]), s.mode, dis)}
          ${settingSelect("map", Object.values(MAPS).map((m) => [m.id, m.name]), s.map, dis)}
          ${settingSelect("durationMin", DURATIONS.map((d) => [d, `${d} minutes`]), s.durationMin, dis)}
          ${settingSelect("scoreLimit", [0, 10, 20, 30, 50].map((n) => [n, n === 0 ? "None" : `${n}`]), s.scoreLimit, dis)}
          ${settingSelect("bots", Array.from({ length: s.mode === "training" ? 4 : 8 }, (_, i) => [i, `${i}`]), s.bots, dis)}
          ${settingSelect("botDifficulty", [["easy", "Easy"], ["normal", "Normal"], ["hard", "Hard"]], s.botDifficulty, dis)}
          ${settingSelect("respawnSec", [1, 2, 3, 5, 10].map((n) => [n, `${n} s`]), s.respawnSec, dis)}
          ${settingSelect("gravity", multOpts, s.gravity, dis)}
          ${settingSelect("moveSpeed", multOpts, s.moveSpeed, dis)}
          ${settingSelect("thrust", multOpts, s.thrust, dis)}
          ${settingSelect("fuelCapacity", multOpts, s.fuelCapacity, dis)}
          ${settingSelect("recharge", multOpts, s.recharge, dis)}
          ${settingSelect("health", multOpts, s.health, dis)}
          ${settingSelect("damage", multOpts, s.damage, dis)}
        </div>
        <div class="checks">
          ${settingCheck("flight", s.flight, dis)}
          ${settingCheck("unlimitedFuel", s.unlimitedFuel, dis)}
          ${settingCheck("unlimitedAmmo", s.unlimitedAmmo, dis)}
          ${settingCheck("friendlyFire", s.friendlyFire, dis || !teamMode)}
          ${settingCheck("mapPickups", s.mapPickups, dis)}
        </div>
      </section>
    </main>
    <div class="lobby-actions">
      <button id="leave" class="danger">Leave</button>
      ${host ? `<button id="start" class="primary big">Start round</button>` : `<span class="muted">Waiting for the host to start…</span>`}
    </div>`;

  app.querySelector("#copy")!.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast("Invite link copied.");
    } catch {
      toast(link);
    }
  });
  app.querySelector("#ready")!.addEventListener("click", () => net.send({ t: "ready", ready: !me?.ready }));
  app.querySelector("#leave")!.addEventListener("click", leaveRoom);
  app.querySelector("#start")?.addEventListener("click", () => net.send({ t: "start" }));
  for (const b of app.querySelectorAll<HTMLButtonElement>("button[data-team]")) {
    b.addEventListener("click", () => net.send({ t: "team", team: Number(b.dataset.team) as 0 | 1 }));
  }
  for (const el of app.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-setting]")) {
    el.addEventListener("change", () => {
      const key = el.dataset.setting as keyof RoomSettings;
      const current = r.settings[key];
      let value: unknown;
      if (el instanceof HTMLInputElement && el.type === "checkbox") value = el.checked;
      else value = typeof current === "number" ? Number(el.value) : el.value;
      net.send({ t: "settings", settings: { [key]: value } as Partial<RoomSettings> });
    });
  }
}

// ---------- results ----------

const SAVE_TEXT: Record<SaveStatus, string> = {
  saving: "Saving results…",
  saved: "Results saved to your match history.",
  failed: "These results could not be saved. They are shown here but won't appear in your history.",
};

function renderResults(): void {
  if (!results) return;
  setScreen("results");
  const { result, save } = results;
  const team = TEAM_MODES.includes(result.mode);
  let headline: string;
  if (result.reason === "abandoned") headline = "Match abandoned";
  else if (result.draw) headline = "Draw";
  else if (team && result.winnerTeam !== null && result.winnerTeam !== -1) headline = `${TEAM_NAMES[result.winnerTeam]} win`;
  else headline = `${esc(result.participants.find((p) => result.winnerKeys.includes(p.key))?.name ?? "?")} wins`;
  const host = isHost();
  app.innerHTML = `
    <main class="results">
      <h1>${headline}</h1>
      ${team ? `<p class="final">${TEAM_NAMES[0]} <b>${result.teamScores[0]}</b> : <b>${result.teamScores[1]}</b> ${TEAM_NAMES[1]}</p>` : ""}
      <p class="save ${save}" role="status">${SAVE_TEXT[save]}</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Pilot</th>${team ? "<th>Team</th>" : ""}<th>K</th><th>D</th><th>A</th><th>Score</th><th></th></tr></thead>
        <tbody>${result.participants
          .map(
            (p) => `<tr class="${p.key === room?.you ? "me" : ""}">
              <td>${esc(p.name)}${p.bot ? ' <small class="muted">bot</small>' : ""}</td>
              ${team ? `<td>${p.team === -1 ? "" : TEAM_NAMES[p.team]}</td>` : ""}
              <td>${p.kills}</td><td>${p.deaths}</td><td>${p.assists}</td><td>${p.score}</td>
              <td>${p.mvp ? '<span class="mvp">MVP</span>' : ""}</td></tr>`,
          )
          .join("")}</tbody>
      </table></div>
      <p class="muted small">${esc(result.scoringNote)}</p>
      <div class="lobby-actions">
        <button id="leave" class="danger">Leave room</button>
        ${host ? `<button id="rematch" class="primary big">Rematch</button>` : `<span class="muted">The host can start a rematch.</span>`}
      </div>
    </main>`;
  app.querySelector("#leave")!.addEventListener("click", leaveRoom);
  app.querySelector("#rematch")?.addEventListener("click", () => net.send({ t: "rematch" }));
}

// ---------- messages ----------

function startGame(m: Extract<ServerMessage, { t: "match" }>): void {
  game?.destroy();
  results = null;
  setScreen("game");
  app.innerHTML = "";
  const root = document.createElement("div");
  root.className = "game";
  app.appendChild(root);
  game = new GameSession(root, net, m, {
    isHost,
    leave: leaveRoom,
    endRound: () => net.send({ t: "end" }),
    reducedShake,
  });
}

net.on((m) => {
  switch (m.t) {
    case "welcome":
      profile = m.profile;
      break;
    case "room":
      room = m.room;
      if (room.state === "lobby") {
        game?.destroy();
        game = null;
        results = null;
        if (autoStart && isHost()) {
          autoStart = false;
          net.send({ t: "start" });
        }
        renderLobby();
      } else if (room.state === "results" && results && screen === "results") {
        renderResults();
      } else if (room.state === "playing" && !game) {
        setScreen("waiting");
        app.innerHTML = `<div class="waiting"><p>Joining the match…</p></div>`;
      }
      break;
    case "match":
      startGame(m);
      break;
    case "results":
      game?.destroy();
      game = null;
      results = { result: m.result, save: m.save };
      renderResults();
      break;
    case "save":
      if (results && results.result.matchId === m.matchId) {
        results.save = m.save;
        if (screen === "results") renderResults();
      }
      break;
    case "error":
      toast(m.message, "error");
      if (!room && screen === "waiting") {
        net.roomCode = null;
        renderHome();
      }
      break;
    case "left":
      if (net.roomCode === null || screen !== "waiting") {
        room = null;
        game?.destroy();
        game = null;
        results = null;
        if (screen !== "home") renderHome();
      }
      break;
    default:
      break;
  }
});

net.onStatus((s) => {
  game?.setConnection(s === "open" ? null : "Connection lost. Reconnecting…");
});

async function boot(): Promise<void> {
  try {
    profile = (await api<{ profile: Profile }>("/api/session", { method: "POST" })).profile;
  } catch {
    app.innerHTML = `<div class="waiting"><p>The server isn't answering. Refresh to try again.</p></div>`;
    return;
  }
  net.connect();
  const invite = location.pathname.match(/^\/r\/([A-Z0-9]{5})$/);
  if (invite) joinRoom(invite[1]);
  else renderHome();
}

void boot();
