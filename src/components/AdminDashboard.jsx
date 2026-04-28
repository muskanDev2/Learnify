import Card from './Card';
import SectionContainer from './SectionContainer';

export default function AdminDashboard() {
  return (
    <SectionContainer
      title="Admin Dashboard"
      subtitle="Summary view for platform management."
    >
      <div className="dashboardQuickGrid">
        <Card title="Total Users" value="245" description="Registered users in system" />
        <Card title="Total Courses" value="38" description="Live courses currently available" />
        <Card title="Total Enrollments" value="1,240" description="All course enrollments" />
      </div>

      <div className="dashboardQuickLinks">
        <button type="button" className="dashboardLinkButton">Manage Users</button>
        <button type="button" className="dashboardLinkButton">Manage Courses</button>
      </div>
    </SectionContainer>
  );
}
