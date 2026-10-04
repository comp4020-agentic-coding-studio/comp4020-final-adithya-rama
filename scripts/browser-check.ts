// Drives the running app in Chromium at the two marking viewports (1920x1080
// desktop, 390x844 touch phone): home, practice round, controls, results.
// Screenshots land in test-results/. Usage: APP_URL=... pnpm check:browser
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";

const base = process.env.APP_URL ?? "http://localhost:8080";
const out = "test-results";
mkdirSync(out, { recursive: true });

const problems: string[] = [];

async function practiceRound(page: Page, tag: string, touch: boolean): Promise<void> {
  page.on("console", (m) => m.type() === "error" && problems.push(`${tag} console: ${m.text()}`));
  page.on("pageerror", (e) => problems.push(`${tag} pageerror: ${e.message}`));
  await page.goto(base);
  await page.getByRole("button", { name: "Practice against bots" }).waitFor();
  await page.screenshot({ path: `${out}/${tag}-home.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (overflow) problems.push(`${tag}: home page scrolls horizontally`);

  await page.getByRole("button", { name: "Practice against bots" }).click();
  await page.locator("canvas").waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1500);

  if (touch) {
    const stick = page.locator(".stick.left");
    const box = (await stick.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + box.width * 0.4, cy - box.height * 0.4, { steps: 4 });
    await page.waitForTimeout(900);
    await page.mouse.up();
    const aim = (await page.locator(".stick.right").boundingBox())!;
    await page.mouse.move(aim.x + aim.width / 2, aim.y + aim.height / 2);
    await page.mouse.down();
    await page.mouse.move(aim.x + aim.width, aim.y + aim.height / 2, { steps: 4 });
    await page.waitForTimeout(600);
    await page.mouse.up();
  } else {
    await page.mouse.move(1400, 500);
    await page.keyboard.down("KeyD");
    await page.keyboard.down("Space");
    await page.waitForTimeout(700);
    await page.keyboard.up("Space");
    await page.mouse.down();
    await page.waitForTimeout(500);
    await page.mouse.up();
    await page.keyboard.up("KeyD");
    await page.keyboard.press("KeyG");
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${tag}-game.png` });

  const hud = await page.locator(".hud-weapon").innerText();
  if (!/Mini Eagle|Uzi/.test(hud)) problems.push(`${tag}: weapon HUD missing (${hud})`);

  if (touch) await page.getByRole("button", { name: "Menu" }).click();
  else await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "End round now" }).click();
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.getByText("Results saved to your match history.").waitFor({ timeout: 10_000 });
  await page.screenshot({ path: `${out}/${tag}-results.png`, fullPage: true });

  await page.getByRole("button", { name: "Leave room" }).click();
  await page.getByRole("heading", { name: "Your matches" }).waitFor();
  await page.locator(".match-row").first().waitFor({ timeout: 5000 });
}

const browser = await chromium.launch();
try {
  const desktop = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await practiceRound(await desktop.newPage(), "desktop", false);
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await practiceRound(await phone.newPage(), "phone", true);
} catch (e) {
  problems.push(`run failed: ${(e as Error).message}`);
} finally {
  await browser.close();
}

if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`);
  process.exit(1);
}
console.log(`✓ desktop and phone practice rounds played through; screenshots in ${out}/`);
