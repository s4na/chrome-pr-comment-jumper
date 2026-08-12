const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const puppeteer = require("puppeteer");

const extensionPath = path.resolve(__dirname, "..");

test("manifest resources and icons exist", () => {
  const manifest = require("../manifest.json");
  const resources = [
    ...manifest.content_scripts.flatMap(({ js = [], css = [] }) => [...js, ...css]),
    ...Object.values(manifest.icons ?? {}),
  ];
  for (const resource of resources) {
    assert.ok(fs.existsSync(path.join(extensionPath, resource)), `missing: ${resource}`);
  }
});

test("loads in Chrome and opens the comment panel from a fixed button", async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    pipe: true,
    enableExtensions: [extensionPath],
    args: ["--no-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.goto("https://github.com/octocat/Hello-World/pull/1", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector("#pr-comment-jumper-toggle", { visible: true });
    await page.evaluate(() => {
      const container = document.getElementById("s4na-github-floating-actions");
      container.insertAdjacentHTML(
        "beforeend",
        '<button data-s4na-floating-action="zzz-extension">Z</button>',
      );
      document.body.insertAdjacentHTML(
        "afterbegin",
        '<div class="timeline-comment"><a class="author">test-user</a>' +
          '<div class="comment-body">E2E fixture comment</div></div>',
      );
      document.dispatchEvent(new Event("turbo:load"));
    });
    assert.equal(await page.$eval("#s4na-github-floating-actions", (el) => getComputedStyle(el).position), "fixed");
    assert.deepEqual(
      await page.$$eval("[data-s4na-floating-action]", (elements) =>
        elements.map((element) => element.dataset.s4naFloatingAction),
      ),
      ["chrome-pr-comment-jumper", "zzz-extension"],
    );
    await page.click("#pr-comment-jumper-toggle");
    await page.waitForSelector("#pr-comment-jumper-panel.open", { visible: true });
    assert.match(await page.$eval(".panel-body", (el) => el.textContent), /E2E fixture comment/);
  } finally {
    await browser.close();
  }
});
