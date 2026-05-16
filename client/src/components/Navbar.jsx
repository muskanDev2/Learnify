import { NavLink, useLocation } from 'react-router-dom';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { pathname } = useLocation();
  const isHomePage = pathname === '/';

  return (
    <nav className={styles.navbar}>
      <a href="/" className={styles.brand}>Learnify</a>
      <div className={styles.links}>
        <NavLink to="/" className={({ isActive }) => (isActive ? styles.active : '')}>
          Home
        </NavLink>
        <a href={isHomePage ? '#about' : '/#about'}>About Us</a>
        <a href={isHomePage ? '#contact' : '/#contact'}>Contact</a>
      </div>
    </nav>
  );
}
