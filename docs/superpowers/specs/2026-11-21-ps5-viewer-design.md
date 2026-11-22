# PS5 Viewer — design

**Date:** 2026-11-21 · **Owner:** Michael (`aerosaur`) · **Status:** draft for approval

## Intent

Michael plays his PS5 on the TV today. He wants it on his Windows PC instead, in a window, so he can play while also using the PC. The PS5 feeds an Elgato **Cam Link 4K** (HDMI → USB). OBS works but is a cockpit for streaming, not a viewer, and it looks like one. He wants a small, bespoke app that feels like an object: TE (Teenage Engineering) layout and type, in the greys and colours of the PS 30th-anniversary DualSense, with the four original PlayStation colours as a stripe. The approved look is artboard **E** on the mockup canvas: https://claude.ai/artifact/TKzi6V3Qoif3UESjE9L2Ky#artboard-TE-30th

## Goals

1. **No noticeable lag.** It should feel fine to play on. The app must not add buffering.
2. **Windowed first.** It sits alongside other things on one monitor. Fullscreen and a small "mini" window are there for when they're wanted.
3. **PS5 volume independent of the PC.** It has its own level and mute, separate from the Windows master volume.
4. **Controls can be hidden**, leaving just the picture.
5. **Lightweight.** A small .exe, quick to start, low CPU use.
6. **Installable from a single .exe** that Michael copies to the PC via Google Drive.

## Non-goals

Recording, streaming, screenshots, more than one source, overlays or filters, sending controller input, scaling or upscaling options, a settings screen, auto-update, code signing.

## Anti-goals (it fails if any of these are true, even if it technically works)

- Lag you can feel in play, or sound that drifts out of sync with the picture.
- It looks like a generic app: Windows title bar, system buttons, default fonts.
- It's heavy (Electron-sized, hundreds of MB, or slow to open).
- A permission prompt or set-up step every time it opens.

## Constraints

- **Built on an Intel Mac, running on Windows 10/11.** Nothing can be run on Windows from here. The .exe is built by GitHub Actions on a Windows runner.
- **Cam Link 4K accepts 1080p60 or 2160p30.** The PS5 must be set to 1080p, with HDR off, 120 Hz off and **HDCP off** (Settings → System → HDMI → Enable HDCP). With HDCP on, the picture is black.
- The Cam Link shows up on Windows as a webcam (UVC) plus a separate audio input device.
- The .exe is unsigned, so Windows SmartScreen will warn on first launch ("More info → Run anyway").
- The PS5 controller stays paired to the PS5, so the app is controlled by mouse and keyboard.

## Approaches considered

| Approach                                                                       | Trade-off                                                                                                                                                                                                            | Verdict                                                                                  |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Tauri 2 (Rust shell + Windows' built-in WebView2), built on GitHub Actions** | ~5–10 MB. UI is HTML/CSS, so the TE look is cheap to get exactly right. Video goes through Chromium's camera path, which is hardware-decoded and adds roughly 1–2 frames. Needs a GitHub repo for the Windows build. | **Chosen.** Michael handed over the how; this is the best balance of size, look and lag. |
| Native C# (WPF/WinUI + Media Foundation), cross-built on the Mac               | The lowest possible lag in theory. But the tactile UI is far more work, the file is 60–150 MB self-contained, and the media code can't be tested from here.                                                          | Rejected: cost and risk for a lag gain he likely wouldn't feel.                          |
| A single HTML page in Edge kiosk/app mode                                      | Nothing to install, and the same video path as Tauri. But it isn't an app: a shortcut launches it, Edge's chrome leaks through, and there are no global hotkeys.                                                     | Rejected: fails "bespoke app" and global volume keys.                                    |

## How it looks (decided with Michael — artboard E)

- **Window:** frameless, 1040×790 by default. Background is cool grey `#A0A1A5`, type is IBM Plex Mono throughout, labels are uppercase, small and tracked out.
- **Title bar (custom, 44 px, draggable):** four vertical stripes, 6×18 px, 3 px apart, in red `#D7261E`, yellow `#F2B600`, green `#1E9A57` and blue `#1F5FBF`. Then `PS5` in bold, `IN 01 / CAM LINK 4K` and `HDMI → USB` (the last two show the real device name and status). On the right are minimise `_` and close `×`.
- **Picture:** 16:9, with a 2 px `#2B2C30` border, a black background and a small `01` in the corner. It always keeps 16:9 and is letterboxed if the window is a different shape.
- **Control panel (112 px):** `#B4B5B9` with a 1 px `#8C8D92` border and 4 px corner radius. From left to right:
  - **Display:** black, 220×76. The top line shows `VOL` and the live signal mode (e.g. `1080P · 60`). Below it is the volume as three digits (`060`), or `MUTE` in red `#FF8A8F`.
  - **Volume:** a light-grey square `−` key, then a charcoal dished knob with a light marker inside a TE tick ring (from −135° to +135°), then a `+` key.
  - **Four charcoal square keys** (`#55565B`, 56 px), each with a numbered label above and a thin coloured line icon: `01 MUTE` (red `#FF8A8F`), `02 MINI` (pink `#F4A6D8`), `03 FULL` (blue `#8FB0FF`) and `04 HIDE` (green `#5FD6B8`). Keys have a 2 px drop shadow. A pressed or latched key (mute on) sits down 2 px with no shadow.
- The mockup's colours, sizes and spacing are the reference. The builder copies them from `project/TE-30th.dc.html` on the canvas.

## How it behaves

### Video

- On launch, the app finds the capture device whose label contains "Cam Link" (if there isn't one, it uses the first video input) and asks for 1920×1080 at 60 fps.
- Video plays in a `<video>` element with the stream attached, muted, with no controls and no extra buffering.
- **States, shown in the picture area in mono text:**
  - `NO DEVICE`: no Cam Link is plugged in. The app waits and connects automatically when one appears.
  - `NO SIGNAL`: the device is there but no frames are arriving, or they're all black for about 3 s. The display adds a hint: `CHECK PS5 IS ON · HDCP OFF`.
  - When the device is unplugged, the app shows `NO DEVICE` and reconnects when it's plugged back in.

### Audio

- The app opens the Cam Link's audio input (matched by label) with echo cancellation, noise suppression and auto-gain **all off**, in stereo at 48 kHz.
- Sound runs through Web Audio (with the `interactive` latency setting) into a gain node and out to the Windows default output. The Windows master volume still applies on top, but the app's volume is independent.
- **Volume** goes from 0 to 100 in steps of 5 (the keys) or 1 (scroll on the knob). Gain is `(v/100)²` so it sounds even across the range. **Mute** sets gain to 0 and remembers the level.
- Dragging the knob also works, up and down or by rotation, whichever the builder finds feels better.

### Window modes

- **Normal:** the windowed layout above. The window is resizable, with a minimum of 640×(16:9 + chrome).
- **Hide (key 04 or `H`):** the title bar and control panel go away, and the window shrinks to just the 16:9 picture at the same picture size. You drag the window by the picture. Pressing `H`, double-clicking, or a small eye button (bottom-right, fades in on hover) brings the controls back.
- **Mini (key 02 or `N`):** a 480×270 window with no controls that **stays on top**, placed bottom-right of the current monitor. You can drag it and resize it (it keeps 16:9). Pressing `N` again, or double-clicking, returns to the previous size and position.
- **Full (key 03, `F` or double-click in normal mode):** fullscreen with no controls. `Esc` or `F` exits.

### Keyboard

- **When the app is focused:** `↑`/`↓` change volume by 5, `M` mutes, `H` hides, `N` toggles mini, `F` toggles fullscreen, `Esc` leaves fullscreen or mini.
- **Global, working while another app is focused:** `Ctrl+Alt+↑` and `Ctrl+Alt+↓` change volume, `Ctrl+Alt+M` mutes. If Windows won't register a shortcut because something else already uses it, the app skips it quietly.

### Remembers between launches

Volume, mute, window size and position, and whether controls are hidden. Stored in the webview's localStorage.

## Build & delivery

- **Repo:** a new **private** GitHub repo `aerosaur/ps5-viewer` (local folder `~/ps5-viewer`).
- **Stack:** Tauri 2 with a plain HTML/CSS/JS frontend (no framework, no bundler unless Tauri needs one). Plugins: `global-shortcut`, and whatever window APIs are needed for always-on-top, fullscreen and resizing.
- **WebView2 camera/mic permission:** granted automatically for the app's own origin, either through a WebView2 `PermissionRequested` handler or Tauri's equivalent, so there's no prompt. If that can't be done, one prompt on first run is acceptable.
- **CI:** GitHub Actions on `windows-latest` with `tauri-action`, run manually or on a `v*` tag. Its artifacts are the NSIS installer `.exe` and the bare app `.exe`. Michael downloads one, puts it on Drive, and installs it on the PC.
- **App icon:** the four stripes on cool grey.
- **Local development on the Mac:** the frontend runs in Chrome against the Mac's own camera, so the look and controls can be iterated without Windows. A `?test` mode draws a moving test pattern with a frame counter in place of a real device.

## What's left to the builder

- The exact way to grant camera/mic permission automatically in WebView2 under Tauri 2.
- How to detect "no signal" (frames stop arriving, or a sampled frame is all black).
- Knob drag mechanics.
- The window-resize maths for hide and mini on Windows (DPI scaling).

## Known risks

- **Real lag can only be judged on the PC.** If it's noticeable, the first things to check are the Cam Link's own mode, the PS5's output, and whether WebView2 is using hardware decoding.
- **Audio/video sync** depends on the Windows audio output path. Bluetooth headphones will add their own delay, and the app can't fix that.

## Decisions after builder review (Winfred's calls — check these)

1. **Mockup source is in the repo:** `docs/design/mockup-E.dc.html`. That copy is the visual reference, not the canvas link. Port its colours, sizes and spacing directly.
2. **Audio sits behind a small seam.** The UI only calls `setVolume(0–100)` and `setMuted(bool)`, and reads `status`. Version 1 does this with Web Audio. If sync or lag turns out bad on the PC, native WASAPI passthrough in Rust can replace it behind the same interface, and the UI doesn't change. Web Audio is not treated as fixed.
3. **Testing loop:** small, numbered releases. Each build shows its version in the title bar tooltip. A diagnostics readout, toggled with `D`, overlays the picture with: actual fps, dropped and total frames (from `getVideoPlaybackQuality`), the audio context's `baseLatency` + `outputLatency`, the video track settings, and the GPU/decoder info WebView2 reports. Michael's reports are a phone photo of that overlay plus "feels fine / feels laggy".
4. **Minimised or behind other windows:** sound and video keep running, like a TV. Background throttling is turned off for the webview (Tauri `backgroundThrottling` disabled / WebView2 equivalent). It's acceptable for rendering to stop while minimised, but sound must never stop.
5. **Device in use (e.g. OBS has it open):** this is a fourth picture state, `DEVICE IN USE`, with the hint `CLOSE OBS OR OTHER CAPTURE APPS`. The app retries every 2 s and connects as soon as the device is free.
