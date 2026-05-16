import { Navigate, Outlet } from 'react-router-dom';
// Logged-in app shell: use dashboard top bar (search + profile), not the public Navbar.
import DashboardNavbar from './DashboardNavbar';
import Footer from './Footer';
import styles from './MainLayout.module.css';

function MainLayout() {
  // Frontend route guard: if logged out, redirect to Home and replace history entry.
  const currentUser = localStorage.getItem('learnify_current_user');
  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className={styles.layoutWrapper}>
      <DashboardNavbar />
      <main className={styles.contentArea}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default MainLayout;
