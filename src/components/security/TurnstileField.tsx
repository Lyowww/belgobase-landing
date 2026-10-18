"use client";

import { useEffect, useId, useRef } from "react";
import {
  TURNSTILE_ACTIONS,
  type TurnstileAction,
  turnstileSiteKey,
} from "@/lib/security/turnstile-config";

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      theme?: "auto" | "light" | "dark";
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_ID = "cf-turnstile-api";
const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("turnstile_script_failed")),
        { once: true },
      );
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("turnstile_script_failed")),
      { once: true },
    );
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export type TurnstileFieldProps = {
  action: TurnstileAction;
  /** Hidden input name for server actions / FormData. */
  name?: string;
  /** Imperative token for JSON API callers. */
  onTokenChange?: (token: string) => void;
  /** Increment to force a fresh challenge after a failed submit. */
  resetSignal?: number;
  className?: string;
  theme?: "auto" | "light" | "dark";
};

export function TurnstileField({
  action,
  name = "cf-turnstile-response",
  onTokenChange,
  resetSignal = 0,
  className,
  theme = "auto",
}: TurnstileFieldProps) {
  const siteKey = turnstileSiteKey();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const tokenInputId = useId();
  const tokenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let cancelled = false;

    const setToken = (token: string) => {
      if (tokenRef.current) tokenRef.current.value = token;
      onTokenChange?.(token);
    };

    const clearToken = () => {
      if (tokenRef.current) tokenRef.current.value = "";
      onTokenChange?.("");
    };

    void loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        if (widgetIdRef.current) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
        containerRef.current.replaceChildren();
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          theme,
          callback: setToken,
          "expired-callback": clearToken,
          "error-callback": clearToken,
        });
      })
      .catch(() => {
        clearToken();
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [action, onTokenChange, siteKey, theme]);

  useEffect(() => {
    if (!resetSignal || !widgetIdRef.current || !window.turnstile) return;
    window.turnstile.reset(widgetIdRef.current);
    if (tokenRef.current) tokenRef.current.value = "";
    onTokenChange?.("");
  }, [onTokenChange, resetSignal]);

  if (!siteKey) return null;

  return (
    <div className={className}>
      <input
        id={tokenInputId}
        ref={tokenRef}
        type="hidden"
        name={name}
        defaultValue=""
        autoComplete="off"
      />
      <div ref={containerRef} className="cf-turnstile" />
    </div>
  );
}

export { TURNSTILE_ACTIONS };
