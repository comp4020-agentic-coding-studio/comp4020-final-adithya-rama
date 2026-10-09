import type { MapDefinition, Rect } from "./types.ts";

// Terrain is authored as a union of rectangles. The renderer outlines that exact
// union, so the illustrated cliff edges and the authoritative collision agree.
const r=(x:number,y:number,w:number,h:number):Rect=>({x,y,w,h});
const mirror=(width:number,rs:Rect[])=>rs.map(s=>r(width-s.x-s.w,s.y,s.w,s.h));
function island(x:number,y:number,width:number,depth:number):Rect[] {
  const widths=[.13,.19,.35,.20,.13], tops=[24,8,0,12,28], bottoms=[.60,.86,1,.82,.51];
  let xx=x;
  return widths.map((part,i)=>{const w=Math.round(width*part),out=r(xx,y+tops[i],w,Math.round(depth*bottoms[i])-tops[i]);xx+=w;return out;});
}
const bunker=(x:number,floor:number,width:number,height:number):Rect[]=>[
  r(x,floor-height,width,22),r(x,floor-height+22,24,height-94),r(x+width-24,floor-height+22,24,height-94),
  r(x,floor,width,20),
];
function arena(id:string,name:string,width:number,height:number,biome:NonNullable<MapDefinition["biome"]>,theme:MapDefinition["theme"],solids:Rect[],platforms:Rect[],weapons:string[],scenery:NonNullable<MapDefinition["scenery"]>):MapDefinition {
  const floor=height-120;
  const allSolids=[r(0,floor,width,120),r(0,0,32,height),r(width-32,0,32,height),r(0,0,width,24),...solids];
  const nodes=platforms.map(p=>({x:p.x+p.w/2,y:p.y}));
  const ground=Array.from({length:Math.ceil((width-180)/160)},(_,i)=>({x:90+i*160,y:floor}));
  const weaponSpots=[...nodes,...ground.filter((_,i)=>i%2)];
  return {id,name,width,height,biome,theme,solids:allSolids,platforms,scenery,
    spawns:[...[100,220,350,480].map(x=>({x,y:floor,team:0 as const})),...[100,220,350,480].map(x=>({x:width-x,y:floor,team:1 as const})),
      ...nodes.filter((_,i)=>i%2===0).filter(p=>!allSolids.some(s=>p.x+11>s.x&&p.x-11<s.x+s.w&&p.y>s.y&&p.y-44<s.y+s.h)).map(p=>({...p,team:-1 as const}))],
    pickups:[
      ...weapons.map((item,i)=>({...weaponSpots[i%weaponSpots.length],kind:"weapon" as const,item,respawnSec:18+i%3*4})),
      ...["frag","flash","gas","emp","mine"].map((item,i)=>({x:width*(.22+i*.14),y:floor,kind:"throwable" as const,item,respawnSec:20})),
      ...[.16,.84].map(f=>({x:width*f,y:floor,kind:"health" as const,respawnSec:25})),
      ...[.32,.68].map(f=>({x:width*f,y:floor,kind:"ammo" as const,respawnSec:20})),
      ...[.42,.58].map(f=>({x:width*f,y:floor,kind:"fuel" as const,respawnSec:15})),
    ],
    goals:[{team:0,rect:r(48,floor-125,130,125)},{team:1,rect:r(width-178,floor-125,130,125)}],
    flagHomes:[{team:0,x:340,y:floor},{team:1,x:width-340,y:floor}],
    navNodes:[...ground,...nodes,...solids.filter(s=>s.w>=100&&s.y>60).map(s=>({x:s.x+s.w/2,y:s.y}))],
  };
}

// FERN CANYON: sheltered lower passage, broad jungle shelves, central stone
// arch, a high floating island and two distinct flank routes.
const jungleLeft=[
  ...island(32,750,650,340),...island(180,350,420,200),
  ...island(840,870,240,245),...island(970,620,660,130),
  r(1030,690,95,250),r(1475,690,95,250),
];
const outpostYard=arena("outpost-yard","Outpost Yard",2600,1400,"jungle",
  {sky:0xc5dcd5,rock:0x777668,platform:0x79a44f,accent:0xe9c479},
  [...jungleLeft,...mirror(2600,jungleLeft.slice(0,10)),...island(1520,870,240,245),...island(1110,260,380,205)],
  [r(180,1140,170,14),r(2250,1140,170,14),r(730,1080,180,14),r(1690,1080,180,14),
   r(1100,1020,400,14),r(720,690,190,14),r(1690,690,190,14),r(660,460,190,14),r(1750,460,190,14),r(1100,500,400,14)],
  ["ak47","m4","xm8","spas12","tavor-x95","uzi","smaw","magnum","golden-eagle","machete","mini-eagle"],
  [{kind:"palm",x:340,y:750,h:180},{kind:"palm",x:2250,y:750,h:195,flip:true},{kind:"palm",x:460,y:350,h:135},
   {kind:"palm",x:2150,y:350,h:155,flip:true},{kind:"palm",x:1310,y:260,h:180},
   {kind:"fern",x:560,y:758,w:115},{kind:"fern",x:1980,y:770,w:110},{kind:"fern",x:1100,y:620,w:90},
   {kind:"fern",x:1500,y:632,w:90},{kind:"fern",x:170,y:1280,w:80},
   {kind:"crate",x:405,y:750,w:42,h:36},{kind:"crate",x:2180,y:750,w:48,h:40},
   {kind:"bridge",x:1100,y:1020,w:400},{kind:"lantern",x:1270,y:750,h:65}]);

// ICEWATCH: two raised log forts with usable interiors, window back walls,
// collision-matched roofs and side walls, snowy ledges and a central lookout.
const snowLeft=[...island(220,1060,560,165),...bunker(305,1060,300,155),...island(60,560,500,170),...bunker(150,560,270,145)];
const skyshaft=arena("skyshaft","Skyshaft",2600,1500,"snow",
  {sky:0xdce1e8,rock:0x737b83,platform:0xedf7f6,accent:0x9bd8dd},
  [...snowLeft,...mirror(2600,snowLeft),...island(1090,800,420,220),...island(1100,300,400,160)],
  [r(100,1230,180,14),r(2320,1230,180,14),r(780,1180,200,14),r(1620,1180,200,14),
   r(1030,1080,170,14),r(1400,1080,170,14),r(700,820,200,14),r(1700,820,200,14),
   r(770,510,230,14),r(1600,510,230,14),r(1130,600,340,14)],
  ["m93ba","m14","smaw","minigun","phasr","emp-gun","saw-launcher","mp5","tavor-x95","riot-shield"],
  [{kind:"bunker",x:305,y:1060,w:300,h:155},{kind:"bunker",x:1995,y:1060,w:300,h:155},
   {kind:"bunker",x:150,y:560,w:270,h:145},{kind:"bunker",x:2180,y:560,w:270,h:145},
   {kind:"pine",x:705,y:1072,h:200},{kind:"pine",x:1880,y:1068,h:190},{kind:"pine",x:1270,y:300,h:200},
   {kind:"pine",x:120,y:584,h:130},{kind:"pine",x:2490,y:584,h:150},{kind:"pine",x:80,y:1380,h:175},
   {kind:"pine",x:2520,y:1380,h:195},{kind:"crate",x:490,y:1060,w:45,h:34},{kind:"crate",x:2110,y:1060,w:45,h:34},
   {kind:"lantern",x:565,y:940,h:50},{kind:"lantern",x:2030,y:940,h:50}]);

// CRYPTWORKS: large connected cave vaults, hanging rock teeth, staggered
// chambers and mining remnants. Every low passage has at least player height.
const caveLeft=[...island(32,910,600,250),...island(250,460,410,250),...island(800,700,260,370),
  r(900,480,100,220),r(1000,430,600,90),r(1600,480,100,220),
  r(1000,520,100,25),r(1000,545,65,25),r(1000,570,35,25),
  r(1500,520,100,25),r(1535,545,65,25),r(1565,570,35,25)];
const cryptworks=arena("cryptworks","Cryptworks",2600,1450,"cavern",
  {sky:0x354445,rock:0x6a7068,platform:0x969a80,accent:0x83c7a3},
  [...caveLeft,...mirror(2600,caveLeft.slice(0,10)),...island(1540,700,260,370),
   ...[r(32,590,270,65),r(180,655,50,65),r(560,600,65,130),r(560,825,65,115),r(650,460,280,65)].flatMap(s=>[s,...mirror(2600,[s])]),
   ...island(1090,950,420,120),...island(1080,180,440,130),r(80,24,130,190),r(2390,24,130,190)],
  [r(210,795,160,14),r(2230,795,160,14),r(130,1210,190,14),r(2280,1210,190,14),r(700,1150,210,14),r(1690,1150,210,14),
   r(1030,1190,210,14),r(1360,1190,210,14),r(650,810,190,14),r(1760,810,190,14),
   r(1110,730,380,14),r(740,360,210,14),r(1650,360,210,14)],
  ["spas12","aa20","saw-launcher","flamethrower","machete","riot-shield","tec9","magnum","rg6","emp-gun","mp5"],
  [{kind:"crystal",x:400,y:910,w:80,h:55},{kind:"crystal",x:2210,y:918,w:70,h:48},
   {kind:"crystal",x:1220,y:180,w:100,h:60},{kind:"crystal",x:970,y:700,w:55,h:50},
   {kind:"lantern",x:330,y:1120,h:60},{kind:"lantern",x:2270,y:1120,h:60},
   {kind:"lantern",x:1100,y:520,h:75},{kind:"lantern",x:1500,y:520,h:75},
   {kind:"lantern",x:300,y:665,h:70},{kind:"lantern",x:2300,y:665,h:70},
   {kind:"bones",x:650,y:1330,w:60},{kind:"bones",x:1960,y:1330,w:60},
   {kind:"bridge",x:1110,y:730,w:380},{kind:"crate",x:530,y:918,w:48,h:44}]);

// CROSSCURRENT: an asymmetric broken coastal viaduct. Unequal headlands,
// rising bridge spans and hanging piers create a distinct long-range middle lane.
const crosscurrent=arena("crosscurrent","Crosscurrent",2800,1300,"coast",
  {sky:0xc4dfe0,rock:0x8c8878,platform:0x99b784,accent:0xf0cd83},
  [...island(32,700,670,360),...island(2070,520,698,390),
   r(640,750,420,55),r(1220,680,420,65),r(1800,610,370,60),
   r(1300,745,100,290),r(1940,670,90,245),
   r(300,330,460,55),r(380,385,70,180),r(635,385,65,135),
   ...island(2200,195,370,150),r(1010,970,240,40)],
  [r(150,1120,180,14),r(2450,1060,180,14),r(780,980,190,14),r(1690,1020,200,14),
   r(1060,730,160,14),r(1640,650,160,14),r(780,540,240,14),r(1120,440,250,14),
   r(1540,350,240,14),r(1870,260,190,14)],
  ["ak47","m4","tavor-x95","xm8","m14","golden-eagle","uzi","mini-eagle","rg6","riot-shield"],
  [{kind:"palm",x:380,y:700,h:160},{kind:"palm",x:2440,y:520,h:180,flip:true},
   {kind:"palm",x:2380,y:195,h:135},{kind:"fern",x:550,y:712,w:95},{kind:"fern",x:2240,y:528,w:100},
   {kind:"bridge",x:1060,y:730,w:160},{kind:"bridge",x:1640,y:650,w:160},
   {kind:"crate",x:500,y:330,w:54,h:38},{kind:"crate",x:1480,y:680,w:48,h:40},
   {kind:"lantern",x:660,y:520,h:65},{kind:"lantern",x:1970,y:915,h:55}]);

const rangeWeapons=["mini-eagle","golden-eagle","magnum","uzi","tec9","mp5","ak47","m4","tavor-x95","xm8","m14","m93ba","spas12","aa20","minigun","smaw","rg6","saw-launcher","flamethrower","phasr","emp-gun","machete","riot-shield"];
const testRange:MapDefinition={id:"test-range",name:"Test Range",width:1800,height:1000,biome:"range",
  theme:{sky:0x859b9a,rock:0x545e5b,platform:0xc3b48b,accent:0xf0ba60},
  solids:[r(0,900,1800,100),r(0,0,40,1000),r(1760,0,40,1000),r(0,0,1800,30)],
  platforms:[r(160,760,180,14),r(160,620,180,14),r(160,480,180,14),r(860,520,200,14),r(1220,760,260,14)],
  spawns:[{x:100,y:900,team:-1},{x:960,y:900,team:-1},{x:1500,y:900,team:-1}],
  pickups:[...rangeWeapons.map((item,i)=>({x:90+i*70,y:900,kind:"weapon" as const,item,respawnSec:5})),
    ...["frag","flash","gas","emp","mine"].map((item,i)=>({x:180+i*320,y:900,kind:"throwable" as const,item,respawnSec:5}))],
  goals:[],flagHomes:[],navNodes:Array.from({length:11},(_,i)=>({x:100+150*i,y:900})),scenery:[{kind:"crate",x:60,y:900,w:30,h:30}],
};
export const MAPS:Record<string,MapDefinition>={[cryptworks.id]:cryptworks,[crosscurrent.id]:crosscurrent,[skyshaft.id]:skyshaft,[outpostYard.id]:outpostYard,[testRange.id]:testRange};
