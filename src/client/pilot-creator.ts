import {AVATAR_CHOICES,AVATAR_LABELS,PILOT_PRESETS,avatarOf,type Avatar} from "../shared/avatar.ts";
import {avatarSvg} from "./avatar-art.ts";
import {esc} from "./dom.ts";

const HEAD_CHOICES=new Set<keyof Avatar>(["helmet","hair","hairColor","facialHair","eyebrows","glasses","face"]);
const title=(value:string)=>value.replaceAll("-"," ").replace(/^./,c=>c.toUpperCase());
/** Option art exposes the feature being selected, even when current headgear covers it. */
export function choiceArt(avatar:Avatar,key:keyof Avatar,value:string,color:number):string {
  const option={...avatarOf({...avatar,[key]:value})};
  if(["hair","hairColor","eyebrows","facialHair","face"].includes(key))option.helmet="none";
  if(["eyebrows","face"].includes(key))option.glasses="none";
  if(key==="eyebrows")option.hair="bald";
  return avatarSvg(option,color).replace('viewBox="0 0 120 130"',HEAD_CHOICES.has(key)?'viewBox="15 0 80 58"':'viewBox="0 0 120 130"');
}
export function appearanceFields(avatar:Avatar,color:number):string {
  return `<div class="creator-categories" role="tablist" aria-label="Appearance categories">${(Object.keys(AVATAR_CHOICES) as (keyof Avatar)[]).map((key,i)=>`<button type="button" role="tab" id="appearance-tab-${key}" aria-controls="appearance-${key}" aria-selected="${i===0}" tabindex="${i===0?0:-1}" data-category="${key}">${AVATAR_LABELS[key]}</button>`).join("")}</div><div class="creator-options">${(Object.keys(AVATAR_CHOICES) as (keyof Avatar)[]).map((key,i)=>`<section role="tabpanel" id="appearance-${key}" aria-labelledby="appearance-tab-${key}" ${i?"hidden":""}><fieldset class="appearance-choices"><legend>${AVATAR_LABELS[key]}</legend>${AVATAR_CHOICES[key].map(value=>`<label class="appearance-choice"><input type="radio" name="${key}" value="${value}" ${avatar[key]===value?"checked":""}><span class="appearance-tile"><span class="choice-art" aria-hidden="true" data-choice-art="${key}" data-choice-value="${value}">${choiceArt(avatar,key,value,color)}</span><span>${title(value)}</span><span class="choice-check" aria-hidden="true">✓</span></span></label>`).join("")}</fieldset></section>`).join("")}</div>`;
}
export function creatorPresets(color:number):string {
  return `<details class="creator-presets"><summary>Start from a look</summary><div class="pilot-presets">${PILOT_PRESETS.map((p,i)=>`<button type="button" data-preset="${i}">${avatarSvg(p.avatar,color)}<span>${p.name}</span></button>`).join("")}</div></details>`;
}
export function creatorPreview(avatar:Avatar,color:number,name:string):string {
  return `<aside class="creator-stage" aria-label="Live pilot preview"><span class="eyebrow">YOUR PILOT</span><div id="avatar-preview" class="avatar-preview">${avatarSvg(avatar,color)}</div><b data-preview-name>${esc(name)}</b><span class="creator-stage-note">Ready for the arena</span><div class="creator-poses" aria-label="Preview animation"><button type="button" data-pose="idle" aria-pressed="true">Idle</button><button type="button" data-pose="flight" aria-pressed="false">Flight</button></div><p class="muted small" data-preview-note>Every look has the same health and hitbox.</p></aside>`;
}
export function avatarFromForm(fd:FormData):Avatar {
  return avatarOf(Object.fromEntries(Object.keys(AVATAR_CHOICES).map(key=>[key,fd.get(key)])));
}
export function bindCreator(form:HTMLFormElement):void {
  const tabs=Array.from(form.querySelectorAll<HTMLButtonElement>("[data-category]"));
  const choose=(tab:HTMLButtonElement)=>{
    for(const t of tabs){const active=t===tab;t.setAttribute("aria-selected",String(active));t.tabIndex=active?0:-1;form.querySelector<HTMLElement>(`#appearance-${t.dataset.category}`)!.hidden=!active;}
    refreshChoices();
  };
  const refreshChoices=()=>{
    const fd=new FormData(form),avatar=avatarFromForm(fd),color=Number(fd.get("color"));
    for(const item of form.querySelectorAll<HTMLElement>('[role="tabpanel"]:not([hidden]) [data-choice-art]'))item.innerHTML=choiceArt(avatar,item.dataset.choiceArt as keyof Avatar,item.dataset.choiceValue!,color);
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
  form.addEventListener("input",()=>{
    const fd=new FormData(form),avatar=avatarFromForm(fd);
    form.querySelector("#avatar-preview")!.innerHTML=avatarSvg(avatar,Number(fd.get("color")));
    form.querySelector("[data-preview-name]")!.textContent=String(fd.get("name")||"Your pilot");
    const category=tabs.find(t=>t.getAttribute("aria-selected")==="true")?.dataset.category;
    const covered=(["hair","hairColor","eyebrows"].includes(category??""))&&avatar.helmet!=="none";
    form.querySelector("[data-preview-note]")!.textContent=covered?"Your headgear covers some hair and brows. Choose Headgear → None to show them.":"Every look has the same health and hitbox.";
    refreshChoices();
  });
  for(const button of form.querySelectorAll<HTMLButtonElement>("[data-preset]"))button.addEventListener("click",()=>{
    const preset=PILOT_PRESETS[Number(button.dataset.preset)].avatar;
    for(const input of form.querySelectorAll<HTMLInputElement>('.appearance-choice input'))input.checked=preset[input.name as keyof Avatar]===input.value;
    form.dispatchEvent(new Event("input",{bubbles:true}));
  });
  for(const button of form.querySelectorAll<HTMLButtonElement>("[data-pose]"))button.addEventListener("click",()=>{
    form.querySelector<HTMLElement>(".creator-stage")!.dataset.pose=button.dataset.pose;
    for(const other of form.querySelectorAll("button[data-pose]"))other.setAttribute("aria-pressed",String(other===button));
  });
}