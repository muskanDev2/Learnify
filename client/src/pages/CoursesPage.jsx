import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getCurrentUser,
  isAdmin as checkAdmin,
  isInstructor as checkInstructor,
  isStudent as checkStudent,
} from '../utils/authUtils';
import {
  fetchCourses,
  updateCourse as updateCourseRequest,
  updateStudentCourseWork,
} from '../utils/courseApi';
import {
  fetchProgress,
  openContent,
  saveContentTime,
  saveProgress as saveProgressRequest,
} from '../utils/progressApi';
import {
  fetchMyQuizAttempts,
  fetchQuizAttempts,
  submitQuizAttempt as submitQuizAttemptRequest,
} from '../utils/quizApi';
import {
  deleteAssignmentSubmission,
  fetchAssignmentSubmissions,
  fetchMyAssignmentSubmission,
  gradeAssignmentSubmission,
  submitAssignment as submitAssignmentRequest,
} from '../utils/assignmentApi';
import { fetchEnrollments } from '../utils/enrollmentApi';
import { fetchStudents } from '../utils/userApi';
import { syncLmsSnapshotFromLocalSoon } from '../utils/lmsStorage';
import { uploadFiles } from '../utils/uploadApi';
import DeleteConfirmationDialog from '../components/DeleteConfirmationDialog';
import Toast from '../components/Toast';

const COURSES_KEY = 'learnify_courses';
const ENROLLMENTS_KEY = 'learnify_enrollments';
const STUDENT_PROGRESS_KEY = 'learnify_student_progress';
const CONTENT_FILE_TYPES = ['pdf', 'video', 'ppt', 'doc', 'txt', 'image'];
const ASSIGNMENT_GRADING_OPTIONS = ['Not graded', 'Points based', 'Pass / Fail'];
const ASSIGNMENT_FILE_TYPES = ['pdf', 'doc', 'docx', 'txt', 'jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'avi', 'ppt', 'pptx', 'zip', 'rar'];
const ASSIGNMENT_FILE_ACCEPT = ASSIGNMENT_FILE_TYPES.map((type) => `.${type}`).join(',');
const DEFAULT_ASSIGNMENT_MAX_FILE_SIZE_MB = 250;

function activityKey(courseId, itemId) {
  return `${courseId}:${itemId}`;
}

function formatProgramSemester(student) {
  const program = student.degreeProgram || 'Program not provided';
  const semester = student.semester ? `Semester ${student.semester}` : 'Semester not selected';
  return { program, semester };
}

function getStoredCourses() {
  const rawCourses = localStorage.getItem(COURSES_KEY);
  if (!rawCourses) return [];

  try {
    const parsed = JSON.parse(rawCourses);
    if (!Array.isArray(parsed)) return [];

    // Deduplicate by ID to clean up any existing corruption from previous bugs
    const uniqueMap = new Map();
    parsed.forEach((course) => {
      if (course && course.id) {
        // Keep the latest version if duplicates exist
        uniqueMap.set(course.id, course);
      }
    });
    return Array.from(uniqueMap.values());
  } catch {
    return [];
  }
}

function saveStoredCourses(courses) {
  localStorage.setItem(COURSES_KEY, JSON.stringify(courses));
  syncLmsSnapshotFromLocalSoon();
}

function getStoredEnrollments() {
  const raw = localStorage.getItem(ENROLLMENTS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveStoredEnrollments(enrollments) {
  localStorage.setItem(ENROLLMENTS_KEY, JSON.stringify(enrollments || {}));
  syncLmsSnapshotFromLocalSoon();
}

function getStoredStudentProgress() {
  const raw = localStorage.getItem(STUDENT_PROGRESS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveStoredStudentProgress(progress) {
  localStorage.setItem(STUDENT_PROGRESS_KEY, JSON.stringify(progress));
  syncLmsSnapshotFromLocalSoon();
}

function getFileUrl(file) {
  return file?.url || file?.dataUrl || '';
}

function getFileIconLabel(file) {
  const mimeType = String(file?.mimeType || '').toLowerCase();
  const name = String(file?.name || '').toLowerCase();

  if (mimeType.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/.test(name)) return 'VID';
  if (mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/.test(name)) return 'IMG';
  if (mimeType.includes('pdf') || name.endsWith('.pdf')) return 'PDF';
  if (mimeType.includes('powerpoint') || /\.(ppt|pptx)$/.test(name)) return 'PPT';
  if (mimeType.includes('word') || /\.(doc|docx)$/.test(name)) return 'DOC';
  return 'FILE';
}

function getSubmissionFileType(file) {
  const explicit = String(file?.fileType || '').toLowerCase();
  if (explicit) return explicit;
  const mimeType = String(file?.mimeType || '').toLowerCase();
  const name = String(file?.originalFilename || file?.name || '').toLowerCase();
  if (mimeType.startsWith('image/') || /\.(png|jpe?g|webp)$/.test(name)) return 'image';
  if (mimeType.startsWith('video/') || /\.(mp4|mov|avi)$/.test(name)) return 'video';
  if (mimeType.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
  if (mimeType.includes('powerpoint') || /\.(ppt|pptx)$/.test(name)) return 'ppt';
  if (mimeType.includes('word') || /\.(doc|docx)$/.test(name)) return 'doc';
  if (name.endsWith('.zip') || name.endsWith('.rar')) return 'archive';
  if (name.endsWith('.txt')) return 'txt';
  return 'file';
}

function getAssignmentAllowedTypes(item) {
  return Array.isArray(item?.allowedFileTypes) && item.allowedFileTypes.length
    ? item.allowedFileTypes
    : ASSIGNMENT_FILE_TYPES;
}

function getAssignmentMaxFileSizeMb(item) {
  const configuredSize = Number(item?.maxFileSizeMb || item?.maxFileSize || DEFAULT_ASSIGNMENT_MAX_FILE_SIZE_MB);
  // Existing assignments were created when 25 MB was the default; treat that value as legacy default.
  return configuredSize === 25 ? DEFAULT_ASSIGNMENT_MAX_FILE_SIZE_MB : configuredSize;
}

function getStudentSubmissionStatus(submission, assignment) {
  if (!submission) return 'pending';
  if (submission.status === 'graded' || submission.gradedAt) return 'graded';
  if (submission.status === 'late') return 'late';
  if (assignment?.dueAt && new Date(submission.submittedAt) > new Date(assignment.dueAt)) return 'late';
  return 'submitted';
}

function getSubmissionStatusLabel(status) {
  return {
    submitted: 'Submitted',
    late: 'Late Submission',
    pending: 'Not Submitted',
    graded: 'Graded',
  }[status] || 'Not Submitted';
}

function isAssignmentClosed(assignment) {
  if (!assignment) return true;
  const isPastDue = shouldAutoCloseSubmission(assignment.dueAt);
  if (isPastDue && assignment.allowLateSubmission === true) return assignment.submissionOpen !== false;
  return assignment.submissionOpen === false || isPastDue;
}

function getLocalFileType(file) {
  const mimeType = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  if (mimeType.startsWith('image/jpeg') || /\.(jpe?g)$/.test(name)) return 'jpg';
  if (mimeType.startsWith('image/png') || name.endsWith('.png')) return 'png';
  if (mimeType.startsWith('image/webp') || name.endsWith('.webp')) return 'webp';
  if (mimeType === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (mimeType.includes('wordprocessingml') || name.endsWith('.docx')) return 'docx';
  if (mimeType.includes('msword') || name.endsWith('.doc')) return 'doc';
  if (mimeType.includes('presentationml') || name.endsWith('.pptx')) return 'pptx';
  if (mimeType.includes('powerpoint') || name.endsWith('.ppt')) return 'ppt';
  if (mimeType.startsWith('video/mp4') || name.endsWith('.mp4')) return 'mp4';
  if (mimeType.startsWith('video/quicktime') || name.endsWith('.mov')) return 'mov';
  if (mimeType.includes('x-msvideo') || name.endsWith('.avi')) return 'avi';
  if (mimeType === 'text/plain' || name.endsWith('.txt')) return 'txt';
  if (mimeType.includes('zip') || name.endsWith('.zip')) return 'zip';
  if (mimeType.includes('rar') || name.endsWith('.rar')) return 'rar';
  return '';
}

function validateAssignmentFiles(files, assignment) {
  const allowedTypes = new Set(getAssignmentAllowedTypes(assignment));
  const maxBytes = getAssignmentMaxFileSizeMb(assignment) * 1024 * 1024;
  const fileList = Array.from(files || []);
  const invalid = fileList.find((file) => !allowedTypes.has(getLocalFileType(file)));
  if (invalid) return `${invalid.name} is not an allowed file type for this assignment.`;
  const oversized = fileList.find((file) => file.size > maxBytes);
  if (oversized) return `${oversized.name} exceeds the ${getAssignmentMaxFileSizeMb(assignment)} MB file limit.`;
  return '';
}

function getUploadFileKey(file) {
  return String(file?.id || file?.publicId || file?.url || `${file?.name || file?.originalFilename}-${file?.size || ''}`);
}

function formatFileSize(bytes) {
  const size = Number(bytes) || 0;
  if (!size) return '';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getNextId(items) {
  return items.length ? Math.max(...items.map((item) => item.id)) + 1 : 1;
}

function buildStarterModules() {
  return [{ id: 1, title: 'General', items: [] }];
}

function normalizeModuleItems(module) {
  if (Array.isArray(module.items)) return module.items;

  // Small migration: older saved data used "materials" instead of "items".
  if (Array.isArray(module.materials)) {
    return module.materials.map((material) => {
      const materialType = String(material.type || '').toLowerCase();

      if (materialType === 'assignment') {
        return {
          id: material.id,
          type: 'assignment',
          title: material.title || 'Untitled assignment',
          instructions: material.link || '',
          openedAt: material.openedAt || '',
          dueAt: material.dueAt || material.dueDate || '',
          gradingStatus: material.gradingStatus || 'Not graded',
          requiresStudentUpload: material.requiresStudentUpload ?? true,
          submissionOpen:
            material.submissionOpen ?? !shouldAutoCloseSubmission(material.dueAt || material.dueDate || ''),
          fileSubmissionEnabled: material.fileSubmissionEnabled ?? false,
          attachments: material.attachments || [],
          submissions: material.submissions || [],
          isDelivered: Boolean(material.isDelivered),
        };
      }

      if (materialType === 'quiz') {
        const normalizedQuestions = Array.isArray(material.questions) ? material.questions : [];
        return {
          id: material.id,
          type: 'quiz',
          title: material.title || 'Untitled quiz',
          questionsCount: normalizedQuestions.length,
          questions: normalizedQuestions,
          attempts: material.attempts || [],
          instructions: material.instructions || '',
          timeLimitMinutes: Number(material.timeLimitMinutes) > 0 ? Number(material.timeLimitMinutes) : 20,
          maxAttempts: Number(material.maxAttempts) > 0 ? Number(material.maxAttempts) : 1,
          openedAt: material.openedAt || '',
          dueAt: material.dueAt || material.dueDate || '',
          gradingStatus: material.gradingStatus || 'Not graded',
          isDelivered: Boolean(material.isDelivered),
        };
      }

      return {
        id: material.id,
        type: 'content',
        title: material.title || 'Untitled content',
        fileType: CONTENT_FILE_TYPES.includes(materialType) ? materialType : 'pdf',
        link: material.link || '',
        fileName: material.fileName || '',
        files: material.files || [],
        isDelivered: Boolean(material.isDelivered),
      };
    });
  }

  return [];
}

function normalizeModules(modules) {
  if (!Array.isArray(modules) || modules.length === 0) {
    return buildStarterModules();
  }

  return modules.map((module) => ({
    id: module.id,
    title: module.title || 'Untitled module',
    items: normalizeModuleItems(module),
  }));
}

function getCourseProgress(course) {
  const allItems = course.modules.flatMap((module) => module.items || []);
  if (allItems.length === 0) return 0;
  const deliveredItems = allItems.filter((item) => item.isDelivered).length;
  return Math.round((deliveredItems / allItems.length) * 100);
}

function getItemMetaText(item) {
  if (item.type === 'content') {
    const ext = String(item.fileType || 'file').toUpperCase();
    // Match mockup style like "PPTX" / "PDF"
    return ext === 'PPT' ? 'PPTX' : ext;
  }

  // Roll back to showing the module item type (not "Gradable item")
  return String(item.type || '').toUpperCase();
}

function formatDateTimeLabel(value) {
  // value is usually "YYYY-MM-DDTHH:MM" (from datetime-local)
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatSecondsAsMMSS(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
}

function getAttemptStudentEmail(attempt) {
  return String(attempt?.student?.email || attempt?.studentEmail || '').toLowerCase();
}

function getItemIconLabel(item) {
  if (item.type === 'assignment') return 'A';
  if (item.type === 'quiz') return 'Q';
  const type = String(item.fileType || 'file').toUpperCase();
  if (type === 'PPT') return 'PPT';
  if (type === 'PDF') return 'PDF';
  if (type === 'DOC') return 'DOC';
  if (type === 'TXT') return 'TXT';
  if (type === 'VIDEO') return 'VID';
  if (type === 'IMAGE') return 'IMG';
  return 'FILE';
}

function hasAssignmentDetails(item) {
  return Boolean(
    item.instructions ||
      item.openedAt ||
      item.dueAt ||
      item.gradingStatus ||
      item.requiresStudentUpload !== undefined ||
      item.submissionOpen !== undefined ||
      item.fileSubmissionEnabled ||
      (item.attachments && item.attachments.length > 0),
  );
}

function getDefaultAssignmentSubmissions() {
  return [];
}

function shouldAutoCloseSubmission(dueAt) {
  if (!dueAt) return false;
  const dueDate = new Date(dueAt);
  if (Number.isNaN(dueDate.getTime())) return false;
  return Date.now() > dueDate.getTime();
}

function getDefaultQuizQuestion(id = 1) {
  return {
    id,
    text: '',
    options: ['', '', '', ''],
    answer: 0,
    points: 1,
  };
}

function CoursesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = getCurrentUser();
  const isAdmin = checkAdmin(currentUser);
  const isInstructor = checkInstructor(currentUser);
  const isStudent = checkStudent(currentUser);
  const canManageContent = isInstructor || isAdmin;

  const menuItems = useMemo(() => {
    if (checkAdmin(currentUser)) {
      return [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'users', label: 'Users' },
        { id: 'courses', label: 'Courses' },
        { id: 'reports', label: 'Reports' },
      ];
    }

    if (checkInstructor(currentUser)) {
      return [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'my-courses', label: 'My Courses' },
        { id: 'students', label: 'Students' },
      ];
    }

    return [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'my-courses', label: 'My Courses' },
      { id: 'progress', label: 'Progress' },
    ];
  }, [currentUser]);

  const coursesPageActiveMenuId = useMemo(() => {
    if (checkAdmin(currentUser)) return 'courses';
    return 'my-courses';
  }, [currentUser]);
  const userEmail = (currentUser?.email || '').toLowerCase();
  const [allEnrollments, setAllEnrollments] = useState(() => getStoredEnrollments());
  const [students, setStudents] = useState([]);
  const studentEnrolledIds = allEnrollments[userEmail] || [];
  const studentEnrolledIdsKey = studentEnrolledIds.join(',');
  const courseQueryParam = new URLSearchParams(location.search).get('courseId');
  const assignmentQueryParam = new URLSearchParams(location.search).get('assignmentId');
  const contentQueryParam = new URLSearchParams(location.search).get('contentId');
  const quizQueryParam = new URLSearchParams(location.search).get('quizId');
  const requestedCourseId = courseQueryParam ? Number(courseQueryParam) : location.state?.courseId || null;
  const requestedAssignmentId = assignmentQueryParam || location.state?.assignmentId || null;
  const requestedContentId = contentQueryParam || location.state?.contentId || null;
  const requestedQuizId = quizQueryParam || location.state?.quizId || null;

  const [courses, setCourses] = useState(() =>
    getStoredCourses()
      .filter((course) => {
        if (isAdmin) return true;
        if (isInstructor) return (course.ownerEmail || '').toLowerCase() === userEmail;
        if (isStudent) return studentEnrolledIds.includes(course.id);
        return false;
      })
      .map((course) => ({
        ...course,
        modules: normalizeModules(course.modules),
      })),
  );
  const [selectedCourseId, setSelectedCourseId] = useState(requestedCourseId);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [moduleModalMode, setModuleModalMode] = useState('create');
  const [moduleTitleInput, setModuleTitleInput] = useState('');
  const [moduleActionId, setModuleActionId] = useState(null);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemTargetModuleId, setItemTargetModuleId] = useState(null);
  const [itemModalMode, setItemModalMode] = useState('create'); // create | edit
  const [editingItemId, setEditingItemId] = useState(null);
  const [draggingModuleId, setDraggingModuleId] = useState(null);
  const [expandedModuleIds, setExpandedModuleIds] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [selectedContent, setSelectedContent] = useState(null);
  const [selectedContentFileId, setSelectedContentFileId] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [assignmentEditorMode, setAssignmentEditorMode] = useState('view');
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [submissionFilter, setSubmissionFilter] = useState('all');
  const [previewSubmission, setPreviewSubmission] = useState(null);
  const [gradingDrafts, setGradingDrafts] = useState({});
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizTimeoutNotice, setQuizTimeoutNotice] = useState('');
  const [quizQuestionEditorMode, setQuizQuestionEditorMode] = useState('view'); // view | edit
  const [quizQuestionEditor, setQuizQuestionEditor] = useState([]);
  const [quizTimeLeftSec, setQuizTimeLeftSec] = useState(null);
  const [quizAttemptsByKey, setQuizAttemptsByKey] = useState({});
  const [assignmentSubmissionsByKey, setAssignmentSubmissionsByKey] = useState({});
  const [moduleUploadProgress, setModuleUploadProgress] = useState(0);
  const [assignmentUploadProgress, setAssignmentUploadProgress] = useState(0);
  const [studentUploadProgress, setStudentUploadProgress] = useState(0);
  const [activeDropZone, setActiveDropZone] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [pendingDeleteAction, setPendingDeleteAction] = useState(null);
  const [deleteToastMessage, setDeleteToastMessage] = useState('');
  const quizAttemptSubmittedRef = useRef(false);
  const quizStartAtMsRef = useRef(null);
  const quizAnswersRef = useRef({});
  // Holds the active countdown interval id so submitQuiz can pause the timer immediately.
  const quizTimerIdRef = useRef(null);
  const handledDeepLinkRef = useRef('');
  const [studentAssignmentUploadFiles, setStudentAssignmentUploadFiles] = useState([]);
  const [deepLinkTarget, setDeepLinkTarget] = useState(null);
  const [highlightedItemKey, setHighlightedItemKey] = useState('');
  const [assignmentDetailForm, setAssignmentDetailForm] = useState({
    instructions: '',
    gradingStatus: 'Not graded',
    requiresStudentUpload: true,
    submissionOpen: true,
    fileSubmissionEnabled: false,
    openedAt: '',
    dueAt: '',
    allowedFileTypes: ASSIGNMENT_FILE_TYPES,
    maxFileSizeMb: DEFAULT_ASSIGNMENT_MAX_FILE_SIZE_MB,
    allowResubmission: true,
    allowLateSubmission: true,
    attachments: [],
    submissions: [],
  });
  const [studentProgress, setStudentProgress] = useState(() => getStoredStudentProgress());
  const [courseSyncMessage, setCourseSyncMessage] = useState('');
  const [moduleItemForm, setModuleItemForm] = useState({
    title: '',
    itemType: 'content',
    fileType: 'pdf',
    link: '',
    fileName: '',
    uploadedFiles: [],
    instructions: '',
    openedAt: '',
    dueAt: '',
    allowedFileTypes: ASSIGNMENT_FILE_TYPES,
    maxFileSizeMb: DEFAULT_ASSIGNMENT_MAX_FILE_SIZE_MB,
    allowResubmission: true,
    allowLateSubmission: true,
    questionsCount: '5',
    quizQuestions: [],
    quizInstructions: '',
    quizTimeLimitMinutes: '20',
    quizMaxAttempts: '1',
  });

  function showDeleteSuccess() {
    setDeleteToastMessage('Item deleted successfully.');
    window.setTimeout(() => setDeleteToastMessage(''), 4000);
  }

  function requestDeleteAction(config) {
    setPendingDeleteAction({
      title: 'Confirm Delete',
      message: 'This action cannot be undone.',
      impact: 'Deleted data will no longer be available.',
      ...config,
    });
  }

  async function confirmPendingDeleteAction() {
    if (!pendingDeleteAction?.onConfirm) return;
    await pendingDeleteAction.onConfirm();
    setPendingDeleteAction(null);
    showDeleteSuccess();
  }

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) || courses[0] || null,
    [courses, selectedCourseId],
  );

  const moduleSearchResults = useMemo(() => {
    if (!selectedCourse || !searchTerm.trim()) return [];

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const results = [];

    selectedCourse.modules.forEach((module) => {
      if (module.title.toLowerCase().includes(normalizedSearch)) {
        results.push({
          id: `module-${module.id}`,
          resultType: 'module',
          moduleId: module.id,
          title: module.title,
          subtext: 'Module',
        });
      }

      module.items.forEach((item) => {
        if (item.title.toLowerCase().includes(normalizedSearch)) {
          results.push({
            id: `item-${module.id}-${item.id}`,
            resultType: 'item',
            moduleId: module.id,
            itemId: item.id,
            title: item.title,
            subtext: `${module.title} • ${getItemMetaText(item)}`,
          });
        }
      });
    });

    return results;
  }, [searchTerm, selectedCourse]);

  const selectedAssignmentItem = useMemo(() => {
    if (!selectedCourse || !selectedAssignment) return null;
    const module = selectedCourse.modules.find((item) => item.id === selectedAssignment.moduleId);
    return module?.items.find((item) => item.id === selectedAssignment.itemId) || null;
  }, [selectedAssignment, selectedCourse]);

  const selectedContentItem = useMemo(() => {
    if (!selectedCourse || !selectedContent) return null;
    const module = selectedCourse.modules.find((item) => item.id === selectedContent.moduleId);
    return module?.items.find((item) => item.id === selectedContent.itemId) || null;
  }, [selectedContent, selectedCourse]);

  const selectedQuizItem = useMemo(() => {
    if (!selectedCourse || !selectedQuiz) return null;
    const module = selectedCourse.modules.find((item) => item.id === selectedQuiz.moduleId);
    return module?.items.find((item) => item.id === selectedQuiz.itemId) || null;
  }, [selectedCourse, selectedQuiz]);

  const studentQuizAttempt = useMemo(() => {
    if (!isStudent || !selectedQuizItem) return null;
    const key = activityKey(selectedCourse?.id, selectedQuizItem.id);
    const apiAttempts = quizAttemptsByKey[key] || [];
    const latestApiAttempt = apiAttempts[apiAttempts.length - 1];

    if (latestApiAttempt) {
      return {
        studentEmail: userEmail,
        score: latestApiAttempt.score,
        total: latestApiAttempt.totalMarks,
        percent: latestApiAttempt.percentage,
        attemptCount: apiAttempts.length,
        submittedAt: latestApiAttempt.submittedAt
          ? new Date(latestApiAttempt.submittedAt).toLocaleString()
          : '',
        autoSubmitted: latestApiAttempt.autoSubmitted,
      };
    }

    return (selectedQuizItem.attempts || []).find((attempt) => attempt.studentEmail === userEmail) || null;
  }, [isStudent, quizAttemptsByKey, selectedCourse, selectedQuizItem, userEmail]);

  const latestQuizAttemptByEmail = useMemo(() => {
    if (!selectedCourse || !selectedQuizItem) return {};

    const key = activityKey(selectedCourse.id, selectedQuizItem.id);
    const attempts = quizAttemptsByKey[key] || [];

    return attempts.reduce((map, attempt) => {
      const email = getAttemptStudentEmail(attempt);
      if (!email) return map;

      const current = map[email];
      const currentAttemptNo = Number(current?.attemptNo) || 0;
      const nextAttemptNo = Number(attempt.attemptNo) || 0;

      if (!current || nextAttemptNo >= currentAttemptNo) {
        map[email] = attempt;
      }

      return map;
    }, {});
  }, [quizAttemptsByKey, selectedCourse, selectedQuizItem]);

  const selectedAssignmentSubmissions = useMemo(() => {
    if (!selectedCourse || !selectedAssignmentItem) return [];
    return (
      assignmentSubmissionsByKey[activityKey(selectedCourse.id, selectedAssignmentItem.id)] ||
      selectedAssignmentItem.submissions ||
      []
    );
  }, [assignmentSubmissionsByKey, selectedAssignmentItem, selectedCourse]);

  const myAssignmentSubmission = useMemo(() => {
    if (!currentUser?.email) return null;
    const email = String(currentUser.email).toLowerCase();
    return selectedAssignmentSubmissions.find((submission) => {
      const submissionEmail = String(submission.student?.email || submission.studentEmail || '').toLowerCase();
      return submissionEmail === email || String(submission.student?._id || submission.student) === String(currentUser.id || currentUser._id);
    }) || null;
  }, [currentUser, selectedAssignmentSubmissions]);

  const enrolledStudentsForSelectedCourse = useMemo(() => {
    if (!selectedCourse) return [];
    return students.filter((user) =>
      (allEnrollments[user.email?.toLowerCase()] || []).includes(selectedCourse.id),
    );
  }, [allEnrollments, selectedCourse, students]);

  const instructorSubmissionRows = useMemo(() => {
    if (!selectedAssignmentItem) return [];
    return enrolledStudentsForSelectedCourse
      .map((student) => {
        const submission = selectedAssignmentSubmissions.find((item) => {
          const email = String(item.student?.email || item.studentEmail || '').toLowerCase();
          return email === String(student.email || '').toLowerCase();
        });
        const status = getStudentSubmissionStatus(submission, selectedAssignmentItem);
        return { student, submission, status };
      })
      .filter((row) => {
        if (submissionFilter === 'all') return true;
        if (submissionFilter === 'submitted') return row.status === 'submitted';
        if (submissionFilter === 'late') return row.status === 'late';
        if (submissionFilter === 'graded') return row.status === 'graded';
        if (submissionFilter === 'pending') return row.status === 'pending';
        return true;
      });
  }, [enrolledStudentsForSelectedCourse, selectedAssignmentItem, selectedAssignmentSubmissions, submissionFilter]);

  const activeContentFile = useMemo(() => {
    if (!selectedContentItem?.files?.length) return null;
    return (
      selectedContentItem.files.find((file) => file.id === selectedContentFileId) ||
      selectedContentItem.files[0]
    );
  }, [selectedContentFileId, selectedContentItem]);

  useEffect(() => {
    if (requestedCourseId) {
      setSelectedCourseId(requestedCourseId);
    }
  }, [requestedCourseId]);

  useEffect(() => {
    if (!selectedCourseId && courses.length > 0) {
      setSelectedCourseId(requestedCourseId || courses[0].id);
    }
  }, [courses, requestedCourseId, selectedCourseId]);

  useEffect(() => {
    if (!selectedCourse) return;

    const matchedModule = selectedCourse.modules.find((module) =>
      (module.items || []).some((item) => {
        if (requestedAssignmentId) return String(item.id) === String(requestedAssignmentId) && item.type === 'assignment';
        if (requestedContentId) return String(item.id) === String(requestedContentId) && item.type === 'content';
        if (requestedQuizId) return String(item.id) === String(requestedQuizId) && item.type === 'quiz';
        return false;
      }),
    );
    const matchedItem = matchedModule?.items.find((item) =>
      [requestedAssignmentId, requestedContentId, requestedQuizId].some((id) => id && String(item.id) === String(id)),
    );

    if (matchedModule && matchedItem) {
      const deepLinkKey = `${selectedCourse.id}:${matchedItem.type}:${matchedItem.id}:${location.search}`;
      if (handledDeepLinkRef.current === deepLinkKey) return;
      handledDeepLinkRef.current = deepLinkKey;

      if (matchedItem.type === 'assignment') handleAssignmentClick(matchedModule.id, matchedItem);
      if (matchedItem.type === 'content') handleContentClick(matchedModule.id, matchedItem);
      if (matchedItem.type === 'quiz') handleQuizClick(matchedModule.id, matchedItem);

      setDeepLinkTarget({ type: matchedItem.type, id: matchedItem.id });
    }
  }, [location.search, requestedAssignmentId, requestedContentId, requestedQuizId, selectedCourse]);

  useEffect(() => {
    if (!deepLinkTarget) return;

    const targetKey = `${deepLinkTarget.type}-${deepLinkTarget.id}`;
    const itemId = `course-item-${targetKey}`;
    const detailId = `course-detail-${targetKey}`;
    let cleanupTimers = [];

    const scrollWhenReady = () => {
      const itemElement = document.getElementById(itemId);
      const detailElement = document.getElementById(detailId);

      if (!detailElement) {
        cleanupTimers.push(window.setTimeout(scrollWhenReady, 80));
        return;
      }

      setHighlightedItemKey(targetKey);
      itemElement?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

      cleanupTimers.push(
        window.setTimeout(() => {
          detailElement.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
        }, 320),
      );
      cleanupTimers.push(window.setTimeout(() => setHighlightedItemKey(''), 2400));
      setDeepLinkTarget(null);
    };

    cleanupTimers.push(window.setTimeout(scrollWhenReady, 120));

    return () => {
      cleanupTimers.forEach((timerId) => window.clearTimeout(timerId));
      cleanupTimers = [];
    };
  }, [deepLinkTarget, selectedAssignmentItem, selectedContentItem, selectedQuizItem]);

  useEffect(() => {
    if (!selectedCourse?.modules?.length) {
      setExpandedModuleIds([]);
      return;
    }

    setExpandedModuleIds((prev) => {
      const validIds = prev.filter((moduleId) =>
        selectedCourse.modules.some((module) => module.id === moduleId),
      );

      if (validIds.length > 0) return validIds;
      return [selectedCourse.modules[0].id];
    });
  }, [selectedCourse]);

  useEffect(() => {
    if (!selectedContentItem?.files?.length) {
      setSelectedContentFileId(null);
      return;
    }

    const hasSelectedFile = selectedContentItem.files.some((file) => file.id === selectedContentFileId);
    if (!hasSelectedFile) {
      setSelectedContentFileId(selectedContentItem.files[0].id);
    }
  }, [selectedContentFileId, selectedContentItem]);

  useEffect(() => {
    let isMounted = true;

    async function loadCoursePageDataFromApi() {
      try {
        const [apiCourses, apiProgress, apiEnrollments, apiStudents] = await Promise.all([
          fetchCourses(),
          fetchProgress(),
          fetchEnrollments(),
          canManageContent ? fetchStudents() : Promise.resolve([]),
        ]);
        if (!isMounted) return;

        const visibleCourses = apiCourses
          .filter((course) => {
            if (isAdmin) return true;
            if (isInstructor) return (course.ownerEmail || '').toLowerCase() === userEmail;
            if (isStudent) return (apiEnrollments[userEmail] || []).includes(course.id);
            return false;
          })
          .map((course) => ({
            ...course,
            modules: normalizeModules(course.modules),
          }));

        setCourses(visibleCourses);
        setAllEnrollments(apiEnrollments);
        setStudents(apiStudents);
        setStudentProgress(apiProgress);
        saveStoredCourses(apiCourses);
        saveStoredEnrollments(apiEnrollments);
        saveStoredStudentProgress(apiProgress);
        setCourseSyncMessage('');
      } catch (error) {
        if (isMounted) {
          setCourseSyncMessage(`Could not load course content from API: ${error.message}`);
        }
      }
    }

    loadCoursePageDataFromApi();

    return () => {
      isMounted = false;
    };
  }, [canManageContent, isAdmin, isInstructor, isStudent, studentEnrolledIdsKey, userEmail]);

  function persistInstructorCourses(updatedCourses) {
    const allStored = getStoredCourses();
    const updatedIds = new Set((updatedCourses || []).map((c) => c.id));

    // Keep all courses that were NOT in the updated batch
    const otherCourses = allStored.filter((c) => !updatedIds.has(c.id));

    // Combine them. This ensures updatedCourses replace their old versions by ID.
    saveStoredCourses([...otherCourses, ...(updatedCourses || [])]);

    if (selectedCourse) {
      const changedCourse = (updatedCourses || []).find((course) => course.id === selectedCourse.id);
      if (changedCourse) {
        const saveCourseWork = canManageContent ? updateCourseRequest : updateStudentCourseWork;
        saveCourseWork(changedCourse.id, { modules: normalizeModules(changedCourse.modules) })
          .then(() => setCourseSyncMessage(''))
          .catch((error) => {
            setCourseSyncMessage(`Could not sync course content: ${error.message}`);
          });
      }
    }
  }

  function updateInstructorCourses(updater) {
    setCourses((prev) => {
      const updatedCourses = updater(prev);
      persistInstructorCourses(updatedCourses);
      return updatedCourses;
    });
  }

  function openCreateModuleModal() {
    setModuleModalMode('create');
    setModuleActionId(null);
    setModuleTitleInput('');
    setIsModuleModalOpen(true);
  }

  function openEditModuleModal(module) {
    setModuleModalMode('edit');
    setModuleActionId(module.id);
    setModuleTitleInput(module.title);
    setIsModuleModalOpen(true);
  }

  function closeModuleModal() {
    setIsModuleModalOpen(false);
    setModuleActionId(null);
    setModuleTitleInput('');
  }

  function handleSidebarClick(menuId) {
    navigate(`/dashboard?tab=${menuId}`);
  }

  function handleSaveModule() {
    if (!selectedCourse || !moduleTitleInput.trim()) return;

    if (moduleModalMode === 'edit' && moduleActionId) {
      updateInstructorCourses((prev) =>
        prev.map((course) =>
          course.id === selectedCourse.id
            ? {
                ...course,
                modules: course.modules.map((module) =>
                  module.id === moduleActionId
                    ? { ...module, title: moduleTitleInput.trim() }
                    : module,
                ),
              }
            : course,
        ),
      );
      closeModuleModal();
      return;
    }

    const nextModuleId = getNextId(selectedCourse.modules);
    updateInstructorCourses((prev) =>
      prev.map((course) =>
        course.id === selectedCourse.id
          ? {
              ...course,
              modules: [
                ...course.modules,
                { id: nextModuleId, title: moduleTitleInput.trim(), items: [] },
              ],
            }
          : course,
      ),
    );

    setExpandedModuleIds((prev) => (prev.includes(nextModuleId) ? prev : [...prev, nextModuleId]));
    closeModuleModal();
  }

  function handleDeleteModule(moduleId) {
    if (!selectedCourse) return;

    const module = selectedCourse.modules.find((item) => item.id === moduleId);
    requestDeleteAction({
      title: 'Delete Module?',
      message: `This will delete "${module?.title || 'this module'}" from the course.`,
      impact: 'All items inside this module will also be removed. This action cannot be undone.',
      onConfirm: () => {
        updateInstructorCourses((prev) =>
          prev.map((course) =>
            course.id === selectedCourse.id
              ? { ...course, modules: course.modules.filter((item) => item.id !== moduleId) }
              : course,
          ),
        );
      },
    });
  }

  function toggleModuleExpanded(moduleId) {
    setExpandedModuleIds((prev) =>
      prev.includes(moduleId)
        ? prev.filter((id) => id !== moduleId)
        : [...prev, moduleId],
    );
  }

  function handleExpandAll() {
    if (!selectedCourse) return;

    if (expandedModuleIds.length === selectedCourse.modules.length) {
      setExpandedModuleIds([]);
      return;
    }

    setExpandedModuleIds(selectedCourse.modules.map((module) => module.id));
  }

  function reorderModules(course, draggedId, droppedOnId) {
    const draggedIndex = course.modules.findIndex((module) => module.id === draggedId);
    const droppedIndex = course.modules.findIndex((module) => module.id === droppedOnId);

    if (draggedIndex < 0 || droppedIndex < 0 || draggedIndex === droppedIndex) {
      return course.modules;
    }

    const nextModules = [...course.modules];
    const [movedModule] = nextModules.splice(draggedIndex, 1);
    nextModules.splice(droppedIndex, 0, movedModule);
    return nextModules;
  }

  function handleModuleDrop(targetModuleId) {
    if (!selectedCourse || !draggingModuleId || draggingModuleId === targetModuleId) return;

    updateInstructorCourses((prev) =>
      prev.map((course) =>
        course.id === selectedCourse.id
          ? { ...course, modules: reorderModules(course, draggingModuleId, targetModuleId) }
          : course,
      ),
    );

    setDraggingModuleId(null);
  }

  function openAddItemModal(moduleId) {
    setSelectedAssignment(null);
    setSelectedContent(null);
    setItemTargetModuleId(moduleId);
    setItemModalMode('create');
    setEditingItemId(null);
    setModuleItemForm({
      title: '',
      itemType: 'content',
      fileType: 'pdf',
      link: '',
      fileName: '',
      uploadedFiles: [],
      instructions: '',
      openedAt: '',
      dueAt: '',
      allowedFileTypes: ASSIGNMENT_FILE_TYPES,
      maxFileSizeMb: DEFAULT_ASSIGNMENT_MAX_FILE_SIZE_MB,
      allowResubmission: true,
      allowLateSubmission: true,
      questionsCount: '5',
      quizQuestions: [],
      quizInstructions: '',
      quizTimeLimitMinutes: '20',
      quizMaxAttempts: '1',
    });
    setIsItemModalOpen(true);
  }

  function openEditItemModal(moduleId, item) {
    setItemTargetModuleId(moduleId);
    setItemModalMode('edit');
    setEditingItemId(item.id);
    setModuleItemForm({
      title: item.title || '',
      itemType: item.type || 'content',
      fileType: item.fileType || 'pdf',
      link: item.link || '',
      fileName: item.fileName || '',
      uploadedFiles: item.files || [],
      instructions: item.instructions || '',
      openedAt: item.openedAt || '',
      dueAt: item.dueAt || '',
      allowedFileTypes: getAssignmentAllowedTypes(item),
      maxFileSizeMb: getAssignmentMaxFileSizeMb(item),
      allowResubmission: item.allowResubmission !== false,
      allowLateSubmission: item.allowLateSubmission !== false,
      questionsCount: String(item.questionsCount || '5'),
      quizQuestions:
        Array.isArray(item.questions) && item.questions.length ? item.questions : [],
      quizInstructions: item.instructions || '',
      quizTimeLimitMinutes: String(item.timeLimitMinutes || 20),
      quizMaxAttempts: String(item.maxAttempts || 1),
    });
    setIsItemModalOpen(true);
  }

  function closeItemModal() {
    setIsItemModalOpen(false);
    setItemTargetModuleId(null);
    setEditingItemId(null);
    setModuleUploadProgress(0);
    setUploadError('');
  }

  function handleModuleItemFormChange(event) {
    const { name, value, type, checked } = event.target;
    setModuleItemForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  function toggleModuleAssignmentFileType(fileType) {
    setModuleItemForm((prev) => {
      const current = new Set(prev.allowedFileTypes || ASSIGNMENT_FILE_TYPES);
      if (current.has(fileType)) current.delete(fileType);
      else current.add(fileType);
      return { ...prev, allowedFileTypes: current.size ? [...current] : [fileType] };
    });
  }

  async function handleModuleItemFileChange(event) {
    const files = event.target.files;
    if (!files?.length) return;
    await uploadModuleItemFiles(files);
  }

  async function handleAssignmentAttachmentChange(event) {
    const files = event.target.files;
    if (!files?.length) return;
    await uploadAssignmentAttachmentFiles(files);
  }

  async function uploadModuleItemFiles(files) {
    setUploadError('');
    setModuleUploadProgress(1);
    try {
      const uploadedFiles = await uploadFiles(files, setModuleUploadProgress);
      setModuleItemForm((prev) => ({
        ...prev,
        fileName: [...prev.uploadedFiles, ...uploadedFiles].map((file) => file.name).join(', '),
        uploadedFiles: [...prev.uploadedFiles, ...uploadedFiles],
      }));
    } catch (error) {
      setUploadError(error.message || 'Could not upload files.');
    } finally {
      setModuleUploadProgress(0);
    }
  }

  async function uploadAssignmentAttachmentFiles(files) {
    setUploadError('');
    setAssignmentUploadProgress(1);
    try {
      const attachments = await uploadFiles(files, setAssignmentUploadProgress);
      setAssignmentDetailForm((prev) => ({
        ...prev,
        attachments: [...prev.attachments, ...attachments],
      }));
    } catch (error) {
      setUploadError(error.message || 'Could not upload files.');
    } finally {
      setAssignmentUploadProgress(0);
    }
  }

  async function uploadStudentAssignmentFiles(files) {
    setUploadError('');
    const validationError = validateAssignmentFiles(files, selectedAssignmentItem);
    if (validationError) {
      setUploadError(validationError);
      return;
    }
    setStudentUploadProgress(1);
    try {
      const uploadedFiles = await uploadFiles(files, setStudentUploadProgress);
      setStudentAssignmentUploadFiles((prev) => {
        const nextFiles = [...prev];
        uploadedFiles.forEach((file) => {
          const fileKey = getUploadFileKey(file);
          if (!nextFiles.some((existingFile) => getUploadFileKey(existingFile) === fileKey)) {
            nextFiles.push(file);
          }
        });
        return nextFiles;
      });
    } catch (error) {
      setUploadError(error.message || 'Could not upload files.');
    } finally {
      setStudentUploadProgress(0);
    }
  }

  function removeStudentAssignmentUploadFile(fileToRemove) {
    const removeKey = getUploadFileKey(fileToRemove);
    setStudentAssignmentUploadFiles((prev) => prev.filter((file) => getUploadFileKey(file) !== removeKey));
  }

  function handleUploadDragOver(event, zone) {
    event.preventDefault();
    setActiveDropZone(zone);
  }

  function handleUploadDragLeave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setActiveDropZone('');
    }
  }

  function handleUploadDrop(event, zone, uploadHandler) {
    event.preventDefault();
    setActiveDropZone('');
    const files = event.dataTransfer.files;
    if (files?.length) {
      uploadHandler(files);
    }
  }

  function renderUploadProgress(progress) {
    if (!progress) return null;
    const label = progress >= 95
      ? 'Finalizing video processing. Please keep this window open...'
      : `Uploading... ${progress}%`;
    return (
      <div className="uploadProgressWrap" aria-live="polite">
        <div className="uploadProgressTrack">
          <span style={{ width: `${progress}%` }} />
        </div>
        <small>{label}</small>
      </div>
    );
  }

  function renderUploadedFiles(files, options = {}) {
    if (!files.length) return null;
    return (
      <div className="uploadFileGrid">
        {files.map((file) => {
          const fileType = getSubmissionFileType(file);
          const previewUrl = file.previewUrl || file.thumbnailUrl || getFileUrl(file);
          return (
            <div
              key={file.id || file.url || file.name}
              className="uploadFileCard assignmentUploadPreviewCard"
            >
              <button type="button" className="assignmentUploadOpenButton" onClick={() => openStoredFile(file)}>
                {fileType === 'image' ? (
                  <img src={previewUrl} alt="" className="assignmentMiniPreview" />
                ) : fileType === 'video' ? (
                  <span className="assignmentMiniPreview assignmentVideoPreview">Video</span>
                ) : (
                  <span className="uploadFileIcon">{getFileIconLabel(file)}</span>
                )}
                <span>
                  <strong>{file.name || file.originalFilename}</strong>
                  <small>{formatFileSize(file.size) || file.mimeType || 'Uploaded file'}</small>
                </span>
              </button>
              {options.onRemove && (
                <button
                  type="button"
                  className="assignmentUploadRemoveButton"
                  onClick={() => options.onRemove(file)}
                  aria-label={`Remove ${file.name || file.originalFilename}`}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function addQuizQuestion() {
    setModuleItemForm((prev) => ({
      ...prev,
      quizQuestions: [...prev.quizQuestions, getDefaultQuizQuestion(prev.quizQuestions.length + 1)],
    }));
  }

  function removeQuizQuestion(questionId) {
    setModuleItemForm((prev) => {
      const nextQuestions = prev.quizQuestions.filter((question) => question.id !== questionId);
      return {
        ...prev,
        quizQuestions: nextQuestions.length ? nextQuestions : [getDefaultQuizQuestion(1)],
      };
    });
  }

  function updateQuizQuestionText(questionId, value) {
    setModuleItemForm((prev) => ({
      ...prev,
      quizQuestions: prev.quizQuestions.map((question) =>
        question.id === questionId ? { ...question, text: value } : question,
      ),
    }));
  }

  function updateQuizQuestionOption(questionId, optionIndex, value) {
    setModuleItemForm((prev) => ({
      ...prev,
      quizQuestions: prev.quizQuestions.map((question) => {
        if (question.id !== questionId) return question;
        const nextOptions = [...question.options];
        nextOptions[optionIndex] = value;
        return { ...question, options: nextOptions };
      }),
    }));
  }

  function updateQuizQuestionAnswer(questionId, answerIndex) {
    setModuleItemForm((prev) => ({
      ...prev,
      quizQuestions: prev.quizQuestions.map((question) =>
        question.id === questionId ? { ...question, answer: Number(answerIndex) } : question,
      ),
    }));
  }

  function handleSaveModuleItem() {
    if (!selectedCourse || !itemTargetModuleId || !moduleItemForm.title.trim()) return;
    if (moduleUploadProgress) {
      setUploadError('Please wait for the upload to finish before adding this item.');
      return;
    }

    updateInstructorCourses((prev) =>
      prev.map((course) => {
        if (course.id !== selectedCourse.id) return course;

        return {
          ...course,
          modules: course.modules.map((module) => {
            if (module.id !== itemTargetModuleId) return module;

            const isEditing = itemModalMode === 'edit' && editingItemId;
            const nextItemId = isEditing ? editingItemId : getNextId(module.items);

            const baseItem = {
              id: nextItemId,
              title: moduleItemForm.title.trim(),
              type: moduleItemForm.itemType,
              isDelivered: false,
            };

            if (moduleItemForm.itemType === 'assignment') {
              const nextAssignment = {
                ...baseItem,
                instructions: moduleItemForm.instructions.trim(),
                gradingStatus: 'Not graded',
                requiresStudentUpload: true,
                submissionOpen: true,
                fileSubmissionEnabled: true,
                allowedFileTypes: moduleItemForm.allowedFileTypes || ASSIGNMENT_FILE_TYPES,
                maxFileSizeMb: Number(moduleItemForm.maxFileSizeMb) || DEFAULT_ASSIGNMENT_MAX_FILE_SIZE_MB,
                allowResubmission: moduleItemForm.allowResubmission !== false,
                allowLateSubmission: moduleItemForm.allowLateSubmission !== false,
                attachments: [],
                submissions: getDefaultAssignmentSubmissions(),
                openedAt: moduleItemForm.openedAt,
                dueAt: moduleItemForm.dueAt,
              };

              return {
                ...module,
                items: isEditing
                  ? module.items.map((item) => (item.id === editingItemId ? nextAssignment : item))
                  : [...module.items, nextAssignment],
              };
            }

            if (moduleItemForm.itemType === 'quiz') {
              const quizQuestions = moduleItemForm.quizQuestions.map((question, index) => ({
                id: index + 1,
                text: question.text || `Question ${index + 1}`,
                options: question.options.map((option, optionIndex) =>
                  option.trim() ? option : `Option ${optionIndex + 1}`,
                ),
                answer: Number.isInteger(question.answer) ? question.answer : 0,
              }));
              const existingItem = isEditing
                ? module.items.find((it) => it.id === editingItemId)
                : null;
              const nextQuiz = {
                ...baseItem,
                questionsCount: quizQuestions.length,
                questions: quizQuestions,
                attempts: existingItem?.attempts || [],
                instructions: moduleItemForm.quizInstructions.trim(),
                timeLimitMinutes: Number(moduleItemForm.quizTimeLimitMinutes) > 0
                  ? Number(moduleItemForm.quizTimeLimitMinutes)
                  : 20,
                maxAttempts: Number(moduleItemForm.quizMaxAttempts) > 0
                  ? Number(moduleItemForm.quizMaxAttempts)
                  : 1,
                openedAt: moduleItemForm.openedAt,
                dueAt: moduleItemForm.dueAt,
              };

              return {
                ...module,
                items: isEditing
                  ? module.items.map((item) =>
                      item.id === editingItemId
                        ? { ...item, ...nextQuiz, attempts: item.attempts || [] }
                        : item,
                    )
                  : [...module.items, nextQuiz],
              };
            }

            const nextContent = {
              ...baseItem,
              fileType: moduleItemForm.fileType,
              link: moduleItemForm.link.trim(),
              fileName: moduleItemForm.fileName,
              files: moduleItemForm.uploadedFiles,
            };

            return {
              ...module,
              items: isEditing
                ? module.items.map((item) => (item.id === editingItemId ? nextContent : item))
                : [...module.items, nextContent],
            };
          }),
        };
      }),
    );

    closeItemModal();
  }

  function deleteItem(moduleId, itemId) {
    if (!selectedCourse) return;

    const targetModule = selectedCourse.modules.find((module) => module.id === moduleId);
    const targetItem = targetModule?.items.find((item) => item.id === itemId);
    requestDeleteAction({
      title: 'Delete Course Item?',
      message: `This will delete "${targetItem?.title || 'this item'}" from the module.`,
      impact: 'Students will no longer see this content, assignment, or quiz in the course. This action cannot be undone.',
      onConfirm: () => {
        updateInstructorCourses((prev) =>
          prev.map((course) =>
            course.id === selectedCourse.id
              ? {
                  ...course,
                  modules: course.modules.map((module) =>
                    module.id === moduleId
                      ? {
                          ...module,
                          items: module.items.filter((item) => item.id !== itemId),
                        }
                      : module,
                  ),
                }
              : course,
          ),
        );
      },
    });
  }

  function openStoredFile(file) {
    if (!getFileUrl(file)) return;
    setPreviewFile(file);
  }

  function closePreviewFile() {
    setPreviewFile(null);
  }

  function openContentItem(item) {
    return item;
  }

  function handleSearchResultClick(result) {
    setExpandedModuleIds((prev) =>
      prev.includes(result.moduleId) ? prev : [...prev, result.moduleId],
    );
  }

  function handleAssignmentClick(moduleId, item) {
    setSelectedContent(null);
    setSelectedContentFileId(null);
    setSelectedAssignment({ moduleId, itemId: item.id });
    setExpandedModuleIds((prev) => (prev.includes(moduleId) ? prev : [...prev, moduleId]));
    setAssignmentDetailForm({
      instructions: item.instructions || '',
      gradingStatus: item.gradingStatus || 'Not graded',
      requiresStudentUpload: item.requiresStudentUpload ?? true,
      submissionOpen:
        item.submissionOpen ?? !shouldAutoCloseSubmission(item.dueAt),
      fileSubmissionEnabled: item.fileSubmissionEnabled ?? false,
      openedAt: item.openedAt || '',
      dueAt: item.dueAt || '',
      allowedFileTypes: getAssignmentAllowedTypes(item),
      maxFileSizeMb: getAssignmentMaxFileSizeMb(item),
      allowResubmission: item.allowResubmission !== false,
      allowLateSubmission: item.allowLateSubmission !== false,
      attachments: item.attachments || [],
      submissions: item.submissions || getDefaultAssignmentSubmissions(),
    });
    setAssignmentEditorMode(
      canManageContent ? (hasAssignmentDetails(item) ? 'view' : 'edit') : 'view',
    );

    if (selectedCourse) {
      const key = activityKey(selectedCourse.id, item.id);
      const request = canManageContent
        ? fetchAssignmentSubmissions(selectedCourse.id, item.id)
        : fetchMyAssignmentSubmission(selectedCourse.id, item.id).then((submission) =>
            submission ? [submission] : [],
          );

      request
        .then((submissions) => {
          setAssignmentSubmissionsByKey((prev) => ({ ...prev, [key]: submissions }));
          setCourseSyncMessage('');
        })
        .catch((error) => setCourseSyncMessage(`Could not load assignment submissions: ${error.message}`));
    }
  }

  function handleContentClick(moduleId, item) {
    setSelectedAssignment(null);
    setSelectedContent({ moduleId, itemId: item.id });
    setSelectedContentFileId(item.files?.[0]?.id || null);
    setSelectedQuiz(null);
    setQuizAnswers({});
    setQuizResult(null);
    setExpandedModuleIds((prev) => (prev.includes(moduleId) ? prev : [...prev, moduleId]));
    if (isStudent && selectedCourse) {
      openContent(selectedCourse.id, item.id).catch((error) =>
        setCourseSyncMessage(`Could not record content activity: ${error.message}`),
      );
      saveContentTime(selectedCourse.id, item.id, 1).catch(() => {});
    }
    markStudentItemCompleted(item.id);
  }

  function markStudentItemCompleted(itemId) {
    if (!isStudent || !selectedCourse) return;

    saveProgressRequest(selectedCourse.id, itemId, true)
      .then((updatedProgress) => {
        setStudentProgress(updatedProgress);
        saveStoredStudentProgress(updatedProgress);
        setCourseSyncMessage('');
      })
      .catch((error) => {
        setCourseSyncMessage(`Could not save progress: ${error.message}`);
      });
  }

  function getQuizQuestions(quizItem) {
    if (Array.isArray(quizItem?.questions) && quizItem.questions.length) {
      return quizItem.questions.map((q, index) => ({
        id: q.id ?? index + 1,
        text: q.text || '',
        options: Array.isArray(q.options) ? q.options : ['', '', '', ''],
        answer: Number.isInteger(q.answer) ? q.answer : 0,
        points: Number.isFinite(Number(q.points)) ? Number(q.points) : 1,
      }));
    }
    return [];
  }

  function handleQuizClick(moduleId, item) {
    setSelectedAssignment(null);
    setSelectedContent(null);
    setSelectedQuiz({ moduleId, itemId: item.id });
    setQuizStarted(false);
    setQuizQuestionEditorMode('view');
    setQuizQuestionEditor([]);
    setQuizAnswers({});
    setQuizResult(null);
    setQuizTimeoutNotice('');
    setExpandedModuleIds((prev) => (prev.includes(moduleId) ? prev : [...prev, moduleId]));

    if (selectedCourse) {
      const loadAttempts = canManageContent ? fetchQuizAttempts : fetchMyQuizAttempts;

      loadAttempts(selectedCourse.id, item.id)
        .then((attempts) => {
          setQuizAttemptsByKey((prev) => ({
            ...prev,
            [activityKey(selectedCourse.id, item.id)]: attempts,
          }));
          setCourseSyncMessage('');
        })
        .catch((error) => setCourseSyncMessage(`Could not load quiz attempts: ${error.message}`));
    }
  }

  function startQuizAttempt() {
    if (!selectedQuizItem) return;
    const max = Number(selectedQuizItem.maxAttempts) > 0 ? Number(selectedQuizItem.maxAttempts) : 1;
    const used = studentQuizAttempt?.attemptCount || 0;
    // Defensive guard — UI also disables the button, but never start a fresh attempt past the limit.
    if (used >= max) return;

    setQuizAnswers({});
    setQuizResult(null);
    setQuizTimeoutNotice('');
    quizAttemptSubmittedRef.current = false;
    quizStartAtMsRef.current = Date.now();
    const limitMinutes = Number(selectedQuizItem?.timeLimitMinutes) > 0 ? Number(selectedQuizItem?.timeLimitMinutes) : 20;
    setQuizTimeLeftSec(limitMinutes * 60);
    setQuizStarted(true);
  }

  function backToQuizInstructions() {
    setQuizStarted(false);
    setQuizTimeLeftSec(null);
    quizStartAtMsRef.current = null;
    quizAttemptSubmittedRef.current = false;
    setQuizResult(null);
    setQuizTimeoutNotice('');
  }

  function retryQuiz() {
    if (!selectedQuizItem) return;
    const max = Number(selectedQuizItem.maxAttempts) > 0 ? Number(selectedQuizItem.maxAttempts) : 1;
    const used = studentQuizAttempt?.attemptCount || 0;
    // Defensive: never let a retry happen once attempts are exhausted.
    if (used >= max) return;

    setQuizResult(null);
    setQuizTimeoutNotice('');
    setQuizAnswers({});
    quizAttemptSubmittedRef.current = false;
    quizStartAtMsRef.current = Date.now();
    const limitMinutes = Number(selectedQuizItem?.timeLimitMinutes) > 0
      ? Number(selectedQuizItem.timeLimitMinutes)
      : 20;
    setQuizTimeLeftSec(limitMinutes * 60);
    setQuizStarted(true);
  }

  useEffect(() => {
    if (!isStudent || !quizStarted || !selectedQuizItem || quizResult) return;

    const limitMinutes =
      Number(selectedQuizItem?.timeLimitMinutes) > 0
        ? Number(selectedQuizItem.timeLimitMinutes)
        : 20;
    const totalSeconds = limitMinutes * 60;
    const startAtMs = quizStartAtMsRef.current ?? Date.now();

    // Set immediately so UI doesn't wait 1s for the first tick.
    const leftNow = Math.max(0, totalSeconds - Math.floor((Date.now() - startAtMs) / 1000));
    setQuizTimeLeftSec(leftNow);

    const intervalId = window.setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startAtMs) / 1000);
      const left = Math.max(0, totalSeconds - elapsedSec);
      setQuizTimeLeftSec(left);

      if (left <= 0 && !quizAttemptSubmittedRef.current) {
        // Pause timer immediately so the UI freezes at 00:00.
        window.clearInterval(intervalId);
        quizTimerIdRef.current = null;
        submitQuiz({ autoSubmitted: true });
      }
    }, 1000);

    quizTimerIdRef.current = intervalId;

    return () => {
      window.clearInterval(intervalId);
      if (quizTimerIdRef.current === intervalId) {
        quizTimerIdRef.current = null;
      }
    };
  }, [isStudent, quizStarted, selectedQuizItem, quizResult]);

  function cloneQuizQuestions(questions) {
    if (!Array.isArray(questions)) return [];
    return questions.map((q) => ({
      id: q.id,
      text: q.text || '',
      options: Array.isArray(q.options) ? q.options : ['', '', '', ''],
      answer: Number.isInteger(q.answer) ? q.answer : 0,
      points: Number.isFinite(Number(q.points)) ? Number(q.points) : 1,
    }));
  }

  function openQuizQuestionsEditor() {
    if (!selectedQuizItem || !selectedQuiz) return;
    const current = cloneQuizQuestions(selectedQuizItem.questions);
    if (current.length) {
      setQuizQuestionEditor(current);
    } else {
      setQuizQuestionEditor([getDefaultQuizQuestion(1)]);
    }
    setQuizQuestionEditorMode('edit');
  }

  function cancelQuizQuestionsEditor() {
    setQuizQuestionEditorMode('view');
    setQuizQuestionEditor([]);
  }

  function getNextQuestionId(questions) {
    if (!Array.isArray(questions) || questions.length === 0) return 1;
    return Math.max(...questions.map((q) => (Number(q.id) ? Number(q.id) : 0))) + 1;
  }

  function addQuizQuestionEditor() {
    setQuizQuestionEditor((prev) => [
      ...prev,
      getDefaultQuizQuestion(getNextQuestionId(prev)),
    ]);
  }

  function removeQuizQuestionEditor(questionId) {
    requestDeleteAction({
      title: 'Remove Quiz Question?',
      message: 'This will remove the question from the quiz editor.',
      impact: 'The question will be lost from this draft unless you cancel this action.',
      onConfirm: () => {
        setQuizQuestionEditor((prev) => prev.filter((q) => q.id !== questionId));
      },
    });
  }

  function updateQuizQuestionEditorText(questionId, value) {
    setQuizQuestionEditor((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, text: value } : q)),
    );
  }

  function updateQuizQuestionEditorOption(questionId, optionIndex, value) {
    setQuizQuestionEditor((prev) =>
      prev.map((q) => {
        if (q.id !== questionId) return q;
        const nextOptions = [...q.options];
        nextOptions[optionIndex] = value;
        return { ...q, options: nextOptions };
      }),
    );
  }

  function updateQuizQuestionEditorAnswer(questionId, answerIndex) {
    setQuizQuestionEditor((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, answer: answerIndex } : q)),
    );
  }

  function updateQuizQuestionEditorPoints(questionId, pointsValue) {
    setQuizQuestionEditor((prev) =>
      prev.map((q) => {
        if (q.id !== questionId) return q;
        const parsed = Number(pointsValue);
        return { ...q, points: Number.isFinite(parsed) && parsed > 0 ? parsed : 1 };
      }),
    );
  }

  function saveQuizQuestionsEditor() {
    if (!selectedCourse || !selectedQuizItem || !selectedQuiz) return;
    updateInstructorCourses((prev) =>
      prev.map((course) => {
        if (course.id !== selectedCourse.id) return course;
        return {
          ...course,
          modules: course.modules.map((module) => {
            if (module.id !== selectedQuiz.moduleId) return module;
            return {
              ...module,
              items: module.items.map((item) => {
                if (item.id !== selectedQuiz.itemId) return item;
                return {
                  ...item,
                      questions: quizQuestionEditor.map((q) => ({
                        ...q,
                        points: Number.isFinite(Number(q.points)) ? Number(q.points) : 1,
                      })),
                  questionsCount: quizQuestionEditor.length,
                };
              }),
            };
          }),
        };
      }),
    );
    cancelQuizQuestionsEditor();
  }

  function updateQuizAnswer(questionId, optionIndex) {
    setQuizAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  }

  useEffect(() => {
    quizAnswersRef.current = quizAnswers;
  }, [quizAnswers]);

  function submitQuiz(options) {
    // Accepts an event (from onClick) or an options object. Only read `autoSubmitted` if present.
    const autoSubmitted = Boolean(options && options.autoSubmitted === true);

    if (!selectedQuizItem) return;
    if (quizAttemptSubmittedRef.current) return;
    quizAttemptSubmittedRef.current = true;

    // Pause the countdown immediately so the timer UI freezes at the moment of submission.
    if (quizTimerIdRef.current) {
      window.clearInterval(quizTimerIdRef.current);
      quizTimerIdRef.current = null;
    }

    const existingAttempt = (selectedQuizItem.attempts || []).find(
      (attempt) => attempt.studentEmail === userEmail,
    );
    const maxAttempts = Number(selectedQuizItem.maxAttempts) > 0 ? Number(selectedQuizItem.maxAttempts) : 1;
    const attemptCount = existingAttempt?.attemptCount || 0;
    if (isStudent && attemptCount >= maxAttempts) return;
    const questions = getQuizQuestions(selectedQuizItem);
    if (!questions.length) return;
    const totalPoints = questions.reduce((sum, q) => {
      const p = Number.isFinite(Number(q.points)) ? Number(q.points) : 1;
      return sum + (p > 0 ? p : 1);
    }, 0);

    let score = 0;
    const answers = quizAnswersRef.current || quizAnswers;
    questions.forEach((question) => {
      const p = Number.isFinite(Number(question.points)) ? Number(question.points) : 1;
      const safePoints = p > 0 ? p : 1;
      if (answers[question.id] === question.answer) score += safePoints;
    });

    const percent = totalPoints ? Math.round((score / totalPoints) * 100) : 0;
    const passed = percent >= 50;
    const attemptNumber = attemptCount + 1;
    setQuizResult({
      score,
      total: totalPoints,
      percent,
      passed,
      autoSubmitted,
      attemptNumber,
      maxAttempts,
    });
    if (autoSubmitted) {
      setQuizTimeoutNotice('Time is up. Your quiz was auto-submitted with your saved answers.');
    }
    if (isStudent && selectedCourse && currentUser) {
      submitQuizAttemptRequest(selectedCourse.id, selectedQuiz.itemId, {
        answers,
        startedAt: quizStartAtMsRef.current
          ? new Date(quizStartAtMsRef.current).toISOString()
          : undefined,
        durationSeconds: quizStartAtMsRef.current
          ? Math.floor((Date.now() - quizStartAtMsRef.current) / 1000)
          : 0,
        autoSubmitted,
      })
        .then((savedAttempt) => {
          const key = activityKey(selectedCourse.id, selectedQuiz.itemId);
          setQuizAttemptsByKey((prev) => ({
            ...prev,
            [key]: [...(prev[key] || []), savedAttempt],
          }));
          setCourseSyncMessage('');
        })
        .catch((error) => setCourseSyncMessage(`Could not save quiz attempt: ${error.message}`));
    }
    if (passed) {
      markStudentItemCompleted(selectedQuizItem.id);
    }
  }

  function handleAssignmentFormChange(event) {
    const { name, value, type, checked } = event.target;
    setAssignmentDetailForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  function toggleAssignmentFileType(fileType) {
    setAssignmentDetailForm((prev) => {
      const current = new Set(prev.allowedFileTypes || ASSIGNMENT_FILE_TYPES);
      if (current.has(fileType)) current.delete(fileType);
      else current.add(fileType);
      return { ...prev, allowedFileTypes: current.size ? [...current] : [fileType] };
    });
  }

  function removeAssignmentAttachment(fileId) {
    requestDeleteAction({
      title: 'Remove Attachment?',
      message: 'This will remove the attachment from the assignment draft.',
      impact: 'Students will not see this attachment after you save the assignment changes.',
      onConfirm: () => {
        setAssignmentDetailForm((prev) => ({
          ...prev,
          attachments: prev.attachments.filter((file) => file.id !== fileId),
        }));
      },
    });
  }

  function updateAssignmentSubmissionGrade(submissionId, gradeValue, feedbackValue = '') {
    if (!selectedCourse || !selectedAssignment) return;

    gradeAssignmentSubmission(submissionId, { grade: gradeValue, feedback: feedbackValue })
      .then((updatedSubmission) => {
        const key = activityKey(selectedCourse.id, selectedAssignment.itemId);
        setAssignmentSubmissionsByKey((prev) => ({
          ...prev,
          [key]: (prev[key] || []).map((submission) =>
            submission._id === updatedSubmission._id ? updatedSubmission : submission,
          ),
        }));
        setCourseSyncMessage('');
      })
      .catch((error) => setCourseSyncMessage(`Could not grade assignment: ${error.message}`));
  }

  function updateGradingDraft(submissionId, field, value, baseDraft = {}) {
    setGradingDrafts((prev) => ({
      ...prev,
      [submissionId]: {
        grade: prev[submissionId]?.grade ?? baseDraft.grade ?? '',
        feedback: prev[submissionId]?.feedback ?? baseDraft.feedback ?? '',
        [field]: value,
      },
    }));
  }

  function deleteStudentSubmission() {
    if (!selectedCourse || !selectedAssignment || !myAssignmentSubmission) return;

    deleteAssignmentSubmission(myAssignmentSubmission._id || myAssignmentSubmission.id)
      .then(() => {
        const key = activityKey(selectedCourse.id, selectedAssignment.itemId);
        const deletedId = myAssignmentSubmission._id || myAssignmentSubmission.id;
        setAssignmentSubmissionsByKey((prev) => ({
          ...prev,
          [key]: (prev[key] || []).filter((submission) => (submission._id || submission.id) !== deletedId),
        }));
        setCourseSyncMessage('');
      })
      .catch((error) => setCourseSyncMessage(`Could not remove submission: ${error.message}`));
  }

  async function handleStudentAssignmentUploadChange(event) {
    const files = event.target.files;
    if (!files?.length) return;
    await uploadStudentAssignmentFiles(files);
  }

  function submitStudentAssignment() {
    if (!selectedCourse || !selectedAssignment || !currentUser) return;
    if (myAssignmentSubmission && selectedAssignmentItem?.allowResubmission === false) {
      setCourseSyncMessage('This assignment does not allow resubmission.');
      return;
    }

    submitAssignmentRequest(selectedCourse.id, selectedAssignment.itemId, {
      files: studentAssignmentUploadFiles,
    })
      .then((submission) => {
        const key = activityKey(selectedCourse.id, selectedAssignment.itemId);
        setAssignmentSubmissionsByKey((prev) => ({
          ...prev,
          [key]: [
            ...(prev[key] || []).filter((item) => item._id !== submission._id),
            submission,
          ],
        }));
        setStudentAssignmentUploadFiles([]);
        setCourseSyncMessage('');
      })
      .catch((error) => setCourseSyncMessage(`Could not submit assignment: ${error.message}`));
  }

  function saveAssignmentDetails() {
    if (!selectedCourse || !selectedAssignment) return;

    const nextSubmissionOpen = shouldAutoCloseSubmission(assignmentDetailForm.dueAt)
      ? false
      : assignmentDetailForm.submissionOpen;

    updateInstructorCourses((prev) =>
      prev.map((course) =>
        course.id === selectedCourse.id
          ? {
              ...course,
              modules: course.modules.map((module) =>
                module.id === selectedAssignment.moduleId
                  ? {
                      ...module,
                      items: module.items.map((item) =>
                        item.id === selectedAssignment.itemId
                          ? {
                              ...item,
                              instructions: assignmentDetailForm.instructions.trim(),
                              gradingStatus: assignmentDetailForm.gradingStatus,
                              requiresStudentUpload: assignmentDetailForm.requiresStudentUpload,
                              submissionOpen: nextSubmissionOpen,
                              fileSubmissionEnabled: assignmentDetailForm.fileSubmissionEnabled,
                              allowedFileTypes: assignmentDetailForm.allowedFileTypes,
                              maxFileSizeMb: Number(assignmentDetailForm.maxFileSizeMb) || DEFAULT_ASSIGNMENT_MAX_FILE_SIZE_MB,
                              allowResubmission: assignmentDetailForm.allowResubmission,
                              allowLateSubmission: assignmentDetailForm.allowLateSubmission,
                              openedAt: assignmentDetailForm.openedAt,
                              dueAt: assignmentDetailForm.dueAt,
                              attachments: assignmentDetailForm.attachments,
                              submissions: assignmentDetailForm.submissions,
                            }
                          : item,
                      ),
                    }
                  : module,
              ),
            }
          : course,
      ),
    );

    setAssignmentEditorMode('view');
  }

  return (
    <section className="dashboardShell">
      <Toast message={deleteToastMessage} />
      <aside className="dashboardSidebar">
        <h3 className="dashboardSidebarTitle">Dashboard Menu</h3>
        <nav className="dashboardSidebarNav">
          {menuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`dashboardMenuButton${item.id === coursesPageActiveMenuId ? ' dashboardMenuButtonActive' : ''}`}
              onClick={() => handleSidebarClick(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="dashboardMain">
        <main className="dashboardContent coursesPageContent">
          {courseSyncMessage && <p className="errorText formError">{courseSyncMessage}</p>}
          {uploadError && <p className="errorText formError">{uploadError}</p>}

          {!selectedCourse ? (
            <section className="dashboardPanel">
              <h3>No course selected</h3>
              <p>Create a course first from the My Courses panel, then open it here to manage modules.</p>
            </section>
          ) : selectedAssignmentItem ? (
            <>
              <div className="coursesPageHeader">
                <div>
                  <h2>{selectedCourse?.title || 'Untitled Course'}</h2>
                  <p>{selectedCourse?.description || 'No description available.'}</p>
                </div>
                <button
                  type="button"
                  className="heroButton heroButtonSecondary"
                  onClick={() => setSelectedAssignment(null)}
                >
                  Back to Modules
                </button>
              </div>

              <section
                id={`course-detail-assignment-${selectedAssignmentItem.id}`}
                className="assignmentWorkspace assignmentWorkspaceStandalone notificationScrollTarget"
              >
                <div className="assignmentWorkspaceHeader">
                  <div>
                    <p className="assignmentWorkspaceEyebrow">Assignment Workspace</p>
                    <h3>{selectedAssignmentItem.title}</h3>
                  </div>
                  {canManageContent && assignmentEditorMode === 'view' && (
                    <div className="assignmentWorkspaceActions">
                      <button type="button" className="profilePrimaryButton" onClick={() => setAssignmentEditorMode('edit')}>
                        Edit Details
                      </button>
                      <button type="button" className="heroButton heroButtonSecondary" onClick={() => setAssignmentEditorMode('edit')}>
                        Extend Due Date
                      </button>
                    </div>
                  )}
                </div>

                {canManageContent && assignmentEditorMode === 'edit' ? (
                  <div className="assignmentEditorCard">
                    <div className="authForm">
                      <label htmlFor="assignment-instructions">Description / Instruction</label>
                      <textarea
                        id="assignment-instructions"
                        name="instructions"
                        rows={4}
                        value={assignmentDetailForm.instructions}
                        onChange={handleAssignmentFormChange}
                        placeholder="Add clear assignment instructions for students..."
                      />

                      <label htmlFor="assignment-grading">Grading status</label>
                      <select
                        id="assignment-grading"
                        name="gradingStatus"
                        value={assignmentDetailForm.gradingStatus}
                        onChange={handleAssignmentFormChange}
                      >
                        {ASSIGNMENT_GRADING_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>

                      <label htmlFor="assignment-opened">Opened / uploaded on</label>
                      <input
                        id="assignment-opened"
                        type="datetime-local"
                        name="openedAt"
                        value={assignmentDetailForm.openedAt}
                        onChange={handleAssignmentFormChange}
                      />

                      <label htmlFor="assignment-due">Due date &amp; time</label>
                      <input
                        id="assignment-due"
                        type="datetime-local"
                        name="dueAt"
                        value={assignmentDetailForm.dueAt}
                        onChange={handleAssignmentFormChange}
                      />

                      <label className="assignmentCheckboxRow">
                        <input
                          type="checkbox"
                            name="requiresStudentUpload"
                            checked={assignmentDetailForm.requiresStudentUpload}
                            onChange={handleAssignmentFormChange}
                          />
                          <span>Requires Student Upload</span>
                        </label>

                        <label className="assignmentCheckboxRow">
                          <input
                            type="checkbox"
                            name="submissionOpen"
                            checked={shouldAutoCloseSubmission(assignmentDetailForm.dueAt) ? false : assignmentDetailForm.submissionOpen}
                            onChange={handleAssignmentFormChange}
                          />
                          <span>
                            Submission {shouldAutoCloseSubmission(assignmentDetailForm.dueAt)
                              ? 'Closed automatically after due date'
                              : assignmentDetailForm.submissionOpen ? 'Open' : 'Closed'}
                          </span>
                        </label>

                        <label className="assignmentCheckboxRow">
                          <input
                            type="checkbox"
                          name="fileSubmissionEnabled"
                          checked={assignmentDetailForm.fileSubmissionEnabled}
                          onChange={handleAssignmentFormChange}
                        />
                        <span>Enable file submission</span>
                      </label>

                      <label htmlFor="assignment-max-file-size">Max file size per file (MB)</label>
                      <input
                        id="assignment-max-file-size"
                        type="number"
                        min="1"
                        max="250"
                        name="maxFileSizeMb"
                        value={assignmentDetailForm.maxFileSizeMb}
                        onChange={handleAssignmentFormChange}
                      />

                      <div className="assignmentPolicyGroup">
                        <span className="assignmentPolicyLabel">Allowed file types</span>
                        <div className="assignmentFileTypeGrid">
                          {ASSIGNMENT_FILE_TYPES.map((fileType) => (
                            <label key={fileType} className="assignmentTypeChip">
                              <input
                                type="checkbox"
                                checked={(assignmentDetailForm.allowedFileTypes || []).includes(fileType)}
                                onChange={() => toggleAssignmentFileType(fileType)}
                              />
                              <span>{fileType.toUpperCase()}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <label className="assignmentCheckboxRow">
                        <input
                          type="checkbox"
                          name="allowResubmission"
                          checked={assignmentDetailForm.allowResubmission}
                          onChange={handleAssignmentFormChange}
                        />
                        <span>Allow students to replace submissions before the deadline</span>
                      </label>

                      <label className="assignmentCheckboxRow">
                        <input
                          type="checkbox"
                          name="allowLateSubmission"
                          checked={assignmentDetailForm.allowLateSubmission}
                          onChange={handleAssignmentFormChange}
                        />
                        <span>Allow late submissions and mark them as late</span>
                      </label>

                      <label htmlFor="assignment-files">Upload supporting content</label>
                      <div
                        className={`uploadDropZone ${activeDropZone === 'assignment' ? 'uploadDropZoneActive' : ''}`}
                        onDragOver={(event) => handleUploadDragOver(event, 'assignment')}
                        onDragLeave={handleUploadDragLeave}
                        onDrop={(event) => handleUploadDrop(event, 'assignment', uploadAssignmentAttachmentFiles)}
                      >
                        <span className="uploadDropIcon">Attach</span>
                        <strong>Drop assignment files here</strong>
                        <p>Keep instructions lightweight and attach files as cloud URLs for fast student access.</p>
                        <input
                          id="assignment-files"
                          type="file"
                          multiple
                          accept=".doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.pdf,.mp4,.webm"
                          onChange={handleAssignmentAttachmentChange}
                        />
                      </div>
                      {renderUploadProgress(assignmentUploadProgress)}
                    </div>

                    {assignmentDetailForm.attachments.length > 0 && (
                      <div className="uploadFileGrid">
                        {assignmentDetailForm.attachments.map((file) => (
                          <div key={file.id || file.url || file.name} className="assignmentAttachmentChip uploadFileCard">
                            <button
                              type="button"
                              className="courseInlineFileButton uploadFileOpenButton"
                              onClick={() => openStoredFile(file)}
                            >
                              <span className="uploadFileIcon">{getFileIconLabel(file)}</span>
                              {file.name}
                            </button>
                            <button
                              type="button"
                              className="assignmentAttachmentRemoveButton"
                              onClick={() => removeAssignmentAttachment(file.id)}
                              aria-label={`Remove ${file.name}`}
                            >
                              x
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="profileModalActions">
                      <button type="button" className="profilePrimaryButton" onClick={saveAssignmentDetails}>
                        Save Assignment
                      </button>
                      <button type="button" className="heroButton heroButtonSecondary" onClick={() => setAssignmentEditorMode('view')}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="assignmentSummaryGrid">
                      <article>
                        <h4>Assignment Name</h4>
                        <p>{selectedAssignmentItem.title}</p>
                      </article>
                      <article>
                        <h4>Assignment Timeline</h4>
                        <p>
                          {selectedAssignmentItem.openedAt
                            ? formatDateTimeLabel(selectedAssignmentItem.openedAt)
                            : 'Not set'}{' '}
                          to{' '}
                          {selectedAssignmentItem.dueAt
                            ? formatDateTimeLabel(selectedAssignmentItem.dueAt)
                            : 'Not set'}
                        </p>
                      </article>
                      <article>
                        <h4>Grading Status</h4>
                        <p>{selectedAssignmentItem.gradingStatus || 'Not graded'}</p>
                      </article>
                      <article>
                        <h4>Requires Student Upload</h4>
                        <p>{selectedAssignmentItem.requiresStudentUpload ? 'Yes' : 'No submission required'}</p>
                      </article>
                      <article>
                        <h4>Submission Control</h4>
                        <p>
                          {shouldAutoCloseSubmission(selectedAssignmentItem.dueAt)
                            ? 'Closed'
                            : selectedAssignmentItem.submissionOpen ? 'Open' : 'Closed'}
                        </p>
                      </article>
                      <article>
                        <h4>File Submission</h4>
                        <p>
                          {selectedAssignmentItem.fileSubmissionEnabled
                            ? `${getAssignmentAllowedTypes(selectedAssignmentItem).map((type) => type.toUpperCase()).join(', ')} up to ${getAssignmentMaxFileSizeMb(selectedAssignmentItem)} MB`
                            : 'Disabled'}
                        </p>
                      </article>
                    </div>

                    <section className="assignmentDetailPanel">
                      <h4>Description / Instruction</h4>
                      <p>{selectedAssignmentItem.instructions || 'No description added yet.'}</p>

                      {!canManageContent && selectedAssignmentItem.requiresStudentUpload && (
                        <div className="assignmentEditorCard">
                          <div className="assignmentStudentSubmissionHeader">
                            <div>
                              <h4>Submit Assignment</h4>
                              <p>
                                Allowed: {getAssignmentAllowedTypes(selectedAssignmentItem).map((type) => type.toUpperCase()).join(', ')}
                                {' '}| Max {getAssignmentMaxFileSizeMb(selectedAssignmentItem)} MB per file
                              </p>
                            </div>
                            <span className={`assignmentStatusChip assignmentStatus-${getStudentSubmissionStatus(myAssignmentSubmission, selectedAssignmentItem)}`}>
                              {getSubmissionStatusLabel(getStudentSubmissionStatus(myAssignmentSubmission, selectedAssignmentItem))}
                            </span>
                          </div>
                          {myAssignmentSubmission?.files?.length > 0 && (
                            <div className="assignmentCurrentSubmission">
                              <strong>Current submission</strong>
                              {renderUploadedFiles(myAssignmentSubmission.files)}
                              {myAssignmentSubmission.feedback && <p className="assignmentFeedbackText">Feedback: {myAssignmentSubmission.feedback}</p>}
                              {!isAssignmentClosed(selectedAssignmentItem) && selectedAssignmentItem.allowResubmission !== false && (
                                <button type="button" className="profileDangerButton" onClick={deleteStudentSubmission}>
                                  Remove Submission
                                </button>
                              )}
                            </div>
                          )}
                          <div className="authForm">
                            <label htmlFor="student-assignment-files">Upload your files</label>
                            <div
                              className={`uploadDropZone ${activeDropZone === 'student-assignment' ? 'uploadDropZoneActive' : ''}`}
                              onDragOver={(event) => handleUploadDragOver(event, 'student-assignment')}
                              onDragLeave={handleUploadDragLeave}
                              onDrop={(event) => {
                                if (
                                  isAssignmentClosed(selectedAssignmentItem) ||
                                  (myAssignmentSubmission && selectedAssignmentItem.allowResubmission === false)
                                ) {
                                  return;
                                }
                                handleUploadDrop(event, 'student-assignment', uploadStudentAssignmentFiles);
                              }}
                            >
                              <span className="uploadDropIcon">Submit</span>
                              <strong>Drop your files here or browse</strong>
                              <p>Your files upload first, then the assignment submission stores secure file links.</p>
                              <input
                                id="student-assignment-files"
                                type="file"
                                multiple
                                accept={ASSIGNMENT_FILE_ACCEPT}
                                onChange={handleStudentAssignmentUploadChange}
                                disabled={
                                  isAssignmentClosed(selectedAssignmentItem) ||
                                  (myAssignmentSubmission && selectedAssignmentItem.allowResubmission === false)
                                }
                              />
                            </div>
                            {renderUploadProgress(studentUploadProgress)}
                          </div>
                          {studentAssignmentUploadFiles.length > 0 && (
                            renderUploadedFiles(studentAssignmentUploadFiles, { onRemove: removeStudentAssignmentUploadFile })
                          )}
                          {studentAssignmentUploadFiles.length > 0 && (
                            <div className="profileModalActions">
                              <button
                                type="button"
                                className="profilePrimaryButton"
                                onClick={submitStudentAssignment}
                                disabled={
                                  isAssignmentClosed(selectedAssignmentItem) ||
                                  (myAssignmentSubmission && selectedAssignmentItem.allowResubmission === false)
                                }
                              >
                                {myAssignmentSubmission ? 'Submit Replacement' : 'Submit Assignment'}
                              </button>
                              <button
                                type="button"
                                className="heroButton heroButtonSecondary"
                                onClick={() => setStudentAssignmentUploadFiles([])}
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {selectedAssignmentItem.attachments?.length > 0 && (
                        <>
                          <h4>Uploaded Content</h4>
                          <div className="assignmentAttachmentList">
                            {selectedAssignmentItem.attachments.map((file) => (
                              <button
                                key={file.id}
                                type="button"
                                className="courseInlineFileButton"
                                onClick={() => openStoredFile(file)}
                              >
                                {file.name}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </section>

                    {canManageContent && (
                      <section className="assignmentSubmissionTable">
                        <div className="assignmentTrackingHeader">
                          <div>
                            <h4>Assignment submission tracking</h4>
                            <p>{instructorSubmissionRows.length} student record(s) shown</p>
                          </div>
                          <div className="assignmentSubmissionFilters">
                            {['all', 'submitted', 'pending', 'late', 'graded'].map((filter) => (
                              <button
                                key={filter}
                                type="button"
                                className={submissionFilter === filter ? 'assignmentFilterActive' : ''}
                                onClick={() => setSubmissionFilter(filter)}
                              >
                                {filter.charAt(0).toUpperCase() + filter.slice(1)}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="assignmentTableHeader">
                          <span>Student Name</span>
                          <span>Assignment</span>
                          <span>Status</span>
                          <span>Submitted</span>
                          <span>Files</span>
                          <span>Review</span>
                        </div>
                        {instructorSubmissionRows.length ? (
                          instructorSubmissionRows.map(({ student, submission, status }) => {
                            const draft = gradingDrafts[submission?._id] || {
                              grade: submission?.grade || '',
                              feedback: submission?.feedback || '',
                            };
                            return (
                              <div key={student.email} className="assignmentTableRow">
                                <span>
                                  <strong>{student.name}</strong>
                                  <small>{student.email}</small>
                                </span>
                                <span>{selectedAssignmentItem.title}</span>
                                <span>
                                  <span className={`assignmentStatusChip assignmentStatus-${status}`}>
                                    {getSubmissionStatusLabel(status)}
                                  </span>
                                </span>
                                <span>{submission?.submittedAt ? new Date(submission.submittedAt).toLocaleString() : 'N/A'}</span>
                                <span>
                                  {submission?.files?.length ? (
                                    submission.files.map((file) => (
                                      <button
                                        key={file.id || file.url}
                                        type="button"
                                        className="courseInlineFileButton assignmentFileButton"
                                        onClick={() => openStoredFile(file)}
                                      >
                                        {getFileIconLabel(file)} {file.name || file.originalFilename}
                                      </button>
                                    ))
                                  ) : (
                                    'No upload'
                                  )}
                                </span>
                                <span className="assignmentReviewCell">
                                  {submission ? (
                                    <>
                                      <button type="button" className="heroButton heroButtonSecondary" onClick={() => setPreviewSubmission(submission)}>
                                        View Submission
                                      </button>
                                      <input
                                        className="assignmentGradeInput"
                                        type="text"
                                        value={draft.grade}
                                        onChange={(event) =>
                                          updateGradingDraft(submission._id, 'grade', event.target.value, {
                                            grade: submission.grade,
                                            feedback: submission.feedback,
                                          })
                                        }
                                        placeholder="e.g. 8/10"
                                      />
                                      <textarea
                                        className="assignmentFeedbackInput"
                                        value={draft.feedback}
                                        onChange={(event) =>
                                          updateGradingDraft(submission._id, 'feedback', event.target.value, {
                                            grade: submission.grade,
                                            feedback: submission.feedback,
                                          })
                                        }
                                        placeholder="Feedback for the student"
                                      />
                                      <button
                                        type="button"
                                        className="profilePrimaryButton"
                                        onClick={() => updateAssignmentSubmissionGrade(submission._id, draft.grade, draft.feedback)}
                                      >
                                        Mark Graded
                                      </button>
                                    </>
                                  ) : (
                                    <span className="assignmentMutedText">Awaiting submission</span>
                                  )}
                                </span>
                              </div>
                            );
                          })
                        ) : (
                          <div className="notificationsEmptyState">
                            <h3>No submissions yet</h3>
                            <p>Student submissions for this assignment will appear here.</p>
                          </div>
                        )}
                      </section>
                    )}
                  </>
                )}
              </section>
            </>
          ) : selectedContentItem ? (
            <>
              <div className="coursesPageHeader">
                <div>
                  <h2>{selectedContentItem.title}</h2>
                  <p>Content viewer</p>
                </div>
                <button
                  type="button"
                  className="heroButton heroButtonSecondary"
                  onClick={() => setSelectedContent(null)}
                >
                  Back to Modules
                </button>
              </div>

              <section
                id={`course-detail-content-${selectedContentItem.id}`}
                className="contentViewerWorkspace notificationScrollTarget"
              >
                <div className="assignmentSummaryGrid contentViewerSummaryGrid">
                  <article>
                    <h4>Content Type</h4>
                    <p>{getItemMetaText(selectedContentItem)}</p>
                  </article>
                  <article>
                    <h4>Files</h4>
                    <p>{selectedContentItem.files?.length || 0}</p>
                  </article>
                </div>

                <div className="contentViewerFiles">
                  {selectedContentItem.files?.length ? (
                    <>
                      <div className="contentViewerTabs">
                        {selectedContentItem.files.map((file) => (
                          <button
                            key={file.id}
                            type="button"
                            className={
                              activeContentFile?.id === file.id
                                ? 'contentViewerTab contentViewerTabActive'
                                : 'contentViewerTab'
                            }
                            onClick={() => setSelectedContentFileId(file.id)}
                          >
                            {file.name}
                          </button>
                        ))}
                      </div>

                      {activeContentFile && (
                        <article className="contentViewerFileCard">
                          <div className="contentViewerFileHeader">
                            <strong>{activeContentFile.name}</strong>
                            <button
                              type="button"
                              className="courseInlineFileButton"
                              onClick={() => openStoredFile(activeContentFile)}
                            >
                              Open in new tab
                            </button>
                          </div>
                          {activeContentFile.mimeType.startsWith('image/') ? (
                            <img src={getFileUrl(activeContentFile)} alt={activeContentFile.name} className="contentViewerImage" />
                          ) : activeContentFile.mimeType === 'application/pdf' ? (
                            <iframe src={getFileUrl(activeContentFile)} title={activeContentFile.name} className="contentViewerFrame" />
                          ) : activeContentFile.mimeType.startsWith('video/') ? (
                            <video controls className="contentViewerVideo">
                              <source src={getFileUrl(activeContentFile)} type={activeContentFile.mimeType} />
                            </video>
                          ) : (
                            <div className="contentViewerFallback">
                              Preview is not available for this file type. Use "Open in new tab".
                            </div>
                          )}
                        </article>
                      )}
                    </>
                  ) : selectedContentItem.link ? (
                    <iframe src={selectedContentItem.link} title={selectedContentItem.title} className="contentViewerFrame" />
                  ) : (
                    <div className="contentViewerFallback">
                      No uploaded content found for this item yet.
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : selectedQuizItem ? (
            <>
              <div className="coursesPageHeader">
                <div>
                  <h2>{selectedQuizItem.title}</h2>
                  <p>Quiz workspace (automatic grading)</p>
                </div>
                <button
                  type="button"
                  className="heroButton heroButtonSecondary"
                  onClick={() => setSelectedQuiz(null)}
                >
                  Back to Modules
                </button>
              </div>

              <section
                id={`course-detail-quiz-${selectedQuizItem.id}`}
                className="assignmentWorkspace assignmentWorkspaceStandalone notificationScrollTarget"
              >
                {canManageContent ? (
                  <>
                    <section className="assignmentSummaryGrid">
                      <article>
                        <h4>Instructions</h4>
                        <p>{selectedQuizItem.instructions || 'No quiz instructions added yet.'}</p>
                      </article>
                      <article>
                        <h4>Questions</h4>
                        <p>{getQuizQuestions(selectedQuizItem).length}</p>
                      </article>
                      <article>
                        <h4>Time Limit</h4>
                        <p>{selectedQuizItem.timeLimitMinutes || 20} minutes</p>
                      </article>
                      <article>
                        <h4>Allowed Attempts</h4>
                        <p>{selectedQuizItem.maxAttempts || 1}</p>
                      </article>
                    </section>

                    <section className="assignmentDetailPanel">
                      {quizQuestionEditorMode === 'edit' ? (
                        <>
                          <div className="profileModalActions">
                            <button
                              type="button"
                              className="profilePrimaryButton"
                              onClick={addQuizQuestionEditor}
                            >
                              Add Question
                            </button>
                            <button
                              type="button"
                              className="heroButton heroButtonSecondary"
                              onClick={cancelQuizQuestionsEditor}
                            >
                              Cancel
                            </button>
                          </div>

                          {quizQuestionEditor.map((question, questionIndex) => (
                            <article key={question.id} className="contentViewerFileCard">
                              <label htmlFor={`quiz-editor-qtext-${question.id}`}>
                                Question {questionIndex + 1}
                              </label>
                              <textarea
                                id={`quiz-editor-qtext-${question.id}`}
                                rows={2}
                                value={question.text}
                                onChange={(event) =>
                                  updateQuizQuestionEditorText(question.id, event.target.value)
                                }
                                placeholder="Type quiz question..."
                              />

                              <label>Options</label>
                              <div className="authForm">
                                {question.options.map((option, optionIndex) => (
                                  <input
                                    key={`${question.id}-opt-${optionIndex}`}
                                    value={option}
                                    onChange={(event) =>
                                      updateQuizQuestionEditorOption(
                                        question.id,
                                        optionIndex,
                                        event.target.value,
                                      )
                                    }
                                    placeholder={`Option ${optionIndex + 1}`}
                                  />
                                ))}
                              </div>

                              <label htmlFor={`quiz-editor-answer-${question.id}`}>
                                Correct Answer
                              </label>
                              <select
                                id={`quiz-editor-answer-${question.id}`}
                                value={question.answer}
                                onChange={(event) =>
                                  updateQuizQuestionEditorAnswer(
                                    question.id,
                                    Number(event.target.value),
                                  )
                                }
                              >
                                {question.options.map((_, optionIndex) => (
                                  <option key={optionIndex} value={optionIndex}>
                                    Option {optionIndex + 1}
                                  </option>
                                ))}
                              </select>

                              <label htmlFor={`quiz-editor-points-${question.id}`}>Points</label>
                              <input
                                id={`quiz-editor-points-${question.id}`}
                                type="number"
                                min="1"
                                value={question.points}
                                onChange={(event) =>
                                  updateQuizQuestionEditorPoints(question.id, event.target.value)
                                }
                              />

                              {quizQuestionEditor.length > 1 && (
                                <div className="profileModalActions">
                                  <button
                                    type="button"
                                    className="heroButton heroButtonSecondary"
                                    onClick={() => removeQuizQuestionEditor(question.id)}
                                  >
                                    Remove Question
                                  </button>
                                </div>
                              )}
                            </article>
                          ))}

                          <div className="profileModalActions">
                            <button
                              type="button"
                              className="profilePrimaryButton"
                              onClick={saveQuizQuestionsEditor}
                            >
                              Save Questions
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="profileModalActions">
                            <button
                              type="button"
                              className="profilePrimaryButton"
                              onClick={() =>
                                openEditItemModal(selectedQuiz.moduleId, selectedQuizItem)
                              }
                            >
                              Edit Quiz Details
                            </button>

                            {getQuizQuestions(selectedQuizItem).length > 0 ? (
                              <button
                                type="button"
                                className="heroButton heroButtonSecondary"
                                onClick={openQuizQuestionsEditor}
                              >
                                Edit Questions
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="heroButton heroButtonSecondary"
                                onClick={openQuizQuestionsEditor}
                              >
                                Add Questions
                              </button>
                            )}
                          </div>

                          {getQuizQuestions(selectedQuizItem).length > 0 ? (
                            getQuizQuestions(selectedQuizItem).map((question, index) => (
                              <article key={question.id} className="contentViewerFileCard">
                                <h4>
                                  Question {index + 1}: {question.text}{' '}
                                  <span className="courseItemMetaBadge">{question.points || 1} pts</span>
                                </h4>
                                <ul>
                                  {question.options.map((option, optionIndex) => (
                                    <li key={`${question.id}-${optionIndex}`}>
                                      {option}
                                      {question.answer === optionIndex ? ' (Correct)' : ''}
                                    </li>
                                  ))}
                                </ul>
                              </article>
                            ))
                          ) : (
                            <p className="authSubtext">No questions added yet. Click "Add Questions".</p>
                          )}
                        </>
                      )}
                    </section>

                    <section className="assignmentSubmissionTable">
                      <h4>Quiz attempts</h4>
                      <div className="assignmentTableHeader">
                        <span>Student Name</span>
                        <span>Submission Status</span>
                        <span>Submitted At</span>
                        <span>Score</span>
                        <span>Result</span>
                        <span>Details</span>
                      </div>
                      {enrolledStudentsForSelectedCourse.map((student) => {
                        const emailKey = student.email.toLowerCase();
                        const attempt = latestQuizAttemptByEmail[emailKey];
                        const score = attempt?.score ?? '';
                        const total = attempt?.totalMarks ?? attempt?.total ?? '';
                        const percent = attempt?.percentage ?? attempt?.percent;
                        return (
                          <div key={student.email} className="assignmentTableRow">
                            <span>{student.name}</span>
                            <span>{attempt ? 'Submitted' : 'Not attempted'}</span>
                            <span>{attempt?.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : 'N/A'}</span>
                            <span>{attempt ? `${score}/${total || 0}` : 'N/A'}</span>
                            <span>{attempt ? `${percent ?? 0}%` : 'N/A'}</span>
                            <span>{attempt ? ((percent ?? 0) >= 50 ? 'Passed' : 'Failed') : 'N/A'}</span>
                            <span>
                              {attempt ? (
                                <div className="assignmentGradeActions">
                                  <small>
                                    Attempt {attempt.attemptNo || 1}: {score}/{total || 0}
                                    {attempt.autoSubmitted ? ' (auto-submitted)' : ''}
                                  </small>
                                </div>
                              ) : (
                                'N/A'
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </section>
                  </>
                ) : (
                  !quizStarted ? (
                    <section className="assignmentDetailPanel">
                      <h4>Quiz Instructions</h4>
                      <p>{selectedQuizItem.instructions || 'Follow instructor guidance and submit your best answers.'}</p>
                      <div className="assignmentSummaryGrid">
                        <article>
                          <h4>Total Questions</h4>
                          <p>{getQuizQuestions(selectedQuizItem).length}</p>
                        </article>
                        <article>
                          <h4>Time Limit</h4>
                          <p>{selectedQuizItem.timeLimitMinutes || 20} minutes</p>
                        </article>
                        <article>
                          <h4>Allowed Attempts</h4>
                          <p>{selectedQuizItem.maxAttempts || 1}</p>
                        </article>
                        <article>
                          <h4>Your Attempts</h4>
                          <p>{studentQuizAttempt?.attemptCount || 0}</p>
                        </article>
                        <article>
                          <h4>Your Score</h4>
                          {(() => {
                            const used = studentQuizAttempt?.attemptCount || 0;
                            if (!used) {
                              return <p>—</p>;
                            }
                            const earned = studentQuizAttempt?.score ?? studentQuizAttempt?.autoScore ?? 0;
                            const outOf = studentQuizAttempt?.total ?? studentQuizAttempt?.autoTotal ?? 0;
                            const pct =
                              Number.isFinite(Number(studentQuizAttempt?.percent)) && studentQuizAttempt.percent != null
                                ? studentQuizAttempt.percent
                                : outOf > 0
                                  ? Math.round((earned / outOf) * 100)
                                  : 0;
                            const passed = pct >= 50;
                            return (
                              <>
                                <p>
                                  {outOf > 0 ? `${earned} / ${outOf}` : `${earned} pts`}
                                  {outOf > 0 ? ` (${pct}%)` : ''}
                                </p>
                                <p className="quizInstructionScoreStatus">{passed ? 'Passed' : 'Not passed'}</p>
                              </>
                            );
                          })()}
                        </article>
                      </div>

                      {(() => {
                        const usedAttempts = studentQuizAttempt?.attemptCount || 0;
                        const maxAttempts = selectedQuizItem.maxAttempts || 1;
                        const noQuestions = !getQuizQuestions(selectedQuizItem).length;
                        const attemptsExhausted = usedAttempts >= maxAttempts;
                        const remaining = Math.max(0, maxAttempts - usedAttempts);

                        return (
                          <>
                            {attemptsExhausted && (
                              <div className="dashboardFeedback" aria-live="polite">
                                You have used all {maxAttempts} attempt{maxAttempts === 1 ? '' : 's'} for this quiz. No more attempts are allowed.
                              </div>
                            )}
                            {!attemptsExhausted && usedAttempts > 0 && (
                              <div className="dashboardFeedback" aria-live="polite">
                                Attempts remaining: {remaining} of {maxAttempts}.
                              </div>
                            )}
                            {noQuestions && (
                              <div className="dashboardFeedback" aria-live="polite">
                                This quiz has no questions yet. Please check back later.
                              </div>
                            )}
                            <div className="profileModalActions">
                              <button
                                type="button"
                                className="profilePrimaryButton"
                                onClick={startQuizAttempt}
                                disabled={noQuestions || attemptsExhausted}
                              >
                                {usedAttempts > 0 && !attemptsExhausted ? 'Start Next Attempt' : 'Start Quiz'}
                              </button>
                            </div>
                          </>
                        );
                      })()}
                    </section>
                  ) : (
                    <div className="assignmentDetailPanel">
                      {quizTimeoutNotice && (
                        <div className="dashboardFeedback" role="alert">
                          <strong>{quizTimeoutNotice}</strong>
                        </div>
                      )}

                      <div className="dashboardFeedback" aria-live="polite">
                        Time left: {quizTimeLeftSec === null ? '00:00' : formatSecondsAsMMSS(quizTimeLeftSec)}
                      </div>
                      {getQuizQuestions(selectedQuizItem).map((question) => (
                        <article key={question.id} className="contentViewerFileCard">
                          <h4>{question.text}</h4>
                          <div className="dashboardSidebarNav">
                            {question.options.map((option, index) => (
                              <label key={`${question.id}-${index}`} className="assignmentCheckboxRow">
                                <input
                                  type="radio"
                                  name={`quiz-question-${question.id}`}
                                  checked={quizAnswers[question.id] === index}
                                  onChange={() => updateQuizAnswer(question.id, index)}
                                />
                                <span>{option}</span>
                              </label>
                            ))}
                          </div>
                        </article>
                      ))}

                      <div className="profileModalActions">
                        <button
                          type="button"
                          className="profilePrimaryButton"
                          onClick={submitQuiz}
                          disabled={Boolean(quizResult) || quizTimeLeftSec === 0}
                        >
                          Submit Quiz
                        </button>
                        <button
                          type="button"
                          className="heroButton heroButtonSecondary"
                          onClick={backToQuizInstructions}
                        >
                          Back to Instructions
                        </button>
                      </div>

                      {quizResult && (
                        <div className="dashboardFeedback" aria-live="polite">
                          {quizResult.autoSubmitted && (
                            <p>
                              <strong>Time&apos;s up.</strong> Your quiz was auto-submitted in its current state.
                            </p>
                          )}
                          <p>
                            Score: {quizResult.score}/{quizResult.total} ({quizResult.percent}%)
                            {quizResult.passed
                              ? ' — Passed. Completion recorded.'
                              : ' — Not passed yet.'}
                          </p>
                          <p>
                            Attempt {quizResult.attemptNumber} of {quizResult.maxAttempts}.
                          </p>
                          {quizResult.attemptNumber < quizResult.maxAttempts ? (
                            <div className="profileModalActions">
                              <button
                                type="button"
                                className="profilePrimaryButton"
                                onClick={retryQuiz}
                              >
                                Try Again ({quizResult.maxAttempts - quizResult.attemptNumber} left)
                              </button>
                            </div>
                          ) : (
                            <p>
                              <strong>You have used all {quizResult.maxAttempts} attempt{quizResult.maxAttempts === 1 ? '' : 's'} for this quiz.</strong> No more attempts are allowed.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                )}
              </section>
            </>
          ) : (
            <>
              <div className="coursesPageHeader">
                <div>
                  <h2>{selectedCourse?.title || 'Untitled Course'}</h2>
                  <p>{selectedCourse?.description || 'No description available.'}</p>
                </div>
                <button
                  type="button"
                  className="heroButton heroButtonSecondary"
                  onClick={() => navigate('/dashboard')}
                >
                  Back to My Courses
                </button>
              </div>

              <div className="courseContentStats">
                <article>
                  <h4>Modules</h4>
                  <p>{selectedCourse?.modules?.length || 0}</p>
                </article>
                <article>
                  <h4>Total Items</h4>
                  <p>{selectedCourse?.modules?.reduce((sum, module) => sum + (module.items?.length || 0), 0) || 0}</p>
                </article>
                <article>
                  <h4>Progress</h4>
                  <p>{selectedCourse ? getCourseProgress(selectedCourse) : 0}%</p>
                </article>
              </div>

              <div className="courseModuleToolbar">
                <input
                  type="text"
                  placeholder="Search modules or items"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
                {canManageContent && (
                  <button type="button" className="profilePrimaryButton" onClick={openCreateModuleModal}>
                    + New Module
                  </button>
                )}
              </div>

              {searchTerm.trim() && (
                <div className="courseSearchResults">
                  <h4>Search Results</h4>
                  {moduleSearchResults.length === 0 ? (
                    <p className="courseEmptyModuleText">Not found.</p>
                  ) : (
                    moduleSearchResults.map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        className="courseSearchResultButton"
                        onClick={() => handleSearchResultClick(result)}
                      >
                        <strong>{result.title}</strong>
                        <span>{result.subtext}</span>
                      </button>
                    ))
                  )}
                </div>
              )}

              <div className="courseModulesHeader">
                <h3>Modules</h3>
                <button type="button" className="courseTextButton" onClick={handleExpandAll}>
                  {expandedModuleIds.length === selectedCourse.modules.length ? 'Collapse all' : 'Expand all'}
                </button>
              </div>

              <div className="courseModulesList">
                {selectedCourse.modules.map((module) => {
                  const isExpanded = expandedModuleIds.includes(module.id);

                  return (
                    <article
                      key={module.id}
                      className="courseAccordionModule"
                      draggable={canManageContent}
                      onDragStart={() => canManageContent && setDraggingModuleId(module.id)}
                      onDragEnd={() => canManageContent && setDraggingModuleId(null)}
                      onDragOver={(event) => canManageContent && event.preventDefault()}
                      onDrop={() => canManageContent && handleModuleDrop(module.id)}
                    >
                      <div className="courseAccordionHeader">
                        <button
                          type="button"
                          className="courseAccordionToggle"
                          onClick={() => toggleModuleExpanded(module.id)}
                        >
                          <span className={isExpanded ? 'courseAccordionArrow courseAccordionArrowOpen' : 'courseAccordionArrow'}>
                            &gt;
                          </span>
                          <span>{module.title}</span>
                        </button>

                        {canManageContent && (
                          <div className="courseModuleHeaderActions">
                            <button type="button" onClick={() => openAddItemModal(module.id)}>
                              Add Item
                            </button>
                            <button type="button" onClick={() => openEditModuleModal(module)}>
                              Edit Title
                            </button>
                            <button type="button" onClick={() => handleDeleteModule(module.id)}>
                              Delete Module
                            </button>
                          </div>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="courseAccordionBody">
                          {module.items.length === 0 ? (
                            <p className="courseEmptyModuleText">No items added in this module yet.</p>
                          ) : (
                            module.items.map((item) => (
                              <div
                                id={`course-item-${item.type}-${item.id}`}
                                key={item.id}
                                className={`courseItemCard ${
                                  highlightedItemKey === `${item.type}-${item.id}` ? 'courseItemCardDeepLinked' : ''
                                }`}
                                role={item.type === 'quiz' ? 'button' : undefined}
                                tabIndex={item.type === 'quiz' ? 0 : undefined}
                                onClick={() => item.type === 'quiz' && handleQuizClick(module.id, item)}
                                onKeyDown={(event) => {
                                  if (item.type !== 'quiz') return;
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    handleQuizClick(module.id, item);
                                  }
                                }}
                              >
                                <div className={`courseItemIcon courseItemIcon${String(item.type).toUpperCase()}`}>
                                  {getItemIconLabel(item)}
                                </div>

                                <div className="courseItemMain">
                                  <div className="courseItemTopRow">
                                    {item.type === 'content' ? (
                                      <button
                                        type="button"
                                        className="courseContentLink"
                                        onClick={() => handleContentClick(module.id, item)}
                                      >
                                        {item.title}
                                      </button>
                                    ) : item.type === 'assignment' ? (
                                      <button
                                        type="button"
                                        className="courseContentLink"
                                        onClick={() => handleAssignmentClick(module.id, item)}
                                      >
                                        {item.title}
                                      </button>
                                    ) : item.type === 'quiz' ? (
                                      <button
                                        type="button"
                                        className="courseContentLink"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleQuizClick(module.id, item);
                                        }}
                                      >
                                        {item.title}
                                      </button>
                                    ) : (
                                      <strong className="courseItemTitle">{item.title}</strong>
                                    )}
                                    <span className="courseItemMetaBadge">{getItemMetaText(item)}</span>
                                  </div>

                                  {item.type === 'assignment' && (
                                    <div className="courseItemMetaLines">
                                      {item.openedAt && (
                                        <div>
                                          <strong>Opened:</strong> {formatDateTimeLabel(item.openedAt)}
                                        </div>
                                      )}
                                      {item.dueAt && (
                                        <div>
                                          <strong>Due:</strong> {formatDateTimeLabel(item.dueAt)}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {item.type === 'quiz' && (
                                    <div className="courseItemMetaLines">
                                      <div>
                                        <strong>Questions:</strong> {item.questionsCount}
                                      </div>
                                      {item.openedAt && (
                                        <div>
                                          <strong>Opened:</strong> {formatDateTimeLabel(item.openedAt)}
                                        </div>
                                      )}
                                      {item.dueAt && (
                                        <div>
                                          <strong>Due:</strong> {formatDateTimeLabel(item.dueAt)}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {item.type === 'content' && item.fileName && (
                                    <small className="courseItemSubtle">File: {item.fileName}</small>
                                  )}
                                  {item.type === 'content' && item.files?.length > 0 && (
                                    <div className="courseInlineFileList">
                                      {item.files.map((file) => (
                                        <button
                                          key={file.id}
                                          type="button"
                                          className="courseInlineFileButton"
                                          onClick={() => openStoredFile(file)}
                                        >
                                          {file.name}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {canManageContent && (
                                  <div className="courseItemActions">
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        openEditItemModal(module.id, item);
                                      }}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        deleteItem(module.id, item.id);
                                      }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              {canManageContent && selectedCourse && (
                <section className="assignmentWorkspace assignmentWorkspaceStandalone">
                  <div className="assignmentWorkspaceHeader">
                    <div>
                      <p className="assignmentWorkspaceEyebrow">Course Students</p>
                      <h3>Students enrolled in this course</h3>
                    </div>
                  </div>
                  <section className="assignmentSubmissionTable">
                    <div className="assignmentTableHeader studentRosterTableRow">
                      <span>Student Name</span>
                      <span>Email</span>
                      <span>Program &amp; Semester</span>
                    </div>
                    {enrolledStudentsForSelectedCourse.length ? (
                      enrolledStudentsForSelectedCourse
                        .map((student) => {
                          const programMeta = formatProgramSemester(student);
                          return (
                            <div key={student.email} className="assignmentTableRow assignmentTableRowSimple studentRosterTableRow">
                              <span>{student.name}</span>
                              <span>{student.email}</span>
                              <span className="programSemesterCell">
                                <strong>{programMeta.program}</strong>
                                <small>{programMeta.semester}</small>
                              </span>
                            </div>
                          );
                        })
                    ) : (
                      <div className="assignmentTableRow assignmentTableRowSimple studentRosterTableRow">
                        <span>No students enrolled yet.</span>
                        <span>-</span>
                        <span>-</span>
                      </div>
                    )}
                  </section>
                </section>
              )}

            </>
          )}
        </main>
      </div>

      {canManageContent && isModuleModalOpen && (
        <div className="lightboxOverlay" role="dialog" aria-modal="true">
          <div className="lightboxCard courseModalCard">
            <h3>{moduleModalMode === 'edit' ? 'Edit Module' : 'New Module'}</h3>
            <p className="authSubtext">Enter a module name to keep your course organized.</p>
            <div className="authForm">
              <label htmlFor="module-title-input">Module Name</label>
              <input
                id="module-title-input"
                value={moduleTitleInput}
                onChange={(event) => setModuleTitleInput(event.target.value)}
                placeholder="For example: General, Topic 1, Week 1"
              />
            </div>
            <div className="profileModalActions">
              <button type="button" className="profilePrimaryButton" onClick={handleSaveModule}>
                Confirm
              </button>
              <button type="button" className="heroButton heroButtonSecondary" onClick={closeModuleModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {canManageContent && isItemModalOpen && (
        <div className="lightboxOverlay" role="dialog" aria-modal="true">
          <div className="lightboxCard courseModalCard">
            <h3>{itemModalMode === 'edit' ? 'Edit Item' : 'Add Item'}</h3>
            <p className="authSubtext">Add content, assignment, or quiz to the selected module.</p>
            <div className="authForm">
              <label htmlFor="module-item-type">Item Type</label>
              <select
                id="module-item-type"
                name="itemType"
                value={moduleItemForm.itemType}
                onChange={handleModuleItemFormChange}
                disabled={itemModalMode === 'edit'}
              >
                <option value="content">Content</option>
                <option value="assignment">Assignment</option>
                <option value="quiz">Quiz</option>
              </select>

              <label htmlFor="module-item-title">Title</label>
              <input
                id="module-item-title"
                name="title"
                value={moduleItemForm.title}
                onChange={handleModuleItemFormChange}
                placeholder="Lecture 1, Assignment 1, Quiz 1..."
              />

              {moduleItemForm.itemType === 'content' && (
                <>
                  <label htmlFor="module-item-filetype">Content Type</label>
                  <select
                    id="module-item-filetype"
                    name="fileType"
                    value={moduleItemForm.fileType}
                    onChange={handleModuleItemFormChange}
                  >
                    <option value="pdf">PDF</option>
                    <option value="video">Video</option>
                    <option value="ppt">PPT</option>
                    <option value="doc">DOC</option>
                    <option value="txt">TXT</option>
                    <option value="image">Image</option>
                  </select>

                  <label htmlFor="module-item-link">Link (optional)</label>
                  <input
                    id="module-item-link"
                    name="link"
                    value={moduleItemForm.link}
                    onChange={handleModuleItemFormChange}
                    placeholder="https://..."
                  />

                  <label htmlFor="module-item-file">Upload files</label>
                  <div
                    className={`uploadDropZone ${activeDropZone === 'module-item' ? 'uploadDropZoneActive' : ''}`}
                    onDragOver={(event) => handleUploadDragOver(event, 'module-item')}
                    onDragLeave={handleUploadDragLeave}
                    onDrop={(event) => handleUploadDrop(event, 'module-item', uploadModuleItemFiles)}
                  >
                    <span className="uploadDropIcon">Upload</span>
                    <strong>Drag one or more files here for this single title</strong>
                    <p>All selected videos, PDFs, PPTs, docs, images, and text files stay grouped under this item title.</p>
                    <input
                      id="module-item-file"
                      type="file"
                      multiple
                      accept="video/*,image/*,.pdf,.ppt,.pptx,.doc,.docx,.txt"
                      onChange={handleModuleItemFileChange}
                    />
                  </div>
                  {renderUploadProgress(moduleUploadProgress)}
                  {renderUploadedFiles(moduleItemForm.uploadedFiles)}
                </>
              )}

              {moduleItemForm.itemType === 'assignment' && (
                <>
                  <label htmlFor="module-item-instructions">Instructions (optional)</label>
                  <textarea
                    id="module-item-instructions"
                    name="instructions"
                    rows={3}
                    value={moduleItemForm.instructions}
                    onChange={handleModuleItemFormChange}
                    placeholder="Write short assignment instructions..."
                  />

                  <label htmlFor="module-item-opened">Opened / uploaded on (optional)</label>
                  <input
                    id="module-item-opened"
                    type="datetime-local"
                    name="openedAt"
                    value={moduleItemForm.openedAt}
                    onChange={handleModuleItemFormChange}
                  />

                  <label htmlFor="module-item-due">Due date &amp; time (optional)</label>
                  <input
                    id="module-item-due"
                    type="datetime-local"
                    name="dueAt"
                    value={moduleItemForm.dueAt}
                    onChange={handleModuleItemFormChange}
                  />

                  <label htmlFor="module-assignment-max-file-size">Max file size per file (MB)</label>
                  <input
                    id="module-assignment-max-file-size"
                    type="number"
                    min="1"
                    max="250"
                    name="maxFileSizeMb"
                    value={moduleItemForm.maxFileSizeMb}
                    onChange={handleModuleItemFormChange}
                  />

                  <div className="assignmentPolicyGroup">
                    <span className="assignmentPolicyLabel">Allowed file types</span>
                    <div className="assignmentFileTypeGrid">
                      {ASSIGNMENT_FILE_TYPES.map((fileType) => (
                        <label key={fileType} className="assignmentTypeChip">
                          <input
                            type="checkbox"
                            checked={(moduleItemForm.allowedFileTypes || []).includes(fileType)}
                            onChange={() => toggleModuleAssignmentFileType(fileType)}
                          />
                          <span>{fileType.toUpperCase()}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <label className="assignmentCheckboxRow">
                    <input
                      type="checkbox"
                      name="allowResubmission"
                      checked={moduleItemForm.allowResubmission}
                      onChange={handleModuleItemFormChange}
                    />
                    <span>Allow replacement before the deadline</span>
                  </label>

                  <label className="assignmentCheckboxRow">
                    <input
                      type="checkbox"
                      name="allowLateSubmission"
                      checked={moduleItemForm.allowLateSubmission}
                      onChange={handleModuleItemFormChange}
                    />
                    <span>Allow late submissions</span>
                  </label>
                </>
              )}

              {moduleItemForm.itemType === 'quiz' && (
                <>
                  <label htmlFor="module-item-quiz-instructions">Quiz Instructions (optional)</label>
                  <textarea
                    id="module-item-quiz-instructions"
                    name="quizInstructions"
                    rows={3}
                    value={moduleItemForm.quizInstructions}
                    onChange={handleModuleItemFormChange}
                    placeholder="Add quiz instructions for students..."
                  />

                  <label htmlFor="module-item-quiz-time-limit">Time Limit (minutes)</label>
                  <input
                    id="module-item-quiz-time-limit"
                    type="number"
                    min="1"
                    name="quizTimeLimitMinutes"
                    value={moduleItemForm.quizTimeLimitMinutes}
                    onChange={handleModuleItemFormChange}
                  />

                  <label htmlFor="module-item-quiz-max-attempts">Maximum Attempts</label>
                  <input
                    id="module-item-quiz-max-attempts"
                    type="number"
                    min="1"
                    name="quizMaxAttempts"
                    value={moduleItemForm.quizMaxAttempts}
                    onChange={handleModuleItemFormChange}
                  />

                  <label htmlFor="module-item-opened-quiz">Opened / uploaded on (optional)</label>
                  <input
                    id="module-item-opened-quiz"
                    type="datetime-local"
                    name="openedAt"
                    value={moduleItemForm.openedAt}
                    onChange={handleModuleItemFormChange}
                  />

                  <label htmlFor="module-item-due-quiz">Due date &amp; time (optional)</label>
                  <input
                    id="module-item-due-quiz"
                    type="datetime-local"
                    name="dueAt"
                    value={moduleItemForm.dueAt}
                    onChange={handleModuleItemFormChange}
                  />

                  <p className="authSubtext">
                    Questions are edited inside the Quiz workspace (not in this modal).
                  </p>
                </>
              )}
            </div>

            <div className="profileModalActions">
              <button
                type="button"
                className="profilePrimaryButton"
                onClick={handleSaveModuleItem}
                disabled={Boolean(moduleUploadProgress)}
              >
                {moduleUploadProgress
                  ? 'Uploading...'
                  : itemModalMode === 'edit' ? 'Save Changes' : 'Add Item'}
              </button>
              <button type="button" className="heroButton heroButtonSecondary" onClick={closeItemModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {previewFile && (
        <div className="lightboxOverlay" role="dialog" aria-modal="true" aria-label="File preview">
          <div className="lightboxCard filePreviewCard">
            <div className="filePreviewHeader">
              <div>
                <h3>{previewFile.name}</h3>
                <p className="authSubtext">Preview uploaded file and download it if needed.</p>
              </div>
            </div>

            <div className="filePreviewBody">
              {previewFile.mimeType?.startsWith('image/') ? (
                <img src={getFileUrl(previewFile)} alt={previewFile.name} className="filePreviewImage" />
              ) : previewFile.mimeType === 'application/pdf' ? (
                <iframe src={getFileUrl(previewFile)} title={previewFile.name} className="filePreviewFrame" />
              ) : previewFile.mimeType?.startsWith('video/') ? (
                <video controls className="filePreviewVideo">
                  <source src={getFileUrl(previewFile)} type={previewFile.mimeType} />
                </video>
              ) : (
                <div className="contentViewerFallback">
                  Preview is not available for this file type yet. You can still download it below.
                </div>
              )}
            </div>

            <div className="profileModalActions">
              <a
                href={getFileUrl(previewFile)}
                download={previewFile.name}
                className="profilePrimaryButton filePreviewDownloadButton"
              >
                Download
              </a>
              <button type="button" className="heroButton heroButtonSecondary" onClick={closePreviewFile}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {previewSubmission && (
        <div className="lightboxOverlay" role="dialog" aria-modal="true" aria-label="Submission preview">
          <div className="lightboxCard filePreviewCard">
            <div className="filePreviewHeader">
              <div>
                <h3>{previewSubmission.student?.name || 'Student submission'}</h3>
                <p className="authSubtext">
                  Submitted {previewSubmission.submittedAt ? new Date(previewSubmission.submittedAt).toLocaleString() : 'recently'}
                </p>
              </div>
            </div>
            <div className="assignmentSubmissionPreviewList">
              {previewSubmission.files?.length ? (
                previewSubmission.files.map((file) => (
                  <article key={file.id || file.url} className="assignmentSubmissionPreviewCard">
                    <span className="uploadFileIcon">{getFileIconLabel(file)}</span>
                    <div>
                      <strong>{file.name || file.originalFilename}</strong>
                      <small>{getSubmissionFileType(file).toUpperCase()} · {formatFileSize(file.size) || 'Cloud file'}</small>
                    </div>
                    <button type="button" className="heroButton heroButtonSecondary" onClick={() => setPreviewFile(file)}>
                      Preview
                    </button>
                    <a href={getFileUrl(file)} className="profilePrimaryButton" download={file.name || file.originalFilename}>
                      Download
                    </a>
                  </article>
                ))
              ) : (
                <div className="contentViewerFallback">No uploaded files are attached to this submission.</div>
              )}
              {previewSubmission.feedback && <p className="assignmentFeedbackText">Feedback: {previewSubmission.feedback}</p>}
            </div>
            <div className="profileModalActions">
              <button type="button" className="heroButton heroButtonSecondary" onClick={() => setPreviewSubmission(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteAction && (
        <DeleteConfirmationDialog
          title={pendingDeleteAction.title}
          message={pendingDeleteAction.message}
          impact={pendingDeleteAction.impact}
          onCancel={() => setPendingDeleteAction(null)}
          onConfirm={confirmPendingDeleteAction}
        />
      )}
    </section>
  );
}

export default CoursesPage;
