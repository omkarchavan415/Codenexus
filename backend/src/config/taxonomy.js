'use strict';

/**
 * Subjects and subtopics. Tests are subject/subtopic based, never company based.
 * Keys are stable identifiers stored in the database; labels are for display.
 */
const TAXONOMY = {
  DSA: {
    label: 'Data Structures & Algorithms',
    subtopics: [
      { key: 'arrays', label: 'Arrays' },
      { key: 'strings', label: 'Strings' },
      { key: 'hashing', label: 'Hashing' },
      { key: 'linked-list', label: 'Linked List' },
      { key: 'stack-queue', label: 'Stack & Queue' },
      { key: 'trees', label: 'Trees' },
      { key: 'graphs', label: 'Graphs' },
      { key: 'dynamic-programming', label: 'Dynamic Programming' },
      { key: 'sorting-searching', label: 'Sorting & Searching' },
    ],
  },
  OOP: {
    label: 'Object-Oriented Programming',
    subtopics: [
      { key: 'oop-basics', label: 'Classes & Objects' },
      { key: 'inheritance', label: 'Inheritance' },
      { key: 'polymorphism', label: 'Polymorphism' },
      { key: 'abstraction-encapsulation', label: 'Abstraction & Encapsulation' },
      { key: 'design-principles', label: 'SOLID & Design Principles' },
    ],
  },
  DBMS: {
    label: 'Database Management Systems',
    subtopics: [
      { key: 'er-model-keys', label: 'ER Model & Keys' },
      { key: 'normalization', label: 'Normalization' },
      { key: 'transactions-acid', label: 'Transactions & ACID' },
      { key: 'indexing', label: 'Indexing' },
      { key: 'concurrency-control', label: 'Concurrency Control' },
    ],
  },
  SQL: {
    label: 'SQL',
    subtopics: [
      { key: 'basic-queries', label: 'Basic Queries' },
      { key: 'joins', label: 'Joins' },
      { key: 'aggregation', label: 'Aggregation & GROUP BY' },
      { key: 'subqueries', label: 'Subqueries' },
      { key: 'advanced-sql', label: 'Window Functions & Advanced SQL' },
    ],
  },
  OS: {
    label: 'Operating Systems',
    subtopics: [
      { key: 'processes-threads', label: 'Processes & Threads' },
      { key: 'cpu-scheduling', label: 'CPU Scheduling' },
      { key: 'memory-management', label: 'Memory Management' },
      { key: 'synchronization-deadlocks', label: 'Synchronization & Deadlocks' },
      { key: 'file-systems', label: 'File Systems & I/O' },
    ],
  },
  CN: {
    label: 'Computer Networks',
    subtopics: [
      { key: 'osi-tcp-ip', label: 'OSI & TCP/IP Models' },
      { key: 'ip-addressing', label: 'IP Addressing & Routing' },
      { key: 'transport-layer', label: 'Transport Layer' },
      { key: 'application-protocols', label: 'Application Layer Protocols' },
      { key: 'network-security', label: 'Network Security' },
    ],
  },
};

const SUBJECTS = Object.keys(TAXONOMY);

/** Subjects where LeetCode-style problems genuinely help. The rest are studied with resources, practicals and quizzes. */
const PROBLEM_SUBJECTS = ['DSA', 'SQL', 'OOP'];
/** Subjects that get a daily DSA warm-up problem on their days. */
const WARMUP_SUBJECT = 'DSA';
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const WEIGHTS = ['high', 'medium', 'low'];

function subtopicKeys(subject) {
  return TAXONOMY[subject] ? TAXONOMY[subject].subtopics.map((s) => s.key) : [];
}

function isValidSubtopic(subject, subtopic) {
  return subtopicKeys(subject).includes(subtopic);
}

function subtopicLabel(subject, subtopic) {
  const found = TAXONOMY[subject] && TAXONOMY[subject].subtopics.find((s) => s.key === subtopic);
  return found ? found.label : subtopic;
}

module.exports = {
  TAXONOMY,
  SUBJECTS,
  PROBLEM_SUBJECTS,
  WARMUP_SUBJECT,
  DIFFICULTIES,
  WEIGHTS,
  subtopicKeys,
  isValidSubtopic,
  subtopicLabel,
};
