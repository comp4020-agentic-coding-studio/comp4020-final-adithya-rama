import {AVATAR_CHOICES,AVATAR_LABELS,PILOT_PRESETS,avatarOf,type Avatar} from "../shared/avatar.ts";
import {avatarSvg,AVATAR_PORTRAIT_VIEWBOX} from "./avatar-art.ts";
import {esc} from "./dom.ts";

const HEAD_CHOICES=new Set<keyof Avatar>(["helmet","hair","hairColor","facialHair","eyebrows","glasses","face"]);

const title=(value:string)=>value.replaceAll("-"," ").replace(/^./,c=>c.toUpperCase());
function previewArt(avatar:Avatar,color:number,face:boolean):string {
  return avatarSvg(avatar,color).replace('viewBox="0 0 120 130"',`viewBox="${face?AVATAR_PORTRAIT_VIEWBOX:"0 0 120 130"}"`);
}
/** Tiles expose the selected feature even when another item covers it in the full outfit. */
export function choiceArt(avatar:Avatar,key:keyof Avatar,value:string,color:number):string {
  const option={...avatarOf({...avatar,[key]:value})};
  if(["hair","hairColor","eyebrows","facialHair","face","glasses"].includes(key))option.helmet="none";
  if(["eyebrows","face","facialHair"].includes(key))option.glasses="none";
  if(key==="eyebrows"){option.hair="cropped";option.facialHair="none";if(option.face==="robot")option.face="medium";}
  if(key==="hairColor"&&option.hair==="bald")option.hair="cropped";
  const art=previewArt(option,color,HEAD_CHOICES.has(key));
  const detail=key==="eyebrows"?"48 20 30 22":key==="glasses"?"42 21 39 25":key==="facialHair"?"42 31 40 28":null;
  return detail?art.replace(`viewBox="${AVATAR_PORTRAIT_VIEWBOX}"`,`viewBox="${detail}"`):art;
}
export function appearanceFields(avatar:Avatar,color:number):string {
  return `<div class="creator-categories" role="tablist" aria-label="Appearance categories">${(Object.keys(AVATAR_CHOICES) as (keyof Avatar)[]).map((key,i)=>`<button type="button" role="tab" id="appearance-tab-${key}" aria-controls="appearance-${key}" aria-selected="${i===0}" tabindex="${i===0?0:-1}" data-category="${key}">${AVATAR_LABELS[key]}</button>`).join("")}</div><div class="creator-options">${(Object.keys(AVATAR_CHOICES) as (keyof Avatar)[]).map((key,i)=>`<section role="tabpanel" id="appearance-${key}" aria-labelledby="appearance-tab-${key}" ${i?"hidden":""}><fieldset class="appearance-choices"><legend>${AVATAR_LABELS[key]}</legend>${AVATAR_CHOICES[key].map(value=>`<label class="appearance-choice"><input type="radio" name="${key}" value="${value}" ${avatar[key]===value?"checked":""}><span class="appearance-tile"><span class="choice-art" aria-hidden="true" data-choice-art="${key}" data-choice-value="${value}">${choiceArt(avatar,key,value,color)}</span><span>${title(value)}</span><span class="choice-check" aria-hidden="true">✓</span></span></label>`).join("")}</fieldset></section>`).join("")}</div>`;
}
export function creatorPresets(color:number):string {
  return `<details class="creator-presets"><summary>Start from a look</summary><div class="pilot-presets">${PILOT_PRESETS.map((p,i)=>`<button type="button" data-preset="${i}">${avatarSvg(p.avatar,color)}<span>${p.name}</span></button>`).join("")}</div></details>`;
}
export function creatorPreview(avatar:Avatar,color:number,name:string):string {
  return `<aside class="creator-stage" data-view="full" aria-label="Live pilot preview"><span class="eyebrow">YOUR PILOT</span><div class="creator-views" role="group" aria-label="Preview framing"><button type="button" data-view="full" aria-pressed="true">Full pilot</button><button type="button" data-view="face" aria-pressed="false">Face</button></div><div id="avatar-preview" class="avatar-preview">${avatarSvg(avatar,color)}</div><b data-preview-name>${esc(name)}</b><span class="creator-stage-note">Ready for the arena</span><div class="creator-poses" aria-label="Preview animation"><button type="button" data-pose="idle" aria-pressed="true">Idle</button><button type="button" data-pose="flight" aria-pressed="false">Flight</button></div><p class="muted small" data-preview-note>Every look has the same health and hitbox.</p></aside>`;
}
export function avatarFromForm(fd:FormData):Avatar {
  return avatarOf(Object.fromEntries(Object.keys(AVATAR_CHOICES).map(key=>[key,fd.get(key)])));
}
export function bindCreator(form:HTMLFormElement):void {
  const tabs=Array.from(form.querySelectorAll<HTMLButtonElement>("[data-category]"));
  const stage=form.querySelector<HTMLElement>(".creator-stage")!;
  const refreshChoices=()=>{
    const fd=new FormData(form),avatar=avatarFromForm(fd),color=Number(fd.get("color"));
    for(const item of form.querySelectorAll<HTMLElement>('[role="tabpanel"]:not([hidden]) [data-choice-art]'))item.innerHTML=choiceArt(avatar,item.dataset.choiceArt as keyof Avatar,item.dataset.choiceValue!,color);
  };
  const refreshPreview=()=>{
    const fd=new FormData(form),avatar=avatarFromForm(fd);
    form.querySelector("#avatar-preview")!.innerHTML=previewArt(avatar,Number(fd.get("color")),stage.dataset.view==="face");
    form.querySelector("[data-preview-name]")!.textContent=String(fd.get("name")||"Your pilot");
    const category=tabs.find(t=>t.getAttribute("aria-selected")==="true")?.dataset.category;
    const covered=["hair","hairColor","eyebrows","glasses"].includes(category??"")&&avatar.helmet!=="none";
    form.querySelector("[data-preview-note]")!.textContent=covered?"Your headgear can cover these details. Choose Headgear → None to reveal your full look.":"Every look has the same health and hitbox.";
  };
  const setView=(view:string)=>{
    stage.dataset.view=view;
    for(const button of form.querySelectorAll<HTMLButtonElement>("button[data-view]"))button.setAttribute("aria-pressed",String(button.dataset.view===view));
    refreshPreview();
  };
  const choose=(tab:HTMLButtonElement)=>{
    for(const t of tabs){const active=t===tab;t.setAttribute("aria-selected",String(active));t.tabIndex=active?0:-1;form.querySelector<HTMLElement>(`#appearance-${t.dataset.category}`)!.hidden=!active;}
    setView(HEAD_CHOICES.has(tab.dataset.category as keyof Avatar)?"face":"full");
    refreshChoices();
  };
  for(const [i,tab] of tabs.entries()){
    tab.addEventListener("click",()=>choose(tab));
    tab.addEventListener("keydown",e=>{
      let next=i;if(e.key==="ArrowRight"||e.key==="ArrowDown")next=(i+1)%tabs.length;
      else if(e.key==="ArrowLeft"||e.key==="ArrowUp")next=(i+tabs.length-1)%tabs.length;
      else if(e.key==="Home")next=0;else if(e.key==="End")next=tabs.length-1;else return;
      e.preventDefault();choose(tabs[next]);tabs[next].focus();
    });
  }
  form.addEventListener("input",()=>{refreshPreview();refreshChoices();});
  for(const button of form.querySelectorAll<HTMLButtonElement>("button[data-view]"))button.addEventListener("click",()=>setView(button.dataset.view!));
  for(const button of form.querySelectorAll<HTMLButtonElement>("[data-preset]"))button.addEventListener("click",()=>{
    const preset=PILOT_PRESETS[Number(button.dataset.preset)].avatar;
    for(const input of form.querySelectorAll<HTMLInputElement>('.appearance-choice input'))input.checked=preset[input.name as keyof Avatar]===input.value;
    form.dispatchEvent(new Event("input",{bubbles:true}));
  });
  for(const button of form.querySelectorAll<HTMLButtonElement>("[data-pose]"))button.addEventListener("click",()=>{
    stage.dataset.pose=button.dataset.pose;
    for(const other of form.querySelectorAll("button[data-pose]"))other.setAttribute("aria-pressed",String(other===button));
  });
}
