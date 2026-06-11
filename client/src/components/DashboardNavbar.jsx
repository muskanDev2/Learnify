import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FaRegCircleUser,
  FaKey,
  FaCircleQuestion,
  FaArrowRightFromBracket,
  FaChevronDown,
} from 'react-icons/fa6';
import styles from './DashboardNavbar.module.css';
import { clearAuthSession, validatePassword } from '../utils/authUtils';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../utils/notificationApi';
import { changePassword } from '../utils/userApi';
import Toast from './Toast';

// Read logged-in user for the top bar (frontend-only; same key as LoginPage).
function getCurrentUser() {
  try {
    const raw = localStorage.getItem('learnify_current_user');
    if (!raw) return { name: 'Learner', initial: 'L', profileImage: '' };
    const user = JSON.parse(raw);
    const name = user.name?.trim() || 'Learner';
    const initial = name.charAt(0).toUpperCase();
    return {
      name,
      initial,
      profileImage: user.profileImage || '',
    };
  } catch {
    return { name: 'Learner', initial: 'L', profileImage: '' };
  }
}

const emptyPasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirmNewPassword: '',
};

function getPasswordChecklist(password) {
  return [
    { id: 'length', label: 'At least 8 characters', passed: password.length >= 8 },
    { id: 'uppercase', label: 'One uppercase letter', passed: /[A-Z]/.test(password) },
    { id: 'lowercase', label: 'One lowercase letter', passed: /[a-z]/.test(password) },
    { id: 'number', label: 'One number', passed: /\d/.test(password) },
    { id: 'special', label: 'One special character', passed: /[^A-Za-z\d]/.test(password) },
  ];
}

function formatNotificationTime(value) {
  if (!value) return '';
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) return 'Just now';
  if (diffMs < hour) return `${Math.floor(diffMs / minute)} minutes ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)} hours ago`;
  if (diffMs < 2 * day) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function DashboardNavbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isProfilePage = pathname === '/profile';
  const [userInfo, setUserInfo] = useState(() => getCurrentUser());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeInfoMenu, setActiveInfoMenu] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [passwordTouched, setPasswordTouched] = useState({});
  const [passwordVisibility, setPasswordVisibility] = useState({
    currentPassword: false,
    newPassword: false,
    confirmNewPassword: false,
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordToast, setPasswordToast] = useState({ type: 'success', text: '' });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const profileMenuRef = useRef(null);

  const passwordChecklist = getPasswordChecklist(passwordForm.newPassword);
  const newPasswordStrengthError = validatePassword(passwordForm.newPassword);
  const passwordFieldErrors = {
    currentPassword: passwordForm.currentPassword ? '' : 'Current Password is required.',
    newPassword: passwordForm.newPassword ? newPasswordStrengthError : 'New Password is required.',
    confirmNewPassword: passwordForm.confirmNewPassword
      ? passwordForm.confirmNewPassword === passwordForm.newPassword
        ? ''
        : 'New Password and Confirm New Password must match.'
      : 'Confirm New Password is required.',
  };
  const canUpdatePassword =
    !isUpdatingPassword &&
    passwordForm.currentPassword &&
    passwordForm.newPassword &&
    passwordForm.confirmNewPassword &&
    !passwordFieldErrors.currentPassword &&
    !passwordFieldErrors.newPassword &&
    !passwordFieldErrors.confirmNewPassword;

  useEffect(() => {
    function handleOutsideClick(event) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
        setActiveInfoMenu(null);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadNavbarNotifications() {
      setIsLoadingNotifications(true);
      setNotificationError('');
      try {
        const data = await fetchNotifications({ page: 1, limit: 6, status: 'all' });
        if (!isMounted) return;
        setNotifications(data.items || []);
        setUnreadCount(data.unreadCount || 0);
      } catch (error) {
        if (isMounted) setNotificationError(error.message || 'Could not load notifications.');
      } finally {
        if (isMounted) setIsLoadingNotifications(false);
      }
    }

    loadNavbarNotifications();
    const intervalId = window.setInterval(loadNavbarNotifications, 30000);
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    // Refresh navbar user info after profile updates in the same session.
    function handleUserUpdate() {
      setUserInfo(getCurrentUser());
    }

    window.addEventListener('learnify-user-updated', handleUserUpdate);
    return () => window.removeEventListener('learnify-user-updated', handleUserUpdate);
  }, []);

  function handleMenuToggle() {
    setIsMenuOpen((prev) => !prev);
    setActiveInfoMenu(null);
  }

  function handleViewProfile() {
    setIsMenuOpen(false);
    setActiveInfoMenu(null);
    navigate('/profile');
  }

  function resetPasswordModal() {
    setPasswordForm(emptyPasswordForm);
    setPasswordTouched({});
    setPasswordVisibility({
      currentPassword: false,
      newPassword: false,
      confirmNewPassword: false,
    });
    setPasswordError('');
    setIsUpdatingPassword(false);
  }

  function handleOpenPasswordModal() {
    setIsMenuOpen(false);
    setActiveInfoMenu(null);
    resetPasswordModal();
    setIsPasswordModalOpen(true);
  }

  function handleClosePasswordModal() {
    setIsPasswordModalOpen(false);
    resetPasswordModal();
  }

  function handlePasswordFormChange(event) {
    const { name, value } = event.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
    setPasswordError('');
  }

  function handlePasswordBlur(event) {
    const { name } = event.target;
    setPasswordTouched((prev) => ({ ...prev, [name]: true }));
  }

  function togglePasswordVisibility(fieldName) {
    setPasswordVisibility((prev) => ({ ...prev, [fieldName]: !prev[fieldName] }));
  }

  function showPasswordToast(type, text) {
    setPasswordToast({ type, text });
    window.setTimeout(() => setPasswordToast({ type: 'success', text: '' }), 4000);
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setPasswordTouched({
      currentPassword: true,
      newPassword: true,
      confirmNewPassword: true,
    });

    if (!canUpdatePassword) return;

    setIsUpdatingPassword(true);
    setPasswordError('');

    try {
      await changePassword(passwordForm);
      handleClosePasswordModal();
      showPasswordToast('success', 'Password updated successfully.');
    } catch (error) {
      const message = error.message || 'Could not update password.';
      setPasswordError(message);
      showPasswordToast('error', message);
    } finally {
      setIsUpdatingPassword(false);
    }
  }

  function handleInfoMenuToggle(type) {
    setActiveInfoMenu((prev) => (prev === type ? null : type));
    setIsMenuOpen(false);
  }

  async function handleNotificationClick(notification) {
    if (!notification.isRead) {
      setNotifications((prev) =>
        prev.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      markNotificationRead(notification.id).catch(() => {});
    }

    if (notification.actionUrl) {
      setActiveInfoMenu(null);
      navigate(notification.actionUrl);
    }
  }

  async function handleMarkAllNotificationsRead() {
    await markAllNotificationsRead().catch(() => {});
    setNotifications((prev) => prev.map((notification) => ({ ...notification, isRead: true })));
    setUnreadCount(0);
  }

  function handleViewAllNotifications() {
    setActiveInfoMenu(null);
    navigate('/notifications');
  }

  function handleLogoutClick() {
    setIsMenuOpen(false);
    setActiveInfoMenu(null);
    setShowLogoutConfirm(true);
  }

  function handleCancelLogout() {
    setShowLogoutConfirm(false);
  }

  function handleConfirmLogout() {
    clearAuthSession();
    setIsMenuOpen(false);
    setActiveInfoMenu(null);
    setShowLogoutConfirm(false);
    navigate('/', { replace: true });
  }

  return (
    <nav className={styles.navbar} aria-label="Dashboard navigation">
      <Toast message={passwordToast.text} type={passwordToast.type} />
      {/* Brand stays on the left like the public navbar */}
      <Link to="/dashboard" className={styles.brand}>
        Learnify
      </Link>

      {/* Search — wide field with icon inside (matches reference layout) */}
      <div className={styles.searchWrap}>
        <span className={styles.searchIcon} aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M20 20l-4.2-4.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Search here..."
          aria-label="Search"
        />
      </div>

      <div className={styles.right} ref={profileMenuRef}>
        {isProfilePage && (
          <Link to="/dashboard" className={styles.homeButton}>
            Home
          </Link>
        )}

        <div className={styles.iconMenuWrap}>
          <button
            type="button"
            className={styles.iconCircle}
            aria-label="Messages"
            aria-expanded={activeInfoMenu === 'messages'}
            onClick={() => handleInfoMenuToggle('messages')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path
                d="M4 4h16v12H7l-3 3V4Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {activeInfoMenu === 'messages' && (
            <div className={styles.infoDropdown} role="status">
              We&apos;re currently building this feature to give you a better experience.
              Stay tuned!
            </div>
          )}
        </div>

        <div className={styles.iconMenuWrap}>
          <button
            type="button"
            className={styles.iconCircle}
            aria-label="Notifications"
            aria-expanded={activeInfoMenu === 'notifications'}
            onClick={() => handleInfoMenuToggle('notifications')}
          >
            {unreadCount > 0 && (
              <span className={styles.notificationBadge} aria-label={`${unreadCount} unread notifications`}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path
                d="M12 3a4 4 0 0 0-4 4v2.1L6 12v1h12v-1l-2-2.9V7a4 4 0 0 0-4-4Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path d="M10 20h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          {activeInfoMenu === 'notifications' && (
            <div className={styles.notificationDropdown} role="region" aria-label="Notifications">
              <div className={styles.notificationHeader}>
                <div>
                  <strong>Notifications</strong>
                  <span>{unreadCount} unread</span>
                </div>
                <button type="button" onClick={handleMarkAllNotificationsRead} disabled={!unreadCount}>
                  Mark All as Read
                </button>
              </div>
              <div className={styles.notificationList}>
                {isLoadingNotifications ? (
                  <p className={styles.notificationState}>Loading notifications...</p>
                ) : notificationError ? (
                  <p className={styles.notificationState}>{notificationError}</p>
                ) : notifications.length ? (
                  notifications.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      className={`${styles.notificationItem} ${!notification.isRead ? styles.notificationUnread : ''}`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <span className={styles.notificationItemTop}>
                        <strong>{notification.title}</strong>
                        {!notification.isRead && <i aria-label="Unread notification" />}
                      </span>
                      <span>{notification.message}</span>
                      <small>{formatNotificationTime(notification.createdAt)}</small>
                    </button>
                  ))
                ) : (
                  <p className={styles.notificationState}>No notifications available.</p>
                )}
              </div>
              <button type="button" className={styles.notificationFooterLink} onClick={handleViewAllNotifications}>
                View All Notifications
              </button>
            </div>
          )}
        </div>

        <div className={styles.profileWrap}>
          <button
            type="button"
            className={styles.profile}
            aria-label="Account menu"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            onClick={handleMenuToggle}
          >
            {userInfo.profileImage ? (
              <img src={userInfo.profileImage} alt="Profile" className={styles.avatarImage} />
            ) : (
              <span className={styles.avatar} aria-hidden>
                {userInfo.initial}
              </span>
            )}
            <span className={styles.userName}>{userInfo.name}</span>
            <span className={styles.chevron} aria-hidden>
              <FaChevronDown />
            </span>
          </button>

          {isMenuOpen && (
            <div className={styles.dropdown} role="menu" aria-label="Profile actions">
              <button type="button" className={styles.dropdownItem} role="menuitem" onClick={handleViewProfile}>
                <FaRegCircleUser aria-hidden />
                <span>View Profile</span>
              </button>
              <button type="button" className={styles.dropdownItem} role="menuitem" onClick={handleOpenPasswordModal}>
                <FaKey aria-hidden />
                <span>Change Password</span>
              </button>
              <button type="button" className={styles.dropdownItem} role="menuitem">
                <FaCircleQuestion aria-hidden />
                <span>Help and Support</span>
              </button>
              <button
                type="button"
                className={`${styles.dropdownItem} ${styles.logoutItem}`}
                role="menuitem"
                onClick={handleLogoutClick}
              >
                <FaArrowRightFromBracket aria-hidden />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {showLogoutConfirm && (
        <div className="lightboxOverlay" role="dialog" aria-modal="true" aria-labelledby="navbar-logout-confirm-title">
          <div className="lightboxCard authConfirmCard">
            <p className="authModalEyebrow">Confirm logout</p>
            <h3 id="navbar-logout-confirm-title">Are you sure you want to log out?</h3>
            <p className="authSubtext">
              Your session will end now. To access this account again, you will need to log in with your email and password.
            </p>
            <div className="profileModalActions">
              <button type="button" className="profilePrimaryButton" onClick={handleConfirmLogout} autoFocus>
                Yes, Logout
              </button>
              <button type="button" className="heroButton heroButtonSecondary" onClick={handleCancelLogout}>
                Stay Logged In
              </button>
            </div>
          </div>
        </div>
      )}

      {isPasswordModalOpen && (
        <div className="lightboxOverlay" role="dialog" aria-modal="true" aria-labelledby="change-password-title">
          <div className="lightboxCard changePasswordCard">
            <p className="authModalEyebrow">Security</p>
            <h3 id="change-password-title">Change Password</h3>
            <p className="authSubtext">Use a strong password that you do not use on other websites.</p>

            <form className="changePasswordForm" onSubmit={handlePasswordSubmit} noValidate>
              {[
                ['currentPassword', 'Current Password', 'Enter current password'],
                ['newPassword', 'New Password', 'Enter new password'],
                ['confirmNewPassword', 'Confirm New Password', 'Re-enter new password'],
              ].map(([fieldName, label, placeholder]) => (
                <div key={fieldName} className="changePasswordField">
                  <label htmlFor={`change-${fieldName}`}>{label}</label>
                  <div className="passwordInputWrap">
                    <input
                      id={`change-${fieldName}`}
                      type={passwordVisibility[fieldName] ? 'text' : 'password'}
                      name={fieldName}
                      value={passwordForm[fieldName]}
                      onChange={handlePasswordFormChange}
                      onBlur={handlePasswordBlur}
                      placeholder={placeholder}
                      autoComplete={fieldName === 'currentPassword' ? 'current-password' : 'new-password'}
                      className={passwordTouched[fieldName] && passwordFieldErrors[fieldName] ? 'inputError' : ''}
                    />
                    <button
                      type="button"
                      className="passwordToggleButton"
                      onClick={() => togglePasswordVisibility(fieldName)}
                      aria-label={passwordVisibility[fieldName] ? `Hide ${label}` : `Show ${label}`}
                    >
                      {passwordVisibility[fieldName] ? (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M3 4.3 4.3 3 21 19.7 19.7 21l-3-3A11.3 11.3 0 0 1 12 19C6.6 19 2.5 14.8 1 12c.7-1.4 2.1-3.1 4-4.4L3 4.3Zm6.1 6.1A3 3 0 0 0 13.6 15l-4.5-4.6ZM12 5c5.4 0 9.5 4.2 11 7-.5 1-1.4 2.2-2.6 3.3l-3-3A5.5 5.5 0 0 0 10.7 5.1c.4-.1.8-.1 1.3-.1Z" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 5c5.4 0 9.5 4.2 11 7-1.5 2.8-5.6 7-11 7S2.5 14.8 1 12c1.5-2.8 5.6-7 11-7Zm0 11.5A4.5 4.5 0 1 0 12 7a4.5 4.5 0 0 0 0 9.5Zm0-2A2.5 2.5 0 1 1 12 9a2.5 2.5 0 0 1 0 5.5Z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {passwordTouched[fieldName] && passwordFieldErrors[fieldName] && (
                    <p className="errorText">{passwordFieldErrors[fieldName]}</p>
                  )}
                  {fieldName === 'newPassword' && (
                    <ul className="passwordRequirementList" aria-label="Password requirements">
                      {passwordChecklist.map((item) => (
                        <li key={item.id} className={item.passed ? 'passwordRequirementPassed' : ''}>
                          <span aria-hidden>{item.passed ? '✓' : '•'}</span>
                          {item.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}

              {passwordError && <p className="errorText formError">{passwordError}</p>}

              <div className="profileModalActions">
                <button type="submit" className="profilePrimaryButton" disabled={!canUpdatePassword}>
                  {isUpdatingPassword ? 'Updating...' : 'Update Password'}
                </button>
                <button type="button" className="heroButton heroButtonSecondary" onClick={handleClosePasswordModal} disabled={isUpdatingPassword}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </nav>
  );
}
