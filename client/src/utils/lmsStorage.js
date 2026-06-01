import { apiFetch } from './api';

export const COURSES_KEY = 'learnify_courses';
export const ENROLLMENTS_KEY = 'learnify_enrollments';
export const STUDENT_PROGRESS_KEY = 'learnify_student_progress';

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function hasLocalLmsData(snapshot) {
  return (
    snapshot.courses.length > 0 ||
    Object.keys(snapshot.enrollments).length > 0 ||
    Object.keys(snapshot.studentProgress).length > 0
  );
}

function hasRemoteLmsData(snapshot) {
  return hasLocalLmsData(snapshot);
}

export function getLocalLmsSnapshot() {
  const courses = readJson(COURSES_KEY, []);
  const enrollments = readJson(ENROLLMENTS_KEY, {});
  const studentProgress = readJson(STUDENT_PROGRESS_KEY, {});

  return {
    courses: Array.isArray(courses) ? courses : [],
    enrollments: enrollments && typeof enrollments === 'object' ? enrollments : {},
    studentProgress: studentProgress && typeof studentProgress === 'object' ? studentProgress : {},
  };
}

export function writeLocalLmsSnapshot(snapshot) {
  localStorage.setItem(COURSES_KEY, JSON.stringify(snapshot.courses || []));
  localStorage.setItem(ENROLLMENTS_KEY, JSON.stringify(snapshot.enrollments || {}));
  localStorage.setItem(STUDENT_PROGRESS_KEY, JSON.stringify(snapshot.studentProgress || {}));
  window.dispatchEvent(new Event('learnify-lms-data-updated'));
}

export async function syncLmsSnapshotFromLocal() {
  const snapshot = getLocalLmsSnapshot();

  return apiFetch('/api/lms/snapshot', {
    method: 'PUT',
    body: JSON.stringify(snapshot),
  });
}

export async function loadLmsSnapshot() {
  const localSnapshot = getLocalLmsSnapshot();
  const [snapshotResult, coursesResult, enrollmentsResult, progressResult] = await Promise.all([
    apiFetch('/api/lms/snapshot'),
    apiFetch('/api/courses'),
    apiFetch('/api/enrollments'),
    apiFetch('/api/progress'),
  ]);
  const remoteSnapshot = snapshotResult.data || getLocalLmsSnapshot();
  const apiCourses = Array.isArray(coursesResult.data) ? coursesResult.data : [];
  const apiEnrollments =
    enrollmentsResult.data && typeof enrollmentsResult.data === 'object' ? enrollmentsResult.data : {};
  const apiProgress =
    progressResult.data && typeof progressResult.data === 'object' ? progressResult.data : {};

  if (!hasRemoteLmsData(remoteSnapshot) && hasLocalLmsData(localSnapshot)) {
    await syncLmsSnapshotFromLocal();
    const mergedLocalSnapshot = {
      ...localSnapshot,
      courses: apiCourses.length ? apiCourses : localSnapshot.courses,
      enrollments: apiEnrollments,
      studentProgress: apiProgress,
    };
    writeLocalLmsSnapshot(mergedLocalSnapshot);
    return mergedLocalSnapshot;
  }

  const mergedSnapshot = {
    ...remoteSnapshot,
    courses: apiCourses,
    enrollments: apiEnrollments,
    studentProgress: apiProgress,
  };
  writeLocalLmsSnapshot(mergedSnapshot);
  return mergedSnapshot;
}

export function syncLmsSnapshotFromLocalSoon() {
  syncLmsSnapshotFromLocal().catch((error) => {
    console.error('Failed to sync LMS data:', error.message);
  });
}
