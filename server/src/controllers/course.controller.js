const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const LmsSnapshot = require('../models/LmsSnapshot');
const { notifyAdmins, notifyCourseStudents } = require('../services/notification.service');
const { sanitizeCourseModules, sanitizeCourses } = require('../utils/sanitizeCoursePayload');

function buildStarterModules() {
  return [{ id: 1, title: 'General', items: [] }];
}

async function getNextCourseId() {
  const latestCourse = await Course.findOne().sort({ id: -1 }).select('id');
  return latestCourse?.id ? latestCourse.id + 1 : 1;
}

function canManageCourse(user, course) {
  const role = String(user.role || '').toLowerCase();
  const userEmail = String(user.email || '').toLowerCase();

  return role === 'admin' || String(course.ownerEmail || '').toLowerCase() === userEmail;
}

function flattenCourseItems(course) {
  return (course.modules || []).flatMap((module) =>
    (module.items || []).map((item) => ({
      ...item,
      moduleTitle: module.title,
    })),
  );
}

function getCourseItemKey(item) {
  return `${item.type || 'content'}:${item.id}`;
}

function getNewCourseItems(beforeCourse, afterCourse) {
  const previousKeys = new Set(flattenCourseItems(beforeCourse).map(getCourseItemKey));
  return flattenCourseItems(afterCourse).filter((item) => !previousKeys.has(getCourseItemKey(item)));
}

function getChangedAssignmentDeadlines(beforeCourse, afterCourse) {
  const previousAssignments = new Map(
    flattenCourseItems(beforeCourse)
      .filter((item) => item.type === 'assignment')
      .map((item) => [getCourseItemKey(item), item]),
  );

  return flattenCourseItems(afterCourse)
    .filter((item) => item.type === 'assignment')
    .map((item) => {
      const previous = previousAssignments.get(getCourseItemKey(item));
      if (!previous) return null;

      const previousDueAt = String(previous.dueAt || previous.dueDate || '');
      const nextDueAt = String(item.dueAt || item.dueDate || '');
      if (previousDueAt === nextDueAt) return null;

      return {
        item,
        previousDueAt,
        nextDueAt,
      };
    })
    .filter(Boolean);
}

function formatDueDate(value) {
  if (!value) return 'no due date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildCourseItemActionUrl(courseId, item) {
  if (item.type === 'assignment') return `/courses?courseId=${courseId}&assignmentId=${item.id}`;
  if (item.type === 'quiz') return `/courses?courseId=${courseId}&quizId=${item.id}`;
  return `/courses?courseId=${courseId}&contentId=${item.id}`;
}

function getNewItemNotification(item, course) {
  if (item.type === 'assignment') {
    return {
      title: 'New assignment posted',
      message: `${item.title || 'An assignment'} has been posted in ${course.title}.`,
      notificationType: 'assignment_created',
    };
  }

  if (item.type === 'quiz') {
    return {
      title: 'New quiz created',
      message: `${item.title || 'A quiz'} is now available in ${course.title}.`,
      notificationType: 'quiz_created',
    };
  }

  return {
    title: 'New course material uploaded',
    message: `${item.title || 'New material'} has been uploaded in ${course.title}.`,
    notificationType: 'course_material_uploaded',
  };
}

async function listCourses(req, res, next) {
  try {
    const courseCount = await Course.countDocuments();
    if (courseCount === 0) {
      const snapshot = await LmsSnapshot.findOne({ key: 'main' });
      const snapshotCourses = Array.isArray(snapshot?.courses) ? snapshot.courses : [];

      if (snapshotCourses.length > 0) {
        await Course.insertMany(sanitizeCourses(snapshotCourses), { ordered: false });
      }
    }

    const courses = await Course.find().sort({ updatedAt: -1 });

    return res.json({
      success: true,
      data: courses.map((course) => course.toClient()),
    });
  } catch (error) {
    return next(error);
  }
}

async function createCourse(req, res, next) {
  try {
    const { title, subtitle, description, category, enrollmentKey } = req.body;

    if (!title?.trim() || !subtitle?.trim() || !description?.trim() || !category?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Title, subtitle, description, and category are required.',
      });
    }

    const course = await Course.create({
      id: await getNextCourseId(),
      title: title.trim(),
      subtitle: subtitle.trim(),
      description: description.trim(),
      instructor: req.user.name,
      category: category.trim(),
      enrollmentKey: String(enrollmentKey || '').trim(),
      imageClass: 'courseImageBlue',
      lastAccessed: new Date().toISOString().slice(0, 10),
      ownerEmail: req.user.email,
      modules: buildStarterModules(),
    });

    notifyAdmins({
      title: 'New course created',
      message: `${course.title} was created by ${req.user.name}.`,
      notificationType: 'course_created',
      relatedEntityId: course.id,
      relatedEntityType: 'course',
      actionUrl: `/courses?courseId=${course.id}`,
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Course created successfully.',
      data: course.toClient(),
    });
  } catch (error) {
    return next(error);
  }
}

async function updateCourse(req, res, next) {
  try {
    const course = await Course.findOne({ id: Number(req.params.id) });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found.',
      });
    }

    if (!canManageCourse(req.user, course)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this course.',
      });
    }

    const allowedFields = ['title', 'subtitle', 'description', 'category', 'enrollmentKey', 'modules'];
    const updates = {
      lastAccessed: new Date().toISOString().slice(0, 10),
    };

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = field === 'modules' ? sanitizeCourseModules(req.body[field]) : req.body[field];
      }
    });

    const updatedCourse = await Course.findOneAndUpdate(
      { id: course.id },
      { $set: updates },
      { returnDocument: 'after', runValidators: true },
    );

    if (!updatedCourse) {
      return res.status(404).json({
        success: false,
        message: 'Course was removed before it could be updated. Please refresh and try again.',
      });
    }

    const newItems = getNewCourseItems(course, updatedCourse);
    newItems.forEach((item) => {
      const notification = getNewItemNotification(item, updatedCourse);
      notifyCourseStudents(
        updatedCourse,
        {
          ...notification,
          relatedEntityId: item.id,
          courseId: updatedCourse.id,
          relatedEntityType: item.type || 'content',
          actionUrl: buildCourseItemActionUrl(updatedCourse.id, item),
        },
        Enrollment,
      ).catch(() => {});
    });

    getChangedAssignmentDeadlines(course, updatedCourse).forEach(({ item, nextDueAt }) => {
      notifyCourseStudents(
        updatedCourse,
        {
          title: 'Assignment deadline updated',
          message: `${item.title || 'An assignment'} in ${updatedCourse.title} is now due ${formatDueDate(nextDueAt)}.`,
          notificationType: 'assignment_deadline_updated',
          relatedEntityId: item.id,
          courseId: updatedCourse.id,
          relatedEntityType: 'assignment',
          actionUrl: buildCourseItemActionUrl(updatedCourse.id, item),
        },
        Enrollment,
      ).catch(() => {});
    });

    return res.json({
      success: true,
      message: 'Course updated successfully.',
      data: updatedCourse.toClient(),
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteCourse(req, res, next) {
  try {
    const course = await Course.findOne({ id: Number(req.params.id) });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found.',
      });
    }

    if (!canManageCourse(req.user, course)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this course.',
      });
    }

    await course.deleteOne();

    return res.json({
      success: true,
      message: 'Course deleted successfully.',
    });
  } catch (error) {
    return next(error);
  }
}

async function updateStudentCourseWork(req, res, next) {
  try {
    const course = await Course.findOne({ id: Number(req.params.id) });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found.',
      });
    }

    const studentEmail = String(req.user.email || '').toLowerCase();
    const enrollment = await Enrollment.findOne({ studentEmail, courseId: course.id });

    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: 'You must be enrolled to submit course work.',
      });
    }

    if (!Array.isArray(req.body.modules)) {
      return res.status(400).json({
        success: false,
        message: 'Course modules are required.',
      });
    }

    const updatedCourse = await Course.findOneAndUpdate(
      { id: course.id },
      {
        $set: {
          modules: sanitizeCourseModules(req.body.modules),
          lastAccessed: new Date().toISOString().slice(0, 10),
        },
      },
      { returnDocument: 'after', runValidators: true },
    );

    if (!updatedCourse) {
      return res.status(404).json({
        success: false,
        message: 'Course was removed before your work could be saved. Please refresh and try again.',
      });
    }

    return res.json({
      success: true,
      message: 'Student course work saved successfully.',
      data: updatedCourse.toClient(),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createCourse,
  deleteCourse,
  listCourses,
  updateStudentCourseWork,
  updateCourse,
};
