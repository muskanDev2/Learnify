export function getQuizPublishStatus(quiz) {
  return quiz?.publishStatus === 'draft' ? 'draft' : 'published';
}

export function isQuizPublished(quiz) {
  return getQuizPublishStatus(quiz) === 'published';
}

export function isQuizVisibleToStudent(item) {
  if (item?.type !== 'quiz') return true;
  return isQuizPublished(item);
}

export function getQuizPublishStatusLabel(quiz) {
  return getQuizPublishStatus(quiz) === 'draft' ? 'Draft' : 'Published';
}
