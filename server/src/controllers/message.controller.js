const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

function toBasicUser(user) {
  if (!user) return null;
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    profileImage: user.profileImage || '',
  };
}

async function findConversationForUser(conversationId, userId) {
  return Conversation.findOne({
    _id: conversationId,
    participants: userId,
  });
}

async function getOtherParticipant(participants, currentUserId) {
  const otherId = participants.find((participantId) => String(participantId) !== String(currentUserId));
  if (!otherId) return null;
  return User.findById(otherId).select('name email role profileImage active');
}

async function getLastMessage(conversationId) {
  return Message.findOne({ conversation: conversationId }).sort({ createdAt: -1 }).populate('sender', 'name email');
}

async function getUnreadCountForConversation(conversationId, userId) {
  return Message.countDocuments({
    conversation: conversationId,
    sender: { $ne: userId },
    isRead: false,
  });
}

async function listContacts(req, res, next) {
  try {
    const users = await User.find({
      _id: { $ne: req.user._id },
      active: { $ne: false },
    })
      .select('name email role profileImage')
      .sort({ name: 1 });

    return res.json({
      success: true,
      data: users.map((user) => toBasicUser(user)),
    });
  } catch (error) {
    return next(error);
  }
}

async function getUnreadCount(req, res, next) {
  try {
    const conversations = await Conversation.find({ participants: req.user._id }).select('_id');
    const conversationIds = conversations.map((conversation) => conversation._id);

    const count = conversationIds.length
      ? await Message.countDocuments({
          conversation: { $in: conversationIds },
          sender: { $ne: req.user._id },
          isRead: false,
        })
      : 0;

    return res.json({ success: true, data: { count } });
  } catch (error) {
    return next(error);
  }
}

async function createConversation(req, res, next) {
  try {
    const participantId = req.body.participantId;

    if (!participantId) {
      return res.status(400).json({
        success: false,
        message: 'Participant id is required.',
      });
    }

    if (String(participantId) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot start a conversation with yourself.',
      });
    }

    const participant = await User.findOne({
      _id: participantId,
      active: { $ne: false },
    }).select('name email role profileImage');

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found.',
      });
    }

    const participantKey = Conversation.buildParticipantKey(req.user._id, participant._id);
    let conversation = await Conversation.findOne({ participantKey });
    let isNew = false;

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user._id, participant._id],
        participantKey,
      });
      isNew = true;
    }

    const lastMessage = await getLastMessage(conversation._id);
    const unreadCount = await getUnreadCountForConversation(conversation._id, req.user._id);

    return res.status(isNew ? 201 : 200).json({
      success: true,
      message: 'Conversation ready.',
      data: conversation.toClient({
        otherParticipant: toBasicUser(participant),
        lastMessage: lastMessage
          ? {
              id: lastMessage._id.toString(),
              text: lastMessage.text,
              senderId: lastMessage.sender?._id?.toString() || String(lastMessage.sender),
              createdAt: lastMessage.createdAt,
            }
          : null,
        unreadCount,
      }),
    });
  } catch (error) {
    return next(error);
  }
}

async function listConversations(req, res, next) {
  try {
    const conversations = await Conversation.find({ participants: req.user._id }).sort({ updatedAt: -1 });

    const rows = await Promise.all(
      conversations.map(async (conversation) => {
        const otherUser = await getOtherParticipant(conversation.participants, req.user._id);
        const lastMessage = await getLastMessage(conversation._id);
        const unreadCount = await getUnreadCountForConversation(conversation._id, req.user._id);

        return conversation.toClient({
          otherParticipant: toBasicUser(otherUser),
          lastMessage: lastMessage
            ? {
                id: lastMessage._id.toString(),
                text: lastMessage.text,
                senderId: lastMessage.sender?._id?.toString() || String(lastMessage.sender),
                createdAt: lastMessage.createdAt,
              }
            : null,
          unreadCount,
        });
      }),
    );

    const totalUnread = rows.reduce((sum, row) => sum + (row.unreadCount || 0), 0);

    return res.json({
      success: true,
      data: {
        items: rows,
        unreadCount: totalUnread,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function getMessages(req, res, next) {
  try {
    const conversation = await findConversationForUser(req.params.conversationId, req.user._id);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found.',
      });
    }

    const messages = await Message.find({ conversation: conversation._id })
      .sort({ createdAt: 1 })
      .populate('sender', 'name email');

    await Message.updateMany(
      {
        conversation: conversation._id,
        sender: { $ne: req.user._id },
        isRead: false,
      },
      { $set: { isRead: true } },
    );

    const otherUser = await getOtherParticipant(conversation.participants, req.user._id);

    return res.json({
      success: true,
      data: {
        conversation: conversation.toClient({
          otherParticipant: toBasicUser(otherUser),
        }),
        messages: messages.map((message) => message.toClient()),
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function sendMessage(req, res, next) {
  try {
    const text = String(req.body.text || '').trim();

    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Message text is required.',
      });
    }

    if (text.length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Message must be 5000 characters or fewer.',
      });
    }

    const conversation = await findConversationForUser(req.params.conversationId, req.user._id);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found.',
      });
    }

    const message = await Message.create({
      conversation: conversation._id,
      sender: req.user._id,
      text,
      isRead: false,
    });

    await Conversation.findByIdAndUpdate(conversation._id, { updatedAt: new Date() });

    await message.populate('sender', 'name email');

    return res.status(201).json({
      success: true,
      message: 'Message sent successfully.',
      data: message.toClient(),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createConversation,
  getMessages,
  getUnreadCount,
  listContacts,
  listConversations,
  sendMessage,
};
