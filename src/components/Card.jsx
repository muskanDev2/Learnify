export default function Card({ title, value, description = '' }) {
  return (
    <article className="dashboardCard">
      <h4>{title}</h4>
      <p className="dashboardCardValue">{value}</p>
      {description ? <small className="dashboardCardDescription">{description}</small> : null}
    </article>
  );
}
