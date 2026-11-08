'use strict';

const { isMastered, difficultyForLevel } = require('./skill');
const { WARMUP_SUBJECT } = require('../config/taxonomy');

const PROBLEM_MINUTES = { easy: 20, medium: 35, hard: 50 };
const PREFERENCE = {
  easy: ['easy', 'medium', 'hard'],
  medium: ['medium', 'easy', 'hard'],
  hard: ['hard', 'medium', 'easy'],
};
const QUIZ_MINUTES = 12;
const QUIZ_QUESTIONS = 5;
/** Share of a day that reading and watching may take. */
const RESOURCE_SHARE = 0.45;
/** Days shorter than this get no DSA warm-up, so the main topic is not squeezed out. */
const WARMUP_MIN_DAY_MINUTES = 75;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' plus n days, computed in UTC so no timezone drift. */
function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Split totalDays across items in proportion to priority. Every chosen item gets at least one day.
 * If there are more items than days, only the highest-priority items are kept.
 * items must be sorted by priority, highest first.
 */
function allocateDays(items, totalDays) {
  const chosen = items.slice(0, Math.max(0, totalDays));
  if (!chosen.length) return [];
  const sum = chosen.reduce((s, i) => s + i.priority, 0);
  const shares = chosen.map((i) => (sum > 0 ? (totalDays * i.priority) / sum : totalDays / chosen.length));
  const alloc = shares.map((s) => Math.max(1, Math.floor(s)));

  let total = alloc.reduce((a, b) => a + b, 0);
  while (total > totalDays) {
    let pick = -1;
    for (let i = 0; i < alloc.length; i += 1) {
      if (alloc[i] > 1 && (pick === -1 || alloc[i] - shares[i] > alloc[pick] - shares[pick])) pick = i;
    }
    if (pick === -1) break;
    alloc[pick] -= 1;
    total -= 1;
  }
  while (total < totalDays) {
    let pick = 0;
    for (let i = 1; i < alloc.length; i += 1) {
      if (shares[i] - alloc[i] > shares[pick] - alloc[pick]) pick = i;
    }
    alloc[pick] += 1;
    total += 1;
  }
  return chosen.map((item, i) => ({ item, days: alloc[i] }));
}

function orderProblems(problems, level) {
  const pref = PREFERENCE[difficultyForLevel(level)];
  return [...problems].sort(
    (a, b) => pref.indexOf(a.difficulty) - pref.indexOf(b.difficulty) || String(a.title).localeCompare(String(b.title)),
  );
}

/**
 * Build the day-by-day schedule.
 *
 * subtopics: [{ subject, subtopic, label, level, priority }]  (priority = weight x (1 - level))
 * problems:  [{ id, title, url, subject, subtopic, difficulty }]  candidates not yet solved
 * items:     [{ id, type: 'resource'|'practical', title, url, description, minutes, subject, subtopic }]
 * startDate: 'YYYY-MM-DD' of day 1
 *
 * Every block of days is about one subtopic and is made of:
 *   - reading and watching tasks (resources), spread over the block, at most 45% of a day
 *   - one hands-on task (practical) per day while any are left
 *   - LeetCode problems, only for subtopics that have some (DSA, SQL, a few OOP)
 *   - one DSA warm-up problem on days whose main topic is not DSA, when DSA still needs work
 *   - a short quiz on the subtopic on the last day of the block
 */
function buildPlan({ days, hoursPerDay, startDate, subtopics, problems, items = [] }) {
  const totalDays = Math.max(1, Math.floor(days));
  const dayMinutes = Math.max(15, Math.round(hoursPerDay * 60));

  const skipped = subtopics.filter((s) => isMastered(s.level));
  const active = subtopics
    .filter((s) => !isMastered(s.level) && s.priority > 0)
    .sort((a, b) => b.priority - a.priority);

  if (!active.length) {
    return { schedule: [], allocations: [], skipped, mastered: true, totalDays };
  }

  const allocated = allocateDays(active, totalDays);
  const used = new Set();
  const schedule = [];
  const allocations = [];
  let dayNumber = 1;

  const dsaTopics = active.filter((s) => s.subject === WARMUP_SUBJECT);
  const itemsFor = (item, type) => items.filter((x) => x.type === type && x.subject === item.subject && x.subtopic === item.subtopic);

  /** Next unused DSA problem, from the DSA subtopic that needs the most work. */
  function takeWarmup() {
    for (const topic of dsaTopics) {
      const pool = orderProblems(
        problems.filter((p) => p.subject === WARMUP_SUBJECT && p.subtopic === topic.subtopic && !used.has(String(p.id))),
        topic.level,
      );
      if (pool.length) {
        used.add(String(pool[0].id));
        return pool[0];
      }
    }
    return null;
  }

  for (const { item, days: n } of allocated) {
    const pool = orderProblems(
      problems.filter((p) => p.subject === item.subject && p.subtopic === item.subtopic && !used.has(String(p.id))),
      item.level,
    );
    const resources = itemsFor(item, 'resource');
    const practicals = itemsFor(item, 'practical');
    const label = item.label || item.subtopic;
    const warmupWanted = item.subject !== WARMUP_SUBJECT && dayMinutes >= WARMUP_MIN_DAY_MINUTES && dsaTopics.length > 0;

    allocations.push({
      subject: item.subject,
      subtopic: item.subtopic,
      label,
      level: item.level,
      priority: item.priority,
      days: n,
      startDay: dayNumber,
      endDay: dayNumber + n - 1,
    });

    for (let i = 0; i < n; i += 1) {
      const tasks = [];
      let budget = dayMinutes;

      const warmup = warmupWanted ? takeWarmup() : null;
      if (warmup) budget -= PROBLEM_MINUTES[warmup.difficulty] || 35;
      const isLast = i === n - 1;
      if (isLast) budget -= QUIZ_MINUTES;

      // Reading and watching
      if (resources.length) {
        const cap = Math.round(dayMinutes * RESOURCE_SHARE);
        let spent = 0;
        while (resources.length && (spent === 0 || spent + resources[0].minutes <= cap)) {
          const r = resources.shift();
          spent += r.minutes;
          tasks.push({ type: 'resource', title: r.title, minutes: r.minutes, itemId: r.id, url: r.url, description: r.description });
        }
        budget -= spent;
      } else if (i === 0) {
        const m = Math.round(dayMinutes * 0.4);
        tasks.push({ type: 'study', title: `Learn: ${label}`, minutes: m });
        budget -= m;
      }

      // One hands-on task a day while there are any, if the day has room for it
      if (practicals.length && budget >= Math.round(practicals[0].minutes * 0.6)) {
        const pr = practicals.shift();
        tasks.push({ type: 'practical', title: pr.title, minutes: pr.minutes, itemId: pr.id, description: pr.description, url: pr.url || undefined });
        budget -= pr.minutes;
      }

      // Problems for subtopics that have them
      let assigned = 0;
      while (pool.length) {
        const next = pool[0];
        const cost = PROBLEM_MINUTES[next.difficulty] || 35;
        if (assigned > 0 && budget < cost) break;
        pool.shift();
        used.add(String(next.id));
        assigned += 1;
        budget -= cost;
        tasks.push({ type: 'problem', title: next.title, minutes: cost, problemId: String(next.id), url: next.url, difficulty: next.difficulty });
        if (budget <= 0) break;
      }

      if (warmup) {
        tasks.push({
          type: 'problem',
          title: warmup.title,
          minutes: PROBLEM_MINUTES[warmup.difficulty] || 35,
          problemId: String(warmup.id),
          url: warmup.url,
          difficulty: warmup.difficulty,
          warmup: true,
        });
      }

      if (isLast) {
        tasks.push({
          type: 'quiz',
          title: `Quiz: ${label}`,
          minutes: QUIZ_MINUTES,
          subject: item.subject,
          subtopic: item.subtopic,
          questionCount: QUIZ_QUESTIONS,
        });
      }

      if (!tasks.length) {
        tasks.push({ type: 'review', title: `Revise ${label}: write short notes from the earlier resources`, minutes: Math.max(15, budget) });
      }

      schedule.push({
        dayNumber,
        date: addDays(startDate, dayNumber - 1),
        subject: item.subject,
        subtopic: item.subtopic,
        label,
        tasks: tasks.map((t, k) => ({ id: `d${dayNumber}-t${k + 1}`, ...t })),
      });
      dayNumber += 1;
    }
  }

  return { schedule, allocations, skipped, mastered: false, totalDays };
}

module.exports = { PROBLEM_MINUTES, QUIZ_MINUTES, QUIZ_QUESTIONS, addDays, allocateDays, buildPlan };
