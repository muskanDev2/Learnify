import Card from './Card';
import SectionContainer from './SectionContainer';

export default function InstructorDashboard() {
  return (
    <SectionContainer
      title="Instructor Dashboard"
      subtitle="Summary view for teaching activity (data will update once courses are added)."
    >
      <div className="dashboardQuickGrid">
        <Card title="My Courses" value="0" description="No courses created yet" />
        <Card title="Total Students" value="0" description="No enrolled students yet" />
        <Card title="Pending Assignments to Grade" value="0" description="No submissions to grade" />
      </div>
    </SectionContainer>
  );
}
