import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  cancelLiveClass,
  createLiveClass,
  fetchLiveClassAttendance,
  fetchLiveClasses,
  syncLiveClassAttendance,
} from '../utils/liveClassApi';

const STATUS_LABELS = {
  scheduled: 'Scheduled',
  live: 'Live now',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function formatClassWhen(iso, durationMinutes) {
  if (!iso) return '';
  const start = new Date(iso);
  const end = new Date(start.getTime() + (durationMinutes || 60) * 60 * 1000);
  const datePart = start.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timePart = `${start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  return `${datePart} · ${timePart}`;
}

function toLocalInputValue(date) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultScheduleStart() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 2);
  return toLocalInputValue(d);
}

function LiveClassCard({
  item,
  canManage,
  moduleTitle,
  onCancel,
  onSync,
  onViewAttendance,
  busyId,
  attendancePreview,
}) {
  const status = item.status || 'scheduled';
  const isLive = status === 'live';
  const isCancelled = status === 'cancelled';
  const joinHref = item.joinUrl;
  const hostHref = item.startUrl;

  return (
    <article className={`liveClassCard liveClassCard--${status}`}>
      <div className="liveClassCardGlow" aria-hidden />
      <header className="liveClassCardHeader">
        <div>
          <span className={`liveClassStatusBadge liveClassStatusBadge--${status}`}>
            {isLive && <span className="liveClassPulse" aria-hidden />}
            {STATUS_LABELS[status] || status}
          </span>
          <h4 className="liveClassTitle">{item.title}</h4>
        </div>
        {item.moduleId != null && (
          <span className="liveClassModuleTag">{moduleTitle || `Module ${item.moduleId}`}</span>
        )}
      </header>

      <p className="liveClassWhen">{formatClassWhen(item.scheduledStartAt, item.durationMinutes)}</p>
      {item.description ? <p className="liveClassDescription">{item.description}</p> : null}

      <div className="liveClassMeta">
        <span>{item.durationMinutes} min</span>
        {canManage && (
          <span>Attendance threshold: {item.attendanceThresholdMinutes ?? 20} min</span>
        )}
        {item.instructorName && <span>Host: {item.instructorName}</span>}
      </div>

      {item.password ? (
        <p className="liveClassPasscode">
          Passcode: <code>{item.password}</code>
        </p>
      ) : null}

      <div className="liveClassActions">
        {!isCancelled && (isLive || status === 'scheduled') && joinHref && (
          <a
            className={`heroButton ${isLive ? 'liveClassJoinButton' : 'heroButtonSecondary'}`}
            href={joinHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            {isLive ? 'Join live class' : 'Open join link'}
          </a>
        )}
        {canManage && hostHref && !isCancelled && status !== 'completed' && (
          <a
            className="heroButton heroButtonSecondary"
            href={hostHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            Start as host
          </a>
        )}
        {canManage && status !== 'cancelled' && status !== 'completed' && (
          <button
            type="button"
            className="heroButton heroButtonSecondary liveClassDangerButton"
            disabled={busyId === item.id}
            onClick={() => onCancel(item)}
          >
            Cancel class
          </button>
        )}
        {canManage && (status === 'completed' || status === 'live') && (
          <button
            type="button"
            className="profilePrimaryButton"
            disabled={busyId === item.id}
            onClick={() => onSync(item)}
          >
            {busyId === item.id ? 'Syncing…' : 'Sync attendance'}
          </button>
        )}
        {canManage && item.attendanceSyncedAt && (
          <button
            type="button"
            className="heroButton heroButtonSecondary"
            onClick={() => onViewAttendance(item)}
          >
            View attendance
          </button>
        )}
      </div>

      {attendancePreview?.length > 0 && (
        <div className="liveClassAttendancePreview">
          <h5>Attendance summary</h5>
          <ul>
            {attendancePreview.slice(0, 6).map((row) => (
              <li key={row.id}>
                <span>{row.studentName || row.studentEmail}</span>
                <span className={`liveClassAttendTag liveClassAttendTag--${row.status}`}>
                  {row.status === 'present' ? 'Present' : 'Absent'}
                  {row.durationMinutes != null ? ` · ${row.durationMinutes} min` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function CourseLiveClassesPanel({ courseId, course, currentUser, canManage }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    scheduledStartAt: defaultScheduleStart(),
    durationMinutes: 60,
    moduleId: '',
    attendanceThresholdMinutes: 20,
  });
  const [formError, setFormError] = useState('');
  const [attendanceByClass, setAttendanceByClass] = useState({});

  const modules = course?.modules || [];

  const moduleTitleById = useMemo(() => {
    const map = new Map();
    modules.forEach((m) => map.set(m.id, m.title || `Module ${m.id}`));
    return map;
  }, [modules]);

  const loadAll = useCallback(() => {
    setLoading(true);
    setError('');
    fetchLiveClasses(courseId, { segment: 'all' })
      .then((data) => {
        setClasses(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Could not load live classes.');
        setLoading(false);
      });
  }, [courseId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const grouped = useMemo(() => {
    const live = [];
    const upcoming = [];
    const completed = [];
    const cancelled = [];
    classes.forEach((c) => {
      const s = c.status;
      if (s === 'cancelled') cancelled.push(c);
      else if (s === 'live') live.push(c);
      else if (s === 'completed') completed.push(c);
      else upcoming.push(c);
    });
    const byTime = (a, b) => new Date(a.scheduledStartAt) - new Date(b.scheduledStartAt);
    upcoming.sort(byTime);
    live.sort(byTime);
    completed.sort((a, b) => new Date(b.scheduledStartAt) - new Date(a.scheduledStartAt));
    cancelled.sort((a, b) => new Date(b.scheduledStartAt) - new Date(a.scheduledStartAt));
    return { live, upcoming, completed, cancelled };
  }, [classes]);

  const handleSchedule = (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.title.trim()) {
      setFormError('Please enter a class title.');
      return;
    }
    const payload = {
      courseId,
      title: form.title.trim(),
      description: form.description.trim(),
      scheduledStartAt: new Date(form.scheduledStartAt).toISOString(),
      durationMinutes: Number(form.durationMinutes) || 60,
      attendanceThresholdMinutes: Number(form.attendanceThresholdMinutes) || 20,
    };
    if (form.moduleId !== '') payload.moduleId = Number(form.moduleId);

    setBusyId('create');
    createLiveClass(payload)
      .then(() => {
        setShowSchedule(false);
        setForm({
          title: '',
          description: '',
          scheduledStartAt: defaultScheduleStart(),
          durationMinutes: 60,
          moduleId: '',
          attendanceThresholdMinutes: 20,
        });
        loadAll();
      })
      .catch((err) => setFormError(err.message || 'Could not schedule class.'))
      .finally(() => setBusyId(''));
  };

  const handleCancel = (item) => {
    if (!window.confirm(`Cancel "${item.title}"? Enrolled students will no longer join this session.`)) return;
    setBusyId(item.id);
    cancelLiveClass(item.id)
      .then(() => loadAll())
      .catch((err) => setError(err.message || 'Could not cancel class.'))
      .finally(() => setBusyId(''));
  };

  const handleSync = (item) => {
    setBusyId(item.id);
    syncLiveClassAttendance(item.id)
      .then((data) => {
        loadAll();
        if (data?.attendance) {
          setAttendanceByClass((prev) => ({
            ...prev,
            [item.id]: data.attendance.map((row) => ({
              ...row,
              studentName: row.studentEmail,
            })),
          }));
        }
      })
      .catch((err) => setError(err.message || 'Could not sync attendance from Zoom.'))
      .finally(() => setBusyId(''));
  };

  const handleViewAttendance = (item) => {
    fetchLiveClassAttendance(item.id)
      .then((rows) => {
        setAttendanceByClass((prev) => ({ ...prev, [item.id]: rows }));
      })
      .catch((err) => setError(err.message || 'Could not load attendance.'));
  };

  const renderSection = (title, subtitle, items, emptyText) => {
    if (!items.length && canManage) return null;
    return (
      <section className="liveClassSection">
        <div className="liveClassSectionHead">
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {items.length === 0 ? (
          <p className="liveClassEmpty">{emptyText}</p>
        ) : (
          <div className="liveClassGrid">
            {items.map((item) => (
              <LiveClassCard
                key={item.id}
                item={item}
                canManage={canManage}
                moduleTitle={moduleTitleById.get(item.moduleId)}
                busyId={busyId}
                onCancel={handleCancel}
                onSync={handleSync}
                onViewAttendance={handleViewAttendance}
                attendancePreview={attendanceByClass[item.id]}
              />
            ))}
          </div>
        )}
      </section>
    );
  };

  return (
    <section className="liveClassWorkspace">
      <div className="liveClassHero">
        <div>
          <h3 className="liveClassHeroTitle">Live classes</h3>
          <p className="liveClassHeroText">
            Join scheduled Zoom sessions for this course. Attendance is tracked separately from module progress.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            className="profilePrimaryButton liveClassScheduleButton"
            onClick={() => setShowSchedule((v) => !v)}
          >
            {showSchedule ? 'Close scheduler' : '+ Schedule live class'}
          </button>
        )}
      </div>

      {error && <p className="courseFormError">{error}</p>}

      {canManage && showSchedule && (
        <form className="liveClassScheduleCard" onSubmit={handleSchedule}>
          <h4>Schedule a new session</h4>
          {formError && <p className="courseFormError">{formError}</p>}
          <label htmlFor="lc-title">Title</label>
          <input
            id="lc-title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Week 3 Q&A"
            required
          />
          <label htmlFor="lc-desc">Description (optional)</label>
          <textarea
            id="lc-desc"
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="What will you cover in this session?"
          />
          <div className="liveClassFormRow">
            <div>
              <label htmlFor="lc-start">Start time</label>
              <input
                id="lc-start"
                type="datetime-local"
                value={form.scheduledStartAt}
                onChange={(e) => setForm((f) => ({ ...f, scheduledStartAt: e.target.value }))}
                required
              />
            </div>
            <div>
              <label htmlFor="lc-duration">Duration (minutes)</label>
              <input
                id="lc-duration"
                type="number"
                min={15}
                max={480}
                value={form.durationMinutes}
                onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))}
              />
            </div>
          </div>
          <div className="liveClassFormRow">
            <div>
              <label htmlFor="lc-module">Link to module (optional)</label>
              <select
                id="lc-module"
                value={form.moduleId}
                onChange={(e) => setForm((f) => ({ ...f, moduleId: e.target.value }))}
              >
                <option value="">Whole course</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title || `Module ${m.id}`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="lc-threshold">Attendance threshold (min)</label>
              <input
                id="lc-threshold"
                type="number"
                min={1}
                max={240}
                value={form.attendanceThresholdMinutes}
                onChange={(e) => setForm((f) => ({ ...f, attendanceThresholdMinutes: e.target.value }))}
              />
            </div>
          </div>
          <div className="liveClassFormActions">
            <button type="submit" className="profilePrimaryButton" disabled={busyId === 'create'}>
              {busyId === 'create' ? 'Creating…' : 'Create & notify students'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="liveClassEmpty">Loading live classes…</p>
      ) : (
        <>
          {renderSection(
            'Happening now',
            'Your instructor is live — join using the button below.',
            grouped.live,
            'No live sessions right now.',
          )}
          {renderSection(
            'Upcoming',
            'Save the date — join links open in Zoom.',
            grouped.upcoming,
            canManage
              ? 'No upcoming classes. Schedule one to notify enrolled students.'
              : 'No upcoming live classes yet.',
          )}
          {renderSection(
            'Completed',
            'Past sessions for this course.',
            grouped.completed,
            'No completed sessions yet.',
          )}
          {!canManage && grouped.cancelled.length > 0 && (
            renderSection('Cancelled', null, grouped.cancelled, '')
          )}
          {canManage && renderSection('Cancelled', null, grouped.cancelled, 'No cancelled classes.')}
        </>
      )}
    </section>
  );
}

export default CourseLiveClassesPanel;
