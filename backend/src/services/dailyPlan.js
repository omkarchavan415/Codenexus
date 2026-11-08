'use strict';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The id under which a task's completion is tracked, or null for tasks with no checkbox:
 *   problem          the problem id
 *   resource/practical   the study item id
 *   quiz             quiz:<subject>:<subtopic>, done once the student submits a quiz on that subtopic
 */
function trackId(task) {
  if (task.problemId) return task.problemId;
  if (task.itemId) return task.itemId;
  if (task.type === 'quiz') return quizKey(task.subject, task.subtopic);
  return null;
}

function quizKey(subject, subtopic) {
  return `quiz:${subject}:${subtopic}`;
}

function dayIndex(startDate, todayDate) {
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ty, tm, td] = todayDate.split('-').map(Number);
  return Math.floor((Date.UTC(ty, tm - 1, td) - Date.UTC(sy, sm - 1, sd)) / DAY_MS) + 1;
}

/**
 * What to do today, plus anything left over from earlier days.
 *
 * schedule:  roadmap.schedule
 * startDate: 'YYYY-MM-DD' of day 1
 * today:     'YYYY-MM-DD' in the student's timezone
 * solved:    Set of finished task ids (problem ids, study item ids and quiz keys, see trackId)
 *
 * Only tasks with a checkbox are tracked (problems, resources, practicals, quizzes), so a past day
 * counts as overdue when at least one of those is still open. Study and review tasks are not tracked.
 */
function computeDailyPlan({ schedule, startDate, today, solved }) {
  const totalDays = schedule.length;
  const index = dayIndex(startDate, today);
  const mark = (task) => {
    const id = trackId(task);
    return { ...task, solved: id ? solved.has(id) : undefined };
  };

  if (!totalDays) {
    return { status: 'empty', dayNumber: 0, totalDays: 0, today: null, overdue: [], behindDays: 0, rescheduleRecommended: false };
  }

  const status = index < 1 ? 'upcoming' : index > totalDays ? 'finished' : 'active';
  const current = status === 'active' ? schedule[index - 1] : null;

  const overdue = [];
  const pastLimit = Math.min(index - 1, totalDays);
  for (let i = 0; i < pastLimit; i += 1) {
    const day = schedule[i];
    const pending = day.tasks.filter((t) => {
      const id = trackId(t);
      return id && !solved.has(id);
    });
    if (pending.length) {
      overdue.push({
        dayNumber: day.dayNumber,
        date: day.date,
        subject: day.subject,
        subtopic: day.subtopic,
        label: day.label,
        tasks: pending.map(mark),
      });
    }
  }

  const behindDays = overdue.length;
  return {
    status,
    dayNumber: Math.min(Math.max(index, 0), totalDays),
    totalDays,
    today: current ? { ...current, tasks: current.tasks.map(mark) } : null,
    overdue,
    behindDays,
    rescheduleRecommended: behindDays >= 2 || status === 'finished',
  };
}

/** Ids of every trackable task in a schedule. */
function trackedIds(schedule) {
  return schedule.flatMap((d) => d.tasks.map(trackId).filter(Boolean));
}

/** Share of the plan's trackable tasks finished, 0..100. */
function progressPercent(schedule, solved) {
  const ids = trackedIds(schedule);
  if (!ids.length) return 0;
  return Math.round((ids.filter((id) => solved.has(id)).length / ids.length) * 100);
}

module.exports = { dayIndex, computeDailyPlan, progressPercent, trackId, trackedIds, quizKey };
