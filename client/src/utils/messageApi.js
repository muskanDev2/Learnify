import { apiFetch } from './api';

export function fetchMessageContacts() {
  return apiFetch('/api/messages/contacts').then((result) => result.data || []);
}

export function fetchUnreadMessageCount() {
  return apiFetch('/api/messages/unread-count').then((result) => result.data?.count || 0);
}

export function fetchConversations() {
  return apiFetch('/api/messages/conversations').then((result) => result.data || { items: [], unreadCount: 0 });
}

export function createConversation(participantId) {
  return apiFetch('/api/messages/conversations', {
    method: 'POST',
    body: JSON.stringify({ participantId }),
  }).then((result) => result.data);
}

export function fetchConversationMessages(conversationId) {
  return apiFetch(`/api/messages/conversations/${conversationId}/messages`).then((result) => result.data);
}

export function sendMessage(conversationId, text) {
  return apiFetch(`/api/messages/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  }).then((result) => result.data);
}
