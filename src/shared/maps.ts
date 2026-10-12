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
    navNodes:[...ground,...nodes,...solids.filter(s=>s.w>=100&&s.y>60).map(s=>({x:s.x+s.w/2,y:s.y}))].filter(p=>!allSolids.some(s=>p.x+11>s.x&&p.x-11<s.x+s.w&&p.y>s.y&&p.y-44<s.y+s.h)),
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

// CRYPTWORKS: connected catacomb chambers, a broad burial vault and two
// narrow vertical shafts. These masonry ceilings have a very different route
// silhouette from the exposed forest cliffs and the fort roofs.
const cryptworks=arena("cryptworks","Cryptworks",2600,1450,"cavern",
  {sky:0x29373b,rock:0x606664,platform:0x929683,accent:0x85ceb2},
  [r(32,185,850,110),r(32,295,130,180),r(1090,185,420,120),r(1718,185,850,110),r(2438,295,130,180),
   r(32,565,570,65),r(520,630,82,130),r(32,940,570,100),r(150,1040,100,100),
   r(1998,565,570,65),r(1998,630,82,130),r(1998,940,570,100),r(2350,1040,100,100),
   r(795,475,1010,80),r(795,555,100,380),r(1705,555,100,380),
   r(895,555,115,25),r(895,580,75,25),r(895,605,35,25),
   r(1590,555,115,25),r(1630,580,75,25),r(1670,605,35,25),
   r(975,975,650,80),r(1050,1055,75,100),r(1475,1055,75,100),
   r(630,735,165,60),r(1805,735,165,60),
   r(360,360,220,50),r(2020,360,220,50)],
  [r(240,795,210,14),r(2150,795,210,14),r(95,1195,210,14),r(2295,1195,210,14),
   r(665,1110,200,14),r(1735,1110,200,14),r(625,915,140,14),r(1835,915,140,14),
   r(1060,805,480,14),r(1090,645,200,14),r(1370,645,160,14),r(925,365,160,14),r(1515,365,160,14)],
  ["spas12","aa20","saw-launcher","flamethrower","machete","riot-shield","tec9","magnum","rg6","emp-gun","mp5"],
  [{kind:"crystal",x:410,y:940,w:80,h:55},{kind:"crystal",x:2210,y:940,w:70,h:48},
   {kind:"crystal",x:1200,y:185,w:80,h:45},{kind:"crystal",x:1050,y:975,w:55,h:35},
   {kind:"lantern",x:335,y:640,h:65},{kind:"lantern",x:2265,y:640,h:65},
   {kind:"lantern",x:1130,y:555,h:85},{kind:"lantern",x:1470,y:555,h:85},
   {kind:"bones",x:1240,y:975,w:80},{kind:"bones",x:650,y:1330,w:60},{kind:"bones",x:1960,y:1330,w:60},
   {kind:"urn",x:240,y:940,w:36,h:50},{kind:"urn",x:2360,y:940,w:36,h:50},
   {kind:"crate",x:465,y:940,w:48,h:44}]);

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

// SIROCCO DUNES: stepped sandstone escarpments, a broken aqueduct and
// a tall eroded central needle. Long open sky sits above sheltered ground runs.
const siroccoDunes=arena("sirocco-dunes","Sirocco Dunes",2900,1450,"desert",
  {sky:0xf0dcc0,rock:0xbd8450,platform:0xe6b973,accent:0x64c4b3},
  [r(32,420,430,90),r(32,510,560,90),r(32,600,675,200),r(32,800,540,165),r(32,965,385,170),
   r(2380,320,488,120),r(2240,440,628,100),r(2300,540,568,260),r(2440,800,428,280),
   r(1170,640,510,75),r(1240,715,370,95),r(1280,810,280,180),r(1345,990,155,170),
   r(650,905,430,60),r(710,965,80,170),r(980,965,70,150),
   r(1790,805,480,60),r(1840,865,70,180),r(2150,865,70,170),
   r(930,335,300,65),r(980,400,70,135),r(980,225,70,110),
   r(1740,200,330,65),r(1810,265,70,110),r(1815,85,70,115)],
  [r(170,1220,190,14),r(2540,1210,190,14),r(500,1095,170,14),r(2200,1130,180,14),
   r(1100,1100,170,14),r(1580,1070,170,14),r(1080,875,140,14),r(1650,825,140,14),
   r(755,685,200,14),r(1850,585,210,14),r(1040,490,210,14),r(1510,395,200,14)],
  ["m93ba","ak47","magnum","smaw","m14","tec9","spas12","rg6","mini-eagle","emp-gun","machete","riot-shield"],
  [{kind:"cactus",x:240,y:420,h:155,w:65},{kind:"cactus",x:380,y:420,h:85,w:42},
   {kind:"cactus",x:2660,y:320,h:155,w:70},{kind:"cactus",x:1430,y:640,h:115,w:55},
   {kind:"cactus",x:810,y:1330,h:130,w:60},{kind:"cactus",x:2100,y:1330,h:90,w:50},
   {kind:"urn",x:730,y:905,w:50,h:55},{kind:"urn",x:2110,y:805,w:45,h:55},
   {kind:"bones",x:1020,y:1330,w:75},{kind:"bones",x:1850,y:1330,w:65},
   {kind:"column",x:1015,y:335,w:70,h:110},{kind:"column",x:1850,y:200,w:70,h:115},
   {kind:"palm",x:1580,y:640,h:180,flip:true},{kind:"crate",x:1940,y:805,w:48,h:42}]);

// SUNSPIRE PALACE: continuous galleries face a high central throne hall.
// Open lower courtyards, colonnades and side staircases replace floating islands.
const palaceLeft=[
  r(90,435,650,40),r(110,475,55,175),r(640,475,55,90),
  // Stepped intrados make actual arch-shaped openings, not painted doors.
  r(165,475,85,20),r(165,495,55,20),r(165,515,25,20),
  r(555,475,85,20),r(585,495,55,20),r(615,515,25,20),
  r(90,805,740,45),r(110,850,55,165),r(735,850,55,165),
  r(310,1130,520,40),r(360,1170,60,65),r(725,1170,60,65),
  // Each staircase has 30px risers, traversable at maximum gravity.
  ...Array.from({length:6},(_,i)=>r(410+i*45,805-(i+1)*30,45,(i+1)*30)),
];
const sunspirePalace=arena("sunspire-palace","Sunspire Palace",2800,1500,"palace",
  {sky:0xdbddeb,rock:0xb8afa0,platform:0xe5dbc5,accent:0xc2a348},
  [...palaceLeft,...mirror(2800,palaceLeft),
   r(1090,330,620,50),r(1110,380,60,190),r(1630,380,60,190),
   r(1050,670,700,45),r(1090,715,60,200),r(1650,715,60,200),
   r(1150,715,100,22),r(1150,737,65,22),r(1150,759,30,22),
   r(1550,715,100,22),r(1585,737,65,22),r(1620,759,30,22),
   r(1210,1000,380,45),r(1360,1045,80,155)],
  [r(680,625,115,14),r(2005,625,115,14),r(110,1250,180,14),r(2510,1250,180,14),r(870,1210,200,14),r(1730,1210,200,14),
   r(890,1000,220,14),r(1690,1000,220,14),r(835,790,180,14),r(1785,790,180,14),
   r(795,590,210,14),r(1795,590,210,14),r(1175,505,175,14),r(1450,505,175,14)],
  ["golden-eagle","m4","tavor-x95","xm8","phasr","aa20","m93ba","saw-launcher","minigun","flamethrower","machete","riot-shield"],
  [{kind:"dome",x:1400,y:330,w:550,h:210},{kind:"dome",x:410,y:435,w:430,h:175},{kind:"dome",x:2390,y:435,w:430,h:175},
   {kind:"column",x:137.5,y:650,w:55,h:175},{kind:"column",x:667.5,y:565,w:55,h:90},
   {kind:"column",x:2132.5,y:565,w:55,h:90},{kind:"column",x:2662.5,y:650,w:55,h:175},
   {kind:"column",x:1140,y:570,w:60,h:190},{kind:"column",x:1660,y:570,w:60,h:190},
   {kind:"column",x:1120,y:915,w:60,h:200},{kind:"column",x:1680,y:915,w:60,h:200},
   {kind:"banner",x:270,y:475,w:64,h:190},{kind:"banner",x:2466,y:475,w:64,h:190,flip:true},
   {kind:"banner",x:1250,y:715,w:55,h:180},{kind:"banner",x:1495,y:715,w:55,h:180,flip:true},
   {kind:"urn",x:990,y:1380,w:58,h:75},{kind:"urn",x:1810,y:1380,w:58,h:75},
   {kind:"urn",x:1240,y:1000,w:38,h:50},{kind:"urn",x:1560,y:1000,w:38,h:50},
   {kind:"palm",x:85,y:1380,h:230},{kind:"palm",x:2715,y:1380,h:230,flip:true}]);

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
export const MAPS:Record<string,MapDefinition>={[cryptworks.id]:cryptworks,[crosscurrent.id]:crosscurrent,[skyshaft.id]:skyshaft,[outpostYard.id]:outpostYard,[siroccoDunes.id]:siroccoDunes,[sunspirePalace.id]:sunspirePalace,[testRange.id]:testRange};
