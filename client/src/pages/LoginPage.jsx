import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  loginUser,
  setCurrentUser,
  validateEmail,
  validatePassword,
} from '../utils/authUtils';

function getLoginErrors(formValues) {
  return {
    email: validateEmail(formValues.email),
    password: validatePassword(formValues.password),
  };
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [formValues, setFormValues] = useState({
    email: '',
    password: '',
  });
  const [welcomeUser, setWelcomeUser] = useState(null);
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [globalError, setGlobalError] = useState('');

  const errors = useMemo(() => getLoginErrors(formValues), [formValues]);
  const isFormValid = Object.values(errors).every((error) => error === '');

  function handleChange(event) {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  }

  function handleBlur(event) {
    const { name } = event.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitAttempted(true);
    setGlobalError('');

    if (!isFormValid) return;

    setIsSubmitting(true);
    const result = await loginUser(formValues);
    setIsSubmitting(false);

    if (!result.ok) {
      setGlobalError(result.message);
      return;
    }

    setCurrentUser(result.user);
    setWelcomeUser(result.user);
  }

  function handleContinueToDashboard() {
    navigate('/dashboard', { replace: true });
  }

  function shouldShowFieldError(fieldName) {
    return Boolean((touched[fieldName] || submitAttempted) && errors[fieldName]);
  }

  return (
    <section className="authPage">
      <div className="authCard">
        <h2>Welcome back</h2>
        <p className="authSubtext">Login to continue your learning journey.</p>

        <form className="authForm" onSubmit={handleSubmit} noValidate>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            value={formValues.email}
            onChange={handleChange}
            onBlur={handleBlur}
            className={shouldShowFieldError('email') ? 'inputError' : ''}
            placeholder="you@example.com"
          />
          {shouldShowFieldError('email') && <p className="errorText">{errors.email}</p>}

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            value={formValues.password}
            onChange={handleChange}
            onBlur={handleBlur}
            className={shouldShowFieldError('password') ? 'inputError' : ''}
            placeholder="Enter secure password"
          />
          
          {shouldShowFieldError('password') && <p className="errorText">{errors.password}</p>}

          <a href="#" className="forgotPasswordLink">Forgot password?</a>

          {globalError && <p className="errorText formError">{globalError}</p>}

          <button type="submit" className="authSubmitButton" disabled={!isFormValid || isSubmitting}>
            {isSubmitting ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <p className="authSwitchText">
          New to Learnify? <Link to="/register">Sign Up</Link>
        </p>
      </div>

      {welcomeUser && (
        <div className="lightboxOverlay" role="dialog" aria-modal="true" aria-labelledby="login-welcome-title">
          <div className="lightboxCard authWelcomeCard">
            <p className="authModalEyebrow">Login successful</p>
            <h3 id="login-welcome-title">Welcome back, {welcomeUser.name || 'Learner'}!</h3>
            <p className="authSubtext">
              You are signed in securely. Continue to your dashboard to pick up your learning from where you left off.
            </p>
            <div className="profileModalActions">
              <button type="button" className="profilePrimaryButton" onClick={handleContinueToDashboard} autoFocus>
                Continue to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
