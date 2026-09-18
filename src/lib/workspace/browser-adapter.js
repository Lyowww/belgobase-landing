/*
 * Browser counterpart for the frozen PC1 workspace.
 *
 * The workspace route injects this file before its original inline script. It
 * deliberately keeps the desktop API names: frozen UI code calls
 * window.pywebview.api.search(...), and this adapter sends that exact method to
 * the authenticated web bridge. Microphone capture is the one browser-native
 * replacement because pywebview/WinMM does not exist in a browser.
 */
(() => {
  "use strict";

  const API_ROOT = "/api/web";
  const DOWNLOAD_PATH = /^\/api\/web\/download(?:\/[^/?#]+)?(?:\?[^#]*)?$/;
  const MAX_SECONDS = 60;
  const TARGET_RATE = 16_000;
  let csrf = "";
  let csrfLoad = null;
  let voice = null;
  let workspaceRevision = null;
  let workspaceSaveQueue = Promise.resolve();

  function messageFor(error) {
    return error instanceof Error && error.message
      ? error.message
      : "Deze actie kon niet worden afgerond. Probeer het opnieuw.";
  }

  function notifyAuth(type) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type }, window.location.origin);
    }
  }

  function authExpired() {
    csrf = "";
    csrfLoad = null;
    notifyAuth("belgobase-web-auth-expired");
  }

  async function json(response) {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }

  async function ensureCsrf() {
    if (csrf) return csrf;
    if (!csrfLoad) {
      csrfLoad = fetch(`${API_ROOT}/auth/session`, {
        cache: "no-store",
        credentials: "same-origin",
      }).then(async (response) => {
        const data = await json(response);
        if (response.status === 401 || !response.ok || data.authenticated !== true || typeof data.csrf !== "string") {
          authExpired();
          throw new Error("Je sessie is verlopen. Meld je opnieuw aan.");
        }
        csrf = data.csrf;
        return csrf;
      }).finally(() => {
        csrfLoad = null;
      });
    }
    return csrfLoad;
  }

  function assertDownloadUrl(value) {
    if (typeof value !== "string") return null;
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin || !DOWNLOAD_PATH.test(url.pathname + url.search)) return null;
    return url;
  }

  function triggerDownload(value) {
    const url = assertDownloadUrl(value);
    if (!url) return;
    const link = document.createElement("a");
    link.href = url.href;
    link.download = "";
    link.style.display = "none";
    document.body.append(link);
    link.click();
    link.remove();
  }

  function bridge(method, payload) {
    if (method !== "workspace_save") return sendBridge(method, payload);
    // Keep rapid edits from this browser in order. Other browsers still use
    // the server revision check, so a stale window cannot overwrite their work.
    const snapshot = JSON.parse(JSON.stringify(payload ?? {}));
    const pending = workspaceSaveQueue.then(() => sendBridge(method, snapshot));
    workspaceSaveQueue = pending.catch(() => {});
    return pending;
  }

  async function sendBridge(method, payload) {
    const token = await ensureCsrf();
    const outgoing = payload === undefined ? {} : { ...payload };
    if (method === "workspace_save") outgoing.workspace_revision = workspaceRevision;
    const response = await fetch(`${API_ROOT}/bridge/${encodeURIComponent(method)}`, {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        "X-BelgoBase-CSRF": token,
      },
      body: JSON.stringify(outgoing),
    });
    const data = await json(response);
    if (response.status === 401) {
      authExpired();
      throw new Error("Je sessie is verlopen. Meld je opnieuw aan.");
    }
    if (!response.ok || data.ok !== true) {
      throw new Error(typeof data.error === "string" ? data.error : "Deze actie kon niet worden afgerond. Probeer het opnieuw.");
    }
    triggerDownload(data.download_url);
    if ((method === "bootstrap" || method === "workspace_save") && Number.isInteger(data.workspace_revision)) workspaceRevision = data.workspace_revision;
    return data;
  }

  function destroyVoice() {
    if (!voice) return;
    const active = voice;
    voice = null;
    active.cancelled = true;
    if (active.timer) window.clearTimeout(active.timer);
    if (active.request) active.request.abort();
    try { active.processor.disconnect(); } catch {}
    try { active.source.disconnect(); } catch {}
    try { active.silent.disconnect(); } catch {}
    for (const track of active.stream.getTracks()) track.stop();
    void active.context.close().catch(() => {});
  }

  function linearResample(chunks, inputRate) {
    const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
    const input = new Float32Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      input.set(chunk, offset);
      offset += chunk.length;
    }
    const expected = Math.min(TARGET_RATE * MAX_SECONDS, Math.floor(input.length * TARGET_RATE / inputRate));
    const output = new Int16Array(expected);
    const step = inputRate / TARGET_RATE;
    for (let index = 0; index < output.length; index += 1) {
      const position = index * step;
      const before = Math.floor(position);
      const after = Math.min(before + 1, input.length - 1);
      const fraction = position - before;
      const sample = (input[before] || 0) + ((input[after] || 0) - (input[before] || 0)) * fraction;
      output[index] = Math.max(-1, Math.min(1, sample)) * 0x7fff;
    }
    return output;
  }

  function wavBase64(samples) {
    const bytes = new Uint8Array(44 + samples.length * 2);
    const view = new DataView(bytes.buffer);
    const ascii = (offset, text) => [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
    ascii(0, "RIFF"); view.setUint32(4, 36 + samples.length * 2, true); ascii(8, "WAVE");
    ascii(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, TARGET_RATE, true); view.setUint32(28, TARGET_RATE * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); ascii(36, "data"); view.setUint32(40, samples.length * 2, true);
    for (let index = 0; index < samples.length; index += 1) view.setInt16(44 + index * 2, samples[index], true);
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    return btoa(binary);
  }

  async function startVoice() {
    if (voice) throw new Error("Er loopt al een opname.");
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      throw new Error("Microfoonopname vereist een beveiligde browserverbinding.");
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
    } catch {
      throw new Error("BelgoBase heeft geen toegang tot je microfoon. Sta de microfoon toe en probeer opnieuw.");
    }
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) {
      for (const track of stream.getTracks()) track.stop();
      throw new Error("Deze browser ondersteunt geen microfoonopname.");
    }
    const context = new Audio();
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(4096, 1, 1);
    const silent = context.createGain();
    silent.gain.value = 0;
    const started = performance.now();
    const active = { stream, context, source, processor, silent, chunks: [], started, level: 0, state: "recording", timer: 0, request: null, cancelled: false, result: null, error: "" };
    processor.onaudioprocess = (event) => {
      if (active.cancelled || active.state !== "recording") return;
      const channel = event.inputBuffer.getChannelData(0);
      const copy = new Float32Array(channel.length);
      copy.set(channel);
      active.chunks.push(copy);
      let sum = 0;
      for (const value of copy) sum += value * value;
      active.level = Math.min(1, Math.sqrt(sum / Math.max(1, copy.length)) * 4);
    };
    source.connect(processor);
    processor.connect(silent);
    silent.connect(context.destination);
    await context.resume();
    active.timer = window.setTimeout(() => { void finishVoice(active); }, MAX_SECONDS * 1000);
    voice = active;
    return { ok: true };
  }

  async function finishVoice(active) {
    if (!active || active.cancelled || active.state !== "recording") return active?.result || { ok: true, cancelled: true };
    active.state = "transcribing";
    if (active.timer) window.clearTimeout(active.timer);
    try { active.processor.disconnect(); } catch {}
    try { active.source.disconnect(); } catch {}
    try { active.silent.disconnect(); } catch {}
    for (const track of active.stream.getTracks()) track.stop();
    const samples = linearResample(active.chunks, active.context.sampleRate);
    await active.context.close().catch(() => {});
    if (samples.length < TARGET_RATE / 2) throw new Error("De opname is te kort. Je getypte tekst is behouden.");
    const controller = new AbortController();
    active.request = controller;
    const token = await ensureCsrf();
    const response = await fetch(`${API_ROOT}/voice`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", "X-BelgoBase-CSRF": token },
      body: JSON.stringify({ wav_base64: wavBase64(samples) }),
      signal: controller.signal,
    });
    const data = await json(response);
    if (active.cancelled) return { ok: true, cancelled: true };
    if (response.status === 401) {
      authExpired();
      throw new Error("Je sessie is verlopen. Meld je opnieuw aan.");
    }
    if (!response.ok || data.ok !== true) throw new Error(typeof data.error === "string" ? data.error : "De spraak kon niet worden verwerkt.");
    active.result = data;
    active.state = "complete";
    return data;
  }

  async function voiceStop() {
    if (!voice) throw new Error("Er loopt geen opname.");
    const active = voice;
    try {
      return await finishVoice(active);
    } finally {
      if (voice === active) voice = null;
    }
  }

  async function voiceStatus() {
    const active = voice;
    if (!active) return { ok: true, state: "idle", level: 0, elapsed: 0, max_seconds: MAX_SECONDS };
    const elapsed = Math.min(MAX_SECONDS, Math.max(0, (performance.now() - active.started) / 1000));
    if (active.state === "recording" && elapsed >= MAX_SECONDS) void finishVoice(active).catch((error) => { active.error = messageFor(error); active.state = "error"; });
    if (active.state === "complete") return active.result;
    if (active.state === "error") return { ok: true, state: "idle", error: active.error };
    return { ok: true, state: active.state, level: active.state === "recording" ? active.level : 0, elapsed, max_seconds: MAX_SECONDS };
  }

  async function voiceCancel() {
    destroyVoice();
    return { ok: true, cancelled: true };
  }

  async function logoutFromWorkspace() {
    const token = await ensureCsrf();
    const response = await fetch(`${API_ROOT}/auth/logout`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "X-BelgoBase-CSRF": token },
    });
    if (response.status === 401) authExpired();
    else notifyAuth("belgobase-web-logout");
    return { ok: true, deactivated: true };
  }

  const api = new Proxy({}, {
    get(_target, property) {
      if (typeof property !== "string") return undefined;
      if (property === "voice_start") return startVoice;
      if (property === "voice_stop") return voiceStop;
      if (property === "voice_status") return voiceStatus;
      if (property === "voice_cancel") return voiceCancel;
      if (property === "account_action") {
        return (payload) => payload?.action === "deactivate" ? logoutFromWorkspace() : bridge(property, payload);
      }
      return (payload) => bridge(property, payload);
    },
  });

  window.pywebview = { api };
  window.addEventListener("pagehide", destroyVoice, { once: true });
})();
