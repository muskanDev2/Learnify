const Course = require('../models/Course');
const Discussion = require('../models/Discussion');
const DiscussionReply = require('../models/DiscussionReply');
const { resolveCourseById } = require('../utils/lmsProgress');
const { canAccessCourseForum } = require('../utils/courseForumAccess');

async function listTopics(req, res, next) {
  try {
    const course = await resolveCourseById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    const hasAccess = await canAccessCourseForum(req.user, course);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'You do not have permission to access this forum.' });
    }

    const query = { course: course._id };
    if (req.query.search) {
      query.title = { $regex: String(req.query.search), $options: 'i' };
    }

    const discussions = await Discussion.find(query)
      .populate('author', 'name email role profileImage')
      .sort({ createdAt: -1 });

    const items = await Promise.all(
      discussions.map(async (disc) => {
        const replyCount = await DiscussionReply.countDocuments({ discussion: disc._id });
        return {
          ...disc.toClient(),
          replyCount,
        };
      }),
    );

    return res.json({ success: true, data: items });
  } catch (error) {
    return next(error);
  }
}

async function createTopic(req, res, next) {
  try {
    const course = await resolveCourseById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    const hasAccess = await canAccessCourseForum(req.user, course);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'You do not have permission to access this forum.' });
    }

    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();

    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description are required.' });
    }

    const discussion = await Discussion.create({
      course: course._id,
      courseId: course.id,
      author: req.user._id,
      title,
      description,
    });

    await discussion.populate('author', 'name email role profileImage');

    return res.status(201).json({
      success: true,
      message: 'Discussion topic created.',
      data: discussion.toClient(),
    });
  } catch (error) {
    return next(error);
  }
}

async function getTopic(req, res, next) {
  try {
    const discussion = await Discussion.findById(req.params.discussionId)
      .populate('author', 'name email role profileImage');
    if (!discussion) {
      return res.status(404).json({ success: false, message: 'Discussion not found.' });
    }

    const course = await Course.findById(discussion.course);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    const hasAccess = await canAccessCourseForum(req.user, course);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'You do not have permission to access this forum.' });
    }

    const replyCount = await DiscussionReply.countDocuments({ discussion: discussion._id });

    return res.json({
      success: true,
      data: {
        ...discussion.toClient(),
        replyCount,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteTopic(req, res, next) {
  try {
    const discussion = await Discussion.findById(req.params.discussionId);
    if (!discussion) {
      return res.status(404).json({ success: false, message: 'Discussion not found.' });
    }

    const isAuthor = String(discussion.author) === String(req.user._id);
    const isAdmin = String(req.user.role).toLowerCase() === 'admin';

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ success: false, message: 'You do not have permission to delete this discussion.' });
    }

    // Delete all replies first
    await DiscussionReply.deleteMany({ discussion: discussion._id });
    await discussion.deleteOne();

    return res.json({ success: true, message: 'Discussion topic deleted.' });
  } catch (error) {
    return next(error);
  }
}

async function listReplies(req, res, next) {
  try {
    const discussion = await Discussion.findById(req.params.discussionId);
    if (!discussion) {
      return res.status(404).json({ success: false, message: 'Discussion not found.' });
    }

    const course = await Course.findById(discussion.course);
    const hasAccess = await canAccessCourseForum(req.user, course);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'You do not have permission to access this forum.' });
    }

    const replies = await DiscussionReply.find({ discussion: discussion._id })
      .populate('author', 'name email role profileImage')
      .sort({ createdAt: 1 });

    return res.json({
      success: true,
      data: replies.map((r) => r.toClient()),
    });
  } catch (error) {
    return next(error);
  }
}

async function createReply(req, res, next) {
  try {
    const discussion = await Discussion.findById(req.params.discussionId);
    if (!discussion) {
      return res.status(404).json({ success: false, message: 'Discussion not found.' });
    }

    const course = await Course.findById(discussion.course);
    const hasAccess = await canAccessCourseForum(req.user, course);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'You do not have permission to access this forum.' });
    }

    const message = String(req.body.message || '').trim();
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }

    const reply = await DiscussionReply.create({
      discussion: discussion._id,
      author: req.user._id,
      message,
    });

    await reply.populate('author', 'name email role profileImage');

    return res.status(201).json({
      success: true,
      message: 'Reply posted.',
      data: reply.toClient(),
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteReply(req, res, next) {
  try {
    const reply = await DiscussionReply.findById(req.params.replyId);
    if (!reply) {
      return res.status(404).json({ success: false, message: 'Reply not found.' });
    }

    const isAuthor = String(reply.author) === String(req.user._id);
    const isAdmin = String(req.user.role).toLowerCase() === 'admin';

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ success: false, message: 'You do not have permission to delete this reply.' });
    }

    await reply.deleteOne();

    return res.json({ success: true, message: 'Reply deleted.' });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listTopics,
  createTopic,
  getTopic,
  deleteTopic,
  listReplies,
  createReply,
  deleteReply,
};
