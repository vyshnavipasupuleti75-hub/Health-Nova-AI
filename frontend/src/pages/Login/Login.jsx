import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { FiLock, FiMail } from 'react-icons/fi';
import { FaStethoscope, FaUserDoctor } from 'react-icons/fa6';
import FormField from '../../components/FormField';
import GoogleSignIn from '../../components/GoogleSignIn';
import GoogleLinkPrompt from '../../components/GoogleLinkPrompt';
import ElasticShowcase from '../../components/intro/ElasticShowcase';
import Logo from '../../components/Logo';
import { loginUser, loginWithGoogle } from '../../services/auth';
import { useAuth } from '../../auth/AuthContext';
import { getApiErrorMessage } from '../../services/api';
import '../../styles/login.css';

export default function Login() {
  const [role, setRole] = useState('patient');
  const [serverError, setServerError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [linkRequest, setLinkRequest] = useState(null);
  const navigate = useNavigate();
  const { completeAuthentication } = useAuth();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

  const submit = async (data) => {
    try {
      setServerError('');
      const response = await loginUser({ ...data, role });
      completeAuthentication(response.data.token, response.data.user);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setServerError(getApiErrorMessage(error, 'Unable to login.'));
    }
  };

  const isDoctor = role === 'doctor';

  const handleGoogleCredential = useCallback(async (credential) => {
    try {
      setGoogleLoading(true);
      setServerError('');
      const response = await loginWithGoogle({ credential, role });
      completeAuthentication(response.data.token, response.data.user);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      const data = error.response?.data;
      if (data?.code === 'GOOGLE_LINK_REQUIRED') setLinkRequest({ email: data.email, linkToken: data.linkToken });
      else setServerError(getApiErrorMessage(error, 'Google sign-in could not be completed. Please try again.'));
    } finally {
      setGoogleLoading(false);
    }
  }, [completeAuthentication, navigate, role]);

  const handleGoogleError = useCallback((message) => setServerError(message), []);
  const handleLinked = useCallback((token, linkedUser) => {
    completeAuthentication(token, linkedUser);
    navigate('/dashboard', { replace: true });
  }, [completeAuthentication, navigate]);

  return <main className="auth-page auth-split">
    <aside className="auth-showcase">
      <Link to="/" className="auth-brand" aria-label="HealthNova home"><Logo /></Link>
      <div className="auth-showcase-visual"><ElasticShowcase /></div>
      <div className="auth-showcase-copy">
        <h2>Your reports, <span>made clear.</span></h2>
        <p>Values are read from your report and checked against the reference ranges your lab prints — explained in plain language.</p>
      </div>
    </aside>

    <section className="auth-panel">
      <Link to="/" className="auth-panel-brand" aria-label="HealthNova home"><Logo /></Link>
      <article className="login-card single-login-card">
        <label className="login-role-select" aria-label="Select login role">
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="patient">Patient</option>
            <option value="doctor">Doctor</option>
          </select>
        </label>

        <div className="role-icon">{isDoctor ? <FaUserDoctor /> : <FaStethoscope />}</div>
        <h2>{isDoctor ? 'Doctor' : 'Patient'} Login</h2>
        <p>Login to your {role} account</p>

        {linkRequest ? <GoogleLinkPrompt request={linkRequest} onLinked={handleLinked} onCancel={() => setLinkRequest(null)} /> : <form onSubmit={handleSubmit(submit)}>
          <FormField icon={FiMail} placeholder="Email" type="email" autoComplete="email" error={errors.email?.message}
            {...register('email', { required: 'Email is required' })} />
          <FormField icon={FiLock} placeholder="Password" type="password" autoComplete="current-password" error={errors.password?.message}
            {...register('password', { required: 'Password is required' })} />
          <div className="form-row">
            <label><input type="checkbox" /> Remember me</label>
            <a href="#forgot">Forgot Password?</a>
          </div>
          {serverError && <p className="error-text" role="alert">{serverError}</p>}
          <button className="primary-btn" disabled={isSubmitting || googleLoading}>
            {isSubmitting ? 'Signing in...' : 'Login →'}
          </button>
          <div className="or"><span>OR</span></div>
          <div className={googleLoading ? 'google-auth-loading' : ''} aria-busy={googleLoading}>
            <GoogleSignIn onCredential={handleGoogleCredential} onError={handleGoogleError} />
          </div>
          {googleLoading && <p className="google-status" role="status">Signing in with Google…</p>}
          <p className="switch-auth">Don’t have an account?<br />
            <Link to="/register">Create new account →</Link>
          </p>
        </form>}
      </article>
    </section>
  </main>;
}
