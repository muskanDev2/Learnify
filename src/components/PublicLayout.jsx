import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import styles from './MainLayout.module.css';

export default function PublicLayout() {
  return (
    <div className={styles.layoutWrapper}>
      <Navbar />
      <main className={styles.contentArea}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
