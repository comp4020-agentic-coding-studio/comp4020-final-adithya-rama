import "./styles.css";
import { MAPS } from "../shared/maps.ts";
import type { HistoryEntry, Profile, RoomListing, RoomView, SaveStatus, ServerMessage, RoomPreset, WeaponStats } from "../shared/protocol.ts";
import { AVAILABLE_MODES, DURATIONS, MODE_NAMES, MULTIPLIERS, TEAM_MODES } from "../shared/settings.ts";
import type { MatchResult, RoomSettings } from "../shared/types.ts";
import { api, esc, hex, toast } from "./dom.ts";
import { GameSession } from "./game.ts";
import { Net } from "./net.ts";
import { WEAPONS, THROWABLES } from "../shared/weapons.ts";
import { ACTION_LABELS, BINDABLE_CODE, bindingsOf, DEFAULT_BINDINGS, keyLabel } from "./input.ts";
import { avatarOf, avatarSvg, weaponIcon, weaponName } from "./art.ts";
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
let presets:RoomPreset[]=[];
const messages:{name:string;text:string}[]=[];

async function savePrefs(patch:Record<string,unknown>):Promise<void> {
  try {
    profile=(await api<{profile:Profile}>("/api/me",{method:"PATCH",body:{prefs:{...profile.prefs,...patch}}})).profile;
    // Profile broadcasts can rerender the lobby before this HTTP response.
    // Reconcile preference controls after the saved value becomes authoritative.
    for(const input of document.querySelectorAll<HTMLInputElement>("[data-chat-mute]"))input.checked=profile.prefs.chatMuted===true;
    renderChatLog();
  }
  catch(e){toast((e as Error).message,"error");}
}

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

function previewScenery(map:typeof MAPS[string]):string {
  return (map.scenery??[]).map(s=>{
    const x=s.x,y=s.y,h=s.h??170,w=s.w??120;
    if(s.kind==="palm")return '<g transform="translate('+x+' '+y+')"><path d="M0 0Q-20 -'+h*.55+' 15 -'+h+'" fill="none" stroke="#253d3e" stroke-width="26"/><path d="M0 0Q-20 -'+h*.55+' 15 -'+h+'" fill="none" stroke="#9f8963" stroke-width="17"/>'+[-1,1].map(dir=>'<path d="M15 -'+h+'Q'+(dir*w*.7)+' -'+(h+w*.35)+' '+(dir*w)+' -'+(h-w*.2)+'Q'+(dir*w*.3)+' -'+(h+w*.1)+' 15 -'+h+'M15 -'+h+'Q'+(dir*w*.2)+' -'+(h+w*.65)+' '+(dir*w*.55)+' -'+(h+w*.45)+'Q'+(dir*w*.4)+' -'+(h+w*.1)+' 15 -'+h+'" fill="#658d54" stroke="#254537" stroke-width="6"/>').join("")+'</g>';
    if(s.kind==="pine")return '<g transform="translate('+x+' '+y+')"><path d="M0 0v-'+h+'" stroke="#8b8066" stroke-width="17"/><path d="M0 -'+h+'l-'+w*.45+' '+h*.42+'h'+w*.18+'l-'+w*.3+' '+h*.32+'h'+w*.26+'l-'+w*.3+' '+h*.2+'h'+w*1.22+'l-'+w*.3+' -'+h*.2+'h'+w*.26+'l-'+w*.3+' -'+h*.32+'h'+w*.18+'Z" fill="#527c74" stroke="#243e47" stroke-width="7"/></g>';
    if(s.kind==="fern")return '<g transform="translate('+x+' '+y+')"><path d="M0 0Q-40 -75 -85 -60Q-45 -30 0 0Q-25 -80 -5 -105Q20 -60 0 0Q35 -85 85 -70Q45 -25 0 0" fill="#7fa061" stroke="#36553d" stroke-width="5"/></g>';
    if(s.kind==="crate")return '<g transform="translate('+(x-w/2)+' '+(y-h)+')"><rect width="'+w+'" height="'+h+'" rx="5" fill="#9c8158" stroke="#35463c" stroke-width="8"/><path d="M10 10L'+(w-10)+' '+(h-10)+'M'+(w-10)+' 10L10 '+(h-10)+'" stroke="#c4a273" stroke-width="12"/></g>';
    if(s.kind==="bunker")return '<g transform="translate('+(x-w/2)+' '+(y-h)+')"><rect width="'+w+'" height="'+h+'" fill="#52675e" stroke="#293f40" stroke-width="9"/><path d="M-15 0h'+(w+30)+'M8 '+h*.25+'h'+(w-16)+'M8 '+h*.5+'h'+(w-16)+'M8 '+h*.75+'h'+(w-16)+'" stroke="#718374" stroke-width="14"/><rect x="'+w*.28+'" y="'+h*.36+'" width="'+w*.44+'" height="'+h*.3+'" fill="#1c343b" stroke="#324944" stroke-width="7"/></g>';
    return "";
  }).join("");
}

function arenaPreview(mapId:string):string {
  const map=MAPS[mapId]??MAPS["outpost-yard"];
  const rock=hex(map.theme.rock),accent=hex(map.theme.accent);
  return '<svg class="arena-preview" viewBox="0 0 '+map.width+' '+map.height+'" preserveAspectRatio="xMidYMid slice" role="img" aria-label="'+esc(map.name)+' arena preview">'+
    '<rect width="100%" height="100%" fill="'+hex(map.theme.sky)+'"/><circle cx="'+map.width*.73+'" cy="'+map.height*.2+'" r="'+map.height*.13+'" fill="#f6deb0" opacity=".8"/>'+
    '<path d="M0 '+map.height*.62+' Q'+map.width*.2+' '+map.height*.15+' '+map.width*.4+' '+map.height*.58+' T'+map.width+' '+map.height*.4+' V'+map.height+' H0Z" fill="#263f42" opacity=".3"/>'+
    map.solids.map(r=>'<rect x="'+r.x+'" y="'+r.y+'" width="'+r.w+'" height="'+r.h+'" fill="'+rock+'" stroke="#20313a" stroke-width="8"/><path d="M'+r.x+' '+r.y+'h'+r.w+'" stroke="'+accent+'" stroke-width="12"/>').join("")+
    map.platforms.map(r=>'<rect x="'+r.x+'" y="'+r.y+'" width="'+r.w+'" height="'+Math.max(10,r.h)+'" rx="4" fill="'+hex(map.theme.platform)+'" stroke="#20313a" stroke-width="6"/>').join("")+
    previewScenery(map)+
    map.flagHomes.map(f=>'<path d="M'+f.x+' '+f.y+'v-85h55l-14 17 14 17h-55" fill="'+(f.team===0?"#ee8653":"#71c5e1")+'" stroke="#20313a" stroke-width="5"/>').join("")+'</svg>';
}

function renderHome(): void {
  setScreen("home");
  setPath("/");
  const kd = profile.deaths > 0 ? (profile.kills / profile.deaths).toFixed(2) : String(profile.kills);
  app.innerHTML = `
    <nav class="home-nav"><a class="wordmark" href="/" aria-label="Jet Skirmish home">JET <span>SKIRMISH</span><small>THE ARENA IS YOURS</small></a><button id="profile-button" class="pilot-chip" aria-haspopup="dialog"><span class="pilot-chip-art">${avatarSvg(avatarOf(profile.prefs.avatar),profile.color)}</span><span><small>YOUR PILOT</small><b>${esc(profile.name)}</b></span><span aria-hidden="true">⚙</span></button></nav>
    <main class="home">
      <section class="hero-stage">
        <div class="hero-landscape">${arenaPreview("outpost-yard")}</div>
        <div class="hero-copy"><span class="eyebrow">2D JETPACK COMBAT · UP TO 8 PILOTS</span><h1>Small squads.<br><em>Big air.</em></h1><p>Find your crew. Pick your arsenal.<br>Make the whole arena your playground.</p></div>
        <div class="hero-pilot" aria-hidden="true">${avatarSvg(avatarOf(profile.prefs.avatar),profile.color)}</div>
        <div class="arena-caption"><span class="live-dot"></span><b>OUTPOST YARD</b><span>One of four original arenas</span></div>
        <div class="hero-mission"><span>FLAG DELIVERY</span><b>Your flag. Their goal.</b><p>Carry your team's flag across the arena. Keep flying. Score for your squad.</p></div>
      </section>
      <section class="card play">
        <div class="section-heading"><span class="eyebrow">READY FOR TAKEOFF?</span><h2>Let’s play.</h2></div>
        <button id="quick" class="primary big action-tile"><span>Quick play<small>Find a public room or open one</small></span><b aria-hidden="true">↗</b></button>
        <div class="practice-block"><button id="practice" class="big action-tile"><span>Practice against bots<small>Start flying at your own pace</small></span><b aria-hidden="true">◎</b></button><label class="practice-level">Bot level <select id="practice-difficulty"><option value="easy">Easy · learn the ropes</option><option value="normal">Normal · stay moving</option><option value="hard">Hard · keep your guard up</option></select></label></div>
        <div class="extra-modes"><button id="survival">Survival squad<small>Waves of enemies</small></button><button id="range">Weapon test range<small>Try the whole arsenal</small></button></div>
        <p class="muted small"><kbd>A</kbd><kbd>D</kbd> move · <kbd>Space</kbd> fly<br>Mouse or <kbd>Num 2/4/6/8</kbd> aim & fire</p>
        <details id="join"><summary>Join with code <span>→</span></summary><form id="join-form" class="stack">
          <label class="grow">Room code <input id="code" name="code" required minlength="5" maxlength="5" autocomplete="off" autocapitalize="characters" placeholder="ABCDE"></label>
          <label class="grow">Password <input name="password" type="password" maxlength="64" placeholder="If required" autocomplete="off"></label><button class="primary">Join room</button>
        </form></details>
        <details id="create">
          <summary>Create a room <span>＋</span></summary>
          <form id="create-form" class="stack">
            <label>Room name <input name="name" maxlength="24" placeholder="Optional"></label>
            <label>Mode <select name="mode">${AVAILABLE_MODES.filter((m) => m !== "training")
              .map((m) => `<option value="${m}" ${m === "tdm" ? "selected" : ""}>${MODE_NAMES[m]}</option>`)
              .join("")}</select></label>
            <label>Map <select name="map">${Object.values(MAPS).filter(m=>m.id!=="test-range")
              .map((m) => `<option value="${m.id}">${esc(m.name)}</option>`)
              .join("")}</select></label>
            <label>Password <input name="password" type="password" maxlength="64" placeholder="Optional" autocomplete="new-password"></label>
            <label class="check"><input type="checkbox" name="isPublic" checked> Show in public room list</label><p class="muted small">You are the host. Invite friends, choose teams and set the rules before starting.</p>
            <button class="primary">Create room</button>
          </form>
        </details>
      </section>
      <dialog id="profile-drawer" class="app-dialog profile-drawer"><section class="profile"><button type="button" data-close-profile class="drawer-close" aria-label="Close pilot profile">×</button>
        <h2>Your pilot</h2><div id="avatar-preview" class="avatar-preview">${avatarSvg(avatarOf(profile.prefs.avatar),profile.color)}</div>
        <form id="profile-form" class="stack">
          <label>Name <input name="name" required maxlength="16" value="${esc(profile.name)}"></label>
          <fieldset class="swatches"><legend>Colour</legend>
            ${PALETTE.map(
              (c) =>
                `<label style="--c:${hex(c)}"><input type="radio" name="color" value="${c}" ${c === profile.color ? "checked" : ""}><span class="sr">${hex(c)}</span></label>`,
            ).join("")}
          </fieldset>
          <div class="avatar-fields">
            ${avatarSelect("helmet",["pilot","visor","cap","mohawk"])}
            ${avatarSelect("face",["light","medium","dark","robot"])}
            ${avatarSelect("emblem",["star","bolt","skull"])}
          </div>
          <label class="check"><input type="checkbox" name="muted" ${profile.prefs.muted===true?"checked":""}> Mute sound</label>
          <label>Sound volume <input type="range" name="volume" min="0" max="1" step=".05" value="${Number(profile.prefs.volume??.35)}"></label>
          <label class="check"><input type="checkbox" name="chatMuted" ${profile.prefs.chatMuted===true?"checked":""}> Mute room chat</label>
          <label class="check"><input type="checkbox" name="reducedShake" ${reducedShake() ? "checked" : ""}> Reduce screen shake</label>
          <button>Save</button>
        </form>
        <button id="bindings">Keyboard controls</button>
        <p class="stats"><span><b>${profile.matches}</b> matches</span><span><b>${profile.wins}</b> wins</span><span><b>${kd}</b> K/D</span><span><b>${profile.mvps}</b> MVPs</span></p>
        <p class="muted small">Stats count player-versus-player matches. Your pilot is remembered in this browser.</p>
      </section>
      </dialog><section class="card rooms">
        <div class="section-heading row"><div><span class="eyebrow">FIND YOUR CREW</span><h2>Open rooms</h2></div><button id="refresh-rooms" class="quiet">Refresh</button></div>
        <ul id="room-list" class="list"><li class="muted">Looking…</li></ul>
      </section>
      <section class="card armoury"><h2>Your armoury</h2><p class="muted small">All equipment is available from the start.</p><details><summary>Weapon statistics</summary><div id="weapon-stats" class="table-wrap">Loading…</div></details><details><summary>Explore all equipment</summary><div class="armoury-grid">${Object.values(WEAPONS).map(w=>`<div>${weaponIcon(w.id)}<b>${esc(w.name)}</b><small>${w.category} · ${w.mag} rounds</small></div>`).join("")}</div><p class="muted small">Standard: frag, flashbang and poison smoke. EMP and proximity mines are advanced room options.</p></details></section>
      <section class="card history">
        <div class="section-heading"><span class="eyebrow">YOUR FLIGHT LOG</span><h2>Recent matches</h2></div>
        <ul id="history" class="list"><li class="muted">Loading…</li></ul>
        <button id="more" hidden>Load more</button>
      </section>
    </main>
    <footer class="foot"><span>Original arenas. No unlock grind.</span><a href="/readme/">About this game</a><button id="home-controls" class="quiet">Keyboard controls</button></footer>`;

  const drawer=app.querySelector<HTMLDialogElement>("#profile-drawer")!;
  app.querySelector("#profile-button")!.addEventListener("click",()=>drawer.showModal());
  app.querySelector("[data-close-profile]")!.addEventListener("click",()=>drawer.close());
  app.querySelector("#home-controls")!.addEventListener("click",openBindings);
  app.querySelector("#refresh-rooms")!.addEventListener("click",()=>void loadRooms());
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
        body: { name: "Practice", isPublic: false, settings: { mode: "training", bots: 2, botDifficulty: app.querySelector<HTMLSelectElement>("#practice-difficulty")!.value } },
      });
      autoStart = true;
      joinRoom(code);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  });
  app.querySelector<HTMLFormElement>("#join-form")!.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd=new FormData(e.target as HTMLFormElement);
    const code = String(fd.get("code")).trim().toUpperCase();
    joinRoom(code,String(fd.get("password")??""));
  });
  app.querySelector<HTMLFormElement>("#create-form")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    try {
      const { code } = await api<{ code: string }>("/api/rooms", {
        method: "POST",
        body: { name: fd.get("name"), password:fd.get("password"), isPublic: fd.get("isPublic") === "on", settings: { mode: fd.get("mode"), map: fd.get("map") } },
      });
      joinRoom(code,String(fd.get("password")??""));
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
        body: { name: fd.get("name"), color: Number(fd.get("color") ?? profile.color), prefs: { ...profile.prefs, reducedShake: fd.get("reducedShake") === "on",muted:fd.get("muted")==="on",volume:Number(fd.get("volume")),chatMuted:fd.get("chatMuted")==="on",avatar:{helmet:fd.get("helmet"),face:fd.get("face"),emblem:fd.get("emblem")} } },
      });
      profile = p;
      drawer.close();renderHome();toast("Pilot saved. Ready for takeoff.");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  });
  app.querySelector("#range")!.addEventListener("click",async()=>{try{const {code}=await api<{code:string}>("/api/rooms",{method:"POST",body:{name:"Weapon range",isPublic:false,settings:{mode:"training",map:"test-range",bots:0}}});autoStart=true;joinRoom(code);}catch(e){toast((e as Error).message,"error");}});
  app.querySelector("#bindings")!.addEventListener("click",openBindings);
  app.querySelector("#survival")!.addEventListener("click",async()=>{try{const {code}=await api<{code:string}>("/api/rooms",{method:"POST",body:{name:"Survival squad",isPublic:true,settings:{mode:"survival",map:"outpost-yard",capacity:4,bots:0}}});joinRoom(code);}catch(e){toast((e as Error).message,"error");}});
  app.querySelector("#profile-form")!.addEventListener("input",e=>{const fd=new FormData(e.currentTarget as HTMLFormElement);app.querySelector("#avatar-preview")!.innerHTML=avatarSvg(avatarOf({helmet:fd.get("helmet"),face:fd.get("face"),emblem:fd.get("emblem")}),Number(fd.get("color")??profile.color));});
  void loadWeaponStats();
  app.querySelector("#more")!.addEventListener("click", () => void loadHistory(false));

  void loadRooms();
  if(roomPoll!==undefined)clearInterval(roomPoll);
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
        ? `<li class="room-empty"><b>The runway is clear.</b><span>No public rooms yet. Quick play opens one for other pilots to join.</span></li>`
        : rooms
            .map(
              (r) => `<li class="room-row room-card">
                <span><b>${esc(r.name)} <span class="room-status ${r.state}">${r.players>=r.capacity?"FULL":r.state==="playing"?"LIVE":r.state==="results"?"REMATCH":"LOBBY"}</span></b><small>${MODE_NAMES[r.mode]} · ${esc(mapName(r.map))} · ${r.hasPassword?"Password required":"Open entry"}</small></span>
                <span class="count"><b>${r.players}/${r.capacity}</b><small>pilots</small></span>
                <span class="room-join"><button data-code="${r.code}" data-password="${!!r.hasPassword}" ${r.players >= r.capacity ? "disabled" : ""}>Join</button><button data-watch="${r.code}" data-password="${!!r.hasPassword}">Watch</button></span>
              </li>`,
            )
            .join("");
    for (const b of list.querySelectorAll<HTMLButtonElement>("button[data-code]")) b.addEventListener("click", () => b.dataset.password==="true"?openJoinDialog(b.dataset.code!,false):joinRoom(b.dataset.code!));
    for(const b of list.querySelectorAll<HTMLButtonElement>("button[data-watch]"))b.addEventListener("click",()=>b.dataset.password==="true"?openJoinDialog(b.dataset.watch!,true):joinRoom(b.dataset.watch!,"",true));
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
          <button data-match="${esc(m.id)}" class="small">Details</button>
        </li>`;
      })
      .join("");
    if (reset) list.innerHTML = rows || `<li class="muted">No matches yet. They'll be listed here after you play.</li>`;
    else list.insertAdjacentHTML("beforeend", rows);
    more.hidden = !next;
    for(const b of list.querySelectorAll<HTMLButtonElement>("[data-match]"))b.onclick=()=>void showMatch(b.dataset.match!);
  } catch {
    list.innerHTML = `<li class="muted">Couldn't load your matches.</li>`;
  }
}

// ---------- rooms ----------

function joinRoom(code: string,password="",spectate=false): void {
  if (!/^[A-Z0-9]{5}$/.test(code)) {
    toast("Room codes are five letters or digits.", "error");
    return;
  }
  net.roomCode = code;
  net.roomPassword=password;net.spectating=spectate;
  if (net.open) net.send({ t: "join", code,password,spectate });
  setScreen("waiting");
  app.innerHTML = `<div class="waiting"><p>Joining room ${code}…</p></div>`;
}

function leaveRoom(): void {
  net.send({ t: "leave" });
  net.roomCode = null;
  net.roomPassword="";net.spectating=false;messages.length=0;
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
  capacity:"Player capacity",
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
  const openDetails=[...app.querySelectorAll<HTMLDetailsElement>("details[open]")].map(d=>d.querySelector("summary")?.textContent);
  const chatDraft=app.querySelector<HTMLInputElement>('[data-chat-form] input')?.value??"";
  const focused=document.activeElement instanceof HTMLInputElement&&document.activeElement.name==="message";
  setScreen("lobby");
  setPath(`/r/${room.code}`);
  const r = room;
  const host = isHost();
  const me = r.members.find((m) => m.key === r.you);
  const s = r.settings;
  const teamMode = TEAM_MODES.includes(s.mode);
  const pilots=r.members.filter(m=>m.connected&&!m.spectator);
  const waiting=pilots.filter(m=>!m.host&&!m.ready);
  let startReason="";
  if(!pilots.length)startReason="At least one pilot must join the squad.";
  else if(waiting.length)startReason="Waiting for "+waiting.map(m=>m.name).join(", ")+" to get ready.";
  else if(s.mode!=="training"&&s.mode!=="survival"&&pilots.length+s.bots<2)startReason="Invite another pilot or add a bot to start.";
  else if(pilots.length+s.bots>s.capacity&&s.mode!=="training"&&s.mode!=="survival")startReason="Reduce bots or increase capacity to fit the squad.";
  else if(teamMode&&s.bots===0&&(!pilots.some(m=>m.team===0)||!pilots.some(m=>m.team===1)))startReason="Both teams need a pilot. Choose a team below.";
  const readyCount=pilots.filter(m=>m.host||m.ready).length;
  const member = (m: RoomView["members"][number]) =>
    `<li class="${m.key === r.you ? "me" : ""}"><i class="dot" style="background:${hex(m.color)}"></i>${esc(m.name)}${m.host ? ' <span class="tag">host</span>' : ""}${
      m.spectator?' <span class="tag">spectator</span>':""}${
      m.connected ? "" : ' <span class="tag away">reconnecting</span>'
    }${m.spectator?'':m.host?' <span class="tag ready">host ready</span>':m.ready?' <span class="tag ready">ready</span>':' <span class="tag not-ready">not ready</span>'}</li>`;
  const membersHtml = teamMode
    ? `<div class="teams">${[0, 1]
        .map(
          (t) => `<div class="team" style="--team:${hex(TEAM_COLORS[t])}">
            <h3>${TEAM_NAMES[t]}</h3>
            <ul class="list">${r.members.filter((m) => m.team === t && !m.spectator).map(member).join("") || '<li class="muted">Nobody yet</li>'}</ul>
            ${me && !me.spectator && me.team !== t ? `<button data-team="${t}">Join ${TEAM_NAMES[t]}</button>` : ""}
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
        <span class="eyebrow">SQUAD LOBBY · ${host?"YOU ARE THE HOST":"CHOOSE A TEAM & GET READY"}</span><h1>${esc(r.name)}</h1>
        <p class="muted">${MODE_NAMES[s.mode]} on ${esc(mapName(s.map))} · ${r.isPublic ? "listed publicly" : "private"}</p>
      </div>
      <div class="invite">
        <span>Room code <b class="code">${r.code}</b></span>
        <button id="copy">Copy invite link</button><small>${r.hasPassword?"Password protected · share the password separately":"Share this code or link with your crew"}</small>
      </div>
    </header>
    <main class="lobby">
      <section class="card members">
        <div class="lobby-readiness" role="status"><b>${readyCount}/${pilots.length} pilots ready</b><span>${startReason?esc(startReason):host?"Your squad is ready. Start when you are.":"Ready for takeoff. Waiting for the host."}</span></div><h2>Pilots <small>${r.members.filter(m=>!m.spectator).length}/${s.capacity}${s.bots ? ` + ${s.bots} bot${s.bots > 1 ? "s" : ""}` : ""}</small></h2>
        ${membersHtml}
        ${teamMode?`<ul class="list">${r.members.filter(m=>m.spectator).map(member).join("")}</ul>`:""}
        ${s.bots?'<p class="bot-summary">＋ '+s.bots+' '+s.botDifficulty+' bot'+(s.bots===1?'':'s')+' will join when the round starts.</p>':""}
        <div class="row">
          <button id="spectate">${me?.spectator?"Join as pilot":"Spectate"}</button>
          <button id="ready" ${me?.spectator||host?"disabled":""} class="${me?.ready ? "on" : ""}" aria-pressed="${me?.ready ? "true" : "false"}">${host?"Host is ready":me?.ready ? "Ready ✓ · click to unready" : "I'm ready"}</button>
        </div>
      </section>
      <section class="card settings">
        <div class="section-heading"><span class="eyebrow">${host?"YOUR ROOM, YOUR RULES":"HOST’S ROOM RULES"}</span><h2>Mission briefing</h2></div><div class="lobby-map-preview">${arenaPreview(s.map)}<b>${esc(mapName(s.map))}</b></div><p class="mode-brief">${s.mode==="flag"?"Carry your own team’s flag to the opposing goal. Dropped flags stay where they land.":s.mode==="survival"?"Hold out together. Defeat each wave to revive fallen teammates.":s.mode==="training"?"Explore, practise flight and try equipment against bots.":s.mode==="tdm"?"Two teams. Most enemy eliminations wins.":"Every pilot for themselves. Most eliminations wins."}</p>
        <div class="settings-grid">
          ${settingSelect("mode", AVAILABLE_MODES.map((m) => [m, MODE_NAMES[m]]), s.mode, dis)}
          ${settingSelect("map", Object.values(MAPS).filter(m=>s.mode==="training"||m.id!=="test-range").map((m) => [m.id, m.name]), s.map, dis)}
          ${settingSelect("capacity",Array.from({length:s.mode==="survival"?4:s.mode==="training"?1:8},(_,i)=>[i+1,String(i+1)]),s.capacity,dis)}
          ${settingSelect("durationMin", DURATIONS.map((d) => [d, `${d} minutes`]), s.durationMin, dis)}
          ${settingSelect("scoreLimit", [0, 10, 20, 30, 50].map((n) => [n, n === 0 ? "None" : `${n}`]), s.scoreLimit, dis)}
          ${settingSelect("bots", Array.from({ length: s.mode === "training" ? 4 : 8 }, (_, i) => [i, `${i}`]), s.bots, dis)}
          ${settingSelect("botDifficulty", [["easy", "Easy"], ["normal", "Normal"], ["hard", "Hard"]], s.botDifficulty, dis)}
        </div><p class="bot-explainer">Easy gives you breathing room. Normal reacts faster; Hard is a sharper challenge.</p>
        <details class="advanced-rules"><summary>Advanced movement & combat</summary><div class="settings-grid">
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
        </details>
        ${arsenalSettings(s,dis)}
        <details class="preset-controls"><summary>Saved rule presets</summary><label>Saved preset <select id="presets"><option value="">Choose a preset</option>${presets.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select></label><div class="row"><button id="apply-preset" ${dis?"disabled":""}>Apply preset</button><button id="save-preset">Save current rules</button><button id="delete-preset">Delete preset</button></div></details>
      </section>
      <section class="card room-chat"><h2>Room chat</h2>${chatMarkup()}</section>
    </main>
    <div class="lobby-actions lobby-launch">
      <button id="leave" class="danger">Leave room</button><p id="start-status" role="status">${startReason?esc(startReason):host?"Squad ready. The arena is waiting.":"Ready? The host will launch the round."}</p>
      ${host ? `<button id="start" class="primary big" ${startReason?"disabled":""} aria-describedby="start-status">Start round ↗</button>` : `<span class="tag">Host starts the round</span>`}
    </div>`;

  for(const d of app.querySelectorAll<HTMLDetailsElement>("details"))if(openDetails.includes(d.querySelector("summary")?.textContent))d.open=true;
  const chatInput=app.querySelector<HTMLInputElement>('[data-chat-form] input');if(chatInput){chatInput.value=chatDraft;if(focused)chatInput.focus();}
  app.querySelector("#copy")!.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast("Invite link copied.");
    } catch {
      toast(link);
    }
  });
  app.querySelector("#spectate")!.addEventListener("click",()=>net.send({t:"spectate",spectate:!me?.spectator}));
  bindArsenal(app,s);
  bindChat(app);
  bindPresets();
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
  failed: "Final results are not saved yet. Retry saving; your last checkpoint may still appear in history.",
};

function renderResults(): void {
  if (!results) return;
  setScreen("results");
  const { result, save } = results;
  const team = TEAM_MODES.includes(result.mode);
  let headline: string;
  if (result.reason === "abandoned") headline = "Match abandoned";
  else if(result.mode==="survival")headline=result.reason==="defeat"?"Squad defeated":"Survival round complete";
  else if (result.draw) headline = "Draw";
  else if (team && result.winnerTeam !== null && result.winnerTeam !== -1) headline = `${TEAM_NAMES[result.winnerTeam]} win`;
  else headline = `${esc(result.participants.find((p) => result.winnerKeys.includes(p.key))?.name ?? "?")} wins`;
  const host = isHost();
  app.innerHTML = `
    <main class="results">
      <h1>${headline}</h1>
      ${result.mode==="survival"?`<p class="final"><b>${result.wavesCleared??0}</b> waves cleared</p>`:""}
      ${team ? `<p class="final">${TEAM_NAMES[0]} <b>${result.teamScores[0]}</b> : <b>${result.teamScores[1]}</b> ${TEAM_NAMES[1]}</p>` : ""}
      <p class="save ${save}" role="status">${SAVE_TEXT[save]}</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Pilot</th>${team ? "<th>Team</th>" : ""}<th>K</th><th>D</th><th>A</th><th>Flags</th><th>Score</th><th></th></tr></thead>
        <tbody>${result.participants
          .map(
            (p) => `<tr class="${p.key === room?.you ? "me" : ""}">
              <td>${esc(p.name)}${p.bot ? ' <small class="muted">bot</small>' : ""}</td>
              ${team ? `<td>${p.team === -1 ? "" : TEAM_NAMES[p.team]}</td>` : ""}
              <td>${p.kills}</td><td>${p.deaths}</td><td>${p.assists}</td><td>${p.deliveries}</td><td>${p.score}</td>
              <td>${p.mvp ? '<span class="mvp">MVP</span>' : ""}</td></tr>`,
          )
          .join("")}</tbody>
      </table></div>
      <p class="muted small">${esc(result.scoringNote)}</p>
      ${save==="failed"?'<button id="retry-save">Retry saving results</button>':""}
      <div class="lobby-actions">
        <button id="leave" class="danger">Leave room</button>
        ${host ? `<button id="rematch" class="primary big" ${save!=="saved"?"disabled":""}>Rematch</button>` : `<span class="muted">The host can start a rematch.</span>`}
      </div>
    </main>`;
  app.querySelector("#leave")!.addEventListener("click", leaveRoom);
  app.querySelector("#retry-save")?.addEventListener("click",()=>net.send({t:"retry-save"}));
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
    prefs:()=>profile.prefs,
    savePrefs,
    editRules:()=>openNextRules(),
  });
}

net.on((m) => {
  switch (m.t) {
    case "chat":
      if(profile.prefs.chatMuted!==true){messages.push({name:m.name,text:m.text});if(messages.length>40)messages.shift();renderChatLog();}
      break;
    case "welcome":
      profile = m.profile;
      break;
    case "room":
      room = m.room;
      net.spectating=room.members.find(p=>p.key===room!.you)?.spectator===true;
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
  void loadPresets();
  if (invite) {renderHome();openJoinDialog(invite[1],false);}
  else renderHome();
}


function avatarSelect(name:"helmet"|"face"|"emblem",values:string[]):string {
  const chosen=avatarOf(profile.prefs.avatar)[name];
  return '<label>'+name[0].toUpperCase()+name.slice(1)+'<select name="'+name+'">'+values.map(v=>'<option value="'+v+'" '+(v===chosen?'selected':'')+'>'+v[0].toUpperCase()+v.slice(1)+'</option>').join("")+'</select></label>';
}
function dialog(title:string,body:string):HTMLDialogElement {
  for(const existing of document.querySelectorAll<HTMLDialogElement>("dialog[open]"))existing.close();
  document.querySelector("dialog:not(#profile-drawer)")?.remove();
  const d=document.createElement("dialog");d.className="app-dialog";
  d.innerHTML='<div class="dialog-head"><h2>'+esc(title)+'</h2><button data-close aria-label="Close dialog">×</button></div>'+body;
  document.body.append(d);d.querySelector("[data-close]")!.addEventListener("click",()=>d.close());
  d.addEventListener("close",()=>d.remove());d.showModal();return d;
}
function openJoinDialog(code:string,spectate:boolean):void {
  const d=dialog((spectate?"Watch":"Join")+" room "+code,'<form class="stack"><label>Room password <input name="password" type="password" maxlength="64" placeholder="Leave empty for an open room" autocomplete="off"></label><label class="check"><input type="checkbox" name="spectate" '+(spectate?"checked":"")+'> Join as spectator</label><button class="primary">'+(spectate?"Watch match":"Join room")+'</button></form>');
  d.querySelector("form")!.addEventListener("submit",e=>{e.preventDefault();const pw=d.querySelector<HTMLInputElement>('input[name="password"]')!.value;const watch=d.querySelector<HTMLInputElement>('input[name="spectate"]')!.checked;d.close();joinRoom(code,pw,watch);});
}
function openBindings():void {
  let current=bindingsOf(profile.prefs.bindings);
  const d=dialog("Keyboard controls",'<p class="muted">Select an action, then press its new key. Mouse aiming and mouse buttons stay available.</p><div class="bindings-grid"></div><div class="row"><button data-reset>Restore defaults</button><button data-save class="primary">Save controls</button></div><p class="muted small">Hold Num 2/4/6/8 to aim and fire. Arrow keys aim without firing. Combine directions for diagonals. 1/2/3 select, Tab cycles, B shows scores. Mouse remains available.</p>');
  let capture:((e:KeyboardEvent)=>void)|null=null;
  const cancelCapture=()=>{if(capture)d.removeEventListener("keydown",capture,true);capture=null;};
  d.addEventListener("close",cancelCapture);
  const paint=()=>{
    cancelCapture();
    d.querySelector(".bindings-grid")!.innerHTML=Object.entries(ACTION_LABELS).map(([n,name])=>{
      const key=Object.entries(current).filter(([,bit])=>bit===Number(n)).map(([key])=>keyLabel(key)).join(" / ");
      return '<div><span>'+name+'</span><button data-action="'+n+'">'+(key||"Unbound")+'</button></div>';
    }).join("");
    for(const b of d.querySelectorAll<HTMLButtonElement>("[data-action]"))b.onclick=()=>{
      cancelCapture();
      for(const other of d.querySelectorAll<HTMLButtonElement>("[data-action]")) {const key=Object.entries(current).find(([,n])=>n===Number(other.dataset.action))?.[0];other.textContent=key?keyLabel(key):"Unbound";}
      b.textContent="Press a key…";
      const handler=(e:KeyboardEvent)=>{
        e.preventDefault();e.stopPropagation();
        if(!BINDABLE_CODE.test(e.code)) {b.textContent="Choose a letter / action key";return;}
        const action=Number(b.dataset.action);
        const previous=Object.entries(current).find(([,n])=>n===action)?.[0];
        const replaced=current[e.code];
        for(const [key,n] of Object.entries(current))if(n===action)delete current[key];
        // Swapping two bindings leaves neither action accidentally unbound.
        if(replaced!==undefined&&replaced!==action&&previous)current[previous]=replaced;
        current[e.code]=action;
        d.removeEventListener("keydown",handler,true);paint();
      };
      capture=handler;
      d.addEventListener("keydown",handler,true);
    };
  };
  d.querySelector("[data-reset]")!.addEventListener("click",()=>{current={...DEFAULT_BINDINGS};paint();});
  d.querySelector("[data-save]")!.addEventListener("click",async()=>{await savePrefs({bindings:current});d.close();toast("Keyboard controls saved.");});
  paint();
}
async function loadWeaponStats():Promise<void> {
  const el=document.getElementById("weapon-stats");if(!el)return;
  try{
    const {weapons}=await api<{weapons:WeaponStats[]}>("/api/me/weapons");
    el.innerHTML=weapons.length?'<table><thead><tr><th>Weapon</th><th>Kills</th><th>Hits / shots</th><th>Damage</th></tr></thead><tbody>'+weapons.map(w=>'<tr><td>'+weaponIcon(w.weapon)+esc(weaponName(w.weapon))+'</td><td>'+w.kills+'</td><td>'+w.hits+' / '+w.shots+'</td><td>'+Math.round(w.damage)+'</td></tr>').join("")+'</tbody></table>':'<p class="muted">Weapon statistics appear after completed PvP matches.</p>';
  }catch{el.textContent="Weapon statistics could not be loaded.";}
}
async function showMatch(id:string):Promise<void> {
  try{
    const {match}=await api<{match:{mode:string;map:string;status:string;result:MatchResult|null;participants:MatchResult["participants"]}}>(`/api/matches/${encodeURIComponent(id)}`);
    dialog("Match report",'<p>'+esc(MODE_NAMES[match.mode as RoomSettings["mode"]]??match.mode)+' · '+esc(mapName(match.map))+' · '+esc(match.status)+'</p><div class="table-wrap"><table><thead><tr><th>Pilot</th><th>K / D / A</th><th>Flags</th><th>Score</th></tr></thead><tbody>'+match.participants.map(p=>'<tr><td>'+esc(p.name)+(p.mvp?' <span class="mvp">MVP</span>':'')+'</td><td>'+p.kills+' / '+p.deaths+' / '+p.assists+'</td><td>'+p.deliveries+'</td><td>'+p.score+'</td></tr>').join("")+'</tbody></table></div><p class="muted small">'+esc(match.result?.scoringNote??"Partial progress saved before this match stopped.")+'</p>');
  }catch(e){toast((e as Error).message,"error");}
}
function arsenalSettings(s:RoomSettings,disabled:boolean):string {
  const disabledAttr=disabled?"disabled":"";
  return '<details class="arsenal-settings"><summary>Arsenal & starting loadout</summary><div class="settings-grid">'+[0,1,2].map(i=>'<label>Starting slot '+(i+1)+'<select data-loadout="'+i+'" '+disabledAttr+'>'+(i>0?'<option value="">Empty</option>':'')+s.weapons.map(id=>'<option value="'+id+'" '+(s.loadout[i]===id?'selected':'')+'>'+esc(weaponName(id))+'</option>').join("")+'</select></label>').join("")+'</div><h3 class="small">Allowed weapons</h3><div class="allowlist">'+Object.values(WEAPONS).map(w=>'<label class="check"><input type="checkbox" data-weapon="'+w.id+'" '+(s.weapons.includes(w.id)?"checked":"")+' '+disabledAttr+'>'+weaponIcon(w.id)+esc(w.name)+'</label>').join("")+'</div><h3 class="small">Allowed throwables</h3><div class="checks">'+Object.values(THROWABLES).map(t=>'<label class="check"><input type="checkbox" data-throwable="'+t.id+'" '+(s.throwables.includes(t.id)?"checked":"")+' '+disabledAttr+'>'+esc(t.name)+'</label>').join("")+'</div></details>';
}
function bindArsenal(root:ParentNode,initial:RoomSettings):void {
  const current=()=>room?.nextSettings??room?.settings??initial;
  // Read all three displayed slots, so rapid edits are retained even before the
  // server acknowledges the previous field. Never reuse the modal's opening
  // loadout for a later change.
  const selectedLoadout=():RoomSettings["loadout"]=>{
    const first=root.querySelector<HTMLSelectElement>('[data-loadout="0"]');
    const second=root.querySelector<HTMLSelectElement>('[data-loadout="1"]');
    const third=root.querySelector<HTMLSelectElement>('[data-loadout="2"]');
    return [first?.value??current().loadout[0],second?second.value||null:current().loadout[1],third?third.value||null:current().loadout[2]];
  };
  for(const input of root.querySelectorAll<HTMLInputElement>("[data-weapon],[data-throwable]"))input.addEventListener("change",()=>{
    const weapons=[...root.querySelectorAll<HTMLInputElement>("[data-weapon]:checked")].map(e=>e.dataset.weapon!);
    const throwables=[...root.querySelectorAll<HTMLInputElement>("[data-throwable]:checked")].map(e=>e.dataset.throwable!);
    if(!weapons.length){input.checked=true;toast("Keep at least one weapon available.");return;}
    const previous=selectedLoadout();
    const loadout:RoomSettings["loadout"]=[weapons.includes(previous[0])?previous[0]:weapons[0],previous[1]&&weapons.includes(previous[1])?previous[1]:null,previous[2]&&weapons.includes(previous[2])?previous[2]:null];
    for(const select of root.querySelectorAll<HTMLSelectElement>("[data-loadout]")) {
      const i=Number(select.dataset.loadout) as 0|1|2;
      select.innerHTML=(i>0?'<option value="">Empty</option>':'')+weapons.map(id=>'<option value="'+id+'">'+esc(weaponName(id))+'</option>').join("");
      select.value=loadout[i]??"";
    }
    net.send({t:"settings",settings:{weapons,throwables,loadout}});
  });
  for(const el of root.querySelectorAll<HTMLSelectElement>("[data-loadout]"))el.addEventListener("change",()=>{
    net.send({t:"settings",settings:{loadout:selectedLoadout()}});
  });
}
function chatMarkup():string {
  return '<label class="check"><input type="checkbox" data-chat-mute '+(profile.prefs.chatMuted===true?"checked":"")+'> Mute chat</label><ol class="chat-log" data-chat-log aria-live="polite"></ol><form data-chat-form class="row"><label class="grow"><span class="sr">Message</span><input name="message" maxlength="240" placeholder="Message your room" autocomplete="off"></label><button>Send</button></form>';
}
function bindChat(root:ParentNode):void {
  const form=root.querySelector<HTMLFormElement>("[data-chat-form]");
  form?.addEventListener("submit",e=>{e.preventDefault();const input=form.querySelector<HTMLInputElement>("input")!;if(input.value.trim())net.send({t:"chat",text:input.value.trim()});input.value="";});
  root.querySelector<HTMLInputElement>("[data-chat-mute]")?.addEventListener("change",async e=>{await savePrefs({chatMuted:(e.target as HTMLInputElement).checked});renderChatLog();});
  renderChatLog();
}
function renderChatLog():void {
  if(screen==="game")return;
  const log=app.querySelector("[data-chat-log]");if(!log)return;
  log.innerHTML=profile.prefs.chatMuted===true?'<li class="muted">Chat is muted.</li>':messages.map(m=>'<li><b>'+esc(m.name)+'</b> '+esc(m.text)+'</li>').join("")||'<li class="muted">Say hello to your squad.</li>';
  log.scrollTop=log.scrollHeight;
}
async function loadPresets():Promise<void> {
  try{presets=(await api<{presets:RoomPreset[]}>("/api/presets")).presets;}catch{presets=[];}
}
function bindPresets():void {
  app.querySelector("#apply-preset")?.addEventListener("click",()=>{
    const value=app.querySelector<HTMLSelectElement>("#presets")!.value;
    const p=presets.find(p=>p.id===value);if(p)net.send({t:"settings",settings:p.settings});
  });
  app.querySelector("#save-preset")?.addEventListener("click",()=>{
    const d=dialog("Save room preset",'<form class="stack"><label>Name <input name="name" required maxlength="32" placeholder="Friday night rules"></label><button class="primary">Save preset</button></form>');
    d.querySelector("form")!.addEventListener("submit",async e=>{e.preventDefault();try{await api("/api/presets",{method:"POST",body:{name:d.querySelector<HTMLInputElement>("input")!.value,settings:room!.nextSettings??room!.settings}});await loadPresets();d.close();renderLobby();toast("Preset saved.");}catch(err){toast((err as Error).message,"error");}});
  });
  app.querySelector("#delete-preset")?.addEventListener("click",async()=>{
    const id=app.querySelector<HTMLSelectElement>("#presets")!.value;if(!id)return;
    try{await api(`/api/presets/${encodeURIComponent(id)}`,{method:"DELETE"});await loadPresets();renderLobby();}catch(e){toast((e as Error).message,"error");}
  });
}
function openNextRules():void {
  if(!room||!isHost())return;
  const s=room.nextSettings??room.settings;
  const opts=MULTIPLIERS.map((m):[number,string]=>[m,m+"×"]);
  const d=dialog("Next-round rules",'<p class="muted">The current round keeps its rules. These changes apply on rematch.</p><div class="settings-grid">'+
    settingSelect("mode",AVAILABLE_MODES.map(m=>[m,MODE_NAMES[m]]),s.mode,false)+settingSelect("map",Object.values(MAPS).filter(m=>m.id!=="test-range"||s.mode==="training").map(m=>[m.id,m.name]),s.map,false)+
    settingSelect("capacity",[1,2,3,4,5,6,7,8].map(n=>[n,String(n)]),s.capacity,false)+
    settingSelect("durationMin",DURATIONS.map(n=>[n,n+" minutes"]),s.durationMin,false)+settingSelect("scoreLimit",[0,5,10,20,30,50].map(n=>[n,n?String(n):"None"]),s.scoreLimit,false)+
    (["gravity","moveSpeed","thrust","fuelCapacity","recharge","health","damage"] as const).map(k=>settingSelect(k,opts,s[k],false)).join("")+
    settingSelect("bots",[0,1,2,3,4,5,6,7].map(n=>[n,String(n)]),s.bots,false)+settingSelect("botDifficulty",[["easy","Easy"],["normal","Normal"],["hard","Hard"]],s.botDifficulty,false)+settingSelect("respawnSec",[1,2,3,5,10].map(n=>[n,n+" seconds"]),s.respawnSec,false)+'</div><div class="checks">'+
    (["flight","unlimitedFuel","unlimitedAmmo","friendlyFire","mapPickups"] as const).map(k=>settingCheck(k,s[k],false)).join("")+'</div>'+arsenalSettings(s,false));
  for(const el of d.querySelectorAll<HTMLInputElement|HTMLSelectElement>("[data-setting]"))el.addEventListener("change",()=>{
    const key=el.dataset.setting as keyof RoomSettings;
    const staged=room?.nextSettings??room?.settings??s;
    const value=el instanceof HTMLInputElement&&el.type==="checkbox"?el.checked:typeof staged[key]==="number"?Number(el.value):el.value;
    net.send({t:"settings",settings:{[key]:value} as Partial<RoomSettings>});
  });
  bindArsenal(d,s);
}

void boot();
