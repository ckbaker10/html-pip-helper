# Test report: 2026-10-22

## Version 0.1.3

Package: `dist/html-pip-helper-0.1.3.xpi`. Add-on ID:
`html-pip-helper@local.invalid`. License: MPL-2.0.
The package was installed temporarily on a real Android device.

## Automated checks

All 15 Firefox behavior tests passed. They cover:

- Enabling PiP on existing and dynamically inserted nested videos.
- Removing reapplied `disablepictureinpicture` attributes.
- Preserving layout and paused playback when enabling PiP.
- Activating protection only after real playback, including in embedded frames.
- Respecting user pauses and existing fullscreen controls.
- Recovery from trusted browser decoding errors.
- Restoring the previous playback position.
- Handling existing errors when entering fullscreen.
- Leaving successful recovery by the player itself intact.
- Excluding multi-item playlists and limiting recovery to two attempts per minute.

The decoding errors are produced through `MediaSource.endOfStream("decode")`.
The native recovery test also uses an explicitly simulated HTTP source adapter.
A native restart was separately checked on a real, directly loaded video.

`web-ext lint` reported no errors, warnings, or notices, and the XPI build
succeeded. Tools: Node.js 22.20.0, Playwright 1.64.1, web-ext 10.8.0.
Local evidence: `work/evidence/pip-unlock-native-final-checks-2/`, exit status 0,
21.644 seconds measured on the host.

## Real-device checks

Android 16, Firefox for Android 158.0.2, an enabled content blocker, and ADB 37.0.1.
The browser profile and app data were preserved throughout these checks.

Different HTML5 players produced black PiP windows with `MEDIA_ERR_DECODE`.
Depending on the player, a direct source remained attached while dropped-frame
counts rose, or the player removed its media connection after the error. Another
player recovered its own stream. These cases were assessed separately.

A targeted restart of a direct video source restored the picture and position
without reloading the entire page. In the final version 0.1.3 PiP run, the picture
remained visible through repeated Home presses and app switches for 223 seconds
measured on the host: video time 616.53531 → 839.475685, resolution 1920 × 1080,
`readyState=4`, `paused=false`, frame count 1330 → 12474, and dropped frames
remaining at 1. The error did not recur in that run, so automatic recovery was
not needed and is not claimed to have been newly triggered there.

A reapplied PiP restriction was removed from a real video before playback;
inline styles and the paused state were preserved.

### Locked-screen playback and background network access

Locked-screen playback was checked separately from PiP decoding failures. A
paused or unloaded successor without a decoding error is a different failure
mode from `MEDIA_ERR_DECODE`.

Android reported an effective `APP_BACKGROUND` network block for Firefox after
it moved into a background process state. Data Saver was disabled, but this
separate background restriction still applied. A small Internet request remained
pending while a local control request through the ADB tunnel completed.

A temporary power-saving exemption for Firefox changed the effective network
block to `NONE`. The same Internet request then succeeded with the screen still
locked. Removing the exemption restored `APP_BACKGROUND`, and the Internet
request remained pending again. The original exemption state was verified and
restored after testing.

With version 0.1.3 installed and a temporary exemption enabled, one transition in
the affected playlist completed automatically while the screen remained locked:

- The first video ended at approximately 224.68 seconds.
- The player selected the next item and attached its media source.
- Subsequent samples showed 6.86 and 17.30 seconds of playback, `paused=false`,
  `readyState=4`, and no decoding error.

There was a noticeable loading pause between items. No additional Android media
Play command or experimental animation-timer replacement was sent during the
transition. This confirms one successful transition, not gapless playback or a
long-term guarantee across every player, device, or playlist. The exemption was
removed again after this test. The observed network restriction requires an
Android configuration change; the extension does not manage that setting.

Separate local control players using a direct video file and MediaSource each
played four clips with three automatic transitions while the screen was locked.
Those controls ran without the temporary extension, which had disappeared after
a browser restart; version 0.1.3 was then reinstalled before the final playlist
test. Successful local playback alone does not prove Internet access, because
these clips were served through an ADB tunnel.

Local evidence directories:

- `work/evidence/network-power-exemption-comparison-1/`
- `work/evidence/control-direct-locked-complete-1/`
- `work/evidence/control-mse-locked-1/`
- `work/evidence/playlist-power-exemption-final-1/`

The [Android setup guide](docs/ANDROID_SETUP.md) documents the relevant settings
with reviewed screenshots. The capture device's original battery setting was
restored after illustrating the recommended **Unrestricted** selection.

### Evidence handling

Exact commands, host timestamps, input hashes, exit statuses, and private device
recordings stay in ignored `work/evidence/`. They are not published in this
repository. Durations use the host clock rather than the device clock. The
instructional settings screenshots in `docs/images/` were reviewed separately
before publication; they contain no tested page, stream address, or credentials.

## Reproduce the automated checks

From the repository directory with Node.js 22 or newer:

```sh
npm ci
npx playwright install firefox
npm test
npm run lint
npm run build
```

The Android test resets app data and must only run on a dedicated emulator.
The device identifier and local tool paths are configurable. The optional live
test receives its URL and any player selectors through environment variables;
no target pages are hardcoded. See [README.md](README.md).

For a manual locked-screen check, follow the
[setup verification steps](docs/ANDROID_SETUP.md#4-check-playback-and-automatic-transitions).

## Verified extension inputs

The archive hash identifies the XPI used in the final locked-screen playlist
test. ZIP metadata can change between builds even when the extension source
files are identical.

| Input | SHA-256 |
| --- | --- |
| `extension/content.js` | `1c224563a4dd9fb4accb6066816bda40bf1ad076f0acef275c8734ccbcf252fe` |
| `extension/manifest.json` | `a029ad53966b2117b5bae41eb451831bbea73656d31c63e0ecfad81f971f1e94` |
| `dist/html-pip-helper-0.1.3.xpi` | `db949d39e38d2e9abc127c6d31267d92124208e155f9e88a64d5213f5bee6a5d` |
