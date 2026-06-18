const SupportRequest = require('../models/SupportRequest');
const { createNotification, notifyAdmins } = require('../services/notification.service');

const categoryLabels = {
  account: 'Account & login',
  courses: 'Courses & enrollment',
  assignments: 'Assignments & grades',
  certificates: 'Certificates',
  technical: 'Technical issue',
  other: 'Other',
};

function buildTicketId() {
  const suffix = Date.now().toString(36).toUpperCase().slice(-6);
  return `SUP-${suffix}`;
}

function validateSupportPayload(body) {
  const category = String(body.category || '').trim();
  const subject = String(body.subject || '').trim();
  const message = String(body.message || '').trim();
  const allowed = Object.keys(categoryLabels);

  if (!allowed.includes(category)) {
    return { error: 'Please select a valid support category.' };
  }
  if (subject.length < 5) {
    return { error: 'Subject must be at least 5 characters.' };
  }
  if (message.length < 20) {
    return { error: 'Message must be at least 20 characters so we can help you properly.' };
  }

  return { category, subject, message };
}

async function createSupportRequest(req, res, next) {
  try {
    const validated = validateSupportPayload(req.body);
    if (validated.error) {
      return res.status(400).json({ success: false, message: validated.error });
    }

    const ticketId = buildTicketId();
    const request = await SupportRequest.create({
      user: req.user._id,
      userEmail: req.user.email,
      userName: req.user.name || req.user.email,
      userRole: req.user.role || 'student',
      ticketId,
      category: validated.category,
      subject: validated.subject,
      message: validated.message,
    });

    createNotification(req.user._id, {
      title: 'Support request received',
      message: `We received your request (${ticketId}). Our team will respond by email.`,
      notificationType: 'support_request',
      relatedEntityType: 'support',
      dedupeKey: `support-${ticketId}`,
      actionUrl: '/dashboard',
    }).catch(() => {});

    notifyAdmins({
      title: 'New support request',
      message: `${req.user.name || req.user.email} submitted "${validated.subject}" (${ticketId}).`,
      notificationType: 'support_request',
      relatedEntityType: 'support',
      dedupeKey: `support-admin-${ticketId}`,
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Your support request was submitted successfully.',
      data: request.toClient(),
    });
  } catch (error) {
    return next(error);
  }
}

async function listMySupportRequests(req, res, next) {
  try {
    const rows = await SupportRequest.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10);

    return res.json({
      success: true,
      data: rows.map((row) => row.toClient()),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createSupportRequest,
  listMySupportRequests,
  categoryLabels,
};
