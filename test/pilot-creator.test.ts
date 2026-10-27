// @vitest-environment jsdom
import {describe,it,expect} from "vitest";
import {AVATAR_CHOICES,DEFAULT_AVATAR,PILOT_PRESETS} from "../src/shared/avatar.ts";
import {appearanceFields,creatorPreview,creatorPresets,bindCreator,avatarFromForm,choiceArt} from "../src/client/pilot-creator.ts";

function form(){
  document.body.innerHTML=`<form><input name="name" value="Pilot"><input name="color" value="3968480">${creatorPresets(3968480)}${appearanceFields(DEFAULT_AVATAR,3968480)}${creatorPreview(DEFAULT_AVATAR,3968480,"Pilot")}</form>`;
  const el=document.querySelector("form")!;bindCreator(el);return el;
}
describe("visual pilot workshop",()=>{
  it("keeps all appearance controls in real accessible radio groups without selects",()=>{
    const el=form();expect(el.querySelector("select")).toBeNull();
    for(const [name,choices] of Object.entries(AVATAR_CHOICES)){
      expect(el.querySelectorAll(`input[name="${name}"]`).length).toBe(choices.length);
      expect(el.querySelectorAll(`input[name="${name}"]:checked`).length).toBe(1);
    }
    const hair=el.querySelector<HTMLButtonElement>('[data-category="hair"]')!;hair.click();
    expect(el.querySelector<HTMLElement>("#appearance-hair")!.hidden).toBe(false);
    hair.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}));
    expect(el.querySelector('[data-category="hairColor"]')!.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(el.querySelector('[data-category="hairColor"]'));
  });
  it("applies complete presets, exposes brows in option art and previews the submitted identity",()=>{
    const el=form();el.querySelector<HTMLButtonElement>('[data-preset="1"]')!.click();
    expect(avatarFromForm(new FormData(el))).toEqual(PILOT_PRESETS[1].avatar);
    const name=el.querySelector<HTMLInputElement>('[name="name"]')!;name.value='<b>My Pilot</b>';name.dispatchEvent(new Event("input",{bubbles:true}));
    expect(el.querySelector("[data-preview-name]")!.textContent).toBe('<b>My Pilot</b>');
    expect(el.querySelector("[data-preview-name] b")).toBeNull();
    expect(el.querySelector("#avatar-preview svg")!.getAttribute("aria-label")).toContain("female");
    expect(choiceArt(DEFAULT_AVATAR,"eyebrows","bold",3968480)).not.toEqual(choiceArt(DEFAULT_AVATAR,"eyebrows","arched",3968480));
    el.querySelector<HTMLButtonElement>('[data-pose="flight"]')!.click();
    expect(el.querySelector<HTMLElement>(".creator-stage")!.dataset.pose).toBe("flight");
    expect(el.querySelector('button[data-pose="flight"]')!.getAttribute("aria-pressed")).toBe("true");
  });
});