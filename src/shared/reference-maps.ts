import type { MapDefinition, Rect } from "./types.ts";
import { carve, contour, landing, navigation, rect as r, type Point } from "./map-geometry.ts";

// Original collision drawings reconstructed from the publicly viewed map
// overviews (see docs/RESEARCH_MINI_MILITIA_2026_10_14.md). They are authored
// approximations, not extracted assets or claims of byte-identical v4 maps.
// Dark room backing is separate from collision; platforms are genuinely one-way.
type Anchor=readonly[number,number];
interface Draft {
  id:string;name:string;width:number;height:number;biome:NonNullable<MapDefinition["biome"]>;
  theme:MapDefinition["theme"];solids:Rect[];backgrounds?:Rect[];physics?:"space";
  spawn:readonly[Anchor,Anchor];homes:readonly[Anchor,Anchor];items:Anchor[];
  weapons:string[];scenery?:MapDefinition["scenery"];bushes?:Anchor[];
}
function complete(d:Draft):MapDefinition {
  const at=(a:Anchor)=>landing(d.solids,a[0],a[1]);
  const starts=d.spawn.map(at),homes=d.homes.map(at);
  const map:MapDefinition={id:d.id,name:d.name,width:d.width,height:d.height,biome:d.biome,version:1,
    physics:d.physics??"terrestrial",theme:d.theme,solids:d.solids,platforms:[],backgrounds:d.backgrounds??[],scenery:d.scenery??[],
    spawns:starts.flatMap((p,team)=>[0,45,90].map(offset=>{
      const s=landing(d.solids,p.x+(team===0?offset:-offset),p.y);return{...s,team:team as 0|1};
    })),
    goals:starts.map((p,team)=>({team:team as 0|1,rect:r(p.x-38,p.y-94,100,94)})),
    flagHomes:homes.map((p,team)=>({...p,team:team as 0|1})),
    pickups:d.items.map((a,i)=>({...at(a),kind:"weapon",item:d.weapons[i%d.weapons.length],respawnSec:20+i%3*3})),
    concealment:[],navNodes:[],
  };
  for(const [i,a]of d.items.entries()) {
    const p=at(a);
    if(i<5)map.pickups.push({...at([p.x+18,p.y]),kind:"throwable",item:["frag","flash","gas","emp","mine"][i],respawnSec:24});
    else if(i%3===0)map.pickups.push({...at([p.x-18,p.y]),kind:"health",respawnSec:28});
    else if(i%3===1)map.pickups.push({...at([p.x+18,p.y]),kind:"ammo",respawnSec:22});
    else map.pickups.push({...at([p.x+18,p.y]),kind:"fuel",respawnSec:18});
  }
  for(const a of d.bushes??[]) {
    const p=at(a);
    // Bush volumes are placed wholly above a supported, standing-clear floor.
    map.concealment!.push(r(p.x-36,p.y-36,72,36));
    map.scenery!.push({kind:"fern",x:p.x,y:p.y,w:90,h:46});
  }
  for(const scenery of map.scenery??[])if(!["bunker","lantern","banner","bridge"].includes(scenery.kind)) {
    const supported=at([scenery.x,scenery.y]);scenery.x=supported.x;scenery.y=supported.y;
  }
  map.navNodes=navigation(map);
  for(const p of [...map.spawns,...map.flagHomes])if(!map.navNodes.some(n=>n.x===p.x&&n.y===p.y))map.navNodes.push({x:p.x,y:p.y});
  return map;
}
const poly=(p:Point[],step=20)=>contour(p,step);
const fort=(x:number,y:number,w:number,h:number):Rect[]=>[
  r(x,y-h,w,20),r(x,y-h+20,22,h-86),r(x+w-22,y-h+20,22,h-86),r(x,y,w,22)];
const mirror=(width:number,rs:Rect[])=>rs.map(s=>r(width-s.x-s.w,s.y,s.w,s.h));

// OUTPOST — very wide, low asymmetric landmass; a sheltered left underpass,
// perched left fort, detached central hooks and a fort on the far-right bluff.
const outpostGround=carve(poly([[65,810],[220,790],[440,800],[620,820],[820,785],[1130,805],[1450,785],[1600,745],[1810,720],
  [2020,745],[2240,760],[2550,775],[2810,745],[3030,745],[3110,825],[3040,950],[2810,970],[2650,955],[2400,980],
  [2110,960],[1800,970],[1550,1000],[1440,920],[1190,940],[955,925],[770,955],[540,935],[280,940],[90,900]]),
  [r(420,855,1020,66),r(400,785,260,138),r(1250,700,210,225)]);
const outpostSolids=[
  ...outpostGround,r(420,921,1040,24),
  ...Array.from({length:4},(_,i)=>r(400+i*40,801+i*30,40,144-i*30)),
  ...Array.from({length:4},(_,i)=>r(1290+i*40,891-i*30,40,54+i*30)),
  ...poly([[210,400],[240,355],[490,365],[575,405],[550,485],[475,535],[275,525],[195,460]]),
  ...fort(290,355,240,155),
  ...poly([[820,300],[850,260],[910,290],[875,350],[940,435],[955,570],[875,575],[855,480],[815,380]]),
  ...poly([[1060,310],[1110,275],[1140,210],[1190,235],[1260,290],[1250,345],[1160,425],[1185,535],[1100,550],[1080,470],[1110,410]]),
  ...poly([[1480,465],[1550,425],[1680,450],[1780,355],[1840,370],[1800,470],[1720,560],[1590,635],[1510,610]]),
  ...poly([[2110,235],[2180,210],[2240,235],[2250,285],[2310,325],[2390,315],[2380,375],[2270,400],[2230,465],[2140,485],[2155,380]]),
  ...poly([[2460,350],[2510,295],[2600,325],[2680,225],[2740,215],[2760,270],[2820,310],[2780,350],[2660,355],[2600,440],[2520,470]]),
  ...poly([[2180,570],[2240,530],[2330,500],[2400,535],[2370,610],[2260,655],[2170,650]]),
  ...fort(2780,745,250,170),
];
const outpost=complete({id:"outpost",name:"Outpost",width:3200,height:1108,biome:"jungle",
  theme:{sky:0xb9d2c7,rock:0x807b64,platform:0x8fae5c,accent:0xe2c37b},solids:outpostSolids,
  backgrounds:[r(290,210,240,145),r(2780,585,250,160),r(420,855,1020,66),r(265,490,58,300),r(495,485,48,315)],
  spawn:[[180,800],[2950,745]],homes:[[300,800],[2780,760]],
  items:[[235,800],[625,920],[1060,920],[1520,760],[2030,760],[2870,745],[405,355],[900,570],[1150,210],[1630,440],[2190,220],[2700,240],[2280,520]],
  weapons:["ak47","uzi","spas12","m4","mini-eagle","magnum","m93ba","tec9","smaw","xm8","tavor-x95","golden-eagle","rg6"],
  bushes:[[300,800],[700,820],[1200,800],[1850,740],[2520,780],[450,355]],
  scenery:[{kind:"bunker",x:290,y:355,w:240,h:155},{kind:"bunker",x:2780,y:745,w:250,h:170},
    {kind:"palm",x:1150,y:220,h:110},{kind:"palm",x:2118,y:240,h:90},{kind:"palm",x:565,y:800,h:95},{kind:"crate",x:2980,y:745,w:35,h:32}]});

// HIGHTOWER — enclosed facing metal buildings with staggered inward windows,
// the narrow central well, upper cross-room and a low, curved connecting alley.
const towerLeft=[r(100,440,570,34),r(100,440,34,730),r(100,1170,570,35),
  r(134,640,420,28),r(370,850,300,28),r(134,1030,390,28),
  r(642,474,28,115),r(642,925,28,145)];
const towerBase=poly([[95,1340],[300,1330],[550,1350],[660,1320],[790,1330],[900,1360],[1200,1370],[1440,1350],
  [1600,1320],[1770,1350],[1940,1340],[2190,1330],[2310,1350],[2310,1490],[2090,1510],[1800,1490],[1600,1510],
  [1400,1500],[1190,1520],[950,1500],[740,1510],[550,1490],[300,1510],[95,1480]]);
const highTower=complete({id:"high-tower",name:"HighTower",width:2400,height:1600,biome:"industrial",
  theme:{sky:0xa9bcc0,rock:0x797968,platform:0xb6ba8e,accent:0xe6b555},
  solids:[...towerBase,...towerLeft,...mirror(2400,towerLeft),
    r(960,1100,90,170),r(1350,1100,90,170),r(1050,1230,300,40),
    r(1090,725,42,505),r(1268,725,42,505),
    r(1035,385,330,35),r(990,420,35,140),r(1375,420,35,140),
    r(990,560,160,32),r(1250,560,160,32),r(1090,592,42,130),r(1268,592,42,130),
    r(1035,285,90,100),r(1160,230,80,155),r(1285,285,80,100),
    r(720,1210,145,28),r(1535,1210,145,28)],
  backgrounds:[r(134,474,508,696),r(1758,474,508,696),r(1025,420,350,140),r(1132,590,136,705)],
  spawn:[[200,1340],[2200,1340]],homes:[[460,1340],[1940,1340]],
  items:[[250,1340],[700,1340],[1175,1370],[1700,1340],[2150,1340],[280,640],[500,850],[2000,850],[2070,640],[1200,385],[1190,1295],[800,1210]],
  weapons:["m4","spas12","uzi","ak47","tec9","m93ba","minigun","m14","aa20","smaw","riot-shield","machete"],
  bushes:[[300,1340],[2070,1340]],
  scenery:[{kind:"crate",x:200,y:640,w:45,h:38},{kind:"crate",x:2150,y:640,w:45,h:38},
    {kind:"lantern",x:1200,y:420,h:65},{kind:"lantern",x:540,y:900,h:48},{kind:"lantern",x:1860,y:900,h:48}]});

// ICEBOX — scalloped ice bowl, upper wooden lodges, forked ceiling ledges and
// dense, off-axis interior ice islands. The dark blue room behind is passable.
const iceFloor=poly([[170,1260],[350,1300],[560,1360],[800,1390],[1050,1370],[1250,1410],[1450,1400],[1630,1450],[1860,1400],
  [2080,1380],[2300,1400],[2500,1360],[2740,1320],[3020,1260],[3040,1420],[2770,1500],[2280,1530],[1850,1510],
  [1620,1570],[1190,1540],[790,1510],[320,1450],[160,1400]]);
const iceWall=poly([[160,420],[260,440],[250,610],[320,730],[265,890],[310,1030],[245,1150],[350,1300],[170,1310],[110,1060],[130,780],[100,560]]);
const iceIslands=[
  ...poly([[510,560],[760,545],[860,585],[770,650],[640,680],[550,635]]),
  ...poly([[530,875],[680,830],[840,910],[775,980],[620,945]]),
  ...poly([[1010,920],[1180,860],[1240,770],[1340,795],[1290,980],[1180,1030],[1020,1000]]),
  ...poly([[970,1180],[1110,1110],[1260,1160],[1240,1230],[1100,1280]]),
  ...poly([[1410,460],[1490,310],[1585,270],[1690,330],[1770,485],[1690,545],[1640,420],[1550,405],[1500,535]]),
  ...poly([[1450,720],[1530,625],[1610,655],[1680,780],[1760,835],[1710,875],[1500,805]]),
  ...poly([[1440,1110],[1530,1030],[1640,1010],[1830,1110],[1820,1170],[1630,1160],[1540,1190]]),
  ...poly([[2100,630],[2200,540],[2370,565],[2520,510],[2680,585],[2600,665],[2420,660],[2300,705]]),
  ...poly([[2020,890],[2110,845],[2210,875],[2250,1005],[2130,1030],[2090,965]]),
  ...poly([[2450,1100],[2540,1010],[2680,1025],[2720,1100],[2630,1160],[2490,1170]]),
];
const iceBox=complete({id:"ice-box",name:"IceBox",width:3200,height:1600,biome:"snow",
  theme:{sky:0xc3dce7,rock:0x829fb4,platform:0xe2f4fa,accent:0x8cd1e5},
  solids:[...iceFloor,...iceWall,...mirror(3200,iceWall),...iceIslands,
    r(240,410,530,45),...fort(300,410,380,150),r(2405,415,530,45),...fort(2490,415,380,145),
    ...poly([[825,315],[1020,290],[1120,375],[1250,390],[1240,485],[1120,485],[1060,410],[865,420]]),
    ...poly([[1880,395],[2020,310],[2190,320],[2270,385],[2230,470],[2070,425],[1960,480]])],
  backgrounds:[r(180,450,2840,950),r(300,280,380,130),r(2490,290,380,125)],
  spawn:[[320,1300],[2820,1300]],homes:[[620,1380],[2580,1350]],
  items:[[430,1340],[960,1400],[1640,1450],[2200,1400],[2780,1320],[490,410],[2650,415],[680,550],[1210,860],[1600,1040],[2460,550],[2100,860],[1140,1160]],
  weapons:["m14","mp5","aa20","spas12","magnum","m93ba","smaw","phasr","emp-gun","minigun","tavor-x95","saw-launcher","machete"],
  scenery:[{kind:"bunker",x:300,y:410,w:380,h:150},{kind:"bunker",x:2490,y:415,w:380,h:145},
    {kind:"pine",x:750,y:410,h:145},{kind:"pine",x:2430,y:415,h:140},{kind:"crystal",x:1580,y:1040,w:65,h:40}]});

// PYRAMID — stepped diagonal envelope around a passable triangular rear wall.
// Five broken gallery levels create real connected internal rooms; entrances
// are cut through the bottom of each flank, not painted onto solid sandstone.
const pyramidBase=poly([[180,1550],[430,1530],[750,1570],[980,1550],[1200,1580],[1460,1560],[1730,1580],[1990,1550],[2210,1570],
  [2490,1540],[2770,1570],[2980,1540],[3200,1560],[3420,1550],[3420,1690],[3150,1710],[2840,1690],[2460,1730],[2110,1710],
  [1730,1740],[1340,1710],[960,1730],[560,1690],[180,1690]]);
const pyramidSteps:Rect[]=[];
for(let i=0;i<43;i++){
  const x=700+i*25,y=1510-i*30;
  pyramidSteps.push(r(x,y,48,46),r(3600-x-48,y,48,46));
}
const pyramidRooms=[r(940,1360,610,35),r(1700,1360,200,35),r(2050,1360,610,35),
  r(1060,1110,320,35),r(1540,1110,520,35),r(2220,1110,320,35),
  r(1310,860,290,35),r(1760,860,80,35),r(2000,860,290,35),
  r(1520,610,300,35),r(1980,610,100,35),r(1765,450,70,35),
  r(1380,1150,35,135),r(2185,1150,35,135),r(1580,900,35,150),r(1985,900,35,150),
  r(1820,650,35,135)];
const sandColumn=(x:number,top:number,w:number,stem:number)=>[
  ...poly([[x,top+25],[x+25,top],[x+w-35,top+12],[x+w,top+50],[x+w-25,top+85],[x+35,top+85],[x-10,top+65]]),
  ...poly([[x+w*.38,top+80],[x+w*.64,top+80],[x+w*.68,stem],[x+w*.25,stem],[x+w*.34,top+180]])];
const pyramid=complete({id:"pyramid",name:"Pyramid",width:3600,height:1800,biome:"desert",
  theme:{sky:0xe7d1a6,rock:0xb18b58,platform:0xdcc593,accent:0x69bfc0},
  solids:[...pyramidBase,...carve(pyramidSteps,[r(650,1450,2300,180)]),...pyramidRooms,
    ...sandColumn(690,455,355,1140),...sandColumn(2555,455,355,1110),...sandColumn(350,970,250,1470),...sandColumn(3000,970,250,1470)],
  backgrounds:Array.from({length:15},(_,i)=>r(720+i*70,1480-i*82,2160-i*140,82)),
  spawn:[[330,1540],[3230,1560]],homes:[[620,1560],[2970,1540]],
  items:[[430,1540],[1060,1560],[1790,1580],[2510,1560],[3160,1560],[1130,1360],[2380,1360],[1660,1110],[2100,860],[1640,610],[1800,450],[810,460],[2720,470]],
  weapons:["m14","mini-eagle","rg6","ak47","uzi","aa20","machete","m4","golden-eagle","m93ba","smaw","flamethrower","riot-shield"],
  scenery:[{kind:"cactus",x:330,y:1540,w:70,h:115},{kind:"cactus",x:3230,y:1560,w:60,h:105},
    {kind:"urn",x:1750,y:1110,w:36,h:55},{kind:"urn",x:2460,y:1360,w:36,h:55},{kind:"bones",x:1390,y:1560,w:70}]});

// LUNARCY — disconnected hollow asteroids; there is no invisible/global floor.
// The user-requested space profile forces unlimited boost and zero gravity.
const lunarRocks=[
  ...poly([[360,260],[460,170],[645,140],[830,190],[925,305],[840,430],[740,505],[540,480],[480,405],[570,410],[735,375],[790,280],[660,255],[550,285],[535,350],[420,365]]),
  ...poly([[1760,180],[1850,125],[2040,170],[2200,265],[2250,360],[2170,425],[2030,460],[1910,410],[1975,350],[2110,345],[2070,290],[1900,250],[1830,290],[1760,255]]),
  ...poly([[1120,590],[1260,530],[1390,555],[1500,480],[1640,460],[1710,520],[1700,600],[1570,650],[1430,610],[1300,635],[1210,730]]),
  ...poly([[1120,780],[1170,850],[1180,1010],[1280,1100],[1450,1110],[1640,1015],[1720,870],[1680,730],[1770,700],[1840,835],[1800,1030],[1660,1170],[1500,1240],[1310,1220],[1140,1130],[1060,965],[1050,855]]),
  ...poly([[2320,580],[2470,505],[2630,500],[2820,590],[2860,760],[2790,900],[2650,950],[2520,920],[2460,845],[2590,845],[2720,775],[2730,660],[2600,610],[2460,665],[2440,765],[2310,755]]),
  ...poly([[620,1130],[730,1060],[880,1020],[1000,1080],[1050,1190],[1010,1390],[890,1490],[750,1450],[665,1330],[700,1220],[800,1200],[810,1305],[880,1360],[945,1300],[940,1180],[840,1130],[745,1170]]),
  ...poly([[1940,1130],[2030,1090],[2160,1110],[2290,1230],[2240,1330],[2100,1400],[2000,1330],[2070,1270],[2030,1210],[1950,1240]]),
  ...poly([[180,740],[250,650],[350,690],[400,790],[330,880],[220,850]]),
  ...poly([[2820,220],[2910,180],[3010,240],[2970,350],[2880,370],[2810,320]]),
  ...poly([[1450,900],[1500,865],[1570,885],[1580,950],[1490,990],[1440,955]]),
  ...poly([[380,1310],[460,1270],[520,1330],[480,1410],[400,1400]]),
  ...poly([[2730,1250],[2810,1190],[2900,1250],[2850,1350],[2750,1340]]),
];
const lunarcy=complete({id:"lunarcy",name:"Lunarcy",width:3200,height:1600,biome:"space",physics:"space",
  theme:{sky:0x172437,rock:0x808b98,platform:0xb8c7d4,accent:0x8cdee6},solids:lunarRocks,
  spawn:[[230,700],[2900,220]],homes:[[280,700],[2950,220]],
  items:[[255,680],[590,170],[1330,550],[2030,160],[2880,200],[2520,520],[1470,880],[2080,1110],[790,1060],[440,1290],[2790,1230],[1430,1120]],
  weapons:["phasr","emp-gun","smaw","m93ba","m14","saw-launcher","minigun","m4","mp5","aa20","rg6","riot-shield"],
  scenery:[{kind:"crystal",x:1490,y:880,w:50,h:35},{kind:"crystal",x:280,y:680,w:55,h:40}]});

// CATACOMBS — a broad oval perimeter loop, four masonry quadrants, the central
// cross and secondary junctions. This is the wide maze, not tall Cliffhanger.
const catShell=[
  ...poly([[170,240],[300,140],[710,95],[1190,75],[1780,90],[2310,110],[2750,170],[2910,275],[2840,345],[2660,255],
    [2250,205],[1750,180],[1190,175],[700,195],[330,235],[240,315]]),
  ...poly([[170,240],[240,315],[185,570],[205,790],[160,1030],[195,1290],[250,1490],[345,1640],[260,1750],[135,1570],
    [90,1300],[70,1030],[105,750],[85,500]]),
  ...poly([[2910,275],[3000,520],[2980,750],[3010,1040],[2990,1290],[2940,1540],[2820,1760],[2735,1660],
    [2840,1490],[2890,1270],[2870,1040],[2910,790],[2880,560],[2840,345]]),
  ...poly([[260,1750],[345,1640],[570,1730],[850,1770],[1170,1800],[1530,1810],[1850,1800],[2170,1770],[2510,1740],
    [2735,1660],[2820,1760],[2530,1840],[2210,1870],[1840,1900],[1520,1920],[1160,1900],[800,1870],[510,1830]]),
];
const catMass=[
  r(420,350,820,180),r(420,530,270,285),r(860,530,380,285),r(420,940,490,180),r(1070,940,170,180),
  r(1420,340,220,425),r(1420,765,100,125),r(1560,765,80,125),
  r(1820,350,820,180),r(1820,530,380,285),r(2370,530,270,285),r(1820,940,200,180),r(2180,940,460,180),
  r(420,1290,410,300),r(990,1290,250,110),r(990,1520,250,160),
  r(1420,1120,220,210),r(1420,1470,220,215),
  r(1820,1290,310,110),r(1820,1520,310,160),r(2290,1290,350,300),
  r(1420,980,220,35),r(730,850,110,28),r(2220,850,110,28),
  // Genuine crouch-sized side passage beneath this short bridging lintel.
  r(630,882,150,26),
];
const catacombs=complete({id:"catacombs",name:"Catacombs",width:3080,height:1960,biome:"cavern",
  theme:{sky:0x403a2e,rock:0xa99977,platform:0xc7bfa2,accent:0xe0b760},
  solids:[...catShell,...catMass],backgrounds:[r(180,200,2720,1600)],
  spawn:[[370,1680],[2690,1700]],homes:[[620,1740],[2450,1760]],
  items:[[470,1700],[1150,1800],[1830,1800],[2550,1740],[650,1290],[2450,1290],[1110,940],[1920,940],[1530,980],[520,350],[2470,350],[1510,340],[1490,1470]],
  weapons:["spas12","machete","tec9","aa20","saw-launcher","flamethrower","magnum","uzi","riot-shield","m93ba","rg6","smaw","emp-gun"],
  scenery:[{kind:"lantern",x:780,y:545,h:65},{kind:"lantern",x:2300,y:545,h:65},{kind:"lantern",x:1530,y:1070,h:55},
    {kind:"bones",x:1200,y:1800,w:75},{kind:"urn",x:1450,y:980,w:32,h:44}]});

export const REFERENCE_MAPS:Record<string,MapDefinition>=Object.fromEntries([outpost,highTower,iceBox,pyramid,lunarcy,catacombs].map(m=>[m.id,m]));
export const REFERENCE_MAP_IDS=Object.keys(REFERENCE_MAPS);
