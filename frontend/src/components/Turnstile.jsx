import { useEffect, useRef } from "react";

const scriptUrl = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loader;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = scriptUrl;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.turnstile);
      script.onerror = () => reject(new Error("Turnstile gagal dimuat."));
      document.head.appendChild(script);
    });
  }
  return loader;
}

export function Turnstile({ onVerify }) {
  const element = useRef(null);
  const widgetId = useRef(null);
  const siteKey = (process.env.REACT_APP_TURNSTILE_SITE_KEY || "").trim();

  useEffect(() => {
    if (!siteKey || !element.current) return undefined;
    let active = true;
    loadTurnstile().then((turnstile) => {
      if (!active || !turnstile || widgetId.current !== null) return;
      widgetId.current = turnstile.render(element.current, {
        sitekey: siteKey,
        callback: onVerify,
        "expired-callback": () => onVerify(""),
        "error-callback": () => onVerify(""),
      });
    }).catch(() => onVerify(""));
    return () => {
      active = false;
      if (window.turnstile && widgetId.current !== null) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey, onVerify]);

  if (!siteKey) return null;
  return <div className="turnstile-wrap" ref={element} aria-label="Verifikasi keamanan" />;
}

export const turnstileEnabled = () => Boolean((process.env.REACT_APP_TURNSTILE_SITE_KEY || "").trim());
