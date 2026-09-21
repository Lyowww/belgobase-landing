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
  let voiceGeneration = 0;
  let voiceStarting = 0;
  let workspaceRevision = null;
  let workspaceSaveQueue = Promise.resolve();
  const adapterMessages = Object.freeze({
    recordingActive: { nl: "Er loopt al een opname.", fr: "Un enregistrement est déjà en cours.", en: "A recording is already in progress." },
    secureAudio: { nl: "Microfoonopname vereist een beveiligde browserverbinding.", fr: "L’enregistrement nécessite une connexion sécurisée.", en: "Microphone recording requires a secure browser connection." },
    unsupportedAudio: { nl: "Deze browser ondersteunt geen microfoonopname.", fr: "Ce navigateur ne prend pas en charge l’enregistrement audio.", en: "This browser does not support microphone recording." },
    audioStartFailed: { nl: "De microfoon kon niet starten. Sluit een andere opname of een gesprek en probeer opnieuw.", fr: "Le microphone ne démarre pas. Fermez tout autre enregistrement ou appel et réessayez.", en: "The microphone could not start. Close any other recording or call and try again." },
    recordingShort: { nl: "De opname is te kort. Je getypte tekst is behouden.", fr: "L’enregistrement est trop court. Votre texte saisi est conservé.", en: "The recording is too short. Your typed text has been kept." },
    recordingAbsent: { nl: "Er loopt geen opname.", fr: "Aucun enregistrement en cours.", en: "No recording is in progress." },
    sessionExpired: { nl: "Je sessie is verlopen. Meld je opnieuw aan.", fr: "Votre session a expiré. Reconnectez-vous.", en: "Your session has expired. Sign in again." },
    unavailable: { nl: "BelgoBase is tijdelijk niet beschikbaar. Probeer het later opnieuw.", fr: "BelgoBase est temporairement indisponible. Réessayez plus tard.", en: "BelgoBase is temporarily unavailable. Try again later." },
    denied: { nl: "Deze actie is niet beschikbaar voor je account. Vernieuw de pagina of neem contact op met BelgoBase.", fr: "Cette action n’est pas disponible pour votre compte. Actualisez la page ou contactez BelgoBase.", en: "This action is not available for your account. Refresh the page or contact BelgoBase." },
    retry: { nl: "Deze actie kon niet worden afgerond. Probeer het opnieuw.", fr: "Cette action n’a pas pu être terminée. Réessayez.", en: "This action could not be completed. Try again." },
  });
  function adapterLanguage() {
    const value = document.documentElement?.lang?.toLowerCase();
    return ["nl", "fr", "en"].includes(value) ? value : "nl";
  }
  const adapterMessage = key => adapterMessages[key][adapterLanguage()];
  const protocolCode = value => typeof value === "string" && /^[a-z][a-z0-9_]*$/.test(value);
  function bridgeFailure(status, data) {
    if (status === 403) return adapterMessage("denied");
    if (status >= 500) return adapterMessage("unavailable");
    const message = typeof data?.error === "string" && !protocolCode(data.error) ? data.error : null;
    return message || adapterMessage("retry");
  }

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
      csrfLoad = (async () => {
        let response;
        try {
          response = await fetch(`${API_ROOT}/auth/session`, {
            cache: "no-store",
            credentials: "same-origin",
          });
        } catch {
          throw new Error(adapterMessage("unavailable"));
        }
        const data = await json(response);
        if (response.status === 401) {
          authExpired();
          throw new Error(adapterMessage("sessionExpired"));
        }
        if (!response.ok) throw new Error(bridgeFailure(response.status, data));
        if (data.authenticated !== true || typeof data.csrf !== "string") throw new Error(adapterMessage("unavailable"));
        csrf = data.csrf;
        return csrf;
      })().finally(() => {
        csrfLoad = null;
      });
    }
    return csrfLoad;
  }

  function assertDownloadUrl(value) {
    if (typeof value !== "string") return null;
    try {
      const url = new URL(value, window.location.origin);
      if (url.origin !== window.location.origin || !DOWNLOAD_PATH.test(url.pathname + url.search) || url.hash || url.username || url.password) return null;
      return url;
    } catch { return null; }
  }

  function triggerDownload(value, required = false) {
    if (value == null && !required) return;
    const url = assertDownloadUrl(value);
    if (!url) throw new Error(adapterMessage("retry"));
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
    let response;
    try {
      response = await fetch(`${API_ROOT}/bridge/${encodeURIComponent(method)}`, {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "X-BelgoBase-CSRF": token,
        },
        body: JSON.stringify(outgoing),
      });
    } catch {
      throw new Error(adapterMessage("unavailable"));
    }
    const data = await json(response);
    const localized = typeof window.BelgoBaseWebI18n?.enrich === "function" ? window.BelgoBaseWebI18n.enrich(method, data) : data;
    if (response.status === 401) {
      authExpired();
      throw new Error(adapterMessage("sessionExpired"));
    }
    if (!response.ok || localized.ok !== true) {
      throw new Error(bridgeFailure(response.status, localized));
    }
    triggerDownload(localized.download_url, ["export_results", "export_selection"].includes(method));
    if ((method === "bootstrap" || method === "workspace_save") && Number.isInteger(localized.workspace_revision)) workspaceRevision = localized.workspace_revision;
    if ((method === "set_language" || method === "bootstrap") && ["nl", "fr", "en"].includes(localized.language)) {
      window.parent.postMessage({ type: "belgobase-web-language", language: localized.language }, window.location.origin);
    }
    return localized;
  }

  function destroyVoice() {
    voiceGeneration++;
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
    try { void active.context?.close().catch(() => {}); } catch {}
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
    if (voice || (voiceStarting && voiceStarting === voiceGeneration)) throw new Error(adapterMessage("recordingActive"));
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      throw new Error(adapterMessage("secureAudio"));
    }
    const generation = ++voiceGeneration;
    voiceStarting = generation;
    try {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
    } catch (error) {
      if (generation !== voiceGeneration) return { ok: true, cancelled: true };
      const language = document.getElementById?.("language-switch")?.value || document.documentElement?.lang || "nl";
      const messages = {
        denied: {
          nl: "Microfoon geblokkeerd. Open het instellingenicoon naast het webadres en zet Microfoon op Toestaan. Controleer ook de microfoontoegang van je browser in de telefooninstellingen. Vernieuw daarna deze pagina en tik opnieuw op de microfoon.",
          fr: "Microphone bloqué. Ouvrez les paramètres à côté de l’adresse du site et autorisez le microphone. Vérifiez aussi l’accès au microphone du navigateur dans les paramètres du téléphone. Actualisez la page et réessayez.",
          en: "Microphone blocked. Open the settings icon beside the web address and allow Microphone. Also check your browser’s microphone access in your phone settings. Reload this page and tap the microphone again.",
        },
        missing: { nl: "Geen microfoon gevonden. Sluit een microfoon aan en probeer opnieuw.", fr: "Aucun microphone détecté. Branchez un microphone et réessayez.", en: "No microphone found. Connect a microphone and try again." },
        busy: { nl: "De microfoon kon niet starten. Sluit een andere opname of een gesprek en probeer opnieuw.", fr: "Le microphone ne démarre pas. Fermez tout autre enregistrement ou appel et réessayez.", en: "The microphone could not start. Close any other recording or call and try again." },
      };
      const reason = ["NotAllowedError", "SecurityError"].includes(error?.name) ? "denied" : error?.name === "NotFoundError" ? "missing" : "busy";
      throw new Error(messages[reason][language] || messages[reason].nl);
    }
    if (generation !== voiceGeneration) {
      for (const track of stream.getTracks()) track.stop();
      return { ok: true, cancelled: true };
    }
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) {
      for (const track of stream.getTracks()) track.stop();
      throw new Error(adapterMessage("unsupportedAudio"));
    }
    const active = { stream, context: null, source: null, processor: null, silent: null, chunks: [], started: performance.now(), level: 0, state: "starting", timer: 0, request: null, cancelled: false, result: null, error: "" };
    voice = active;
    try {
    const context = active.context = new Audio();
    const source = active.source = context.createMediaStreamSource(stream);
    const processor = active.processor = context.createScriptProcessor(4096, 1, 1);
    const silent = active.silent = context.createGain();
    silent.gain.value = 0;
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
    if (generation !== voiceGeneration || active.cancelled) return { ok: true, cancelled: true };
    active.started = performance.now();
    active.state = "recording";
    active.timer = window.setTimeout(() => { void finishVoice(active).catch((error) => { active.error = messageFor(error); active.state = "error"; }); }, MAX_SECONDS * 1000);
    return { ok: true };
    } catch {
      if (voice === active) destroyVoice();
      throw new Error(adapterMessage("audioStartFailed"));
    }
    } finally {
      if (voiceStarting === generation) voiceStarting = 0;
    }
  }

  function finishVoice(active) {
    if (!active) return Promise.resolve({ ok: true, cancelled: true });
    if (!active.completion) active.completion = transcribeVoice(active);
    return active.completion;
  }

  async function transcribeVoice(active) {
    if (!active || active.cancelled || active.state !== "recording") return active?.result || { ok: true, cancelled: true };
    active.state = "transcribing";
    if (active.timer) window.clearTimeout(active.timer);
    try { active.processor.disconnect(); } catch {}
    try { active.source.disconnect(); } catch {}
    try { active.silent.disconnect(); } catch {}
    for (const track of active.stream.getTracks()) track.stop();
    const samples = linearResample(active.chunks, active.context.sampleRate);
    await active.context.close().catch(() => {});
    if (samples.length < TARGET_RATE / 2) throw new Error(adapterMessage("recordingShort"));
    const controller = new AbortController();
    active.request = controller;
    const token = await ensureCsrf();
    if (active.cancelled) return { ok: true, cancelled: true };
    const response = await fetch(`${API_ROOT}/voice`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", "X-BelgoBase-CSRF": token },
      body: JSON.stringify({ request_id: window.crypto.randomUUID(), audio_wav: wavBase64(samples) }),
      signal: controller.signal,
    });
    const data = await json(response);
    if (active.cancelled) return { ok: true, cancelled: true };
    if (response.status === 401) {
      authExpired();
      throw new Error(adapterMessage("sessionExpired"));
    }
    if (!response.ok || data.ok !== true) {
      const language = document.getElementById?.("language-switch")?.value || document.documentElement?.lang || "nl";
      const errors = {
        insufficient_balance: { nl: "Onvoldoende AI-tegoed voor deze opname. Laat je AI-tegoed aanvullen en probeer opnieuw. Je kunt je zoekvraag ook typen.", fr: "Votre solde IA est insuffisant pour cet enregistrement. Faites recharger votre solde et réessayez. Vous pouvez aussi saisir votre recherche.", en: "There is not enough AI balance for this recording. Have your balance topped up and try again. You can also type your search." },
        voice_invalid_audio: { nl: "De opname kon niet worden gelezen. Neem opnieuw op, maximaal 60 seconden.", fr: "L’enregistrement est illisible. Réessayez pendant 60 secondes maximum.", en: "The recording could not be read. Record again for up to 60 seconds." },
        no_speech: { nl: "Geen spraak herkend. Spreek duidelijk en probeer opnieuw.", fr: "Aucune parole reconnue. Parlez clairement et réessayez.", en: "No speech recognised. Speak clearly and try again." },
        voice_timeout: { nl: "Het omzetten duurde te lang. Probeer opnieuw; je tekst is behouden.", fr: "La transcription a pris trop de temps. Réessayez ; votre texte est conservé.", en: "Transcription took too long. Try again; your text has been kept." },
      };
      const fallback = { nl: "De spraak kon niet worden verwerkt. Probeer opnieuw; je tekst is behouden.", fr: "La transcription a échoué. Réessayez ; votre texte est conservé.", en: "Speech could not be processed. Try again; your text has been kept." };
      const message = errors[data.error] || fallback;
      throw new Error(message[language] || message.nl);
    }
    if (typeof data.text !== "string") throw new Error(adapterMessage("retry"));
    active.result = data;
    active.state = "complete";
    return data;
  }

  async function voiceStop() {
    if (!voice) throw new Error(adapterMessage("recordingAbsent"));
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
    if (active.state === "complete") { voice = null; return active.result; }
    if (active.state === "error") { voice = null; return { ok: true, state: "idle", error: active.error }; }
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
      headers: { "content-type": "application/json", "X-BelgoBase-CSRF": token },
      body: JSON.stringify({}),
    });
    if (response.status === 401) authExpired();
    else {
      const data = await json(response);
      if (!response.ok || data.ok !== true) throw new Error("Afmelden is niet gelukt. Probeer opnieuw.");
      destroyVoice();
      csrf = "";
      notifyAuth("belgobase-web-logout");
    }
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

  window.addEventListener("message", event => {
    if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.type !== "belgobase-web-language" || !["nl", "fr", "en"].includes(event.data.language)) return;
    const select = document.getElementById("language-switch");
    if (select && select.value !== event.data.language) {
      select.value = event.data.language;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  window.pywebview = { api };
  window.addEventListener("pagehide", destroyVoice);
})();
