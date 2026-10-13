// Persisted control centers are normalized within the safe viewport. Pixel sizes
// stay client-owned, so a saved phone layout also remains reachable after rotation.
export const TOUCH_LAYOUT_KEYS = ["move","aim","jump","reload","swap","dual","slot1","slot2","slot3","throw","type","melee","pickup","drop","descend","scope","score","menu"] as const;
export type TouchLayoutKey = typeof TOUCH_LAYOUT_KEYS[number];
export const TOUCH_LAYOUT_SCALE = {min:.75,max:1.35} as const;
export const TOUCH_LAYOUT_OPACITY = {min:.35,max:1} as const;
export interface TouchPoint {x:number;y:number}
export interface TouchLayout {scale:number;opacity:number;positions:Partial<Record<TouchLayoutKey,TouchPoint>>}
export interface TouchBounds {left:number;top:number;width:number;height:number}
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
const finite=(n:unknown,fallback:number)=>typeof n==="number"&&Number.isFinite(n)?n:fallback;
export function normalizeTouchLayout(value:unknown):TouchLayout {
  const source=value&&typeof value==="object"?value as Record<string,unknown>:{};
  const positions:TouchLayout["positions"]={};
  const raw=source.positions&&typeof source.positions==="object"?source.positions as Record<string,unknown>:{};
  for(const key of TOUCH_LAYOUT_KEYS){
    const point=raw[key];if(!point||typeof point!=="object")continue;
    const {x,y}=point as Record<string,unknown>;
    if(typeof x==="number"&&Number.isFinite(x)&&typeof y==="number"&&Number.isFinite(y))positions[key]={x:clamp(x,0,1),y:clamp(y,0,1)};
  }
  return {scale:clamp(finite(source.scale,1),TOUCH_LAYOUT_SCALE.min,TOUCH_LAYOUT_SCALE.max),opacity:clamp(finite(source.opacity,.9),TOUCH_LAYOUT_OPACITY.min,TOUCH_LAYOUT_OPACITY.max),positions};
}
export function touchCenter(point:TouchPoint,bounds:TouchBounds,size:{width:number;height:number}):TouchPoint {
  const halfW=Math.min(size.width,bounds.width)/2,halfH=Math.min(size.height,bounds.height)/2;
  return {x:clamp(bounds.left+clamp(point.x,0,1)*bounds.width,bounds.left+halfW,bounds.left+bounds.width-halfW),y:clamp(bounds.top+clamp(point.y,0,1)*bounds.height,bounds.top+halfH,bounds.top+bounds.height-halfH)};
}
export function normalizedTouchCenter(point:TouchPoint,bounds:TouchBounds):TouchPoint {
  return {x:clamp((point.x-bounds.left)/Math.max(1,bounds.width),0,1),y:clamp((point.y-bounds.top)/Math.max(1,bounds.height),0,1)};
}
