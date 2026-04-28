import { useMemo, useRef, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import AdminDashboard from '../components/AdminDashboard';
import InstructorDashboard from '../components/InstructorDashboard';
import InstructorCoursesPanel from '../components/InstructorCoursesPanel';
import StudentDashboard from '../components/StudentDashboard';
import { getStoredUsers } from '../utils/authUtils';

function DashboardPage() {
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

  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const loadingTimerRef = useRef(null);
  const normalizedRole = (currentUser?.role || 'Student').toLowerCase();

  // One simple menu map based on role to keep sidebar logic beginner-friendly.
  const menuItems = useMemo(() => {
    if (normalizedRole === 'admin') {
      return [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'users', label: 'Users' },
        { id: 'courses', label: 'Courses' },
        { id: 'reports', label: 'Reports' },
      ];
    }

    if (normalizedRole === 'instructor') {
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
  }, [normalizedRole]);

  const validActiveMenu = menuItems.some((item) => item.id === activeMenu)
    ? activeMenu
    : 'dashboard';

  // Small UI feedback when switching sidebar tabs.
  function handleMenuClick(menuId) {
    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current);
    }

    setActiveMenu(menuId);
    setIsDashboardLoading(true);
    loadingTimerRef.current = setTimeout(() => {
      setIsDashboardLoading(false);
    }, 450);
  }

  // Keep role rendering in one place for easy extension later.
  function renderRoleDashboard() {
    if (normalizedRole === 'admin') return <AdminDashboard />;
    if (normalizedRole === 'instructor') return <InstructorDashboard />;
    return <StudentDashboard />;
  }

  return (
    <DashboardLayout
      userName={currentUser?.name || 'Learner'}
      role={currentUser?.role || 'Student'}
      menuItems={menuItems}
      activeMenu={validActiveMenu}
      onMenuClick={handleMenuClick}
    >
      {isDashboardLoading ? (
        <div className="dashboardFeedback" aria-live="polite">
          Loading dashboard summary...
        </div>
      ) : validActiveMenu === 'dashboard' ? (
        renderRoleDashboard()
      ) : normalizedRole === 'instructor' && validActiveMenu === 'my-courses' ? (
        <InstructorCoursesPanel />
      ) : (
        <div className="dashboardPanel">
          <h3>{menuItems.find((item) => item.id === validActiveMenu)?.label}</h3>
          <p>
            This section is common for all roles and keeps the same dashboard shell.
            We can add role-specific content here in upcoming steps.
          </p>
        </div>
      )}
    </DashboardLayout>
  );
}

export default DashboardPage;
