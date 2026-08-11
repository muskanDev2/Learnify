const Course = require('../models/Course');
const CourseProgress = require('../models/CourseProgress');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');
const {
  enrollmentDateInRange,
  progressCompletedInRange,
} = require('../utils/reportDateRange');
const { parseReportFilters } = require('../utils/reportFilters');

function percentChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

async function getUserStats(req, res, next) {
  try {
    const users = await User.find().select('role active createdAt');
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const newUsersThisMonth = users.filter((user) => user.createdAt >= thisMonth).length;
    const newUsersLastMonth = users.filter(
      (user) => user.createdAt >= lastMonth && user.createdAt < thisMonth,
    ).length;

    const monthlyMap = new Map();
    users.forEach((user) => {
      const key = `${user.createdAt.getFullYear()}-${String(user.createdAt.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(key, (monthlyMap.get(key) || 0) + 1);
    });

    return res.json({
      success: true,
      data: {
        totalUsers: users.length,
        activeUsers: users.filter((user) => user.active !== false).length,
        inactiveUsers: users.filter((user) => user.active === false).length,
        students: users.filter((user) => user.role === 'student').length,
        instructors: users.filter((user) => user.role === 'instructor').length,
        admins: users.filter((user) => user.role === 'admin').length,
        newUsersThisMonth,
        newUsersLastMonth,
        userGrowthPercent: percentChange(newUsersThisMonth, newUsersLastMonth),
        monthlyUsers: Array.from(monthlyMap.entries()).map(([month, count]) => ({ month, count })),
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function getProgressStats(req, res, next) {
  try {
    const [enrollments, progressRows, courses] = await Promise.all([
      Enrollment.find(),
      CourseProgress.find(),
      Course.find().select('id title'),
    ]);

    const averageProgressPercent = progressRows.length
      ? Math.round(progressRows.reduce((sum, row) => sum + (row.progressPercent || 0), 0) / progressRows.length)
      : 0;

    const courseWiseAverageProgress = courses.map((course) => {
      const rows = progressRows.filter((row) => row.courseId === course.id);
      const average = rows.length
        ? Math.round(rows.reduce((sum, row) => sum + (row.progressPercent || 0), 0) / rows.length)
        : 0;
      return {
        courseId: course.id,
        title: course.title,
        averageProgressPercent: average,
      };
    });

    return res.json({
      success: true,
      data: {
        totalEnrollments: enrollments.filter((enrollment) => enrollment.status !== 'dropped').length,
        averageProgressPercent,
        completedCourses: progressRows.filter((row) => row.progressPercent >= 100).length,
        courseWiseAverageProgress,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function getAdminReports(req, res, next) {
  try {
    const { start, end, label: periodLabel, period, courseId } = parseReportFilters(req.query);

    const [enrollments, progressRows, allCourses, users] = await Promise.all([
      Enrollment.find(),
      CourseProgress.find(),
      Course.find().select('id title ownerEmail instructor').sort({ title: 1 }),
      User.find().select('name email role'),
    ]);

    const courses = courseId ? allCourses.filter((course) => course.id === courseId) : allCourses;
    const courseFilter = courseId ? (row) => row.courseId === courseId : () => true;

    const ownerNameByEmail = new Map(
      users.map((user) => [String(user.email || '').toLowerCase(), user.name || user.email || 'Unknown']),
    );

    const activeEnrollments = enrollments.filter((row) => row.status !== 'dropped' && courseFilter(row));
    const enrollmentsInRange = activeEnrollments.filter((row) => {
      if (!start && !end) return true;
      return enrollmentDateInRange(row, start, end);
    });

    const scopedProgressRows = progressRows.filter((row) => courseFilter(row));

    const progressInRange = scopedProgressRows.filter((row) => {
      if (!start && !end) return true;
      const activityDate = row.updatedAt || row.lastActivityAt || row.createdAt;
      if (!activityDate) return false;
      const value = new Date(activityDate);
      if (start && value < start) return false;
      if (end && value > end) return false;
      return true;
    });

    const completedCourses = scopedProgressRows.filter((row) =>
      progressCompletedInRange(row, start, end),
    ).length;

    const averageProgressPercent = (() => {
      const rowsForAverage = !start && !end ? scopedProgressRows : progressInRange;
      if (!rowsForAverage.length) return 0;

      if (!start && !end) {
        return Math.round(
          rowsForAverage.reduce((sum, row) => sum + (row.progressPercent || 0), 0) / rowsForAverage.length,
        );
      }

      const enrolledEmails = new Set(
        enrollmentsInRange.map((row) => String(row.studentEmail || '').toLowerCase()),
      );
      const progressForEnrolled = rowsForAverage.filter((row) => {
        const student = users.find((user) => String(user._id) === String(row.student));
        const email = String(student?.email || '').toLowerCase();
        return enrolledEmails.has(email);
      });

      if (!progressForEnrolled.length) return 0;
      return Math.round(
        progressForEnrolled.reduce((sum, row) => sum + (row.progressPercent || 0), 0) /
          progressForEnrolled.length,
      );
    })();

    const courseRows = courses.map((course) => {
      const courseEnrollments = enrollmentsInRange.filter((row) => row.courseId === course.id);
      const enrolledCount = courseEnrollments.length;
      const enrolledEmails = new Set(
        courseEnrollments.map((row) => String(row.studentEmail || '').toLowerCase()),
      );

      const progressForCourse = scopedProgressRows.filter((row) => row.courseId === course.id);
      const relevantProgress =
        !start && !end
          ? progressForCourse
          : progressForCourse.filter((row) => {
              const student = users.find((user) => String(user._id) === String(row.student));
              const email = String(student?.email || '').toLowerCase();
              return enrolledEmails.has(email);
            });

      const averageCompletion = relevantProgress.length
        ? Math.round(
            relevantProgress.reduce((sum, row) => sum + (row.progressPercent || 0), 0) /
              relevantProgress.length,
          )
        : 0;

      return {
        id: course.id,
        title: course.title || 'Untitled course',
        owner:
          ownerNameByEmail.get(String(course.ownerEmail || '').toLowerCase()) ||
          course.instructor ||
          'Unknown',
        enrolledCount,
        averageCompletion,
      };
    });

    const selectedCourse = courseId ? allCourses.find((course) => course.id === courseId) : null;

    return res.json({
      success: true,
      data: {
        period,
        periodLabel,
        courseId: courseId || 'all',
        courseLabel: selectedCourse ? selectedCourse.title : 'All Courses',
        courseOptions: allCourses.map((course) => ({ id: course.id, title: course.title || 'Untitled course' })),
        summary: {
          totalEnrollments: enrollmentsInRange.length,
          averageProgressPercent,
          completedCourses,
        },
        courses: courseRows,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getAdminReports, getProgressStats, getUserStats };
