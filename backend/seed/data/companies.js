'use strict';

const NOTE =
  'Curated approximation from public job descriptions and commonly reported assessment patterns. Admins can adjust the weights.';

const profile = (name, slug, role, summary, skills) => ({
  name,
  slug,
  role,
  description: `${summary} ${NOTE}`,
  skills: Object.entries(skills).map(([subject, weight]) => ({ subject, weight })),
  active: true,
});

const companies = [
  profile('TCS', 'tcs', 'Assistant System Engineer', 'Mass-recruiter pattern: aptitude plus core programming, OOP and database fundamentals.', {
    OOP: 'high', DSA: 'medium', DBMS: 'medium', SQL: 'medium', OS: 'low', CN: 'low',
  }),
  profile('Infosys', 'infosys', 'Systems Engineer', 'Programming logic, OOP and database questions; stronger DSA for the specialist programmer track.', {
    OOP: 'high', DSA: 'medium', SQL: 'high', DBMS: 'medium', OS: 'low', CN: 'low',
  }),
  profile('Accenture', 'accenture', 'Associate Software Engineer', 'Cognitive and technical screening that includes networking and cloud fundamentals.', {
    OOP: 'medium', DSA: 'medium', DBMS: 'medium', SQL: 'medium', CN: 'medium', OS: 'low',
  }),
  profile('Wipro', 'wipro', 'Project Engineer', 'Aptitude plus coding basics and computer-science fundamentals.', {
    DSA: 'medium', OOP: 'medium', DBMS: 'medium', SQL: 'low', OS: 'low', CN: 'low',
  }),
  profile('Cognizant', 'cognizant', 'Programmer Analyst', 'Coding fundamentals with emphasis on OOP, databases and SQL.', {
    OOP: 'high', DSA: 'medium', DBMS: 'medium', SQL: 'medium', OS: 'low', CN: 'low',
  }),
  profile('Amazon', 'amazon', 'Software Development Engineer', 'Product-company bar: deep data structures and algorithms, plus design and systems basics.', {
    DSA: 'high', OOP: 'high', OS: 'medium', DBMS: 'medium', SQL: 'low', CN: 'low',
  }),
  profile('Google', 'google', 'Software Engineer', 'Algorithmic problem solving first, with strong operating-systems and networking fundamentals.', {
    DSA: 'high', OS: 'medium', CN: 'medium', OOP: 'medium', DBMS: 'low', SQL: 'low',
  }),
  profile('Microsoft', 'microsoft', 'Software Engineer', 'Data structures and algorithms with object-oriented design and operating-systems questions.', {
    DSA: 'high', OOP: 'high', OS: 'medium', DBMS: 'medium', CN: 'low', SQL: 'low',
  }),
  profile('General Placement', 'general-placement', 'Software Engineer', 'A balanced profile for campus placements when you do not have a single target company yet.', {
    DSA: 'high', OOP: 'medium', DBMS: 'medium', SQL: 'medium', OS: 'medium', CN: 'low',
  }),
];

module.exports = { companies };
