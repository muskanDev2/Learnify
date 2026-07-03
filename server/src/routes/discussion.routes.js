const express = require('express');
const {
  listTopics,
  createTopic,
  getTopic,
  deleteTopic,
  listReplies,
  createReply,
  deleteReply,
} = require('../controllers/discussion.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/courses/:courseId', requireAuth, listTopics);
router.post('/courses/:courseId', requireAuth, createTopic);
router.get('/:discussionId', requireAuth, getTopic);
router.delete('/:discussionId', requireAuth, deleteTopic);
router.get('/:discussionId/replies', requireAuth, listReplies);
router.post('/:discussionId/replies', requireAuth, createReply);
router.delete('/replies/:replyId', requireAuth, deleteReply);

module.exports = router;
