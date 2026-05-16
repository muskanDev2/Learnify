import { NavLink } from 'react-router-dom';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <h3 className={styles.title}>Menu</h3>
      <nav className={styles.nav}>
        <NavLink to="/dashboard" className={({ isActive }) => isActive ? styles.active : ''}>Overview</NavLink>
        <NavLink to="/courses" className={({ isActive }) => isActive ? styles.active : ''}>All Courses</NavLink>
        <NavLink to="/my-learning" className={({ isActive }) => isActive ? styles.active : ''}>My Learning</NavLink>
      </nav>
    </aside>
  );
}
