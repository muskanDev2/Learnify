import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Toast from '../components/Toast';
import { getCurrentUser } from '../utils/authUtils';
import {
  createConversation,
  fetchConversationMessages,
  fetchConversations,
  fetchMessageContacts,
  sendMessage,
} from '../utils/messageApi';

function formatMessageTime(value) {
  if (!value) return '';
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return 'Just now';
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < 2 * day) return 'Yesterday';

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatMessageStamp(value) {
  if (!value) return '';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getInitial(name, email) {
  return (name || email || '?').trim().charAt(0).toUpperCase();
}

function truncatePreview(text, max = 72) {
  const value = String(text || '').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export default function MessagesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUser = useMemo(() => getCurrentUser(), []);
  const currentUserId = currentUser?.id || '';

  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState(searchParams.get('conversationId') || '');
  const [messages, setMessages] = useState([]);
  const [activeParticipant, setActiveParticipant] = useState(null);
  const [draftMessage, setDraftMessage] = useState('');
  const [contacts, setContacts] = useState([]);
  const [showNewMessagePanel, setShowNewMessagePanel] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [listStatus, setListStatus] = useState('loading');
  const [chatStatus, setChatStatus] = useState('idle');
  const [isSending, setIsSending] = useState(false);
  const [toast, setToast] = useState({ type: 'success', text: '' });
  const messagesEndRef = useRef(null);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) || null,
    [conversations, selectedConversationId],
  );

  const filteredContacts = useMemo(() => {
    const term = contactSearch.trim().toLowerCase();
    if (!term) return contacts;
    return contacts.filter((contact) =>
      [contact.name, contact.email, contact.role].join(' ').toLowerCase().includes(term),
    );
  }, [contactSearch, contacts]);

  function showToast(type, text) {
    setToast({ type, text });
    window.setTimeout(() => setToast({ type: 'success', text: '' }), 4000);
  }

  async function loadConversations(preferredId = selectedConversationId) {
    setListStatus('loading');
    try {
      const data = await fetchConversations();
      const items = data.items || [];
      setConversations(items);

      if (preferredId && items.some((item) => item.id === preferredId)) {
        setSelectedConversationId(preferredId);
      } else if (!preferredId && items.length) {
        setSelectedConversationId(items[0].id);
      }

      setListStatus('ready');
    } catch (error) {
      setListStatus('error');
      showToast('error', error.message || 'Could not load conversations.');
    }
  }

  async function loadMessages(conversationId) {
    if (!conversationId) {
      setMessages([]);
      setActiveParticipant(null);
      setChatStatus('idle');
      return;
    }

    setChatStatus('loading');
    try {
      const data = await fetchConversationMessages(conversationId);
      setMessages(data.messages || []);
      setActiveParticipant(data.conversation?.otherParticipant || null);
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation,
        ),
      );
      setChatStatus('ready');
    } catch (error) {
      setChatStatus('error');
      showToast('error', error.message || 'Could not load messages.');
    }
  }

  useEffect(() => {
    loadConversations(searchParams.get('conversationId') || '');
  }, []);

  useEffect(() => {
    if (!selectedConversationId) return;
    loadMessages(selectedConversationId);
    setSearchParams({ conversationId: selectedConversationId }, { replace: true });
  }, [selectedConversationId]);

  useEffect(() => {
    if (chatStatus === 'ready') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, chatStatus]);

  async function handleStartConversation(participantId) {
    try {
      const conversation = await createConversation(participantId);
      setShowNewMessagePanel(false);
      setContactSearch('');
      await loadConversations(conversation.id);
      setSelectedConversationId(conversation.id);
      showToast('success', 'Conversation ready.');
    } catch (error) {
      showToast('error', error.message || 'Could not start conversation.');
    }
  }

  async function handleOpenNewMessagePanel() {
    setShowNewMessagePanel(true);
    try {
      const rows = await fetchMessageContacts();
      setContacts(rows);
    } catch (error) {
      showToast('error', error.message || 'Could not load contacts.');
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault();
    const text = draftMessage.trim();
    if (!text || !selectedConversationId || isSending) return;

    setIsSending(true);
    try {
      const savedMessage = await sendMessage(selectedConversationId, text);
      setMessages((prev) => [...prev, savedMessage]);
      setDraftMessage('');
      setConversations((prev) =>
        prev
          .map((conversation) =>
            conversation.id === selectedConversationId
              ? {
                  ...conversation,
                  updatedAt: savedMessage.createdAt,
                  lastMessage: {
                    id: savedMessage.id,
                    text: savedMessage.text,
                    senderId: savedMessage.senderId,
                    createdAt: savedMessage.createdAt,
                  },
                }
              : conversation,
          )
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
      );
    } catch (error) {
      showToast('error', error.message || 'Could not send message.');
    } finally {
      setIsSending(false);
    }
  }

  const headerParticipant = activeParticipant || selectedConversation?.otherParticipant;

  return (
    <section className="messagesPage">
      <Toast message={toast.text} type={toast.type} />

      <header className="messagesPageHeader">
        <div>
          <p className="assignmentWorkspaceEyebrow">Message Center</p>
          <h2>Messages</h2>
          <p>Send and read direct messages with other Learnify users.</p>
        </div>
        <button type="button" className="profilePrimaryButton" onClick={handleOpenNewMessagePanel}>
          New Message
        </button>
      </header>

      <div className="messagesWorkspace">
        <aside className="messagesSidebar" aria-label="Conversation list">
          <div className="messagesSidebarHeader">
            <strong>Inbox</strong>
            <span>{conversations.length} conversation(s)</span>
          </div>

          <div className="messagesConversationList">
            {listStatus === 'loading' ? (
              <div className="dashboardFeedback">Loading conversations...</div>
            ) : conversations.length ? (
              conversations.map((conversation) => {
                const other = conversation.otherParticipant;
                const isActive = conversation.id === selectedConversationId;
                const hasUnread = Number(conversation.unreadCount) > 0;

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    className={`messagesConversationItem ${isActive ? 'messagesConversationItemActive' : ''} ${hasUnread ? 'messagesConversationItemUnread' : ''}`}
                    onClick={() => setSelectedConversationId(conversation.id)}
                  >
                    <span className="messagesAvatar" aria-hidden="true">
                      {getInitial(other?.name, other?.email)}
                    </span>
                    <span className="messagesConversationBody">
                      <span className="messagesConversationTop">
                        <strong>{other?.name || 'Unknown user'}</strong>
                        <small>{formatMessageTime(conversation.lastMessage?.createdAt || conversation.updatedAt)}</small>
                      </span>
                      <span className="messagesConversationMeta">
                        <span>{other?.role || 'user'}</span>
                        {hasUnread && <em>{conversation.unreadCount} new</em>}
                      </span>
                      <span className="messagesConversationPreview">
                        {conversation.lastMessage?.text
                          ? truncatePreview(conversation.lastMessage.text)
                          : 'No messages yet. Say hello.'}
                      </span>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="messagesEmptyState">
                <h3>No conversations yet</h3>
                <p>Start a new message to connect with instructors, students, or admins.</p>
              </div>
            )}
          </div>
        </aside>

        <section className="messagesChatPanel" aria-label="Chat window">
          {selectedConversationId && headerParticipant ? (
            <>
              <header className="messagesChatHeader">
                <span className="messagesAvatar messagesAvatarLarge" aria-hidden="true">
                  {getInitial(headerParticipant.name, headerParticipant.email)}
                </span>
                <div>
                  <h3>{headerParticipant.name || 'Unknown user'}</h3>
                  <p>
                    {headerParticipant.email} · {headerParticipant.role}
                  </p>
                </div>
              </header>

              <div className="messagesThread" aria-live="polite">
                {chatStatus === 'loading' ? (
                  <div className="dashboardFeedback">Loading messages...</div>
                ) : chatStatus === 'error' ? (
                  <div className="dashboardFeedback" role="alert">
                    Could not load this conversation.
                  </div>
                ) : messages.length ? (
                  messages.map((message) => {
                    const isMine = String(message.senderId) === String(currentUserId);
                    return (
                      <article
                        key={message.id}
                        className={`messagesBubble ${isMine ? 'messagesBubbleMine' : 'messagesBubbleTheirs'}`}
                      >
                        <p>{message.text}</p>
                        <time dateTime={message.createdAt}>{formatMessageStamp(message.createdAt)}</time>
                      </article>
                    );
                  })
                ) : (
                  <div className="messagesEmptyState">
                    <h3>Start the conversation</h3>
                    <p>Send your first message to {headerParticipant.name}.</p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <form className="messagesComposer" onSubmit={handleSendMessage}>
                <label htmlFor="message-input" className="srOnly">
                  Type your message
                </label>
                <textarea
                  id="message-input"
                  rows={2}
                  value={draftMessage}
                  onChange={(event) => setDraftMessage(event.target.value)}
                  placeholder="Write a message..."
                  maxLength={5000}
                  disabled={isSending}
                />
                <button type="submit" className="profilePrimaryButton" disabled={!draftMessage.trim() || isSending}>
                  {isSending ? 'Sending...' : 'Send'}
                </button>
              </form>
            </>
          ) : (
            <div className="messagesChatPlaceholder">
              <h3>Select a conversation</h3>
              <p>Choose someone from your inbox or start a new message.</p>
              <button type="button" className="profilePrimaryButton" onClick={handleOpenNewMessagePanel}>
                New Message
              </button>
            </div>
          )}
        </section>
      </div>

      {showNewMessagePanel && (
        <div
          className="lightboxOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-message-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowNewMessagePanel(false);
          }}
        >
          <div className="lightboxCard messagesNewCard">
            <h3 id="new-message-title">Start a new message</h3>
            <p className="authSubtext">Pick a Learnify user to open a conversation.</p>
            <input
              type="search"
              value={contactSearch}
              onChange={(event) => setContactSearch(event.target.value)}
              placeholder="Search by name, email, or role"
              aria-label="Search contacts"
            />
            <ul className="messagesContactList">
              {filteredContacts.length ? (
                filteredContacts.map((contact) => (
                  <li key={contact.id}>
                    <button type="button" onClick={() => handleStartConversation(contact.id)}>
                      <span className="messagesAvatar" aria-hidden="true">
                        {getInitial(contact.name, contact.email)}
                      </span>
                      <span>
                        <strong>{contact.name}</strong>
                        <small>
                          {contact.email} · {contact.role}
                        </small>
                      </span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="messagesContactEmpty">No contacts found.</li>
              )}
            </ul>
            <div className="profileModalActions">
              <button type="button" className="heroButton heroButtonSecondary" onClick={() => setShowNewMessagePanel(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
