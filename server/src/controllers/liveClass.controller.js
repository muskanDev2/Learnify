const Enrollment = require('../models/Enrollment');
const LiveClass = require('../models/LiveClass');
const LiveClassAttendance = require('../models/LiveClassAttendance');
const User = require('../models/User');
const { notifyCourseStudents } = require('../services/notification.service');
const {
  cancelZoomMeeting,
  createScheduledMeeting,
  fetchMeetingParticipantsReport,
  isZoomConfigured,
  parseParticipantDurationMinutes,
} = require('../services/zoom.service');
const {
  canAccessCourseLiveClasses,
  canManageCourseLiveClasses,
} = require('../utils/liveClassAccess');
const { resolveCourseById } = require('../utils/lmsProgress');

function segmentMatchesStatus(segment, effectiveStatus) {
  if (!segment || segment === 'all') return true;
  if (segment === 'upcoming') return effectiveStatus === 'scheduled';
  if (segment === 'live') return effectiveStatus === 'live';
  if (segment === 'completed') return effectiveStatus === 'completed';
  if (segment === 'cancelled') return effectiveStatus === 'cancelled';
  return true;
}

async function listLiveClasses(req, res, next) {
  try {
    const courseId = Number(req.query.courseId);
    if (!courseId) {
      return res.status(400).json({ success: false, message: 'courseId is required.' });
    }

    const course = await resolveCourseById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    if (!(await canAccessCourseLiveClasses(req.user, course))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this course.' });
    }

    const canManage = canManageCourseLiveClasses(req.user, course);
    const segment = String(req.query.segment || 'all').toLowerCase();
    const moduleId = req.query.moduleId ? Number(req.query.moduleId) : null;

    const query = { courseId };
    if (moduleId) query.moduleId = moduleId;

    const rows = await LiveClass.find(query).sort({ scheduledStartAt: -1 }).populate('instructor', 'name email');

    const data = rows
      .map((row) => {
        const client = row.toClient({ includeHostLinks: canManage });
        return {
          ...client,
          instructorName: row.instructor?.name || 'Instructor',
        };
      })
      .filter((row) => segmentMatchesStatus(segment, row.status));

    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

async function getLiveClass(req, res, next) {
  try {
    const liveClass = await LiveClass.findById(req.params.id).populate('instructor', 'name email');
    if (!liveClass) {
      return res.status(404).json({ success: false, message: 'Live class not found.' });
    }

    const course = await resolveCourseById(liveClass.courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    if (!(await canAccessCourseLiveClasses(req.user, course))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this live class.' });
    }

    const canManage = canManageCourseLiveClasses(req.user, course);
    const client = liveClass.toClient({ includeHostLinks: canManage });

    return res.json({
      success: true,
      data: {
        ...client,
        instructorName: liveClass.instructor?.name || 'Instructor',
        zoomConfigured: isZoomConfigured(),
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function createLiveClass(req, res, next) {
  try {
    const courseId = Number(req.body.courseId);
    const title = String(req.body.title || '').trim();
    const scheduledStartAt = req.body.scheduledStartAt ? new Date(req.body.scheduledStartAt) : null;
    const durationMinutes = Number(req.body.durationMinutes);
    const moduleId = req.body.moduleId ? Number(req.body.moduleId) : null;
    const description = String(req.body.description || '').trim();
    const attendanceThresholdMinutes = Number(req.body.attendanceThresholdMinutes) || 20;

    if (!courseId || !title || !scheduledStartAt || Number.isNaN(scheduledStartAt.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'courseId, title, and a valid scheduledStartAt are required.',
      });
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes < 15) {
      return res.status(400).json({ success: false, message: 'durationMinutes must be at least 15.' });
    }

    const course = await resolveCourseById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    if (!canManageCourseLiveClasses(req.user, course)) {
      return res.status(403).json({ success: false, message: 'You cannot schedule live classes for this course.' });
    }

    if (!isZoomConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Zoom is not configured. Contact your administrator.',
      });
    }

    const zoomMeeting = await createScheduledMeeting({
      topic: `${course.title}: ${title}`,
      startTime: scheduledStartAt,
      durationMinutes,
      agenda: description,
    });

    const liveClass = await LiveClass.create({
      course: course._id,
      courseId: course.id,
      moduleId: Number.isFinite(moduleId) ? moduleId : null,
      instructor: req.user._id,
      title,
      description,
      scheduledStartAt,
      durationMinutes,
      timezone: req.body.timezone || 'UTC',
      zoomMeetingId: zoomMeeting.meetingId,
      zoomMeetingUuid: zoomMeeting.meetingUuid,
      joinUrl: zoomMeeting.joinUrl,
      startUrl: zoomMeeting.startUrl,
      password: zoomMeeting.password,
      status: 'scheduled',
      attendanceThresholdMinutes: Math.min(Math.max(attendanceThresholdMinutes, 1), 240),
    });

    await liveClass.populate('instructor', 'name email');

    const startLabel = scheduledStartAt.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    notifyCourseStudents(
      course,
      {
        title: 'New live class scheduled',
        message: `${title} in ${course.title} starts ${startLabel}.`,
        notificationType: 'live_class_scheduled',
        relatedEntityId: liveClass._id,
        courseId: course.id,
        relatedEntityType: 'live_class',
        actionUrl: `/courses?courseId=${course.id}&tab=live`,
        dedupeKey: `live_class:${liveClass._id.toString()}`,
      },
      Enrollment,
    ).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Live class scheduled.',
      data: {
        ...liveClass.toClient({ includeHostLinks: true }),
        instructorName: liveClass.instructor?.name || req.user.name,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function cancelLiveClass(req, res, next) {
  try {
    const liveClass = await LiveClass.findById(req.params.id);
    if (!liveClass) {
      return res.status(404).json({ success: false, message: 'Live class not found.' });
    }

    const course = await resolveCourseById(liveClass.courseId);
    if (!course || !canManageCourseLiveClasses(req.user, course)) {
      return res.status(403).json({ success: false, message: 'You cannot cancel this live class.' });
    }

    if (liveClass.status !== 'cancelled') {
      try {
        await cancelZoomMeeting(liveClass.zoomMeetingId);
      } catch {
        // Meeting may already be gone on Zoom; still mark cancelled in Learnify.
      }
      liveClass.status = 'cancelled';
      await liveClass.save();
    }

    return res.json({
      success: true,
      message: 'Live class cancelled.',
      data: liveClass.toClient({ includeHostLinks: true }),
    });
  } catch (error) {
    return next(error);
  }
}

async function syncLiveClassAttendance(req, res, next) {
  try {
    const liveClass = await LiveClass.findById(req.params.id);
    if (!liveClass) {
      return res.status(404).json({ success: false, message: 'Live class not found.' });
    }

    const course = await resolveCourseById(liveClass.courseId);
    if (!course || !canManageCourseLiveClasses(req.user, course)) {
      return res.status(403).json({ success: false, message: 'You cannot sync attendance for this class.' });
    }

    if (liveClass.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cancelled classes do not have attendance.' });
    }

    const participants = await fetchMeetingParticipantsReport(liveClass.zoomMeetingId);
    const durationByEmail = new Map();

    participants.forEach((participant) => {
      const email = String(participant.user_email || participant.email || '').toLowerCase();
      if (!email) return;
      const minutes = parseParticipantDurationMinutes(participant);
      durationByEmail.set(email, (durationByEmail.get(email) || 0) + minutes);
    });

    const enrollments = await Enrollment.find({
      courseId: course.id,
      status: { $ne: 'dropped' },
    }).select('student studentEmail');

    const threshold = Number(liveClass.attendanceThresholdMinutes) || 20;
    const now = new Date();
    const attendanceRows = [];

    for (const enrollment of enrollments) {
      const email = String(enrollment.studentEmail || '').toLowerCase();
      let student = enrollment.student;
      if (!student) {
        const user = await User.findOne({ email }).select('_id');
        student = user?._id;
      }
      if (!student) continue;

      const totalMinutes = durationByEmail.get(email) || 0;
      const status = totalMinutes >= threshold ? 'present' : 'absent';

      const record = await LiveClassAttendance.findOneAndUpdate(
        { liveClass: liveClass._id, student },
        {
          $set: {
            courseId: course.id,
            studentEmail: email,
            status,
            durationMinutes: totalMinutes,
            joinTime: null,
            leaveTime: null,
            syncedAt: now,
          },
        },
        { upsert: true, returnDocument: 'after' },
      );

      attendanceRows.push(record);
    }

    liveClass.attendanceSyncedAt = now;
    if (liveClass.status !== 'cancelled') {
      liveClass.status = 'completed';
    }
    await liveClass.save();

    return res.json({
      success: true,
      message: 'Attendance synchronized from Zoom.',
      data: {
        liveClass: liveClass.toClient({ includeHostLinks: true }),
        attendance: attendanceRows.map((row) => row.toClient()),
        thresholdMinutes: threshold,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function getLiveClassAttendance(req, res, next) {
  try {
    const liveClass = await LiveClass.findById(req.params.id);
    if (!liveClass) {
      return res.status(404).json({ success: false, message: 'Live class not found.' });
    }

    const course = await resolveCourseById(liveClass.courseId);
    if (!course || !canManageCourseLiveClasses(req.user, course)) {
      return res.status(403).json({ success: false, message: 'You cannot view attendance for this class.' });
    }

    const rows = await LiveClassAttendance.find({ liveClass: liveClass._id })
      .populate('student', 'name email')
      .sort({ status: 1, durationMinutes: -1 });

    return res.json({
      success: true,
      data: rows.map((row) => ({
        ...row.toClient(),
        studentName: row.student?.name || row.studentEmail,
      })),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  cancelLiveClass,
  createLiveClass,
  getLiveClass,
  getLiveClassAttendance,
  listLiveClasses,
  syncLiveClassAttendance,
};
