# HTML PiP Helper

A small Firefox extension for Android that helps HTML5 videos keep playing in the
background, including players embedded from other domains. It adds no buttons.

## Set up your phone

Follow the [Android setup guide with screenshots](docs/ANDROID_SETUP.md) to install
the extension, allow picture-in-picture, and configure Firefox's battery usage.
For locked-screen playlist playback, **Allow background usage** must be enabled
and **Unrestricted** selected on the tested Android device. Allowing PiP alone
does not grant background network access.

## Use picture-in-picture

1. Open a video page and start playback in its player.
2. Use the player's existing fullscreen button.
3. Press Android Home or swipe to the home screen. Firefox moves the video into
   Android's native floating window.

Android must allow Firefox to use picture-in-picture. A video must already be
playing. The extension includes limited recovery for the decoding error observed
after rapid Home transitions. It does not repair protected videos, unrelated
player errors, or a missing `allowfullscreen` permission on an embedding frame.
The existing player and browser controls remain responsible for entering PiP.

## Build and test locally

Requirements: Node.js 22+, npm, and, for behavior tests, FFmpeg and Playwright Firefox.

```sh
npm ci
npx playwright install firefox
npm run lint
npm test
npm run build
```

Package: `dist/html-pip-helper-0.1.3.xpi`.

This XPI is **unsigned**. A permanent installation in release Firefox requires
Mozilla signing, including private distribution outside the add-on catalog.
Building and testing locally does not require a Mozilla account or submit the
extension to Mozilla. For development, load it temporarily using `web-ext` on a
dedicated emulator:

```sh
export PATH="/path/to/android-sdk/platform-tools:$PATH"
npx web-ext run --source-dir extension --target firefox-android \
  --adb-device emulator-5554 --firefox-apk org.mozilla.firefox
```

Enable **Settings → Advanced → Remote debugging via USB** in Firefox for this
development workflow. Temporary extensions disappear when Firefox restarts.
Private tabs may require a separate extension permission.

## Install on Android without ADB

First obtain a Mozilla-signed XPI for release Firefox:

1. Sign in to the [Mozilla Developer Hub](https://addons.mozilla.org/en-US/developers/addon/submit/distribution)
   and submit a new add-on.
2. Choose **On your own** for self-distribution without a public catalog listing.
3. Upload `dist/html-pip-helper-0.1.3.xpi`, select Android compatibility, and finish
   the submission. The JavaScript is readable, with no minification or compilation
   from another source language.
4. Download the signed XPI once signing and any required review are complete.
5. Follow the [installation steps in the Android setup guide](docs/ANDROID_SETUP.md#1-install-and-enable-the-extension).

The local build remains unsigned until this signing process is completed. Each
new version must be signed again. Automatic updates for self-distributed packages
are not configured in this version.

References: [submission](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/),
[signing](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/),
[installation on Android](https://extensionworkshop.com/documentation/publish/install-self-distributed/).

## Android emulator test

`scripts/android-test.mjs` requires Firefox for Android, ADB, and geckodriver. It
uses a **browser profile that is deleted after testing**. Geckodriver resets
Firefox's app data on the emulator at startup. Run this test only on a dedicated
emulator without personal Firefox data, never on your everyday phone. Do not run
other tests on the same emulator at the same time.

Local test inputs are ignored and are not included in the repository:

- `work/firefox.apk`: Firefox for Android 158.0.2, x86_64, from Mozilla's release server.
- `work/geckodriver`: geckodriver 0.37.1 from its official release.
- `work/ublock.xpi`: signed uBlock Origin 1.75.0.

```sh
npm run build
export PATH="/path/to/android-sdk/platform-tools:$PATH"
export ADB="/path/to/android-sdk/platform-tools/adb"
export GECKODRIVER="$PWD/work/geckodriver"
export ANDROID_SERIAL=emulator-5554
npm run test:android
```

The test installs uBlock Origin and this extension, dismisses native installation
prompts, and checks a local clip inside a frame from another origin. It requires
both a Firefox task with `mode=pinned` and advancing video time with `paused=false`.
Set `ANDROID_LIVE_TEST=1` and `ANDROID_LIVE_URL` when invoking
`npm run test:android` to check a video page of your choice afterward.
Optional `ANDROID_LIVE_FRAME`, `ANDROID_LIVE_PLAY`, and `ANDROID_LIVE_FULLSCREEN`
variables specify CSS selectors for an embedding frame and the play and
fullscreen controls. Without them, the test operates a video in the main document.
Extra tabs are closed; the content blocker remains enabled. Live checks depend
on the availability of the page and its player.

Raw test data, diagnostic screenshots, logs, and SHA-256 evidence stay in ignored
`work/`. Only reviewed setup screenshots are published in `docs/images/`.
See [TESTING.md](TESTING.md) for verified results and their limits.

## Permissions and limitations

The extension runs on HTTP and HTTPS pages and in all frames. Broad matching is
needed because pages can embed videos from changing external host domains. It
adds no controls and makes no network requests. It collects no telemetry or other
data, stores no video URLs, and does not extract streams.

It removes `disablepictureinpicture` before playback, including on videos added
later, nested players, and attributes reapplied by the page. It leaves video
position, width, and other layout properties intact and does not start a paused
video merely to remove that attribute.

Once a video starts, the extension attempts to keep the document's Page Visibility
API reporting **visible** and intercepts `visibilitychange`. This prevents common
background-pause behavior while allowing intentional pauses. Reloading resets
this protection. Other mechanisms used by a player to pause playback are not
universally overridden.

If a previously playing fullscreen video reports `MEDIA_ERR_DECODE`, the
extension can reload a JW Player item through the existing player API when its
playlist contains exactly one item. An unencrypted video loaded directly over
HTTP can instead recover through its native loading function. After playback
resumes, the extension restores the previous position. This may cause a brief
interruption without reloading the entire page. It neither inspects media content
nor logs or stores stream addresses.

Multi-item JW playlists and MediaSource players without a supported player API
are not reloaded. If the player has already recovered itself, the extension does
not restart it again. Existing decoding errors are also checked when entering
fullscreen so a previously failed video can recover there.

Recovery is limited to two attempts within 60 seconds. Pausing, removing the
video, or leaving fullscreen before recovery prevents that attempt. A pause while
the video is loading is respected too. Persistent errors or missing playback do
not cause unlimited restarts.

Firefox and Android create the floating window. A browser extension cannot press
Android Home itself. Closed shadow-DOM players and specialized canvas or DRM
players are not supported.

With the screen off or locked, audio can continue, but the PiP picture is not
visible. Playback also depends on the player and Android's battery and background
network policies. On the test device, an Android `APP_BACKGROUND` network block
prevented loading the next video. An automatic playlist transition succeeded with
a temporary battery exemption for Firefox, after a loading pause. See the
[setup guide](docs/ANDROID_SETUP.md#3-allow-unrestricted-background-usage) and
[test report](TESTING.md#locked-screen-playback-and-background-network-access).
The extension does not change lock-screen, battery, or network settings.

## References and license

- Technical reference: [mozilla/video-bg-play](https://github.com/mozilla/video-bg-play).
  This is an independent implementation, not a fork or a Mozilla-affiliated project.
- PiP attribute comparison: [Enable Picture-in-Picture](https://addons.mozilla.org/en-US/firefox/addon/enable-picture-in-picture/).
  The implementation here changes neither video width nor CSS positioning.
- [Mozilla: video playback and PiP on Android](https://support.mozilla.org/en-US/kb/playing-videos-firefox-android)
- [Mozilla: develop extensions for Android](https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/)
- [Mozilla: signing and distribution](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)

MPL-2.0; see [LICENSE](LICENSE).
