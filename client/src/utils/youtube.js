const YOUTUBE_VIDEO_ID_PATTERN = /^[\w-]{11}$/;

function normalizeYoutubeHostname(hostname) {
  return String(hostname || '')
    .toLowerCase()
    .replace(/^www\./, '');
}

function isValidYoutubeVideoId(value) {
  return typeof value === 'string' && YOUTUBE_VIDEO_ID_PATTERN.test(value);
}

/**
 * Extracts a YouTube video id from watch or youtu.be URLs. Returns null for invalid input.
 */
export function extractYoutubeVideoId(url) {
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim();
  if (!trimmed) return null;

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  const host = normalizeYoutubeHostname(parsed.hostname);

  if (host === 'youtu.be') {
    const id = parsed.pathname.replace(/^\//, '').split('/')[0];
    return isValidYoutubeVideoId(id) ? id : null;
  }

  if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (parsed.pathname === '/watch') {
      const id = parsed.searchParams.get('v');
      return isValidYoutubeVideoId(id) ? id : null;
    }

    const embedMatch = parsed.pathname.match(/^\/embed\/([^/?#]+)/);
    if (embedMatch && isValidYoutubeVideoId(embedMatch[1])) {
      return embedMatch[1];
    }
  }

  return null;
}

export function isYoutubeUrl(url) {
  return extractYoutubeVideoId(url) !== null;
}

export function getYoutubeEmbedUrl(url) {
  const videoId = extractYoutubeVideoId(url);
  if (!videoId) return null;
  return `https://www.youtube.com/embed/${videoId}`;
}

/** True when the string appears to reference YouTube (for instructor validation). */
export function looksLikeYoutubeUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.trim().toLowerCase();
  if (!lower) return false;
  return lower.includes('youtube.com') || lower.includes('youtu.be');
}

export function getYoutubeLinkValidationError(link) {
  const trimmed = String(link || '').trim();
  if (!trimmed) return '';
  if (looksLikeYoutubeUrl(trimmed) && !isYoutubeUrl(trimmed)) {
    return 'Enter a valid YouTube watch or youtu.be link (for example https://www.youtube.com/watch?v=VIDEO_ID).';
  }
  return '';
}

export function isSafeHttpUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Classifies a content item link for the student viewer (YouTube embed vs external URL). */
export function resolveContentItemLink(link) {
  const trimmed = String(link || '').trim();
  if (!trimmed) {
    return { youtubeEmbedUrl: null, externalUrl: null, linkInvalid: false };
  }

  const youtubeEmbedUrl = getYoutubeEmbedUrl(trimmed);
  if (youtubeEmbedUrl) {
    return { youtubeEmbedUrl, externalUrl: null, linkInvalid: false };
  }

  if (isSafeHttpUrl(trimmed)) {
    return { youtubeEmbedUrl: null, externalUrl: trimmed, linkInvalid: false };
  }

  return { youtubeEmbedUrl: null, externalUrl: null, linkInvalid: true };
}
