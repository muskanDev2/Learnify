const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const LmsSnapshot = require('../models/LmsSnapshot');
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
