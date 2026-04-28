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

// Read logged-in user for the top bar (frontend-only; same key as LoginPage).
function getCurrentUser() {
  try {
    const raw = localStorage.getItem('learnify_current_user');
    if (!raw) return { name: 'Learner', initial: 'L', profileImage: '', role: 'student' };
    const user = JSON.parse(raw);
    const name = user.name?.trim() || 'Learner';
    const initial = name.charAt(0).toUpperCase();
    return {
      name,
      initial,
      profileImage: user.profileImage || '',
      role: (user.role || 'student').toLowerCase(),
    };
  } catch {
    return { name: 'Learner', initial: 'L', profileImage: '', role: 'student' };
  }
}

export default function DashboardNavbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isProfilePage = pathname === '/profile';
  const [userInfo, setUserInfo] = useState(() => getCurrentUser());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeInfoMenu, setActiveInfoMenu] = useState(null);
  const profileMenuRef = useRef(null);

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

  function handleInfoMenuToggle(type) {
    setActiveInfoMenu((prev) => (prev === type ? null : type));
    setIsMenuOpen(false);
  }

  function handleLogout() {
    localStorage.removeItem('learnify_current_user');
    setIsMenuOpen(false);
    setActiveInfoMenu(null);
    navigate('/', { replace: true });
  }

  return (
    <nav className={styles.navbar} aria-label="Dashboard navigation">
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

      <div className={styles.right}>
        {userInfo.role === 'instructor' && (
          <Link to="/courses" className={styles.createCourseButton}>
            Create Course
          </Link>
        )}

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
            <span className={styles.notifyDot} aria-hidden />
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
            <div className={styles.infoDropdown} role="status">
              We&apos;re currently building this feature to give you a better experience.
              Stay tuned!
            </div>
          )}
        </div>

        <div className={styles.profileWrap} ref={profileMenuRef}>
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
              <button type="button" className={styles.dropdownItem} role="menuitem">
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
                onClick={handleLogout}
              >
                <FaArrowRightFromBracket aria-hidden />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
