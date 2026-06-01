import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import AdminDashboard from '../components/AdminDashboard';
import AdminCoursesPanel from '../components/AdminCoursesPanel';
import AdminUsersPanel from '../components/AdminUsersPanel';
import AdminReportsPanel from '../components/AdminReportsPanel';
import InstructorDashboard from '../components/InstructorDashboard';
import InstructorCoursesPanel from '../components/InstructorCoursesPanel';
import StudentCoursesPanel from '../components/StudentCoursesPanel';
import StudentDashboard from '../components/StudentDashboard';
import {
  clearAuthSession,
  getCurrentRole,
  getStoredUsers,
  isAdmin,
  isInstructor,
  isStudent,
} from '../utils/authUtils';

function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Read logged-in user first; if missing, use first registered user for demo flow.
  const currentUser = useMemo(() => {
    const rawUser = localStorage.getItem('learnify_current_user');
    if (rawUser) {
      try {
        return JSON.parse(rawUser);
      } catch {
        return null;
      }
    }

    // Fallback: show first registered user if current user does not exist yet.
    const users = getStoredUsers();
    return users[0] || null;
  }, []);

  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [showBackLogoutConfirm, setShowBackLogoutConfirm] = useState(false);
  const loadingTimerRef = useRef(null);
  const backGuardPrimedRef = useRef(false);
  const normalizedRole = getCurrentRole(currentUser) || 'student';

  // One simple menu map based on role to keep sidebar logic beginner-friendly.
  const menuItems = useMemo(() => {
    if (isAdmin(currentUser)) {
      return [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'users', label: 'Users' },
        { id: 'courses', label: 'Courses' },
        { id: 'reports', label: 'Reports' },
      ];
    }

    if (isInstructor(currentUser)) {
      return [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'my-courses', label: 'My Courses' },
        { id: 'students', label: 'Students' },
      ];
    }

    return [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'my-courses', label: 'My Courses' },
      { id: 'progress', label: 'Progress' },
    ];
  }, [currentUser]);

  const activeMenuFromUrl = searchParams.get('tab') || 'dashboard';
  const validActiveMenu = menuItems.some((item) => item.id === activeMenuFromUrl)
    ? activeMenuFromUrl
    : 'dashboard';

  useEffect(() => () => {
    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const isGuardTarget = validActiveMenu === 'dashboard';
    if (!isGuardTarget) {
      backGuardPrimedRef.current = false;
      return;
    }

    if (!backGuardPrimedRef.current) {
      window.history.pushState({ learnifyBackGuard: true }, '', window.location.href);
      backGuardPrimedRef.current = true;
    }

    function handlePopState() {
      const hasCurrentUser = Boolean(localStorage.getItem('learnify_current_user'));
      if (!hasCurrentUser) return;
      setShowBackLogoutConfirm(true);
      // Keep user on dashboard while asking for confirmation.
      window.history.pushState({ learnifyBackGuard: true }, '', window.location.href);
    }

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [validActiveMenu]);

  // Small UI feedback when switching sidebar tabs.
  function handleMenuClick(menuId) {
    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current);
    }

    navigate(`/dashboard?tab=${menuId}`);
    setIsDashboardLoading(true);
    loadingTimerRef.current = setTimeout(() => {
      setIsDashboardLoading(false);
    }, 450);
  }

  function handleCancelBackLogout() {
    setShowBackLogoutConfirm(false);
  }

  function handleConfirmBackLogout() {
    clearAuthSession();
    setShowBackLogoutConfirm(false);
    navigate('/', { replace: true });
  }

  // Keep role rendering in one place for easy extension later.
  function renderRoleDashboard() {
    if (isAdmin(currentUser)) return <AdminDashboard />;
    if (isInstructor(currentUser)) return <InstructorDashboard />;
    return <StudentDashboard />;
  }

  return (
    <DashboardLayout
      userName={currentUser?.name || 'Learner'}
      role={currentUser?.role || 'Student'}
      menuItems={menuItems}
      activeMenu={validActiveMenu}
      onMenuClick={handleMenuClick}
      showHeader={!(normalizedRole === 'instructor' && validActiveMenu === 'my-courses')}
    >
      {isDashboardLoading ? (
        <div className="dashboardFeedback" aria-live="polite">
          Loading dashboard summary...
        </div>
      ) : validActiveMenu === 'dashboard' ? (
        renderRoleDashboard()
      ) : isInstructor(currentUser) && validActiveMenu === 'my-courses' ? (
        <InstructorCoursesPanel />
      ) : isStudent(currentUser) && validActiveMenu === 'my-courses' ? (
        <StudentCoursesPanel />
      ) : isAdmin(currentUser) && validActiveMenu === 'users' ? (
        <AdminUsersPanel />
      ) : isAdmin(currentUser) && validActiveMenu === 'courses' ? (
        <AdminCoursesPanel />
      ) : isAdmin(currentUser) && validActiveMenu === 'reports' ? (
        <AdminReportsPanel />
      ) : (
        <div className="dashboardPanel">
          <h3>{menuItems.find((item) => item.id === validActiveMenu)?.label}</h3>
          <p>
            This section is common for all roles and keeps the same dashboard shell.
            We can add role-specific content here in upcoming steps.
          </p>
        </div>
      )}

      {showBackLogoutConfirm && (
        <div className="lightboxOverlay" role="dialog" aria-modal="true" aria-labelledby="dashboard-logout-confirm-title">
          <div className="lightboxCard">
            <h3 id="dashboard-logout-confirm-title">Logout Confirmation</h3>
            <p className="authSubtext">
              Do you want to logout and return to home page?
            </p>
            <div className="profileModalActions">
              <button type="button" className="profilePrimaryButton" onClick={handleConfirmBackLogout}>
                Yes, Logout
              </button>
              <button type="button" className="heroButton heroButtonSecondary" onClick={handleCancelBackLogout}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default DashboardPage;
