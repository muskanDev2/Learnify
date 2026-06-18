import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentRole, isAdmin, isInstructor, isStudent } from '../utils/authUtils';
import { fetchMySupportRequests, submitSupportRequest } from '../utils/supportApi';

const SUPPORT_EMAIL = 'support@learnify.test';

const CATEGORY_OPTIONS = [
  { value: 'account', label: 'Account & login' },
  { value: 'courses', label: 'Courses & enrollment' },
  { value: 'assignments', label: 'Assignments & grades' },
  { value: 'certificates', label: 'Certificates' },
  { value: 'technical', label: 'Technical issue' },
  { value: 'other', label: 'Other' },
];

const COMMON_FAQ = [
  {
    id: 'password',
    question: 'How do I change my password?',
    answer:
      'Open the profile menu (chevron next to your name), choose Change Password, enter your current password, then set a new one that meets the security requirements.',
  },
  {
    id: 'notifications',
    question: 'Where can I see all my notifications?',
    answer:
      'Click the bell icon in the top bar for recent alerts, or open View All Notifications to filter, mark as read, and manage preferences.',
  },
  {
    id: 'profile',
    question: 'How do I update my profile information?',
    answer:
      'From the profile menu, select View Profile. You can update your name, program details, and profile photo from there.',
  },
];

const STUDENT_FAQ = [
  {
    id: 'enroll',
    question: 'How do I enroll in a course?',
    answer:
      'Go to Dashboard → My Courses → Browse, find a course, and click Enroll. If the course is protected, enter the enrollment key from your instructor.',
  },
  {
    id: 'progress',
    question: 'How is my course progress calculated?',
    answer:
      'Progress is based on completed lessons, submitted assignments, and attempted quizzes. Open Dashboard → Progress to see item-level completion.',
  },
  {
    id: 'certificate',
    question: 'When can I download my certificate?',
    answer:
      'Certificates appear on the Progress tab after your instructor approves them. You may need to complete all course items first unless your instructor approves early.',
  },
  {
    id: 'assignment-upload',
    question: 'My assignment upload failed — what should I check?',
    answer:
      'Confirm the file type and size match the assignment rules, ensure the backend server is running, and verify your internet connection. Try again or contact support with the error message.',
  },
];

const INSTRUCTOR_FAQ = [
  {
    id: 'roster',
    question: 'How do I manage students in my course?',
    answer:
      'Open Dashboard → Students to see enrolled learners, their progress, and certificate approval options per course.',
  },
  {
    id: 'grading',
    question: 'How do I grade assignment submissions?',
    answer:
      'Open My Courses, select a course, open an assignment item, and use the submissions table to preview files, add feedback, and assign grades.',
  },
  {
    id: 'cert-approve',
    question: 'How do I approve a student certificate?',
    answer:
      'In Dashboard → Students, find the learner and use the Certificate column. You can set a completion threshold or approve early with confirmation.',
  },
];

const ADMIN_FAQ = [
  {
    id: 'users',
    question: 'How do I manage platform users?',
    answer:
      'Admins can open Dashboard → Users to view accounts, update roles, and deactivate users when needed.',
  },
  {
    id: 'reports',
    question: 'Where do I see platform reports?',
    answer:
      'Dashboard → Reports provides enrollment, activity, and usage summaries for monitoring the LMS.',
  },
];

const emptyForm = { category: 'account', subject: '', message: '' };

function getQuickLinks(user, navigate, onClose) {
  const links = [
    { label: 'Notifications', action: () => navigate('/notifications') },
    { label: 'View Profile', action: () => navigate('/profile') },
  ];

  if (isStudent(user)) {
    links.unshift(
      { label: 'My Courses', action: () => navigate('/dashboard?tab=my-courses') },
      { label: 'My Progress', action: () => navigate('/dashboard?tab=progress') },
    );
  } else if (isInstructor(user)) {
    links.unshift(
      { label: 'My Courses', action: () => navigate('/dashboard?tab=my-courses') },
      { label: 'Students', action: () => navigate('/dashboard?tab=students') },
    );
  } else if (isAdmin(user)) {
    links.unshift(
      { label: 'Users', action: () => navigate('/dashboard?tab=users') },
      { label: 'Reports', action: () => navigate('/dashboard?tab=reports') },
    );
  }

  return links.map((link) => ({
    ...link,
    action: () => {
      onClose();
      link.action();
    },
  }));
}

function formatTicketDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getStatusLabel(status) {
  if (status === 'resolved') return 'Resolved';
  if (status === 'in_progress') return 'In progress';
  return 'Open';
}

function readCurrentUser() {
  try {
    const raw = localStorage.getItem('learnify_current_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function HelpSupportModal({ onClose }) {
  const navigate = useNavigate();
  const user = useMemo(() => readCurrentUser(), []);
  const role = getCurrentRole(user);

  const [activeTab, setActiveTab] = useState('help');
  const [openFaqId, setOpenFaqId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [lastTicket, setLastTicket] = useState(null);
  const [recentRequests, setRecentRequests] = useState([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  const faqItems = useMemo(() => {
    const items = [...COMMON_FAQ];
    if (isStudent(user)) items.push(...STUDENT_FAQ);
    if (isInstructor(user)) items.push(...INSTRUCTOR_FAQ);
    if (isAdmin(user)) items.push(...ADMIN_FAQ);
    return items;
  }, [user]);

  const quickLinks = useMemo(() => getQuickLinks(user, navigate, onClose), [user, navigate, onClose]);

  const fieldErrors = {
    category: form.category ? '' : 'Please choose a category.',
    subject: form.subject.trim()
      ? form.subject.trim().length < 5
        ? 'Subject must be at least 5 characters.'
        : ''
      : 'Subject is required.',
    message: form.message.trim()
      ? form.message.trim().length < 20
        ? 'Message must be at least 20 characters.'
        : ''
      : 'Message is required.',
  };

  const canSubmit =
    !isSubmitting &&
    form.category &&
    form.subject.trim().length >= 5 &&
    form.message.trim().length >= 20;

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  useEffect(() => {
    let isMounted = true;

    async function loadRequests() {
      setIsLoadingRequests(true);
      try {
        const rows = await fetchMySupportRequests();
        if (isMounted) setRecentRequests(rows);
      } catch {
        if (isMounted) setRecentRequests([]);
      } finally {
        if (isMounted) setIsLoadingRequests(false);
      }
    }

    loadRequests();
    return () => {
      isMounted = false;
    };
  }, []);

  function handleFormChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setSubmitError('');
  }

  function handleBlur(event) {
    setTouched((prev) => ({ ...prev, [event.target.name]: true }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setTouched({ category: true, subject: true, message: true });
    if (!canSubmit) return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const ticket = await submitSupportRequest({
        category: form.category,
        subject: form.subject.trim(),
        message: form.message.trim(),
      });
      setLastTicket(ticket);
      setForm(emptyForm);
      setTouched({});
      setRecentRequests((prev) => [ticket, ...prev].slice(0, 10));
      setActiveTab('help');
    } catch (error) {
      setSubmitError(error.message || 'Could not submit your request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="lightboxOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-support-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="lightboxCard helpSupportCard">
        <div className="helpSupportHeader">
          <div>
            <p className="authModalEyebrow">Help & Support</p>
            <h3 id="help-support-title">How can we help you?</h3>
            <p className="authSubtext">
              Browse common answers or send us a message. We typically respond within 1–2 business days at{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            </p>
          </div>
          <button type="button" className="helpSupportClose" onClick={onClose} aria-label="Close help and support">
            ×
          </button>
        </div>

        {lastTicket && (
          <div className="helpSupportSuccessBanner" role="status">
            <strong>Request submitted — {lastTicket.ticketId}</strong>
            <span>We saved your message and will follow up at {user?.email || 'your account email'}.</span>
            <button type="button" onClick={() => setLastTicket(null)} aria-label="Dismiss confirmation">
              Dismiss
            </button>
          </div>
        )}

        <div className="helpSupportTabs" role="tablist" aria-label="Help sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'help'}
            className={activeTab === 'help' ? 'helpSupportTabActive' : ''}
            onClick={() => setActiveTab('help')}
          >
            Help center
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'contact'}
            className={activeTab === 'contact' ? 'helpSupportTabActive' : ''}
            onClick={() => setActiveTab('contact')}
          >
            Contact support
          </button>
        </div>

        {activeTab === 'help' ? (
          <div className="helpSupportPanel" role="tabpanel">
            <section className="helpSupportQuickLinks" aria-label="Quick links">
              <h4>Quick links</h4>
              <div className="helpSupportQuickGrid">
                {quickLinks.map((link) => (
                  <button key={link.label} type="button" className="helpSupportQuickButton" onClick={link.action}>
                    {link.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="helpSupportFaq" aria-label="Frequently asked questions">
              <h4>
                FAQ {role ? `(${role})` : ''}
              </h4>
              <div className="helpSupportFaqList">
                {faqItems.map((item) => {
                  const isOpen = openFaqId === item.id;
                  return (
                    <article key={item.id} className={`helpSupportFaqItem ${isOpen ? 'helpSupportFaqItemOpen' : ''}`}>
                      <button
                        type="button"
                        className="helpSupportFaqQuestion"
                        aria-expanded={isOpen}
                        onClick={() => setOpenFaqId(isOpen ? null : item.id)}
                      >
                        <span>{item.question}</span>
                        <span aria-hidden>{isOpen ? '−' : '+'}</span>
                      </button>
                      {isOpen && <p className="helpSupportFaqAnswer">{item.answer}</p>}
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        ) : (
          <div className="helpSupportPanel" role="tabpanel">
            <form className="helpSupportForm" onSubmit={handleSubmit} noValidate>
              <p className="helpSupportFormMeta">
                Submitting as <strong>{user?.name || 'User'}</strong> ({user?.email || 'no email'}) ·{' '}
                {role || 'student'}
              </p>

              <label htmlFor="support-category">Category</label>
              <select
                id="support-category"
                name="category"
                value={form.category}
                onChange={handleFormChange}
                onBlur={handleBlur}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {touched.category && fieldErrors.category && <p className="errorText">{fieldErrors.category}</p>}

              <label htmlFor="support-subject">Subject</label>
              <input
                id="support-subject"
                name="subject"
                type="text"
                value={form.subject}
                onChange={handleFormChange}
                onBlur={handleBlur}
                placeholder="Brief summary of your issue"
                maxLength={200}
              />
              {touched.subject && fieldErrors.subject && <p className="errorText">{fieldErrors.subject}</p>}

              <label htmlFor="support-message">Message</label>
              <textarea
                id="support-message"
                name="message"
                rows={5}
                value={form.message}
                onChange={handleFormChange}
                onBlur={handleBlur}
                placeholder="Describe what happened, what you expected, and any error messages you saw."
                maxLength={4000}
              />
              {touched.message && fieldErrors.message && <p className="errorText">{fieldErrors.message}</p>}

              {submitError && <p className="errorText formError">{submitError}</p>}

              <div className="profileModalActions">
                <button type="submit" className="profilePrimaryButton" disabled={!canSubmit}>
                  {isSubmitting ? 'Sending...' : 'Submit request'}
                </button>
                <button type="button" className="heroButton heroButtonSecondary" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </button>
              </div>
            </form>

            <section className="helpSupportRecent" aria-label="Your recent support requests">
              <h4>Your recent requests</h4>
              {isLoadingRequests ? (
                <p className="helpSupportMuted">Loading your requests...</p>
              ) : recentRequests.length ? (
                <ul className="helpSupportTicketList">
                  {recentRequests.map((ticket) => (
                    <li key={ticket.id || ticket.ticketId}>
                      <div className="helpSupportTicketTop">
                        <strong>{ticket.ticketId}</strong>
                        <span className={`helpSupportStatus helpSupportStatus${ticket.status}`}>
                          {getStatusLabel(ticket.status)}
                        </span>
                      </div>
                      <p>{ticket.subject}</p>
                      <small>{formatTicketDate(ticket.createdAt)}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="helpSupportMuted">No support requests yet. Use the form above if you need help.</p>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
