const Course = require('../models/Course');
const CourseProgress = require('../models/CourseProgress');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');

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

module.exports = { getProgressStats, getUserStats };
