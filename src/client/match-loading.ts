import { avatarOf, avatarSvg } from "./avatar-art.ts";
import { esc } from "./dom.ts";
import type { RosterEntry } from "../shared/protocol.ts";

/** Real readiness stages, never a made-up percentage or a minimum artificial wait. */
export class MatchLoading {
  readonly element=document.createElement("section");
  private timer:ReturnType<typeof setTimeout>;
  private closed=false;
  constructor(root:HTMLElement,map:string,mode:string,pilot:RosterEntry|undefined,leave:()=>void,touch=false) {
    this.element.className="match-loading";
    this.element.setAttribute("aria-label","Preparing match");
    this.element.innerHTML=`<div class="launch-orbit" aria-hidden="true"></div><div class="launch-card"><span class="eyebrow">JET SKIRMISH · FLIGHT DECK</span>
      <div class="launch-pilot">${avatarSvg(avatarOf(pilot?.avatar),pilot?.color??0x3c8de0)}</div>
      <h1>${esc(map)}</h1><p>${esc(mode)} · ${esc(pilot?.name??"Spectator")}</p>
      <ol class="launch-stages"><li data-stage="scene">Preparing arena</li><li data-stage="sync">Connecting to live match</li></ol>
      <p data-loading-status role="status">Preparing your view…</p>
      <p class="launch-tip">${touch?"Left stick moves and flies. Right stick aims and fires.":"Aim with your mouse or number pad. Movement never turns your gun."}<br>Reload is automatic; hold fire to keep shooting after reloading.</p>
      <button data-loading-leave>Leave room</button></div>`;
    root.append(this.element);
    this.element.querySelector("[data-loading-leave]")!.addEventListener("click",leave);
    this.timer=setTimeout(()=>this.status("Still connecting. You can wait or leave and rejoin."),10000);
  }
  stage(stage:"scene"|"sync"):void { this.element.querySelector(`[data-stage="${stage}"]`)?.classList.add("done"); }
  status(text:string):void { if(!this.closed)this.element.querySelector("[data-loading-status]")!.textContent=text; }
  fail():void { clearTimeout(this.timer);this.element.classList.add("failed");this.status("We couldn’t prepare the arena. Leave and rejoin to try again."); }
  finish():void { this.closed=true;clearTimeout(this.timer);this.element.remove(); }
}
