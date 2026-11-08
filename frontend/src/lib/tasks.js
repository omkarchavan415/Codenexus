/**
 * The id under which a task's completion is tracked, or null for a task with no checkbox.
 * Mirrors the backend: problem id, study item id, or quiz:<subject>:<subtopic>.
 */
export function trackId(task) {
  if (task.problemId) return task.problemId;
  if (task.itemId) return task.itemId;
  if (task.type === 'quiz') return `quiz:${task.subject}:${task.subtopic}`;
  return null;
}

/** Tasks that count towards progress. */
export function trackedTasks(schedule) {
  return schedule.flatMap((d) => d.tasks).filter((t) => trackId(t));
}

export const TASK_LABEL = {
  study: 'Learn',
  review: 'Revise',
  revision: 'Revise',
  resource: 'Read or watch',
  practical: 'Hands-on',
  quiz: 'Quiz',
  problem: 'Problem',
};
