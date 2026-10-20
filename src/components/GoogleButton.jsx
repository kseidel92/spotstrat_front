import { useEffect, useRef } from 'react';

/** Public OAuth client. The API audience at /v1/config wins when it answers. */
export const GOOGLE_CLIENT_FALLBACK = '98371392821-ca4oqqttpoje9uc952it3arfd47f2a2s.apps.googleusercontent.com';

export function resolveGoogleClientId(fromApi) {
  const apiId = String(fromApi || '').trim();
  if (apiId) return apiId;
  const envId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  return envId || GOOGLE_CLIENT_FALLBACK;
}

let gsiPromise;
let readyClientId = '';
let credentialHandler = () => {};
let failHandler = () => {};

function loadGsi() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gsiPromise) {
    gsiPromise = new Promise((resolve, reject) => {
      const prior = document.querySelector('script[data-gsi="1"]');
      const script = prior || document.createElement('script');
      const done = () => {
        if (window.google?.accounts?.id) resolve();
        else reject(new Error('gsi'));
      };
      script.dataset.gsi = '1';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = done;
      script.onerror = () => {
        gsiPromise = null;
        reject(new Error('gsi'));
      };
      if (!prior) document.head.appendChild(script);
      else if (window.google?.accounts?.id) done();
    });
  }
  return gsiPromise;
}

export default function GoogleButton({ clientId, locale, onCredential, onFail }) {
  const hostRef = useRef(null);
  const onCredentialRef = useRef(onCredential);
  const onFailRef = useRef(onFail);
  onCredentialRef.current = onCredential;
  onFailRef.current = onFail;

  useEffect(() => {
    const id = String(clientId || '').trim();
    if (!id) return undefined;
    let cancel = false;
    loadGsi().then(() => {
      if (cancel || !hostRef.current) return;
      const gis = window.google.accounts.id;
      credentialHandler = (cred) => onCredentialRef.current(cred);
      failHandler = () => onFailRef.current();
      if (readyClientId !== id) {
        gis.initialize({
          client_id: id,
          callback: (resp) => {
            if (resp?.credential) credentialHandler(resp.credential);
            else failHandler();
          },
          itp_support: true,
        });
        readyClientId = id;
      }
      const host = hostRef.current;
      const width = Math.max(240, Math.min(360, Math.round(host.getBoundingClientRect().width) || 360));
      host.replaceChildren();
      gis.renderButton(host, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width,
        locale: locale || 'pt-BR',
      });
    }).catch(() => {
      if (!cancel) onFailRef.current();
    });
    return () => { cancel = true; };
  }, [clientId, locale]);

  return <div className="gsi" ref={hostRef} />;
}
