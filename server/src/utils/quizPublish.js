/** Legacy quizzes without publishStatus remain visible to students. */
function isQuizPublished(quiz) {
  return quiz?.publishStatus !== 'draft';
}

function isQuizDraft(quiz) {
  return quiz?.publishStatus === 'draft';
}

function filterCourseModulesForStudent(modules) {
  if (!Array.isArray(modules)) return [];

  return modules.map((module) => ({
    ...module,
    items: (module.items || []).filter(
      (item) => item.type !== 'quiz' || isQuizPublished(item),
    ),
  }));
}

module.exports = {
  filterCourseModulesForStudent,
  isQuizDraft,
  isQuizPublished,
};
