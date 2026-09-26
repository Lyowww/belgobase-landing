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
  const AI_CONTRACT = "belgobase-premium-v1";
  const AI_SELECTION_CONTRACT = "belgobase-selection-v2";
  const JOURNEY_CHUNK_SIZE = 30000;
  const JOURNEY_MIN_REQUEST_INTERVAL = 800;
  const JOURNEY_MAX_UPLOAD = 4 * 1024 * 1024;
  const ENTERPRISE_EXCLUSION_FIELD = "ondernemingsnummers_exclude";
  const JOURNEY_EXPORT_COLUMNS = [
    "ondernemingsnummer", "naam", "straat_nl", "straat_fr", "huisnummer",
    "bus", "kbo_postcode", "gemeente_nl", "gemeente_fr", "land",
    "nace_code", "nace_version", "personeel_vte", "personeel_status",
    "omzet", "omzet_status", "winst_verlies", "winst_verlies_status",
    "boekjaar_einddatum", "jaar",
  ];
  const AI_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  let csrf = "";
  let csrfLoad = null;
  let voice = null;
  let voiceGeneration = 0;
  let voiceStarting = 0;
  let workspaceRevision = null;
  let workspaceSaveQueue = Promise.resolve();
  let aiSessionId = null;
  let aiControlFilters = {};
  let aiGeneration = 0;
  let aiPending = null;
  let journeyQueue = Promise.resolve();
  let journeyLastStarted = 0;
  let journeyClosed = false;
  const adapterMessages = Object.freeze({
    journeyInvalid: { nl: "Controleer je bestand of klantreisaanvraag. Gebruik een gewone Excel- of CSV-lijst en controleer de kolomkoppeling. Je bestaande lijst blijft behouden.", fr: "Vérifiez votre fichier ou votre demande. Utilisez un fichier Excel ou CSV standard et vérifiez les colonnes associées. Votre liste existante est conservée.", en: "Check your file or customer journey request. Use a standard Excel or CSV file and check the column mapping. Your existing list is preserved." },
    journeyAdviceInvalid: { nl: "Het advies kon niet betrouwbaar worden verwerkt. Je lijst en selectie blijven behouden.", fr: "Le conseil n’a pas pu être traité de manière fiable. Votre liste et votre sélection sont conservées.", en: "The advice could not be processed reliably. Your list and selection are preserved." },
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
    aiInsufficient: { nl: "Je AI-tegoed is onvoldoende voor deze opdracht. Neem contact op met BelgoBase om bij te laden.", fr: "Votre solde IA est insuffisant pour cette demande. Contactez BelgoBase pour le recharger.", en: "Your AI balance is insufficient for this request. Contact BelgoBase to top it up." },
    aiWalletUnavailable: { nl: "Je AI-tegoed kan niet worden gecontroleerd. Er is geen nieuwe betaalde aanvraag gestart.", fr: "Votre solde IA ne peut pas être vérifié. Aucune nouvelle demande payante n’a été lancée.", en: "Your AI balance could not be checked. No new paid request was started." },
    aiSessionExpired: { nl: "Dit zoekgesprek is verlopen. Start een nieuw gesprek; je huidige filters blijven behouden.", fr: "Cette conversation de recherche a expiré. Démarrez une nouvelle conversation ; vos filtres actuels sont conservés.", en: "This search conversation has expired. Start a new conversation; your current filters are preserved." },
    aiSessionBusy: { nl: "Dit zoekgesprek verwerkt nog een vraag. Wacht op het antwoord; je huidige filters blijven behouden.", fr: "Cette conversation traite encore une demande. Attendez la réponse ; vos filtres actuels sont conservés.", en: "This search conversation is still processing a request. Wait for the answer; your current filters are preserved." },
    aiDuplicate: { nl: "Deze vraag is al ontvangen. Ze wordt niet opnieuw verstuurd; je huidige filters blijven behouden.", fr: "Cette demande a déjà été reçue. Elle n’est pas renvoyée ; vos filtres actuels sont conservés.", en: "This request was already received. It will not be sent again; your current filters are preserved." },
    aiBusy: { nl: "Slim Zoeken is momenteel druk bezet. Wacht even; je huidige filters blijven behouden.", fr: "La recherche intelligente est actuellement occupée. Patientez ; vos filtres actuels sont conservés.", en: "Smart Search is currently busy. Wait a moment; your current filters are preserved." },
    aiSessionLimit: { nl: "Er staan al zoekgesprekken open. Ga verder in een bestaand gesprek; je filters blijven behouden.", fr: "Des conversations de recherche sont déjà ouvertes. Continuez dans une conversation existante ; vos filtres sont conservés.", en: "Search conversations are already open. Continue in an existing conversation; your filters are preserved." },
    aiAccessDenied: { nl: "Slim Zoeken kon je toegang niet bevestigen. Meld je opnieuw aan; je filters blijven behouden.", fr: "La recherche intelligente n’a pas pu confirmer votre accès. Reconnectez-vous ; vos filtres sont conservés.", en: "Smart Search could not confirm your access. Sign in again; your filters are preserved." },
    aiInvalidRequest: { nl: "Slim Zoeken kon deze vraag niet verwerken. Controleer je invoer; je filters blijven behouden.", fr: "La recherche intelligente n’a pas pu traiter cette demande. Vérifiez votre saisie ; vos filtres sont conservés.", en: "Smart Search could not process this request. Check your input; your filters are preserved." },
    aiTimeout: { nl: "Slim Zoeken antwoordde niet op tijd. Verstuur de vraag niet automatisch opnieuw; je filters blijven behouden.", fr: "La recherche intelligente n’a pas répondu à temps. Ne renvoyez pas automatiquement la demande ; vos filtres sont conservés.", en: "Smart Search did not respond in time. Do not resend the request automatically; your filters are preserved." },
    aiInvalidResponse: { nl: "Slim Zoeken gaf geen geldig antwoord. Je filters blijven behouden.", fr: "La recherche intelligente a renvoyé une réponse non valide. Vos filtres sont conservés.", en: "Smart Search returned an invalid response. Your filters are preserved." },
    aiClosed: { nl: "Dit zoekgesprek is gesloten. Start een nieuw gesprek; je huidige filters blijven behouden.", fr: "Cette conversation de recherche est fermée. Démarrez une nouvelle conversation ; vos filtres actuels sont conservés.", en: "This search conversation is closed. Start a new conversation; your current filters are preserved." },
    aiInvalidProposal: { nl: "Er kon geen bruikbaar zoekvoorstel worden gemaakt. Je filters zijn behouden. Probeer je vraag te verduidelijken.", fr: "Aucune proposition de recherche exploitable n’a pu être produite. Vos filtres sont conservés. Essayez de préciser votre demande.", en: "No usable search proposal could be produced. Your filters are preserved. Try clarifying your request." },
    aiTransport: { nl: "De verbinding met Slim Zoeken is mislukt. De vraag wordt niet automatisch opnieuw verstuurd; je filters blijven behouden.", fr: "La connexion à la recherche intelligente a échoué. La demande n’est pas renvoyée automatiquement ; vos filtres sont conservés.", en: "The connection to Smart Search failed. The request is not resent automatically; your filters are preserved." },
    aiUnavailable: { nl: "Slim Zoeken is tijdelijk niet beschikbaar. Je huidige filters blijven behouden.", fr: "La recherche intelligente est temporairement indisponible. Vos filtres actuels sont conservés.", en: "Smart Search is temporarily unavailable. Your current filters are preserved." },
  });
  function adapterLanguage() {
    const value = (document.getElementById?.("language-switch")?.value || document.documentElement?.lang)?.toLowerCase();
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

  const AI_ERROR_MESSAGES = Object.freeze({
    journey_invalid_request: "journeyInvalid", journey_advice_invalid: "journeyAdviceInvalid",
    insufficient_balance: "aiInsufficient", wallet_insufficient: "aiInsufficient", budget_exhausted: "aiInsufficient",
    wallet_unavailable: "aiWalletUnavailable", ai_session_expired: "aiSessionExpired", ai_session_closed: "aiClosed",
    ai_session_busy: "aiSessionBusy", duplicate_request: "aiDuplicate", ai_busy: "aiBusy",
    concurrency_limit_exceeded: "aiBusy", ai_session_limit: "aiSessionLimit", ai_access_denied: "aiAccessDenied",
    invalid_ai_request: "aiInvalidRequest", ai_timeout: "aiTimeout", ai_invalid_response: "aiInvalidResponse", ai_invalid_proposal: "aiInvalidProposal",
    transport_error: "aiTransport",
  });
  function aiError(code = "ai_unavailable", status) {
    const fallback = status === 408 || status === 504 ? "aiTimeout" : status === 401 || status === 403 ? "aiAccessDenied" : "aiUnavailable";
    const error = new Error(adapterMessage(AI_ERROR_MESSAGES[code] || fallback));
    error.code = code;
    error.status = status;
    return error;
  }
  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
  function normalizeRegions(value) {
    if (value == null || value === "") return [];
    if (!Array.isArray(value)) throw aiError("invalid_ai_request", 400);
    const result = [], allowed = new Set(["vlaanderen", "wallonie", "brussel"]);
    for (const item of value) {
      if (!allowed.has(item) || result.includes(item)) throw aiError("invalid_ai_request", 400);
      result.push(item);
    }
    return result;
  }
  function normalizePreferences(value) {
    if (value == null) return [];
    if (!Array.isArray(value) || value.length > 3) throw aiError("invalid_ai_request", 400);
    const fields = new Set(), priorities = new Set(), result = [];
    for (const item of value) {
      const keys = object(item) ? Object.keys(item).sort() : [];
      if (keys.join(",") !== "direction,evidence,field,priority" || !["omzet", "winst", "personeel_vte"].includes(item.field)
          || !["high", "low"].includes(item.direction) || !Number.isInteger(item.priority) || item.priority < 1 || item.priority > 3
          || typeof item.evidence !== "string" || !item.evidence.trim() || item.evidence.length > 250
          || fields.has(item.field) || priorities.has(item.priority)) throw aiError("invalid_ai_request", 400);
      fields.add(item.field); priorities.add(item.priority);
      result.push({ field: item.field, direction: item.direction, priority: item.priority, evidence: item.evidence.trim() });
    }
    result.sort((left, right) => left.priority - right.priority);
    if (result.some((item, index) => item.priority !== index + 1)) throw aiError("invalid_ai_request", 400);
    return result;
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
    aiGeneration++;
    aiSessionId = null;
    aiControlFilters = {};
    aiPending = null;
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

  function canonicalAiRequest(request) {
    if (!object(request)) throw aiError("invalid_ai_request", 400);
    const common = {
      contract: AI_CONTRACT,
      request_id: window.crypto.randomUUID(),
      assistant: true,
      language: adapterLanguage(),
    };
    if (request.selected_company_choice !== undefined && request.selected_company_choice !== null) {
      if (!aiSessionId || typeof request.selected_company_choice !== "string" || !request.selected_company_choice) throw aiError("ai_session_expired", 409);
      return { ...common, action: "choose", choice_id: request.selected_company_choice, session_id: aiSessionId };
    }
    if (request.selected_codes !== undefined && request.selected_codes !== null) {
      if (!aiSessionId) throw aiError("ai_session_expired", 409);
      if (!Array.isArray(request.selected_codes) || request.selected_codes.some(code => typeof code !== "string" || !code)) throw aiError("invalid_ai_request", 400);
      return { ...common, action: "select", codes: clone(request.selected_codes), session_id: aiSessionId };
    }
    if (typeof request.text !== "string" || !object(request.filters ?? {})) throw aiError("invalid_ai_request", 400);
    const currentFilters = clone(request.filters ?? {});
    if (Object.hasOwn(currentFilters, ENTERPRISE_EXCLUSION_FIELD)) {
      const exclusions = currentFilters[ENTERPRISE_EXCLUSION_FIELD];
      if (!Array.isArray(exclusions) || exclusions.length > 10000
          || exclusions.some(value => typeof value !== "string" || !/^[0-9]{10}$/.test(value))) {
        throw aiError("invalid_ai_request", 400);
      }
      currentFilters[ENTERPRISE_EXCLUSION_FIELD] = [...new Set(exclusions)];
      if (!currentFilters[ENTERPRISE_EXCLUSION_FIELD].length) delete currentFilters[ENTERPRISE_EXCLUSION_FIELD];
    }
    const currentRegions = normalizeRegions(currentFilters.regions);
    const currentPreferences = normalizePreferences(currentFilters.preferences);
    delete currentFilters.regions;
    delete currentFilters.preferences;
    return {
      ...common,
      action: "ask",
      text: request.text.trim(),
      current_filters: currentFilters,
      current_regions: currentRegions,
      current_preferences: currentPreferences,
      ...(request.fresh_session === true || (Array.isArray(request.conversation) && request.conversation.length === 0) ? { reset: true } : {}),
      ...(aiSessionId ? { session_id: aiSessionId } : {}),
    };
  }

  function validateAiProposal(response, action, expectedSession) {
    if (!object(response)) throw aiError("ai_invalid_response", 502);
    const statusCode = Number.isInteger(response._http_status) ? response._http_status : Number.isInteger(response.http_status) ? response.http_status : undefined;
    if (response.ok === false || typeof response.error === "string" || (statusCode !== undefined && statusCode >= 400)) {
      throw aiError(typeof response.error === "string" ? response.error : "ai_unavailable", statusCode);
    }
    if (response.contract !== AI_CONTRACT || typeof response.session_id !== "string" || !AI_UUID.test(response.session_id)
        || !Number.isInteger(response.expires_in_seconds) || response.expires_in_seconds <= 0
        || (expectedSession && response.session_id !== expectedSession)) throw aiError("ai_invalid_response", 502);
    if (action === "reset") {
      if (response.status !== "reset") throw aiError("ai_invalid_response", 502);
      return { proposal: { status: "reset" }, sessionId: response.session_id };
    }
    const required = ["status", "filters", "summary", "question", "choices", "message", "answer_context", "activity_selection_complete"];
    if (!required.every(key => Object.hasOwn(response, key)) || !["ready", "clarify", "out_of_scope", "unsupported"].includes(response.status)
        || !object(response.filters) || !Array.isArray(response.summary) || typeof response.question !== "string"
        || !Array.isArray(response.choices) || typeof response.message !== "string" || !object(response.answer_context)
        || typeof response.activity_selection_complete !== "boolean") throw aiError("ai_invalid_response", 502);
    let regions, preferences;
    try {
      regions = normalizeRegions(response.regions ?? []);
      preferences = normalizePreferences(response.preferences ?? []);
    } catch {
      throw aiError("ai_invalid_response", 502);
    }
    if (JSON.stringify(regions) !== JSON.stringify(response.regions ?? []) || JSON.stringify(preferences) !== JSON.stringify(response.preferences ?? [])) throw aiError("ai_invalid_response", 502);
    const selectionContract = response.selection_contract ?? null;
    if ((regions.length || preferences.length) && selectionContract !== AI_SELECTION_CONTRACT) throw aiError("ai_invalid_response", 502);
    if (selectionContract !== null && selectionContract !== AI_SELECTION_CONTRACT) throw aiError("ai_invalid_response", 502);
    if (Object.hasOwn(response, "assistant_message") && (typeof response.assistant_message !== "string" || response.assistant_message.length > 12000)) throw aiError("ai_invalid_response", 502);
    if (Object.hasOwn(response, "reference_choices") && (!Array.isArray(response.reference_choices) || response.reference_choices.length > 20)) throw aiError("ai_invalid_response", 502);
    if (Object.hasOwn(response, "wallet") && !object(response.wallet)) throw aiError("ai_invalid_response", 502);
    const proposal = Object.fromEntries(required.map(key => [key, clone(response[key])]));
    proposal.regions = regions;
    proposal.preferences = preferences;
    proposal.selection_contract = selectionContract;
    for (const key of ["assistant_message", "export_proposal", "reference_choices", "action", "count", "wallet"]) {
      if (Object.hasOwn(response, key)) proposal[key] = clone(response[key]);
    }
    proposal.filters = { ...proposal.filters, regions: clone(regions), preferences: clone(preferences) };
    return { proposal, sessionId: response.session_id };
  }

  async function closeLateAiSession(response) {
    const sessionId = response?.proposal?.contract === AI_CONTRACT && AI_UUID.test(response.proposal.session_id || "") ? response.proposal.session_id : null;
    if (!sessionId) return;
    try {
      await sendBridge("ai", { contract: AI_CONTRACT, action: "close", request_id: window.crypto.randomUUID(), session_id: sessionId, assistant: true });
    } catch {}
  }

  function cancelAiState(operationId) {
    if (!aiPending || (operationId && aiPending.operationId && operationId !== aiPending.operationId)) return false;
    aiGeneration++;
    aiSessionId = null;
    aiControlFilters = {};
    aiPending = null;
    return true;
  }

  async function aiBridge(request) {
    if (aiPending) throw aiError("ai_session_busy", 409);
    if (request?.fresh_session === true) {
      aiGeneration++;
      aiSessionId = null;
      aiControlFilters = {};
    }
    const outgoing = canonicalAiRequest(request);
    const controls = outgoing.action === "ask"
      ? (Object.hasOwn(outgoing.current_filters || {}, ENTERPRISE_EXCLUSION_FIELD)
          ? { [ENTERPRISE_EXCLUSION_FIELD]: clone(outgoing.current_filters[ENTERPRISE_EXCLUSION_FIELD]) } : {})
      : clone(aiControlFilters);
    const expectedSession = aiSessionId;
    const pending = { generation: aiGeneration, operationId: typeof request.operation_id === "string" ? request.operation_id : null };
    aiPending = pending;
    try {
      const wrapped = await sendBridge("ai", outgoing);
      if (pending.generation !== aiGeneration || aiPending !== pending) {
        await closeLateAiSession(wrapped);
        throw aiError("ai_session_closed", 409);
      }
      const validated = validateAiProposal(wrapped.proposal, outgoing.action, expectedSession);
      delete validated.proposal.filters[ENTERPRISE_EXCLUSION_FIELD];
      Object.assign(validated.proposal.filters, clone(controls));
      aiControlFilters = clone(controls);
      aiSessionId = validated.sessionId;
      const result = { ...wrapped, proposal: validated.proposal };
      if (object(validated.proposal.wallet)) result.wallet = clone(validated.proposal.wallet);
      return result;
    } catch (error) {
      if (error?.code === "ai_session_expired" && pending.generation === aiGeneration) aiSessionId = null;
      throw error;
    } finally {
      if (aiPending === pending) aiPending = null;
    }
  }

  function journeyBridge(command) {
    if (!object(command) || typeof command.command !== "string") throw aiError("invalid_ai_request", 400);
    const snapshot = clone(command);
    const start = journeyQueue.then(async () => {
      const wait = Math.max(0, JOURNEY_MIN_REQUEST_INTERVAL - (performance.now() - journeyLastStarted));
      if (wait) await new Promise(resolve => window.setTimeout(resolve, wait));
      if (journeyClosed) throw aiError("ai_session_closed", 409);
      journeyLastStarted = performance.now();
    });
    journeyQueue = start.catch(() => {});
    return start.then(async () => {
      const wrapped = await sendBridge("ai", {
        contract: AI_CONTRACT,
        action: "journey",
        request_id: window.crypto.randomUUID(),
        language: adapterLanguage(),
        journey: snapshot,
      });
      const envelope = object(wrapped) ? wrapped.proposal : null;
      if (!object(envelope) || envelope.status !== "journey" || envelope.contract !== AI_CONTRACT || !object(envelope.journey)) {
        throw aiError("ai_invalid_response", 502);
      }
      const result = { ok: true, ...clone(envelope.journey) };
      if (object(envelope.wallet)) result.wallet = clone(envelope.wallet);
      return result;
    });
  }

  function bytesBase64(bytes) {
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
  }

  async function journeyPrepareSelection(request) {
    if (!object(request)) throw new Error(adapterMessage("retry"));
    const hasNumbers = Array.isArray(request.numbers);
    const numbers = hasNumbers ? request.numbers : [];
    const expectedCount = request.expected_count;
    if (!Number.isInteger(expectedCount) || expectedCount < 1 || expectedCount > 5000) {
      throw new Error("Kies één tot maximaal 5.000 bedrijven om te verrijken.");
    }
    if (hasNumbers && numbers.length !== expectedCount) {
      throw new Error("De aangevinkte selectie is gewijzigd. Kies de bedrijven opnieuw.");
    }
    const payload = hasNumbers
      ? { numbers: clone(numbers), columns: [...JOURNEY_EXPORT_COLUMNS] }
      : {
          filters: { ...clone(request.filters || {}), max_rows: expectedCount },
          query: typeof request.query === "string" ? request.query : "",
          columns: [...JOURNEY_EXPORT_COLUMNS],
        };
    const method = hasNumbers ? "export_selection" : "export_results";
    const exported = await sendBridge(method, payload, { skipAutodownload: true });
    if (exported.total !== expectedCount || exported.rows !== expectedCount) {
      throw new Error("De selectie of je exportlimiet is gewijzigd. Vernieuw de resultaten; BelgoBase kapt de lijst niet stil af.");
    }
    const url = assertDownloadUrl(exported.download_url);
    if (!url) throw new Error(adapterMessage("retry"));
    const response = await fetch(url.href, { cache: "no-store", credentials: "same-origin" });
    if (response.status === 401) {
      authExpired();
      throw new Error(adapterMessage("sessionExpired"));
    }
    if (!response.ok) throw new Error(adapterMessage("retry"));
    const raw = new Uint8Array(await response.arrayBuffer());
    if (!raw.length || raw.length > JOURNEY_MAX_UPLOAD) {
      throw new Error("Deze selectie is te groot voor de tijdelijke klantenlijst. Verklein ze tot maximaal 4 MB.");
    }
    const upload = await journeyBridge({ command: "upload_begin", filename: "BelgoBase_selectie.xlsx", size: raw.length, purpose: "prospects" });
    if (typeof upload.upload_id !== "string") throw new Error(adapterMessage("retry"));
    let offset = 0;
    while (offset < raw.length) {
      const chunk = raw.subarray(offset, Math.min(raw.length, offset + JOURNEY_CHUNK_SIZE));
      const sent = await journeyBridge({ command: "upload_chunk", upload_id: upload.upload_id, offset, data: bytesBase64(chunk) });
      if (!Number.isInteger(sent.offset) || sent.offset !== offset + chunk.length) throw new Error(adapterMessage("retry"));
      offset = sent.offset;
    }
    return journeyBridge({ command: "upload_finish", upload_id: upload.upload_id });
  }

  async function journeyDownloadExport(request) {
    if (!object(request) || typeof request.export_id !== "string" || !Number.isInteger(request.size)
        || request.size < 1 || request.size > 16 * 1024 * 1024) throw new Error(adapterMessage("retry"));
    const chunks = [];
    let offset = 0;
    while (offset < request.size) {
      const reply = await journeyBridge({ command: "export_chunk", export_id: request.export_id, offset });
      if (typeof reply.data !== "string" || !Number.isInteger(reply.offset) || reply.offset <= offset || reply.offset > request.size) {
        throw new Error(adapterMessage("retry"));
      }
      const binary = atob(reply.data);
      const chunk = Uint8Array.from(binary, char => char.charCodeAt(0));
      if (!chunk.length || chunk.length > JOURNEY_CHUNK_SIZE || reply.offset !== offset + chunk.length) throw new Error(adapterMessage("retry"));
      chunks.push(chunk);
      offset = reply.offset;
    }
    const blob = new Blob(chunks, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const filename = typeof request.filename === "string" && request.filename.toLowerCase().endsWith(".xlsx")
      ? request.filename : "BelgoBase_contacten.xlsx";
    link.download = filename;
    link.style.display = "none";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    // An anchor click cannot tell whether the browser saved or cancelled the
    // download. Let the customer acknowledge receipt before marking rows used.
    return { ok: true, filename, rows: request.rows, export_id: request.export_id,
      delivery_pending: true, message: `${filename}: download gestart.` };
  }

  function bridge(method, payload) {
    if (method === "ai") return aiBridge(payload);
    if (method === "journey") return journeyBridge(payload);
    if (method === "journey_prepare_selection") return journeyPrepareSelection(payload);
    if (method === "journey_save_export") return journeyDownloadExport(payload);
    if (method === "cancel_operation") {
      cancelAiState(payload?.operation_id);
      return sendBridge(method, payload);
    }
    if (method !== "workspace_save") return sendBridge(method, payload);
    // Keep rapid edits from this browser in order. Other browsers still use
    // the server revision check, so a stale window cannot overwrite their work.
    const snapshot = JSON.parse(JSON.stringify(payload ?? {}));
    const pending = workspaceSaveQueue.then(() => sendBridge(method, snapshot));
    workspaceSaveQueue = pending.catch(() => {});
    return pending;
  }

  async function sendBridge(method, payload, { skipAutodownload = false } = {}) {
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
      if (method === "ai") throw aiError("transport_error");
      throw new Error(adapterMessage("unavailable"));
    }
    const data = await json(response);
    const localized = typeof window.BelgoBaseWebI18n?.enrich === "function" ? window.BelgoBaseWebI18n.enrich(method, data) : data;
    if (response.status === 401) {
      authExpired();
      throw new Error(adapterMessage("sessionExpired"));
    }
    if (!response.ok || localized.ok !== true) {
      if (method === "ai") throw aiError(typeof localized.error === "string" ? localized.error : "ai_unavailable", response.status);
      throw new Error(bridgeFailure(response.status, localized));
    }
    if (!skipAutodownload) triggerDownload(localized.download_url, ["export_results", "export_selection"].includes(method));
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
    aiGeneration++;
    aiSessionId = null;
    aiControlFilters = {};
    aiPending = null;
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
  window.addEventListener("pagehide", () => {
    aiGeneration++;
    aiSessionId = null;
    aiControlFilters = {};
    aiPending = null;
    journeyClosed = true;
    destroyVoice();
  });
})();
