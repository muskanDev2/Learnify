/** Build search params for the /courses page (URL is the navigation source of truth). */

export function buildCourseSearchParams({
  courseId,
  moduleId,
  contentId,
  assignmentId,
  quizId,
  tab,
} = {}) {
  const params = new URLSearchParams();

  if (courseId != null && courseId !== '') {
    params.set('courseId', String(courseId));
  }
  if (moduleId != null && moduleId !== '') {
    params.set('moduleId', String(moduleId));
  }
  if (contentId != null && contentId !== '') {
    params.set('contentId', String(contentId));
  }
  if (assignmentId != null && assignmentId !== '') {
    params.set('assignmentId', String(assignmentId));
  }
  if (quizId != null && quizId !== '') {
    params.set('quizId', String(quizId));
  }
  if (tab === 'forum') {
    params.set('tab', 'forum');
  } else if (tab === 'live') {
    params.set('tab', 'live');
  }

  return params;
}

export function parseCourseNav(searchParams) {
  const raw = searchParams instanceof URLSearchParams ? searchParams : new URLSearchParams(searchParams);
  const courseIdRaw = raw.get('courseId');
  const moduleIdRaw = raw.get('moduleId');

  return {
    courseId: courseIdRaw ? Number(courseIdRaw) : null,
    moduleId: moduleIdRaw ? Number(moduleIdRaw) : null,
    contentId: raw.get('contentId') || null,
    assignmentId: raw.get('assignmentId') || null,
    quizId: raw.get('quizId') || null,
    tab:
      raw.get('tab') === 'forum'
        ? 'forum'
        : raw.get('tab') === 'live'
          ? 'live'
          : 'modules',
  };
}

export function courseNavToString(params) {
  const built = buildCourseSearchParams(params);
  const query = built.toString();
  return query ? `/courses?${query}` : '/courses';
}
