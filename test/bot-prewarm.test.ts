import { describe, expect, it } from "vitest";
import { setImmediate as yieldTurn } from "node:timers/promises";
import { botNavigationCacheStats, planBotRoute, prewarmBotNavigation } from "../src/server/bot-navigation.ts";
import { defaultSettings, MULTIPLIERS } from "../src/shared/settings.ts";
import { MAPS } from "../src/shared/maps.ts";
import type { MapDefinition } from "../src/shared/types.ts";

describe("bounded navigation prewarm", () => {
  it("yields before construction, publishes complete caches and agrees with synchronous routing", async () => {
    const source=MAPS["catacombs"],map={...source},cold={...source},settings={...defaultSettings(),map:source.id};
    const start=source.flagHomes[0],goal=source.flagHomes[1];
    const expected=planBotRoute(cold,settings,start,goal);
    let complete=false;const warming=prewarmBotNavigation(map,settings).then(()=>{complete=true;});
    expect(complete).toBe(false);
    await yieldTurn();expect(complete).toBe(false);
    await warming;
    expect(botNavigationCacheStats(map).variants).toBe(2);
    expect(planBotRoute(map,settings,start,goal)).toEqual(expected);
    const before=botNavigationCacheStats(map);
    await Promise.all([prewarmBotNavigation(map,settings),prewarmBotNavigation(map,settings)]);
    expect(botNavigationCacheStats(map)).toEqual(before);
  });
  it("retains at most the five legal variants and shares one space graph across gravity choices", async () => {
    const source=MAPS["high-tower"],map={...source};
    for(const gravity of MULTIPLIERS)await prewarmBotNavigation(map,{...defaultSettings(),gravity});
    const stats=botNavigationCacheStats(map);
    expect(stats.variants).toBe(5);
    expect(stats.nodes).toBeLessThanOrEqual(map.navNodes.length*5);
    expect(stats.edges).toBeLessThanOrEqual(stats.nodes*80);
    const space:MapDefinition={...MAPS.lunarcy};
    for(const gravity of MULTIPLIERS)await prewarmBotNavigation(space,{...defaultSettings(),gravity,flight:false});
    expect(botNavigationCacheStats(space).variants).toBe(1);
  });
});
