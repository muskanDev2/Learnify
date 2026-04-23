import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import Footer from './Footer';
import styles from './MainLayout.module.css';

function MainLayout() {
  return (
    <div className={styles.layoutWrapper}>
      <Navbar />
      <div className={styles.mainContainer}>
        <Sidebar />
        <main className={styles.contentArea}>
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  );
}

export default MainLayout;
