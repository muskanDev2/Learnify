import { useEffect, useState } from 'react';
import { checkApiHealth } from '../utils/api';

export default function HomePage() {
  const [apiStatus, setApiStatus] = useState('checking');

  useEffect(() => {
    checkApiHealth()
      .then(() => setApiStatus('connected'))
      .catch(() => setApiStatus('offline'));
  }, []);

  return (
    <>
      {apiStatus !== 'checking' && (
        <p className="authSubtext" style={{ textAlign: 'center', marginTop: '0.5rem' }}>
          API: {apiStatus === 'connected' ? 'Connected to backend' : 'Backend offline — redeploy Vercel after env fix'}
        </p>
      )}
      <section className="heroSection">
        <p className="heroTag">Learning Management System</p>
        <h1 className="heroTitle">Welcome to Learnify</h1>
        <p className="heroSubtitle">Engage, Evolve, Excel!</p>
        <div className="heroActions">
          <a href="/register" className="heroButton">Sign Up</a>
          <a href="/login" className="heroButton heroButtonSecondary">Log In</a>
        </div>
      </section>

      <section id="about" className="infoSection">
        <h2>About Us</h2>
        <p>
          The Global Youth Network (GYN) is a US based organization that will provide youth with an opportunity to connect with people from various backgrounds coming from different parts of the world. Through our international conferences and leadership programs we aim to target students, professionals’, innovators and community leaders in sharing their ideas and also to collaborate on global challenges via provided interactive forums. With our target focus on four SDGs (4, 5, 9 & 13), we hope to bring sustainable change through local communities to global outreach.
        </p>
      </section>

      <section id="contact" className="infoSection contactSection">
        <h2>Contact</h2>
        <p><strong>Phone:</strong> +123 456 7890</p>
        <p><strong>Email:</strong> contact@learnify.com</p>
        <p><strong>Address:</strong> 123 Learning Street, Knowledge City</p>
      </section>
    </>
  );
}
