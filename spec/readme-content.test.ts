import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { marked } from "marked";
import { expect, inject, it } from "vitest";

const baseUrl = inject("baseUrl");
const expected = new JSDOM(marked.parse(readFileSync("README.md", "utf8"), { async: false }));
const normalise = (value: string | null) => (value ?? "").replace(/\s+/g, " ").trim();

it("publishes the entire current README, including its argument and joining instructions, without running scripts", async () => {
  const response = await fetch(new URL("/readme/", baseUrl));
  expect(response.status).toBe(200);
  const document = new JSDOM(await response.text()).window.document;
  const content = document.querySelector("main");
  expect(content).not.toBeNull();
  content!.querySelectorAll("nav").forEach((nav) => nav.remove());
  // The starter checks headings. This contract also fails when paragraphs,
  // source labels or joining instructions are stale, missing or reordered.
  expect(normalise(content!.textContent)).toBe(normalise(expected.window.document.body.textContent));
  expect([...content!.querySelectorAll("a")].map((a) => a.getAttribute("href")))
    .toEqual([...expected.window.document.querySelectorAll("a")].map((a) => a.getAttribute("href")));
});

it("keeps the README's local documentation links reachable from its published URL", async () => {
  const links = [...expected.window.document.querySelectorAll("a")]
    .map((a) => a.getAttribute("href")!)
    .filter((href) => !/^(https?:|mailto:|#)/.test(href));
  expect(links.length).toBeGreaterThan(0);
  for (const href of links) {
    const response = await fetch(new URL(href, new URL("/readme/", baseUrl)));
    expect(response.status, `README link ${href}`).toBe(200);
    expect(response.headers.get("content-type"), `README link ${href}`).toContain("text/html");
  }
});
