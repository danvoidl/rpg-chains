'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { config } from '@/lib/config';

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptLoading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  scriptLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile missing'));
    script.onerror = () => {
      scriptLoading = null;
      reject(new Error('Turnstile failed to load'));
    };
    document.head.appendChild(script);
  });
  return scriptLoading;
}

export interface Captcha {
  /** The challenge to render inside the form (nothing when the captcha is off). */
  widget: ReactNode;
  /** True once there is a token to send, or always when the captcha is off. */
  ready: boolean;
  /** Headers for the Better Auth call the challenge guards. */
  headers: Record<string, string>;
  /** A token is single-use: call after every attempt so the next one gets a fresh one. */
  reset: () => void;
}

/**
 * Cloudflare Turnstile for the sign-up, sign-in and password-reset forms (the server's
 * `captcha` plugin checks the `x-captcha-response` header). Usually invisible; it shows a
 * checkbox only when Cloudflare is unsure. Off when `NEXT_PUBLIC_TURNSTILE_SITE_KEY=off`.
 */
export function useCaptcha(): Captcha {
  const siteKey = config.turnstileSiteKey;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    void loadTurnstile().then((turnstile) => {
      if (cancelled || !containerRef.current) return;
      widgetIdRef.current = turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: setToken,
        'expired-callback': () => setToken(null),
        'error-callback': () => setToken(null),
      });
    });
    return () => {
      cancelled = true;
      if (widgetIdRef.current) window.turnstile?.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [siteKey]);

  const reset = useCallback(() => {
    setToken(null);
    if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current);
  }, []);

  return {
    widget: siteKey ? <div ref={containerRef} /> : null,
    ready: !siteKey || token !== null,
    headers: token ? { 'x-captcha-response': token } : {},
    reset,
  };
}
