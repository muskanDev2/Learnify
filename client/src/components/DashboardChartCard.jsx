/**
 * HCI-oriented chart shell: caption explains the measure; aria-label summarizes for AT.
 */
export default function DashboardChartCard({ title, caption, footnote, ariaLabel, children }) {
  return (
    <figure className="dashboardChartCard" role="group" aria-label={ariaLabel}>
      <figcaption className="dashboardChartCardCaption">
        <span className="dashboardChartCardTitle">{title}</span>
        {caption ? <span className="dashboardChartCardSubtitle">{caption}</span> : null}
      </figcaption>
      <div className="dashboardChartPlot">{children}</div>
      {footnote ? <p className="dashboardChartFootnote">{footnote}</p> : null}
    </figure>
  );
}
