import React, { useState, useEffect } from 'react';
import {
  fetchDiscussions,
  createDiscussion,
  deleteDiscussion,
  fetchReplies,
  createReply,
  deleteReply,
} from '../utils/discussionApi';

function CourseDiscussionPanel({ courseId, course, currentUser }) {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [replies, setReplies] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);

  // Form states
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newReplyMessage, setNewReplyMessage] = useState('');
  const [formError, setFormError] = useState('');

  const isAdmin = currentUser?.role === 'admin';

  const loadTopics = (search = searchQuery) => {
    setLoading(true);
    setError('');
    fetchDiscussions(courseId, search)
      .then((data) => {
        setTopics(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load discussions.');
        setLoading(false);
      });
  };

  useEffect(() => {
    setSelectedTopic(null);
    setIsCreatingTopic(false);
    setSearchQuery('');
    setNewTitle('');
    setNewDescription('');
    setNewReplyMessage('');
    setFormError('');
    loadTopics('');
  }, [courseId]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    loadTopics(val);
  };

  const handleSelectTopic = (topic) => {
    setSelectedTopic(topic);
    setReplies([]);
    setFormError('');
    setNewReplyMessage('');
    loadReplies(topic.id);
  };

  const loadReplies = (topicId) => {
    fetchReplies(topicId)
      .then((data) => {
        setReplies(data);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load replies.');
      });
  };

  const handleCreateTopic = (e) => {
    e.preventDefault();
    setFormError('');
    if (!newTitle.trim() || !newDescription.trim()) {
      setFormError('Title and description are required.');
      return;
    }

    createDiscussion(courseId, { title: newTitle.trim(), description: newDescription.trim() })
      .then((newTopic) => {
        setTopics((prev) => [newTopic, ...prev]);
        setNewTitle('');
        setNewDescription('');
        setIsCreatingTopic(false);
      })
      .catch((err) => {
        setFormError(err.message || 'Failed to create discussion topic.');
      });
  };

  const handleDeleteTopic = (e, topicId) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this discussion topic? This will also delete all replies.')) {
      return;
    }
    deleteDiscussion(topicId)
      .then(() => {
        setTopics((prev) => prev.filter((t) => t.id !== topicId));
        if (selectedTopic && selectedTopic.id === topicId) {
          setSelectedTopic(null);
        }
      })
      .catch((err) => {
        alert(err.message || 'Failed to delete discussion topic.');
      });
  };

  const handlePostReply = (e) => {
    e.preventDefault();
    setFormError('');
    if (!newReplyMessage.trim()) {
      setFormError('Message is required.');
      return;
    }

    createReply(selectedTopic.id, { message: newReplyMessage.trim() })
      .then((newReply) => {
        setReplies((prev) => [...prev, newReply]);
        setNewReplyMessage('');
      })
      .catch((err) => {
        setFormError(err.message || 'Failed to post reply.');
      });
  };

  const handleDeleteReply = (replyId) => {
    if (!window.confirm('Are you sure you want to delete this reply?')) {
      return;
    }
    deleteReply(replyId)
      .then(() => {
        setReplies((prev) => prev.filter((r) => r.id !== replyId));
      })
      .catch((err) => {
        alert(err.message || 'Failed to delete reply.');
      });
  };

  const formatTopicDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const canDeleteTopic = (topic) => {
    if (!topic || !currentUser) return false;
    return isAdmin || String(topic.author?.id || topic.author) === String(currentUser.id);
  };

  const canDeleteReply = (reply) => {
    if (!reply || !currentUser) return false;
    return isAdmin || String(reply.author?.id || reply.author) === String(currentUser.id);
  };

  return (
    <section className="forumWorkspace">
      {error && <p className="errorText formError">{error}</p>}

      {!selectedTopic ? (
        <>
          <div className="courseModuleToolbar">
            <input
              type="text"
              placeholder="Search discussion topics"
              value={searchQuery}
              onChange={handleSearchChange}
            />
            {!isCreatingTopic && (
              <button
                type="button"
                className="profilePrimaryButton"
                onClick={() => {
                  setIsCreatingTopic(true);
                  setFormError('');
                }}
              >
                + Start Discussion
              </button>
            )}
          </div>

          {isCreatingTopic && (
            <div className="forumEditorCard">
              <h4>Start a New Discussion</h4>
              <form onSubmit={handleCreateTopic} className="authForm">
                {formError && <p className="errorText formError">{formError}</p>}
                
                <label htmlFor="forum-topic-title">Topic Title</label>
                <input
                  id="forum-topic-title"
                  type="text"
                  placeholder="Enter topic title..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />

                <label htmlFor="forum-topic-desc">Description</label>
                <textarea
                  id="forum-topic-desc"
                  placeholder="What would you like to discuss?"
                  rows={5}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />

                <div className="profileModalActions">
                  <button type="submit" className="profilePrimaryButton">
                    Post Topic
                  </button>
                  <button
                    type="button"
                    className="heroButton heroButtonSecondary"
                    onClick={() => {
                      setIsCreatingTopic(false);
                      setFormError('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="forumTopicsList">
            {loading ? (
              <p className="authSubtext">Loading discussions...</p>
            ) : topics.length === 0 ? (
              <p className="courseEmptyModuleText">No discussion topics found. Be the first to start a discussion!</p>
            ) : (
              topics.map((topic) => (
                <div
                  key={topic.id}
                  className="forumTopicCard"
                  onClick={() => handleSelectTopic(topic)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectTopic(topic);
                    }
                  }}
                >
                  <div className="forumTopicHeader">
                    <h4 className="forumTopicTitle">{topic.title}</h4>
                    <span className="forumReplyBadge">
                      {topic.replyCount === 1 ? '1 Reply' : `${topic.replyCount || 0} Replies`}
                    </span>
                  </div>

                  <p className="forumTopicSnippet">
                    {topic.description.length > 180
                      ? `${topic.description.substring(0, 180)}...`
                      : topic.description}
                  </p>

                  <div className="forumTopicMeta">
                    <span className="forumAuthorInfo">
                      Posted by <strong>{topic.author?.name || 'Unknown User'}</strong>
                      {topic.author?.role && (
                        <span className={`forumRoleTag forumRole-${topic.author.role}`}>
                          {topic.author.role}
                        </span>
                      )}
                      on {formatTopicDate(topic.createdAt)}
                    </span>

                    {canDeleteTopic(topic) && (
                      <button
                        type="button"
                        className="forumDeleteButton"
                        onClick={(e) => handleDeleteTopic(e, topic.id)}
                        aria-label="Delete topic"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <div className="forumTopicDetail">
          <button
            type="button"
            className="heroButton heroButtonSecondary forumBackButton"
            onClick={() => {
              setSelectedTopic(null);
              loadTopics();
            }}
          >
            &larr; Back to Topics
          </button>

          <article className="forumMainPost">
            <div className="forumPostHeader">
              <div>
                <h3 className="forumDetailTitle">{selectedTopic.title}</h3>
                <div className="forumAuthorMetaBlock">
                  <strong>{selectedTopic.author?.name || 'Unknown User'}</strong>
                  {selectedTopic.author?.role && (
                    <span className={`forumRoleTag forumRole-${selectedTopic.author.role}`}>
                      {selectedTopic.author.role}
                    </span>
                  )}
                  <span className="forumMetaText">({selectedTopic.author?.email})</span>
                  <span className="forumMetaText">&middot; {formatTopicDate(selectedTopic.createdAt)}</span>
                </div>
              </div>
              {canDeleteTopic(selectedTopic) && (
                <button
                  type="button"
                  className="profileDangerButton"
                  onClick={(e) => handleDeleteTopic(e, selectedTopic.id)}
                >
                  Delete Topic
                </button>
              )}
            </div>

            <p className="forumPostContent">{selectedTopic.description}</p>
          </article>

          <section className="forumRepliesSection">
            <h4>Replies ({replies.length})</h4>
            <div className="forumRepliesList">
              {replies.length === 0 ? (
                <p className="courseEmptyModuleText">No replies yet. Start the conversation!</p>
              ) : (
                replies.map((reply) => (
                  <div key={reply.id} className="forumReplyCard">
                    <div className="forumReplyHeader">
                      <div className="forumReplyAuthor">
                        <strong>{reply.author?.name || 'Unknown User'}</strong>
                        {reply.author?.role && (
                          <span className={`forumRoleTag forumRole-${reply.author.role}`}>
                            {reply.author.role}
                          </span>
                        )}
                        <span className="forumMetaText">({reply.author?.email})</span>
                        <span className="forumMetaText">&middot; {formatTopicDate(reply.createdAt)}</span>
                      </div>
                      {canDeleteReply(reply) && (
                        <button
                          type="button"
                          className="forumReplyDeleteLink"
                          onClick={() => handleDeleteReply(reply.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <p className="forumReplyMessage">{reply.message}</p>
                  </div>
                ))
              )}
            </div>

            <div className="forumAddReplyCard">
              <h5>Post a Reply</h5>
              <form onSubmit={handlePostReply} className="authForm">
                {formError && <p className="errorText formError">{formError}</p>}
                <textarea
                  placeholder="Write your response here..."
                  rows={4}
                  value={newReplyMessage}
                  onChange={(e) => setNewReplyMessage(e.target.value)}
                />
                <button type="submit" className="profilePrimaryButton">
                  Submit Reply
                </button>
              </form>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export default CourseDiscussionPanel;
