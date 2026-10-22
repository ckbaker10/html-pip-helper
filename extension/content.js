/* SPDX-License-Identifier: MPL-2.0 */
(() => {
  "use strict";
  let active = false;
  const videos = new WeakMap();

  function enablePictureInPicture(root) {
    if (root instanceof HTMLVideoElement && root.hasAttribute("disablepictureinpicture")) {
      root.removeAttribute("disablepictureinpicture");
    }
    for (const video of root.querySelectorAll?.("video[disablepictureinpicture]") || []) {
      video.removeAttribute("disablepictureinpicture");
    }
  }

  enablePictureInPicture(document);
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes") enablePictureInPicture(mutation.target);
      else for (const node of mutation.addedNodes) enablePictureInPicture(node);
    }
  }).observe(document, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ["disablepictureinpicture"]
  });

  function playback(video) {
    let state = videos.get(video);
    if (!state) {
      state = { wanted: false, position: 0, attempts: [], cancel: null };
      videos.set(video, state);
    }
    return state;
  }

  function rememberPosition(video, state) {
    if (video.readyState >= 2 && !video.error && Number.isFinite(video.currentTime)) {
      state.position = video.currentTime;
    }
  }

  function singleItemPlayer(video) {
    const container = video.closest(".jwplayer");
    const page = window.wrappedJSObject || window;
    if (!container?.id || typeof page.jwplayer !== "function") return null;
    const player = page.jwplayer(container.id);
    if (!player || !container.isSameNode(player.getContainer?.()) ||
        typeof player.load !== "function" || typeof player.play !== "function") return null;
    // Keep a site's playlist intact. Pass its one-item list back to its player
    // without inspecting, copying or saving any media URLs.
    const playlist = player.getPlaylist?.();
    return Array.isArray(playlist) && playlist.length === 1 ? { player, playlist } : null;
  }

  function hasNativeSource(video) {
    // MediaSource blobs need their owning player to rebuild the stream.
    // A direct HTTP video can reload its existing source without reading its URL.
    return !video.closest(".jwplayer") && !video.mediaKeys && !video.srcObject &&
      /^https?:\/\//.test(video.currentSrc);
  }

  function recoverVideo(video) {
    if (video.error?.code !== 3) return;
    const state = videos.get(video);
    if (!state?.wanted || state.cancel || !document.fullscreenElement) return;
    const now = performance.now();
    state.attempts = state.attempts.filter((time) => now - time < 60000);
    if (state.attempts.length >= 2) return;
    try {
      if (!singleItemPlayer(video) && !hasNativeSource(video)) return;
    } catch {
      return;
    }
    // The native error precedes the HLS provider's teardown. Let that finish
    // before rebuilding the current item, and let Android's Home transition settle.
    const position = video.currentTime > 0 ? video.currentTime : state.position;
    let timer;
    let timeout;
    const finish = () => {
      clearTimeout(timer);
      clearTimeout(timeout);
      video.removeEventListener("playing", resumePosition);
      state.cancel = null;
    };
    const resumePosition = () => {
      if (state.wanted && video.isConnected) {
        try {
          video.currentTime = position;
          state.position = position;
        } catch {
          // A stream may no longer permit seeking to the previous position.
        }
      }
      finish();
    };
    state.cancel = finish;
    timer = setTimeout(() => {
      if (!state.wanted || !video.isConnected) return finish();
      try {
        // Give players which recover themselves a chance to finish first.
        if (!video.error && video.readyState >= 2 && !video.paused) return finish();
        const current = singleItemPlayer(video);
        const native = !current && hasNativeSource(video);
        if ((!current && !native) || !document.fullscreenElement) return finish();
        state.attempts.push(performance.now());
        video.addEventListener("playing", resumePosition, { once: true });
        timeout = setTimeout(finish, 15000);
        if (current) {
          current.player.load(current.playlist);
          current.player.play(true);
        } else {
          video.load();
          video.play().catch(finish);
        }
      } catch {
        finish();
      }
    }, 750);
  }

  // Register before player scripts. Leave pages alone until a video plays.
  window.addEventListener("visibilitychange", (event) => {
    if (active) event.stopImmediatePropagation();
  }, true);

  function protectPlayback(event) {
    const video = event.target;
    if (!event.isTrusted || !(video instanceof HTMLVideoElement)) return;
    const state = playback(video);
    state.wanted = true;
    rememberPosition(video, state);
    enablePictureInPicture(video);
    if (active) return;
    // Firefox content scripts have an isolated world. Change the page's document.
    const pageDocument = document.wrappedJSObject || document;
    try {
      Object.defineProperties(pageDocument, {
        hidden: { configurable: true, get: typeof exportFunction === "function"
          ? exportFunction(() => false, pageDocument) : () => false },
        visibilityState: { configurable: true, get: typeof exportFunction === "function"
          ? exportFunction(() => "visible", pageDocument) : () => "visible" }
      });
      active = true;
    } catch {
      // Keep native controls usable if a page prevents visibility changes.
    }
  }

  // Capture includes videos inserted later and each separately injected frame.
  // Playback, fullscreen and PiP stay under the player's and browser's control.
  window.addEventListener("play", protectPlayback, true);
  window.addEventListener("timeupdate", (event) => {
    const video = event.target;
    if (event.isTrusted && video instanceof HTMLVideoElement && videos.has(video)) {
      rememberPosition(video, videos.get(video));
    }
  }, true);
  window.addEventListener("pause", (event) => {
    const video = event.target;
    if (!event.isTrusted || !(video instanceof HTMLVideoElement) || video.error) return;
    const state = videos.get(video);
    if (state) {
      state.wanted = false;
      state.cancel?.();
    }
  }, true);
  window.addEventListener("error", (event) => {
    if (event.isTrusted && event.target instanceof HTMLVideoElement) recoverVideo(event.target);
  }, true);
  window.addEventListener("fullscreenchange", (event) => {
    if (event.isTrusted && document.fullscreenElement) {
      for (const video of document.querySelectorAll("video")) recoverVideo(video);
    }
  }, true);
  window.addEventListener("pagehide", () => {
    for (const video of document.querySelectorAll("video")) videos.get(video)?.cancel?.();
  }, true);
})();
