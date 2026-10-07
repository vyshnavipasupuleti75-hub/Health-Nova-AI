import { useEffect, useRef } from 'react';

const SCRIPT_ID = 'google-identity-services';

// Google Identity Services must be initialised once per page load (it warns when initialize() is called again).
// The single callback forwards the credential to whichever sign-in button is currently mounted.
let initializedClientId = null;
let activeHandler = null;
function ensureInitialized(clientId) {
  if (initializedClientId === clientId) return;
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => activeHandler?.(response),
    ux_mode: 'popup',
    auto_select: false,
    cancel_on_tap_outside: true,
  });
  initializedClientId = clientId;
}

export default function GoogleSignIn({ onCredential, onError }) {
  const buttonRef = useRef(null);
  const callbacks = useRef({ onCredential, onError });
  callbacks.current = { onCredential, onError };

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      if (import.meta.env.DEV) console.warn('Google sign-in: VITE_GOOGLE_CLIENT_ID is missing from frontend/.env');
      callbacks.current.onError('Google sign-in is not available right now. Please use your email and password.');
      return undefined;
    }

    let active = true;
    const handler = ({ credential }) => (credential ? callbacks.current.onCredential(credential) : callbacks.current.onError('Google did not return a sign-in credential.'));
    activeHandler = handler;
    const renderButton = () => {
      if (!active || !buttonRef.current || !window.google?.accounts?.id) return;
      ensureInitialized(clientId);
      buttonRef.current.replaceChildren();
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', width: Math.min(buttonRef.current.clientWidth || 400, 400),
      });
    };

    const existing = document.getElementById(SCRIPT_ID);
    if (window.google?.accounts?.id) renderButton();
    else if (existing) {
      existing.addEventListener('load', renderButton, { once: true });
      existing.addEventListener('error', () => active && callbacks.current.onError('Google sign-in could not be loaded. Check your connection and try again.'), { once: true });
    }
    else {
      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = renderButton;
      script.onerror = () => callbacks.current.onError('Google sign-in could not be loaded. Check your connection and try again.');
      document.head.appendChild(script);
    }
    return () => {
      active = false;
      if (activeHandler === handler) activeHandler = null;
    };
  }, []);

  return <div className="google-signin" ref={buttonRef} />;
}
