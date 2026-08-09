import { useEffect, useRef } from 'react';

const SCRIPT_ID = 'google-identity-services';

export default function GoogleSignIn({ onCredential, onError }) {
  const buttonRef = useRef(null);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      onError('Google sign-in is not configured. Add VITE_GOOGLE_CLIENT_ID to frontend/.env.');
      return undefined;
    }

    let active = true;
    const renderButton = () => {
      if (!active || !buttonRef.current || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: ({ credential }) => credential ? onCredential(credential) : onError('Google did not return a sign-in credential.'),
        cancel_on_tap_outside: true,
      });
      buttonRef.current.replaceChildren();
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', width: Math.min(buttonRef.current.clientWidth || 400, 400),
      });
    };

    const existing = document.getElementById(SCRIPT_ID);
    if (window.google?.accounts?.id) renderButton();
    else if (existing) existing.addEventListener('load', renderButton, { once: true });
    else {
      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = renderButton;
      script.onerror = () => onError('Google sign-in could not be loaded. Check your connection and try again.');
      document.head.appendChild(script);
    }
    return () => { active = false; };
  }, [onCredential, onError]);

  return <div className="google-signin" ref={buttonRef} />;
}
