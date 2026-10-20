// @vitest-environment jsdom
import {afterEach,describe,it,expect,vi} from "vitest";
import {MatchLoading} from "../src/client/match-loading.ts";
afterEach(()=>{document.body.innerHTML="";vi.useRealTimers();});
describe("honest match loading",()=>{
  it("shows real stages, handles a slow connection and clears its timer on completion",()=>{
    vi.useFakeTimers();const leave=vi.fn(),loading=new MatchLoading(document.body,"<map>","Training",undefined,leave);
    expect(document.querySelector(".launch-card h1")?.textContent).toBe("<map>");
    expect(document.querySelectorAll(".done")).toHaveLength(0);
    loading.stage("scene");expect(document.querySelectorAll(".done")).toHaveLength(1);
    vi.advanceTimersByTime(10000);expect(document.body.textContent).toContain("Still connecting");
    (document.querySelector("[data-loading-leave]") as HTMLButtonElement).click();expect(leave).toHaveBeenCalledOnce();
    loading.stage("sync");loading.finish();expect(document.querySelector(".match-loading")).toBeNull();expect(vi.getTimerCount()).toBe(0);
  });
  it("keeps a renderer failure visible with a way out and no success claim",()=>{
    vi.useFakeTimers();const loading=new MatchLoading(document.body,"Outpost","Practice",undefined,()=>{});
    loading.fail();vi.advanceTimersByTime(20000);
    expect(document.body.textContent).toContain("couldn’t prepare");
    expect(document.querySelector("[data-loading-leave]")).not.toBeNull();loading.finish();
  });
});
