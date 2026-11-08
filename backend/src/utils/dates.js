'use strict';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TZ = 'Asia/Kolkata';

/** 'YYYY-MM-DD' for the given instant in the given IANA timezone. */
function dayKey(date, timeZone = DEFAULT_TZ) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  } catch (e) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: DEFAULT_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  }
}

function dayDiff(fromKey, toKey) {
  const [fy, fm, fd] = fromKey.split('-').map(Number);
  const [ty, tm, td] = toKey.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY_MS);
}

/**
 * Update a study streak. Activity on the same day changes nothing, the next day extends it,
 * a longer gap restarts it at 1.
 */
function updateStreak(streak, now, timeZone = DEFAULT_TZ) {
  const today = dayKey(now, timeZone);
  const current = (streak && streak.current) || 0;
  const longest = (streak && streak.longest) || 0;
  const last = streak && streak.lastActiveDay;

  let next = current;
  if (!last) next = 1;
  else {
    const gap = dayDiff(last, today);
    if (gap === 0) next = Math.max(current, 1);
    else if (gap === 1) next = current + 1;
    else if (gap > 1) next = 1;
  }
  return { current: next, longest: Math.max(longest, next), lastActiveDay: today };
}

/** The streak as it stands today: a streak that was not continued yesterday or today shows as 0. */
function activeStreak(streak, now, timeZone = DEFAULT_TZ) {
  if (!streak || !streak.lastActiveDay) return 0;
  return dayDiff(streak.lastActiveDay, dayKey(now, timeZone)) <= 1 ? streak.current : 0;
}

module.exports = { dayKey, dayDiff, updateStreak, activeStreak };
