import { useState } from 'react';
import { FiLock } from 'react-icons/fi';
import FormField from './FormField';
import { linkGoogleAccount } from '../services/auth';
import { getApiErrorMessage } from '../services/api';
import '../styles/login.css';

// Shown when Google verified an email that already belongs to a password account. Linking requires that
// account's password once, so a Google sign-in can never take over an existing HealthNova account by email alone.
export default function GoogleLinkPrompt({ request, onLinked, onCancel }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [linking, setLinking] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!password || linking) return;
    try {
      setLinking(true);
      setError('');
      const response = await linkGoogleAccount({ linkToken: request.linkToken, password });
      onLinked(response.data.token, response.data.user);
    } catch (linkError) {
      setError(getApiErrorMessage(linkError, 'Google sign-in could not be linked. Please try again.'));
      setLinking(false);
    }
  };

  return <form className="google-link" onSubmit={submit}>
    <h3>Link your Google account</h3>
    <p>A HealthNova account already uses <b>{request.email}</b>. Enter its password once to link Google sign-in. After that, Continue with Google signs you straight in.</p>
    <FormField icon={FiLock} type="password" placeholder="HealthNova password" autoComplete="current-password" autoFocus value={password} onChange={(event) => setPassword(event.target.value)} />
    {error && <p className="error-text" role="alert">{error}</p>}
    <button className="primary-btn" disabled={!password || linking}>{linking ? 'Linking…' : 'Link and sign in →'}</button>
    <button type="button" className="google-link-cancel" onClick={onCancel} disabled={linking}>Cancel</button>
  </form>;
}
