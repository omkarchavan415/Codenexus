'use strict';

/**
 * Checks that every seeded LeetCode URL and study resource link still resolves (YouTube searches are skipped:
 * a search page always exists). Needs internet access, so run it on your own
 * machine:  npm run verify:problems
 * LeetCode may answer 403 to scripted requests; those are reported separately and are not failures.
 */
const { problems } = require('../seed/data/problems');
const { studyItems } = require('../seed/data/studyItems');

const targets = [
  ...problems.map((p) => ({ url: p.url, label: `problem ${p.title}` })),
  ...studyItems.filter((i) => i.url && !i.url.includes('youtube.com/results')).map((i) => ({ url: i.url, label: `${i.subject}/${i.subtopic} ${i.title}` })),
];

async function check(url) {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 CodeNexus link check' }, signal: AbortSignal.timeout(15000) });
    return res.status;
  } catch (err) {
    return `error: ${err.message}`;
  }
}

async function main() {
  const bad = [];
  const blocked = [];
  for (let i = 0; i < targets.length; i += 5) {
    const batch = targets.slice(i, i + 5);
    const results = await Promise.all(batch.map((p) => check(p.url)));
    results.forEach((status, j) => {
      if (status === 404) bad.push(`${batch[j].url}  (${batch[j].label})`);
      else if (status !== 200) blocked.push(`${batch[j].url} -> ${status}`);
    });
  }
  console.log(`${targets.length} links checked: ${bad.length} not found, ${blocked.length} unverifiable`);
  bad.forEach((u) => console.log(`NOT FOUND ${u}`));
  blocked.slice(0, 20).forEach((u) => console.log(`UNVERIFIED ${u}`));
  process.exit(bad.length ? 1 : 0);
}

main();
