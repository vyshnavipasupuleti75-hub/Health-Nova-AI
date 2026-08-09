import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { FiLock, FiMail } from 'react-icons/fi';
import { FaStethoscope, FaUserDoctor } from 'react-icons/fa6';
import FormField from '../../components/FormField';
import GoogleSignIn from '../../components/GoogleSignIn';
import { loginUser, loginWithGoogle } from '../../services/auth';
import { useAuth } from '../../auth/AuthContext';
import '../../styles/login.css';

export default function Login() {
  const [role, setRole] = useState('patient');
  const [serverError, setServerError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
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
      setServerError(error.response?.data?.message || 'Unable to login. Is the API running?');
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
      setServerError(error.response?.data?.message || 'Google sign-in could not be completed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  }, [completeAuthentication, navigate, role]);

  const handleGoogleError = useCallback((message) => setServerError(message), []);

  return <main className="auth-page">
    <section className="auth-intro">
      <div className="brand-mark"><FaStethoscope /></div>
      <h1>Welcome to Health-Nova-AI</h1>
      <p>Your intelligent healthcare companion</p>
    </section>

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

      <form onSubmit={handleSubmit(submit)}>
        <FormField icon={FiMail} placeholder="Email" type="email" error={errors.email?.message}
          {...register('email', { required: 'Email is required' })} />
        <FormField icon={FiLock} placeholder="Password" type="password" error={errors.password?.message}
          {...register('password', { required: 'Password is required' })} />
        <div className="form-row">
          <label><input type="checkbox" /> Remember me</label>
          <a href="#forgot">Forgot Password?</a>
        </div>
        {serverError && <p className="error-text">{serverError}</p>}
        <button className="primary-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in...' : 'Login →'}
        </button>
        <div className="or">OR</div>
        <div className={googleLoading ? 'google-auth-loading' : ''}>
          <GoogleSignIn onCredential={handleGoogleCredential} onError={handleGoogleError} />
        </div>
        <p className="switch-auth">Don’t have an account?<br />
          <Link to="/register">Create new account →</Link>
        </p>
      </form>
    </article>
  </main>;
}
