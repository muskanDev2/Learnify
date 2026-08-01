import {
  getYoutubeEmbedUrl,
  getYoutubeLinkValidationError,
  isSafeHttpUrl,
} from './youtube';

/** Merges legacy single `link` with `links[]` for display and editing. */
export function normalizeContentItemLinks(source) {
  if (Array.isArray(source?.links) && source.links.length) {
    return source.links.map((entry) => String(entry || '').trim()).filter(Boolean);
  }

  const legacy = String(source?.link || '').trim();
  return legacy ? [legacy] : [];
}

export function sanitizeContentLinksForSave(links) {
  if (!Array.isArray(links)) return [];
  return links.map((entry) => String(entry || '').trim()).filter(Boolean);
}

/** Per-link validation errors (empty string means OK). */
export function getContentLinksValidationErrors(links) {
  const list = Array.isArray(links) ? links : [];
  return list.map((link) => getYoutubeLinkValidationError(link));
}

export function hasContentLinksValidationErrors(links) {
  return getContentLinksValidationErrors(links).some((message) => Boolean(message));
}

/** Groups multiple links for the student content viewer. */
export function resolveContentItemLinks(links) {
  const normalized = normalizeContentItemLinks({ links });

  const youtubeEmbeds = [];
  const externalUrls = [];
  const invalidLinks = [];

  normalized.forEach((url, index) => {
    const embedUrl = getYoutubeEmbedUrl(url);
    if (embedUrl) {
      youtubeEmbeds.push({ id: `${index}-${embedUrl}`, url, embedUrl });
      return;
    }
    if (isSafeHttpUrl(url)) {
      externalUrls.push({ id: `${index}-${url}`, url });
      return;
    }
    invalidLinks.push({ id: `${index}-invalid`, url });
  });

  return { youtubeEmbeds, externalUrls, invalidLinks };
}
