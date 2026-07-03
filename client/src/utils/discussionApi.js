import { apiFetch } from './api';

export function fetchDiscussions(courseId, search = '') {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiFetch(`/api/discussions/courses/${courseId}${query}`).then((res) => res.data || []);
}

export function createDiscussion(courseId, payload) {
  return apiFetch(`/api/discussions/courses/${courseId}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then((res) => res.data);
}

export function fetchDiscussion(discussionId) {
  return apiFetch(`/api/discussions/${discussionId}`).then((res) => res.data);
}

export function deleteDiscussion(discussionId) {
  return apiFetch(`/api/discussions/${discussionId}`, {
    method: 'DELETE',
  });
}

export function fetchReplies(discussionId) {
  return apiFetch(`/api/discussions/${discussionId}/replies`).then((res) => res.data || []);
}

export function createReply(discussionId, payload) {
  return apiFetch(`/api/discussions/${discussionId}/replies`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then((res) => res.data);
}

export function deleteReply(replyId) {
  return apiFetch(`/api/discussions/replies/${replyId}`, {
    method: 'DELETE',
  });
}
