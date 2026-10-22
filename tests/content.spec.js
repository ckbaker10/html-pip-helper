import { test, expect } from "@playwright/test";
import { resolve } from "node:path";

test.beforeEach(async ({ context }) => {
  await context.addInitScript({ path: resolve("extension/content.js") });
});

test("unlocks existing paused videos without changing their layout", async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:8765/player");
    await page.locator("video").evaluate((v) => {
      v.setAttribute("disablepictureinpicture", "");
      v.style.cssText = "position: relative; width: 73%;";
    });
    await page.addScriptTag({ path: resolve("extension/content.js") });
    await expect(page.locator("video")).not.toHaveAttribute("disablepictureinpicture");
    expect(await page.locator("video").evaluate((v) => v.style.cssText)).toBe("position: relative; width: 73%;");
    expect(await page.locator("video").evaluate((v) => v.paused)).toBe(true);
    expect(await page.evaluate(() => Object.hasOwn(document, "hidden"))).toBe(false);
  } finally {
    await context.close();
  }
});

test("unlocks nested new videos and removes reapplied PiP restrictions", async ({ page }) => {
  await page.goto("/empty");
  await page.evaluate(() => {
    const container = document.querySelector("#container");
    container.innerHTML = '<section><div><video disablepictureinpicture style="width: 73%; position: relative;"></video></div></section>';
    const direct = document.createElement("video");
    direct.setAttribute("disablepictureinpicture", "");
    container.append(direct);
  });
  await expect(page.locator("video")).toHaveCount(2);
  await expect(page.locator("video[disablepictureinpicture]")).toHaveCount(0);
  await page.locator("video").evaluateAll((videos) => {
    for (const v of videos) v.setAttribute("disablepictureinpicture", "true");
  });
  await expect(page.locator("video[disablepictureinpicture]")).toHaveCount(0);
  expect(await page.locator("video").first().evaluate((v) => v.style.cssText)).toBe("width: 73%; position: relative;");
  expect(await page.locator("video").evaluateAll((videos) => videos.every((v) => v.paused))).toBe(true);
  expect(await page.evaluate(() => Object.hasOwn(document, "hidden"))).toBe(false);
});

test("protects dynamically inserted playing videos without adding controls", async ({ page }) => {
  await page.goto("/empty");
  expect(await page.evaluate(() => Object.hasOwn(document, "hidden"))).toBe(false);
  await page.evaluate(async () => {
    const video = document.createElement("video");
    video.src = "/test.webm";
    video.muted = true;
    video.setAttribute("disablepictureinpicture", "");
    document.querySelector("#container").append(video);
    await video.play();
  });
  expect(await page.evaluate(() => Object.hasOwn(document, "hidden"))).toBe(true);
  await expect(page.locator("video")).not.toHaveAttribute("disablepictureinpicture");
  await expect(page.locator("[data-html-pip-helper], button")).toHaveCount(0);
});

test("preserves intentional pause and player fullscreen", async ({ page }) => {
  await page.goto("/player");
  await page.evaluate(() => {
    window.visibilityEvents = 0;
    document.addEventListener("visibilitychange", () => window.visibilityEvents++);
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
  });
  expect(await page.evaluate(() => window.visibilityEvents)).toBe(1);
  expect(await page.evaluate(() => Object.hasOwn(document, "hidden"))).toBe(false);
  await page.locator("video").evaluate(async (v) => { v.muted = true; await v.play(); });
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange", { bubbles: true })));
  expect(await page.evaluate(() => window.visibilityEvents)).toBe(1);
  // A player click triggers native fullscreen, without extension controls.
  await page.getByRole("button", { name: "Vollbild", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.tagName)).toBe("VIDEO");
  await page.evaluate(() => document.exitFullscreen());
  await page.locator("video").evaluate((v) => v.pause());
  await page.waitForTimeout(250);
  expect(await page.locator("video").evaluate((v) => v.paused)).toBe(true);
  await expect(page.locator("[data-html-pip-helper]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Bild in Bild", exact: true })).toHaveCount(0);
});

test("protects a separate-origin player without changing the parent", async ({ page }) => {
  await page.goto("/embedded");
  const frame = page.frameLocator("iframe");
  await frame.locator("video").evaluate(async (v) => { v.muted = true; await v.play(); });
  expect(await frame.locator("video").evaluate(() => Object.hasOwn(document, "hidden"))).toBe(true);
  expect(await page.evaluate(() => Object.hasOwn(document, "hidden"))).toBe(false);
  await expect(frame.locator("[data-html-pip-helper]")).toHaveCount(0);
});

test("ignores synthetic play events and leaves non-playing pages untouched", async ({ page }) => {
  await page.goto("/player");
  await page.locator("video").evaluate((v) => v.dispatchEvent(new Event("play", { bubbles: true })));
  expect(await page.evaluate(() => Object.hasOwn(document, "hidden"))).toBe(false);
  expect(await page.locator("video").evaluate((v) => v.paused)).toBe(true);
  await expect(page.locator("[data-html-pip-helper]")).toHaveCount(0);
});

async function decodeFixture(page, { playlistLength = 1, nativeSource = false } = {}) {
  await page.goto("/player");
  await page.evaluate(async ({ length, nativeSource }) => {
    const video = document.querySelector("video");
    video.muted = true;
    video.loop = false;
    const container = document.createElement("div");
    container.id = "test-player";
    container.className = "jwplayer";
    video.before(container);
    container.append(video);
    const playlist = Array.from({ length }, () => ({}));
    window.reloads = 0;
    window.jwplayer = () => ({
      getContainer: () => container,
      getPlaylist: () => playlist,
      load: (items) => {
        if (items !== playlist) throw new Error("Playlist changed");
        window.reloads++;
        video.src = "/test.webm";
      },
      play: () => { video.play().catch(() => {}); }
    });
    if (nativeSource) {
      delete window.jwplayer;
      container.className = "native-player";
      // The browser generates the actual trusted decode error via MediaSource.
      // Stand in only for the HTTP-source adapter: its real reload uses the clip.
      Object.defineProperty(video, "currentSrc", {
        configurable: true, get: () => new URL("/test.webm", location.href).href
      });
      const load = video.load.bind(video);
      video.load = () => {
        window.reloads++;
        video.src = "/test.webm";
        load();
      };
    }
    const bytes = await (await fetch("/test.webm")).arrayBuffer();
    window.armDecode = async () => {
      const media = new MediaSource();
      window.decodeSource = media;
      video.src = URL.createObjectURL(media);
      await new Promise((resolve) => media.addEventListener("sourceopen", resolve, { once: true }));
      const buffer = media.addSourceBuffer('video/webm; codecs="vp8,opus"');
      buffer.appendBuffer(bytes);
      await new Promise((resolve) => buffer.addEventListener("updateend", resolve, { once: true }));
      await video.play();
    };
    // Model the hoster's teardown after a genuine browser decoding error.
    // endOfStream('decode') produces a trusted MEDIA_ERR_DECODE, not a synthetic event.
    video.addEventListener("error", (event) => {
      window.decodeError = { code: video.error?.code, trusted: event.isTrusted };
      if (!nativeSource) {
        video.removeAttribute("src");
        video.load();
      }
    });
    await window.armDecode();
  }, { length: playlistLength, nativeSource });
  await page.getByRole("button", { name: "Vollbild", exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await expect.poll(() => page.locator("video").evaluate((v) => v.readyState)).toBeGreaterThanOrEqual(2);
}

async function failDecode(page) {
  await page.evaluate(() => window.decodeSource.endOfStream("decode"));
  await expect.poll(() => page.evaluate(() => window.decodeError?.code)).toBe(3);
  expect(await page.evaluate(() => window.decodeError.trusted)).toBe(true);
}

test("recovers a genuine decode error in fullscreen and restores position", async ({ page }) => {
  await decodeFixture(page);
  await page.locator("video").evaluate((v) => { v.currentTime = 5; });
  await expect.poll(() => page.locator("video").evaluate((v) => v.currentTime)).toBeGreaterThanOrEqual(5);
  await failDecode(page);
  await expect.poll(() => page.evaluate(() => window.reloads)).toBe(1);
  await expect.poll(() => page.locator("video").evaluate((v) => v.currentTime)).toBeGreaterThanOrEqual(5);
  await expect.poll(() => page.locator("video").evaluate((v) => !v.paused && v.readyState >= 2)).toBe(true);
});

test("reloads a native-source adapter after a trusted decode error", async ({ page }) => {
  await decodeFixture(page, { nativeSource: true });
  await page.locator("video").evaluate((v) => { v.currentTime = 5; });
  await expect.poll(() => page.locator("video").evaluate((v) => v.currentTime)).toBeGreaterThanOrEqual(5);
  await failDecode(page);
  await expect.poll(() => page.evaluate(() => window.reloads)).toBe(1);
  await expect.poll(() => page.locator("video").evaluate((v) => v.currentTime)).toBeGreaterThanOrEqual(5);
  await expect.poll(() => page.locator("video").evaluate((v) => !v.error && !v.paused && v.readyState >= 2)).toBe(true);
});

test("leaves a player's successful recovery alone", async ({ page }) => {
  await decodeFixture(page);
  await failDecode(page);
  await page.locator("video").evaluate(async (v) => {
    v.src = "/test.webm";
    await v.play();
  });
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.reloads)).toBe(0);
  expect(await page.locator("video").evaluate((v) => !v.error && !v.paused)).toBe(true);
});

test("recovers an existing native decode error when entering fullscreen", async ({ page }) => {
  await decodeFixture(page, { nativeSource: true });
  await page.evaluate(() => document.exitFullscreen());
  await failDecode(page);
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.reloads)).toBe(0);
  await page.getByRole("button", { name: "Vollbild", exact: true }).evaluate((button) => {
    button.onclick = () => document.querySelector("video").requestFullscreen();
  });
  await page.getByRole("button", { name: "Vollbild", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.reloads)).toBe(1);
  await expect.poll(() => page.locator("video").evaluate((v) => !v.error && !v.paused && v.readyState >= 2)).toBe(true);
});

test("does not recover an intentionally paused video", async ({ page }) => {
  await decodeFixture(page);
  await page.locator("video").evaluate((v) => v.pause());
  await failDecode(page);
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.reloads)).toBe(0);
  expect(await page.locator("video").evaluate((v) => v.paused)).toBe(true);
});

test("does not replace a multi-item playlist", async ({ page }) => {
  await decodeFixture(page, { playlistLength: 2 });
  await failDecode(page);
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.reloads)).toBe(0);
});

test("leaves decoding errors outside fullscreen to the player", async ({ page }) => {
  await decodeFixture(page);
  await page.evaluate(() => document.exitFullscreen());
  await failDecode(page);
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.reloads)).toBe(0);
});

test("respects a pause while recovery is loading", async ({ page }) => {
  await decodeFixture(page);
  await page.route("**/test.webm", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await failDecode(page);
  await expect.poll(() => page.evaluate(() => window.reloads)).toBe(1);
  await page.locator("video").evaluate((v) => v.pause());
  await page.waitForTimeout(1800);
  expect(await page.locator("video").evaluate((v) => v.paused)).toBe(true);
  expect(await page.evaluate(() => window.reloads)).toBe(1);
});

test("limits repeated decoding recovery to two attempts per minute", async ({ page }) => {
  await decodeFixture(page);
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (attempt > 1) {
      await page.evaluate(async () => {
        window.decodeError = null;
        await window.armDecode();
      });
    }
    await failDecode(page);
    if (attempt <= 2) {
      await expect.poll(() => page.evaluate(() => window.reloads)).toBe(attempt);
      await expect.poll(() => page.locator("video").evaluate((v) => !v.paused && v.readyState >= 2)).toBe(true);
    } else {
      await page.waitForTimeout(1000);
      expect(await page.evaluate(() => window.reloads)).toBe(2);
    }
  }
});
