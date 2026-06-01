import { apiFetch } from './api';

export function fetchNotes(courseId) {
  return apiFetch(`/api/notes/${courseId}`).then((result) => result.data || []);
}

export function saveNote(courseId, noteData) {
  return apiFetch(`/api/notes/${courseId}`, {
    method: 'POST',
    body: JSON.stringify(noteData),
  }).then((result) => result.data);
}

export function deleteNote(noteId) {
  return apiFetch(`/api/notes/${noteId}`, {
    method: 'DELETE',
  });
}
