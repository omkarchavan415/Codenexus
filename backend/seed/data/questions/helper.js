'use strict';

/**
 * Authoring helper. Each question is written as
 *   [difficulty, text, correctAnswer, [wrong1, wrong2, wrong3], explanation]
 * so the answer key can never drift away from the options. The helper then places the correct
 * answer at a deterministic position, which spreads the answer key evenly over A-D.
 */
const PERMUTATIONS = [];
(function build(prefix, rest) {
  if (!rest.length) PERMUTATIONS.push(prefix);
  rest.forEach((x, i) => build([...prefix, x], rest.filter((_, j) => j !== i)));
})([], [0, 1, 2, 3]);

let counter = 0;
function nextPosition() {
  const block = Math.floor(counter / 4);
  const position = PERMUTATIONS[(block * 7 + 3) % PERMUTATIONS.length][counter % 4];
  counter += 1;
  return position;
}

function build(subject, bySubtopic) {
  const out = [];
  for (const [subtopic, rows] of Object.entries(bySubtopic)) {
    for (const [difficulty, text, correct, wrong, explanation] of rows) {
      const pos = nextPosition();
      const options = [...wrong];
      options.splice(pos, 0, correct);
      out.push({ subject, subtopic, difficulty, text, options, correctIndex: pos, explanation });
    }
  }
  return out;
}

module.exports = { build };
