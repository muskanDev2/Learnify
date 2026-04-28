export default function SectionContainer({ title, children, subtitle = '' }) {
  return (
    <section className="dashboardSection">
      <header className="dashboardSectionHeader">
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      <div className="dashboardSectionContent">{children}</div>
    </section>
  );
}
