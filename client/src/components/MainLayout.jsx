import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
// Logged-in app shell: use dashboard top bar (search + profile), not the public Navbar.
import DashboardNavbar from './DashboardNavbar';
import Footer from './Footer';
import styles from './MainLayout.module.css';
import { loadLmsSnapshot } from '../utils/lmsStorage';

function MainLayout() {
  // Frontend route guard: if logged out, redirect to Home and replace history entry.
  const currentUser = localStorage.getItem('learnify_current_user');
  const [syncKey, setSyncKey] = useState(0);

  useEffect(() => {
    if (!currentUser) return;

    loadLmsSnapshot()
      .then(() => setSyncKey((key) => key + 1))
      .catch((error) => {
        console.error('Failed to load LMS data:', error.message);
      });
  }, [currentUser]);

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className={styles.layoutWrapper}>
      <DashboardNavbar />
      <main className={styles.contentArea}>
        <Outlet key={syncKey} />
      </main>
      <Footer />
    </div>
  );
}

export default MainLayout;
