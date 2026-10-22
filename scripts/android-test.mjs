import { Builder, By, until } from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox.js";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const serial = process.env.ANDROID_SERIAL || "emulator-5554";
if (!/^emulator-\d+$/.test(serial)) throw new Error("This test resets Firefox app data; use a dedicated Android emulator.");
const liveUrl = process.env.ANDROID_LIVE_URL;
const liveFrame = process.env.ANDROID_LIVE_FRAME;
const livePlay = process.env.ANDROID_LIVE_PLAY || "video";
const liveFullscreen = process.env.ANDROID_LIVE_FULLSCREEN;
if (process.env.ANDROID_LIVE_TEST === "1" && !/^https?:\/\//.test(liveUrl || "")) {
  throw new Error("Set ANDROID_LIVE_URL to the video page for the optional live test.");
}
const adb = process.env.ADB || "/opt/paseo-development/audiobook-stack/redist/android-sdk/platform-tools/adb";
const gecko = process.env.GECKODRIVER || resolve("work/geckodriver");
const device = (...args) => execFileSync(adb, ["-s", serial, ...args], { encoding: "utf8" });
mkdirSync("work/android", { recursive: true });
const started = Date.now();
const options = new firefox.Options().enableMobile("org.mozilla.firefox");
// Selenium's enableMobile() calls this deviceSerial; Gecko uses androidDeviceSerial.
options.set("moz:firefoxOptions", {
  ...options.get("moz:firefoxOptions"), androidDeviceSerial: serial,
  androidIntentArguments: ["-a", "android.intent.action.VIEW", "-d", "about:blank", "--ez", "automationtest", "true"],
  prefs: { "remote.debugging.enabled": true, "marionette.log.level": "Info" }
});
const service = new firefox.ServiceBuilder(gecko).addArguments("--android-storage", "internal", "--allow-system-access").setStdio("inherit");
let driver;
let fixture;
try {
  driver = await new Builder().forBrowser("firefox").setFirefoxOptions(options).setFirefoxService(service).build();
  device("shell", "pm", "grant", "org.mozilla.firefox", "android.permission.POST_NOTIFICATIONS");
  await driver.manage().setTimeouts({ pageLoad: 45000, script: 15000, implicit: 0 });
  console.log("Firefox Android session created");
  const caps = await driver.getCapabilities();
  console.log("Browser:", caps.get("browserVersion"));
  console.log("uBlock:", await driver.installAddon(resolve("work/ublock.xpi"), false));
  console.log("PiP extension:", await driver.installAddon(resolve("dist/html-pip-helper-0.1.3.xpi"), true));
  // Fenix shows a native confirmation over the page for each installed add-on.
  // Dismiss the observed OK controls, so PiP contains the video, not a dialog.
  for (let attempt = 0; attempt < 3; attempt++) {
    await driver.sleep(800);
    device("shell", "uiautomator", "dump", "/sdcard/html-pip-helper-ui.xml");
    const setupUi = device("shell", "cat", "/sdcard/html-pip-helper-ui.xml");
    writeFileSync("work/android/setup-ui.xml", setupUi);
    const ok = [...setupUi.matchAll(/<node\b[^>]*>/g)].map((m) => m[0]).find((node) => /text="OK"/.test(node));
    if (!ok) break;
    const bounds = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(ok);
    if (!bounds) throw new Error("Cannot locate add-on confirmation bounds");
    device("shell", "input", "tap", String(Math.round((Number(bounds[1]) + Number(bounds[3])) / 2)),
      String(Math.round((Number(bounds[2]) + Number(bounds[4])) / 2)));
  }
  device("reverse", "tcp:8766", "tcp:8766");
  process.env.FIXTURE_PORT = "8766";
  fixture = (await import("./fixture-server.mjs")).server;
  await driver.get("http://127.0.0.1:8766/embedded");
  const iframe = await driver.wait(until.elementLocated(By.css("iframe")), 15000);
  await driver.switchTo().frame(iframe);
  await driver.wait(async () => driver.executeScript("return document.querySelector('video')?.readyState >= 2"), 15000);
  if ((await driver.findElements(By.css("[data-html-pip-helper]"))).length) throw new Error("Unexpected extension overlay");
  await driver.findElement(By.css("#fullscreen")).click();
  await driver.wait(async () => driver.executeScript("return document.fullscreenElement?.tagName === 'VIDEO'"), 15000);
  await driver.wait(async () => driver.executeScript("return document.querySelector('video').currentTime > 1"), 15000);
  await driver.sleep(1000); // Android's fullscreen transition follows the DOM event.
  const before = await driver.executeScript("return document.querySelector('video').currentTime");
  device("shell", "input", "keyevent", "KEYCODE_HOME");
  await driver.sleep(2500);
  const activities = device("shell", "dumpsys", "activity", "activities");
  const pinned = activities.split("\n").filter((line) => /org\.mozilla\.firefox.*mode=pinned/.test(line));
  if (!pinned.length) throw new Error("No pinned Firefox Android PiP activity found");
  writeFileSync("work/android/pip-state.txt", pinned.join("\n") + "\n");
  writeFileSync("work/android/pip.png", execFileSync(adb, ["-s", serial, "exec-out", "screencap", "-p"], { maxBuffer: 16 * 1024 * 1024 }));
  const after = await driver.executeScript("return ({time:document.querySelector('video').currentTime,paused:document.querySelector('video').paused,hidden:document.hidden})");
  if (after.paused || after.time <= before) throw new Error("Video did not keep playing in PiP");
  console.log(JSON.stringify({ pip: true, before, after, pinned, seconds: Math.round((Date.now() - started) / 1000) }));
  writeFileSync("work/android/result.json", JSON.stringify({ pip: true, before, after, pinned }, null, 2) + "\n");
  if (process.env.ANDROID_LIVE_TEST === "1") {
  await driver.switchTo().defaultContent();
  device("shell", "am", "start", "-n", "org.mozilla.firefox/org.mozilla.fenix.HomeActivity");
  await driver.get(liveUrl);
  console.log("Target title:", await driver.getTitle());
  // Store only public UI text, never request headers, payloads or credentials.
  writeFileSync("work/android/target.txt", await driver.findElement(By.css("body")).getText());
  const enterLiveFrame = async () => {
    await driver.switchTo().defaultContent();
    if (liveFrame) {
      const frame = await driver.findElement(By.css(liveFrame));
      await driver.executeScript("arguments[0].scrollIntoView({block:'center'})", frame);
      await driver.switchTo().frame(frame);
    }
  };
  await enterLiveFrame();
  await driver.wait(async () => driver.executeScript("return document.querySelectorAll('video').length > 0"), 45000);
  console.log("Player state:", await driver.executeScript("return ({videos:document.querySelectorAll('video').length,frames:document.querySelectorAll('iframe').length})"));
  const originalTab = await driver.getWindowHandle();
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await driver.executeScript("return document.querySelector('video')?.readyState >= 2 && !document.querySelector('video').paused")) break;
    await driver.findElement(By.css(livePlay)).click();
    await driver.sleep(1000);
    // A player click may open an extra tab. Close only tabs opened by this test.
    for (const handle of await driver.getAllWindowHandles()) {
      if (handle === originalTab) continue;
      await driver.switchTo().window(handle);
      await driver.close();
    }
    await driver.switchTo().window(originalTab);
    await enterLiveFrame();
    if (await driver.executeScript("return document.querySelector('video')?.readyState >= 2")) break;
  }
  await driver.wait(async () => driver.executeScript("return document.querySelector('video')?.readyState >= 2"), 30000);
  if (liveFullscreen) await driver.findElement(By.css(liveFullscreen)).click();
  else {
    await driver.executeScript(`
      const video = document.querySelector('video');
      video.addEventListener('click', (event) => {
        event.stopImmediatePropagation();
        video.requestFullscreen();
      }, { once: true, capture: true });
    `);
    await driver.findElement(By.css("video")).click();
  }
  await driver.wait(async () => driver.executeScript("return Boolean(document.fullscreenElement)"), 15000);
  await driver.wait(async () => driver.executeScript("return document.querySelector('video').currentTime > 1"), 15000);
  await driver.sleep(1000);
  const targetBefore = await driver.executeScript("return document.querySelector('video').currentTime");
  device("shell", "input", "keyevent", "KEYCODE_HOME");
  await driver.sleep(2500);
  const targetPinned = device("shell", "dumpsys", "activity", "activities").split("\n")
    .filter((line) => /org\.mozilla\.firefox.*mode=pinned/.test(line));
  const targetAfter = await driver.executeScript("return ({time:document.querySelector('video').currentTime,paused:document.querySelector('video').paused})");
  if (!targetPinned.length || targetAfter.paused || targetAfter.time <= targetBefore) throw new Error("Target video PiP playback failed");
  writeFileSync("work/android/target-pip-state.txt", targetPinned.join("\n") + "\n");
  writeFileSync("work/android/target-pip.png", execFileSync(adb, ["-s", serial, "exec-out", "screencap", "-p"], { maxBuffer: 16 * 1024 * 1024 }));
  console.log(JSON.stringify({ targetPip: true, targetBefore, targetAfter, targetPinned }));
  }
} catch (error) {
  if (driver) {
    console.log("Failure page:", await driver.executeScript("return ({host:location.hostname,text:document.body?.innerText?.slice(0,1800),videos:document.querySelectorAll('video').length})").catch(() => null));
    writeFileSync("work/android/failure.png", execFileSync(adb, ["-s", serial, "exec-out", "screencap", "-p"], { maxBuffer: 16 * 1024 * 1024 }));
  }
  throw error;
} finally {
  // Leave PiP before quitting: closing Gecko while pinned can break Marionette's
  // final response on Android, despite successful playback assertions.
  try {
    if (driver) {
      device("shell", "am", "start", "-n", "org.mozilla.firefox/org.mozilla.fenix.HomeActivity");
      await driver.switchTo().defaultContent();
      await driver.get("about:blank");
      await driver.quit();
    }
  } finally {
    if (fixture) fixture.close();
  }
}
