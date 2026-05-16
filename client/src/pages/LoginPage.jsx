import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  loginUser,
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
    // Simulate API request delay to show loading state.
    await new Promise((resolve) => setTimeout(resolve, 800));
    const result = loginUser(formValues);
    setIsSubmitting(false);

    if (!result.ok) {
      setGlobalError(result.message);
      return;
    }

    localStorage.setItem('learnify_current_user', JSON.stringify(result.user));
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
    </section>
  );
}
