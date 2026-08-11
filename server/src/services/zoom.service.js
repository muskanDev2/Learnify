const { getEnv } = require('../config/env');

let cachedToken = null;
let cachedTokenExpiresAt = 0;

function getZoomConfig() {
  const env = getEnv();
  return env.zoom || {};
}

function isZoomConfigured() {
  const zoom = getZoomConfig();
  return Boolean(zoom.accountId && zoom.clientId && zoom.clientSecret && zoom.hostUserId);
}

async function getAccessToken() {
  const zoom = getZoomConfig();
  if (!isZoomConfigured()) {
    throw new Error('Zoom is not configured on the server. Add ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, and ZOOM_HOST_USER_ID.');
  }

  if (cachedToken && Date.now() < cachedTokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const credentials = Buffer.from(`${zoom.clientId}:${zoom.clientSecret}`).toString('base64');
  const tokenUrl = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(zoom.accountId)}`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.reason || 'Could not authenticate with Zoom.');
  }

  cachedToken = data.access_token;
  cachedTokenExpiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
  return cachedToken;
}

async function zoomRequest(path, options = {}) {
  const token = await getAccessToken();
  const response = await fetch(`https://api.zoom.us/v2${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Zoom API error (${response.status})`);
  }
  return data;
}

function toZoomStartTime(date) {
  return new Date(date).toISOString();
}

async function createScheduledMeeting({ topic, startTime, durationMinutes, agenda = '' }) {
  const zoom = getZoomConfig();
  const payload = {
    topic,
    type: 2,
    start_time: toZoomStartTime(startTime),
    duration: Number(durationMinutes) || 60,
    timezone: 'UTC',
    agenda,
    settings: {
      join_before_host: true,
      waiting_room: false,
      approval_type: 2,
      registrants_email_notification: false,
    },
  };

  const data = await zoomRequest(`/users/${encodeURIComponent(zoom.hostUserId)}/meetings`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return {
    meetingId: String(data.id),
    meetingUuid: data.uuid || '',
    joinUrl: data.join_url,
    startUrl: data.start_url,
    password: data.password || '',
  };
}

async function cancelZoomMeeting(meetingId) {
  await zoomRequest(`/meetings/${encodeURIComponent(meetingId)}`, {
    method: 'DELETE',
  });
}

function parseParticipantDurationMinutes(participant) {
  const duration = Number(participant.duration);
  if (Number.isFinite(duration) && duration > 0) {
    return Math.round(duration);
  }

  const join = participant.join_time ? new Date(participant.join_time) : null;
  const leave = participant.leave_time ? new Date(participant.leave_time) : null;
  if (join && leave && leave > join) {
    return Math.round((leave.getTime() - join.getTime()) / 60000);
  }

  return 0;
}

async function fetchMeetingParticipantsReport(meetingId) {
  const data = await zoomRequest(
    `/report/meetings/${encodeURIComponent(meetingId)}/participants?page_size=300`,
  );
  return Array.isArray(data.participants) ? data.participants : [];
}

module.exports = {
  cancelZoomMeeting,
  createScheduledMeeting,
  fetchMeetingParticipantsReport,
  isZoomConfigured,
  parseParticipantDurationMinutes,
};
