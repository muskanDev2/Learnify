import Card from './Card';
import SectionContainer from './SectionContainer';

export default function StudentDashboard() {
  return (
    <SectionContainer
      title="Student Dashboard"
      subtitle="Summary view for your learning progress."
    >
      <div className="dashboardQuickGrid">
        <Card title="Enrolled Courses" value="5" description="Courses in your learning list" />
        <Card title="Progress Percentage" value="68%" description="Overall learning progress" />
        <Card title="Upcoming Assignments" value="3" description="Tasks due this week" />
      </div>

      <div className="dashboardAnnouncements">
        <h4>Recent Announcements</h4>
        <ul>
          <li>New React basics quiz is now available.</li>
          <li>Assignment deadline extended to Friday.</li>
          <li>Live Q&A session starts at 5 PM today.</li>
        </ul>
      </div>
    </SectionContainer>
  );
}
