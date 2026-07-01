const express = require('express');
const {
  createConversation,
  getMessages,
  getUnreadCount,
  listContacts,
  listConversations,
  sendMessage,
} = require('../controllers/message.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/unread-count', requireAuth, getUnreadCount);
router.get('/contacts', requireAuth, listContacts);
router.get('/conversations', requireAuth, listConversations);
router.post('/conversations', requireAuth, createConversation);
router.get('/conversations/:conversationId/messages', requireAuth, getMessages);
router.post('/conversations/:conversationId/messages', requireAuth, sendMessage);

module.exports = router;
