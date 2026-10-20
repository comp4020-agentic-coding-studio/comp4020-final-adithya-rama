/** Cosmetic choices only: every pilot shares the same collision and damage model. */
export const AVATAR_CHOICES = {
  body: ["male", "female"],
  outfit: ["armour", "flight-suit", "jacket", "dress"],
  helmet: ["pilot", "visor", "cap", "mohawk", "none", "beret"],
  hair: ["cropped", "bob", "ponytail", "braids", "curly", "bald"],
  hairColor: ["black", "brown", "blond", "auburn", "silver", "violet"],
  facialHair: ["none", "moustache", "beard", "goatee"],
  glasses: ["goggles", "none", "round", "aviator"],
  face: ["light", "medium", "dark", "robot"],
  emblem: ["star", "bolt", "skull"],
} as const;
export type Avatar = { [K in keyof typeof AVATAR_CHOICES]: typeof AVATAR_CHOICES[K][number] };
export const DEFAULT_AVATAR: Avatar = {
  body:"male", outfit:"armour", helmet:"pilot", hair:"cropped", hairColor:"brown",
  facialHair:"none", glasses:"goggles", face:"medium", emblem:"bolt",
};
export const AVATAR_LABELS: Record<keyof Avatar,string> = {
  body:"Body style", outfit:"Outfit", helmet:"Headgear", hair:"Hairstyle", hairColor:"Hair colour",
  facialHair:"Facial hair", glasses:"Eyewear", face:"Skin / material", emblem:"Emblem",
};
export function avatarOf(value: unknown): Avatar {
  const raw=value&&typeof value==="object"?value as Record<string,unknown>:{};
  return Object.fromEntries(Object.entries(AVATAR_CHOICES).map(([key,choices])=>[
    key,(choices as readonly unknown[]).includes(raw[key])?raw[key]:DEFAULT_AVATAR[key as keyof Avatar],
  ])) as Avatar;
}
export const PILOT_PRESETS: {name:string; avatar:Avatar}[] = [
  {name:"Vanguard",avatar:{...DEFAULT_AVATAR,facialHair:"moustache",helmet:"beret"}},
  {name:"Nova",avatar:{...DEFAULT_AVATAR,body:"female",outfit:"flight-suit",helmet:"none",hair:"ponytail",hairColor:"violet",glasses:"aviator",emblem:"star"}},
  {name:"Rook",avatar:{...DEFAULT_AVATAR,helmet:"none",hair:"curly",face:"dark",facialHair:"beard",glasses:"round",outfit:"jacket"}},
  {name:"Vesper",avatar:{...DEFAULT_AVATAR,body:"female",helmet:"none",hair:"bob",hairColor:"silver",outfit:"dress",glasses:"none",emblem:"skull"}},
];
