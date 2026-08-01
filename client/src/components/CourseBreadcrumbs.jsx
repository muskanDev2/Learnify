import { Link } from 'react-router-dom';
import { courseNavToString } from '../utils/courseNavigation';

/**
 * LMS-style breadcrumb trail for nested course views.
 * Each segment (except the last) links to that navigation level.
 */
export default function CourseBreadcrumbs({
  dashboardHref = '/dashboard',
  dashboardLabel = 'Dashboard',
  catalogHref,
  catalogLabel = 'My Courses',
  course,
  module,
  item,
}) {
  const segments = [
    { key: 'dashboard', label: dashboardLabel, to: dashboardHref },
    { key: 'catalog', label: catalogLabel, to: catalogHref },
  ];

  if (course?.id) {
    segments.push({
      key: 'course',
      label: course.title || 'Course',
      to: courseNavToString({ courseId: course.id, tab: 'modules' }),
    });
  }

  if (course?.id && module?.id) {
    segments.push({
      key: 'module',
      label: module.title || 'Module',
      to: courseNavToString({ courseId: course.id, moduleId: module.id }),
    });
  }

  if (item?.title) {
    segments.push({
      key: 'item',
      label: item.title,
      to: null,
    });
  }

  return (
    <nav className="courseBreadcrumbs" aria-label="Breadcrumb">
      <ol className="courseBreadcrumbsList">
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          return (
            <li key={segment.key} className="courseBreadcrumbsItem">
              {segment.to && !isLast ? (
                <Link to={segment.to} className="courseBreadcrumbsLink">
                  {segment.label}
                </Link>
              ) : (
                <span className="courseBreadcrumbsCurrent" aria-current={isLast ? 'page' : undefined}>
                  {segment.label}
                </span>
              )}
              {!isLast && <span className="courseBreadcrumbsSep" aria-hidden="true">&gt;</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
