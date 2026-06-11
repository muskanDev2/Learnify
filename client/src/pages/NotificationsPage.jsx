import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  deleteNotification,
  fetchNotificationPreferences,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from '../utils/notificationApi';
import Toast from '../components/Toast';

function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getNotificationIcon(type) {
  const normalized = String(type || '').toLowerCase();
  if (normalized.includes('material') || normalized.includes('content')) return 'MAT';
  if (normalized.includes('announcement')) return 'ANN';
  if (normalized.includes('grade') || normalized.includes('feedback')) return 'GRD';
  if (normalized.includes('quiz')) return 'QUIZ';
  if (normalized.includes('due') || normalized.includes('deadline') || normalized.includes('overdue')) return 'DUE';
  return 'LMS';
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, hasMore: false });
  const [unreadCount, setUnreadCount] = useState(0);
  const [status, setStatus] = useState('loading');
  const [toast, setToast] = useState({ type: 'success', text: '' });
  const [preferences, setPreferences] = useState(null);

  function showToast(type, text) {
    setToast({ type, text });
    window.setTimeout(() => setToast({ type: 'success', text: '' }), 4000);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadNotifications() {
      setStatus('loading');
      try {
        const data = await fetchNotifications({ page, limit: 10, status: filter });
        if (!isMounted) return;
        setItems(data.items || []);
        setPagination(data.pagination || { page, totalPages: 1, hasMore: false });
        setUnreadCount(data.unreadCount || 0);
        setStatus('ready');
      } catch (error) {
        if (!isMounted) return;
        showToast('error', error.message || 'Could not load notifications.');
        setStatus('error');
      }
    }

    loadNotifications();
    return () => {
      isMounted = false;
    };
  }, [filter, page]);

  useEffect(() => {
    let isMounted = true;
    fetchNotificationPreferences()
      .then((data) => {
        if (isMounted) setPreferences(data);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleMarkRead(notification) {
    if (!notification.isRead) {
      const updated = await markNotificationRead(notification.id);
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    if (notification.actionUrl) navigate(notification.actionUrl);
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
    showToast('success', 'All notifications marked as read.');
  }

  async function handleDelete(notificationId) {
    await deleteNotification(notificationId);
    setItems((prev) => prev.filter((item) => item.id !== notificationId));
    showToast('success', 'Notification deleted.');
  }

  function handleFilterChange(nextFilter) {
    setFilter(nextFilter);
    setPage(1);
  }

  async function handlePreferenceToggle(key) {
    const nextPreferences = { ...preferences, [key]: !preferences[key] };
    setPreferences(nextPreferences);
    try {
      await updateNotificationPreferences(nextPreferences);
      showToast('success', 'Notification preferences updated.');
    } catch (error) {
      setPreferences(preferences);
      showToast('error', error.message || 'Could not update preferences.');
    }
  }

  return (
    <section className="notificationsPage">
      <Toast message={toast.text} type={toast.type} />
      <header className="notificationsPageHeader">
        <div>
          <p className="assignmentWorkspaceEyebrow">Notification Center</p>
          <h2>Notifications</h2>
          <p>Review LMS activity, course updates, submissions, and account alerts.</p>
        </div>
        <button type="button" className="profilePrimaryButton" onClick={handleMarkAllRead} disabled={!unreadCount}>
          Mark All as Read
        </button>
      </header>

      <div className="notificationsFilters" aria-label="Filter notifications">
        {['all', 'unread', 'read'].map((option) => (
          <button
            key={option}
            type="button"
            className={filter === option ? 'notificationsFilterActive' : ''}
            onClick={() => handleFilterChange(option)}
          >
            {option.charAt(0).toUpperCase() + option.slice(1)}
          </button>
        ))}
      </div>

      {preferences && (
        <section className="notificationPreferencesPanel" aria-label="Notification preferences">
          <div>
            <h3>Notification Preferences</h3>
            <p>Choose which academic alerts you want to receive in Learnify.</p>
          </div>
          {[
            ['reminders', 'Deadline reminders'],
            ['announcements', 'Announcements'],
            ['grades', 'Grades and feedback'],
            ['courseMaterials', 'Course materials'],
          ].map(([key, label]) => (
            <label key={key} className="notificationPreferenceToggle">
              <input type="checkbox" checked={preferences[key]} onChange={() => handlePreferenceToggle(key)} />
              <span>{label}</span>
            </label>
          ))}
        </section>
      )}

      <div className="notificationsList">
        {status === 'loading' ? (
          <div className="dashboardFeedback">Loading notifications...</div>
        ) : items.length ? (
          items.map((notification) => (
            <article
              key={notification.id}
              className={`notificationCard ${!notification.isRead ? 'notificationCardUnread' : ''}`}
            >
              <div className="notificationCardHeader">
                <span className="notificationTypeIcon" aria-hidden>
                  {getNotificationIcon(notification.notificationType)}
                </span>
                <div>
                  <h3>{notification.title}</h3>
                  <span>{formatDateTime(notification.createdAt)}</span>
                </div>
                <strong>{notification.isRead ? 'Read' : 'Unread'}</strong>
              </div>
              <p>{notification.message}</p>
              <div className="notificationCardActions">
                <button type="button" className="profilePrimaryButton" onClick={() => handleMarkRead(notification)}>
                  {notification.actionUrl ? 'Open' : notification.isRead ? 'Read' : 'Mark as Read'}
                </button>
                <button type="button" className="profileDangerButton" onClick={() => handleDelete(notification.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="notificationsEmptyState">
            <h3>No notifications available.</h3>
            <p>New course activity, submissions, and account alerts will appear here.</p>
          </div>
        )}
      </div>

      {pagination.totalPages > 1 && (
        <div className="notificationsPagination">
          <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>
            Previous
          </button>
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button type="button" onClick={() => setPage((prev) => prev + 1)} disabled={!pagination.hasMore}>
            Next
          </button>
        </div>
      )}
    </section>
  );
}
