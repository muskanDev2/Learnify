import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  registerUser,
  validateEmail,
  validatePassword,
  validateRequired,
} from '../utils/authUtils';

const ROLE_OPTIONS = ['Admin', 'Instructor', 'Student'];

function getRegisterErrors(formValues) {
  const errors = {
    name: validateRequired(formValues.name, 'Full name'),
    email: validateEmail(formValues.email),
    password: validatePassword(formValues.password),
    confirmPassword: '',
    role: validateRequired(formValues.role, 'Role'),
  };

  if (!formValues.confirmPassword) {
    errors.confirmPassword = 'Confirm password is required.';
  } else if (formValues.password !== formValues.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

export default function RegisterPage() {
  const [formValues, setFormValues] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '',
  });
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const errors = useMemo(() => getRegisterErrors(formValues), [formValues]);
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
    setSuccessMessage('');

    if (!isFormValid) return;

    setIsSubmitting(true);
    // Simulate a basic API call delay for better UX feedback.
    await new Promise((resolve) => setTimeout(resolve, 900));

    const result = registerUser(formValues);
    setIsSubmitting(false);

    if (!result.ok) {
      setGlobalError(result.message);
      return;
    }

    setSuccessMessage(result.message);
    setFormValues({
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: '',
    });
    setTouched({});
    setSubmitAttempted(false);
  }

  function shouldShowFieldError(fieldName) {
    return Boolean((touched[fieldName] || submitAttempted) && errors[fieldName]);
  }

  return (
    <section className="authPage">
      <div className="authCard">
        <h2>Create an account</h2>
        <p className="authSubtext">Join Learnify to start your learning journey.</p>

        <form className="authForm" onSubmit={handleSubmit} noValidate>
          <label htmlFor="name">Full Name</label>
          <input
            id="name"
            name="name"
            type="text"
            value={formValues.name}
            onChange={handleChange}
            onBlur={handleBlur}
            className={shouldShowFieldError('name') ? 'inputError' : ''}
            placeholder="Enter your full name"
          />
          {shouldShowFieldError('name') && <p className="errorText">{errors.name}</p>}

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
          <p className="hintText">Use 8+ chars with uppercase, lowercase, number, and symbol.</p>
          {shouldShowFieldError('password') && <p className="errorText">{errors.password}</p>}

          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={formValues.confirmPassword}
            onChange={handleChange}
            onBlur={handleBlur}
            className={shouldShowFieldError('confirmPassword') ? 'inputError' : ''}
            placeholder="Re-enter password"
          />
          {shouldShowFieldError('confirmPassword') && (
            <p className="errorText">{errors.confirmPassword}</p>
          )}

          <label htmlFor="role">Role</label>
          <select
            id="role"
            name="role"
            value={formValues.role}
            onChange={handleChange}
            onBlur={handleBlur}
            className={shouldShowFieldError('role') ? 'inputError' : ''}
          >
            <option value="">Select your role</option>
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          {shouldShowFieldError('role') && <p className="errorText">{errors.role}</p>}

          {globalError && <p className="errorText formError">{globalError}</p>}

          <button type="submit" className="authSubmitButton" disabled={!isFormValid || isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <p className="authSwitchText">
          Already have an account? <Link to="/login">Log In</Link>
        </p>
      </div>

      {successMessage && (
        <div className="lightboxOverlay" role="alertdialog" aria-live="polite">
          <div className="lightboxCard">
            <h3>Success</h3>
            <p>{successMessage}</p>
            <Link to="/login" className="heroButton">Go to Login</Link>
          </div>
        </div>
      )}
    </section>
  );
}
