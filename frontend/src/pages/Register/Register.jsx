import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { FiCalendar, FiDroplet, FiLock, FiMail, FiPhone, FiUser } from 'react-icons/fi';
import { FaShieldHeart, FaUserDoctor } from 'react-icons/fa6';
import FormField from '../../components/FormField';
import GoogleSignIn from '../../components/GoogleSignIn';
import GoogleLinkPrompt from '../../components/GoogleLinkPrompt';
import { loginWithGoogle, registerUser } from '../../services/auth';
import { useAuth } from '../../auth/AuthContext';
import { getApiErrorMessage } from '../../services/api';
import '../../styles/register.css';

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function Register() {
  const [role, setRole] = useState('patient');
  const [message, setMessage] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [linkRequest, setLinkRequest] = useState(null);
  const navigate = useNavigate();
  const { completeAuthentication } = useAuth();
  const { register, getValues, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({ shouldUnregister: true });

  const submit = async (data) => {
    try {
      setMessage('');
      const response = await registerUser({ ...data, role });
      completeAuthentication(response.data.token, response.data.user);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setMessage(getApiErrorMessage(error, 'Unable to register.'));
    }
  };

  const handleGoogleCredential = useCallback(async (credential) => {
    if (!getValues('terms')) {
      setMessage('Please accept the terms before continuing with Google.');
      return;
    }
    try {
      setGoogleLoading(true);
      setMessage('');
      const response = await loginWithGoogle({ credential, role });
      completeAuthentication(response.data.token, response.data.user);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      const data = error.response?.data;
      if (data?.code === 'GOOGLE_LINK_REQUIRED') setLinkRequest({ email: data.email, linkToken: data.linkToken });
      else setMessage(getApiErrorMessage(error, 'Google sign-in could not be completed. Please try again.'));
    } finally {
      setGoogleLoading(false);
    }
  }, [completeAuthentication, getValues, navigate, role]);

  const handleGoogleError = useCallback((errorMessage) => setMessage(errorMessage), []);
  const handleLinked = useCallback((token, linkedUser) => {
    completeAuthentication(token, linkedUser);
    navigate('/dashboard', { replace: true });
  }, [completeAuthentication, navigate]);

  return <main className="register-page">
    <section className="register-card">
      <Link to="/login" className="back">←</Link>
      <div className="register-heading"><FaShieldHeart /><h1>Create Account</h1><p>Fill in the details to get started</p></div>
      {linkRequest ? <GoogleLinkPrompt request={linkRequest} onLinked={handleLinked} onCancel={() => setLinkRequest(null)} /> : <form onSubmit={handleSubmit(submit)}>
        <FormField icon={FiUser} placeholder="Full Name" error={errors.name?.message}
          {...register('name', { required: 'Name is required' })} />
        <FormField icon={FiMail} type="email" placeholder="Email" error={errors.email?.message}
          {...register('email', { required: 'Email is required' })} />
        <div className="form-columns">
          <FormField icon={FiLock} type="password" placeholder="Password" error={errors.password?.message}
            {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Use at least 6 characters' } })} />
          <FormField icon={FiLock} type="password" placeholder="Confirm Password" error={errors.confirmPassword?.message}
            {...register('confirmPassword', { validate: (value) => value === watch('password') || 'Passwords do not match' })} />
          <FormField icon={FiPhone} placeholder="Mobile Number" {...register('phone')} />
          <FormField icon={FiCalendar} type="date" {...register('dateOfBirth')} />
        </div>

        {role === 'patient' && <div className="form-columns patient-fields">
          <FormField icon={FiUser} type="number" min="1" max="120" placeholder="Age" error={errors.age?.message}
            {...register('age', { required: 'Age is required for patients', min: { value: 1, message: 'Enter a valid age' }, max: { value: 120, message: 'Enter a valid age' } })} />
          <label className={`field ${errors.bloodGroup ? 'invalid' : ''}`}>
            <FiDroplet />
            <select defaultValue="" {...register('bloodGroup', { required: 'Blood group is required for patients' })}>
              <option value="" disabled>Blood Group</option>
              {bloodGroups.map((group) => <option key={group} value={group}>{group}</option>)}
            </select>
            {errors.bloodGroup && <small>{errors.bloodGroup.message}</small>}
          </label>
        </div>}

        <h3 className="choose-role">Register as</h3>
        <div className="role-options">
          <button type="button" className={role === 'patient' ? 'active' : ''} onClick={() => setRole('patient')}>
            <FiUser /><b>Patient</b><small>Book appointments and consult doctors</small>
          </button>
          <button type="button" className={role === 'doctor' ? 'active' : ''} onClick={() => setRole('doctor')}>
            <FaUserDoctor /><b>Doctor</b><small>Healthcare support for patients</small>
          </button>
        </div>

        <label className="terms"><input type="checkbox" {...register('terms', { required: true })} /> I agree to the <a href="#terms">Terms & Conditions</a> and <a href="#privacy">Privacy Policy</a></label>
        {errors.terms && <p className="error-text">Please accept the terms.</p>}
        {message && <p className="error-text">{message}</p>}
        <button className="primary-btn" disabled={isSubmitting}>{isSubmitting ? 'Creating account...' : 'Register →'}</button>
        <div className="or">OR</div>
        <div className={googleLoading ? 'google-auth-loading' : ''}>
          <GoogleSignIn onCredential={handleGoogleCredential} onError={handleGoogleError} />
        </div>
        <p className="already">Already have an account? <Link to="/login">Login</Link></p>
      </form>}
    </section>
  </main>;
}
