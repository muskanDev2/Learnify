export default function HomePage() {
  return (
    <>
      <section className="heroSection">
        <p className="heroTag">Learning Management System</p>
        <h1 className="heroTitle">Welcome to Learnify</h1>
        <p className="heroSubtitle">Engage, Evolve, Excel!</p>
        <div className="heroActions">
          <a href="/login?mode=signup" className="heroButton">Sign Up</a>
          <a href="/login?mode=login" className="heroButton heroButtonSecondary">Log In</a>
        </div>
      </section>

      <section id="about" className="infoSection">
        <h2>About Us</h2>
        <p>
          Learnify is a simple and friendly learning platform where students can
          explore courses, track progress, and stay engaged with structured
          content. Our goal is to make digital learning clear, accessible, and
          motivating for everyone.
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
