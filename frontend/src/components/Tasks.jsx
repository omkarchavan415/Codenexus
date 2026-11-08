import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { post, put } from '../lib/api';
import { minutesLabel } from '../lib/format';
import { trackId } from '../lib/tasks';
import { Badge, Spinner, useToast } from './ui';

const DIFF_TONE = { easy: 'good', medium: 'warn', hard: 'bad' };

function Meta({ task }) {
  return <span className="hidden shrink-0 text-xs text-mute sm:inline">{minutesLabel(task.minutes)}</span>;
}

/** A quiz is finished by taking it, so it has a button instead of a checkbox. */
function QuizRow({ task, done, readOnly }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      const { test } = await post('/api/tests/start', { subject: task.subject, subtopic: task.subtopic, count: task.questionCount || 5 });
      navigate(`/test/${test.id}`);
    } catch (err) {
      toast(err.code === 'no_questions' ? 'No approved questions for this topic yet. Ask an admin to add some.' : err.message, 'bad');
      setBusy(false);
    }
  }

  return (
    <li className="flex items-center gap-3 py-1.5 text-sm">
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border text-xs ${done ? 'border-mint bg-mint/20 text-mint' : 'border-ink-600 text-transparent'}`} aria-hidden="true">&#10003;</span>
      <span className={`min-w-0 flex-1 truncate ${done ? 'text-mute line-through' : ''}`}>
        {task.title}
        <span className="sr-only">{done ? ' (done)' : ' (not done)'}</span>
      </span>
      <Badge tone="info">quiz</Badge>
      <Meta task={task} />
      {!readOnly && (
        <button type="button" className={`btn btn-small ${done ? 'btn-quiet' : 'btn-primary'}`} onClick={start} disabled={busy}>
          {busy ? <Spinner label="Preparing quiz" /> : done ? 'Retake' : 'Start quiz'}
        </button>
      )}
    </li>
  );
}

/**
 * One task in a day. Problems, resources and practicals have a checkbox; a quiz has a start button
 * and is ticked by finishing it; study and revision blocks are plain text.
 * `done` is whether the task is finished; `onToggle(trackId, value)` reports changes upward.
 */
export function TaskRow({ task, done = false, onToggle = () => {}, readOnly = false }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const id = trackId(task);

  if (task.type === 'quiz') return <QuizRow task={task} done={done} readOnly={readOnly} />;

  if (!id) {
    return (
      <li className="flex items-center justify-between gap-3 py-1.5 text-sm text-bone-dim">
        <span>{task.title}</span>
        <span className="shrink-0 text-xs text-mute">{minutesLabel(task.minutes)}</span>
      </li>
    );
  }

  async function toggle(e) {
    const next = e.target.checked;
    setBusy(true);
    try {
      if (task.type === 'problem') await put(`/api/roadmap/problems/${task.problemId}/solved`, { solved: next });
      else await put(`/api/roadmap/items/${task.itemId}/done`, { done: next });
      onToggle(id, next);
      if (next) toast('Marked as done');
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      setBusy(false);
    }
  }

  const titleClass = `min-w-0 flex-1 hover:text-marigold ${done ? 'text-mute line-through' : ''}`;
  const box = (
    <input
      type="checkbox"
      className="mt-0.5 h-5 w-5 shrink-0 accent-marigold"
      checked={done}
      disabled={busy || readOnly}
      onChange={toggle}
      aria-label={`Mark ${task.title} as ${done ? 'not done' : 'done'}`}
    />
  );

  if (task.type === 'practical') {
    return (
      <li className="flex items-start gap-3 py-1.5 text-sm">
        {box}
        <details className="min-w-0 flex-1">
          <summary className={`cursor-pointer ${done ? 'text-mute line-through' : ''}`}>{task.title}</summary>
          <p className="mt-1.5 max-w-prose whitespace-pre-wrap text-bone-dim">{task.description}</p>
          {task.url && <a className="link mt-1 inline-block" href={task.url} target="_blank" rel="noopener noreferrer">Open the linked page<span className="sr-only"> (new tab)</span></a>}
        </details>
        <Badge tone="info">hands-on</Badge>
        <Meta task={task} />
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 py-1.5 text-sm">
      {box}
      <a href={task.url} target="_blank" rel="noopener noreferrer" className={`${titleClass} truncate`}>
        {task.title}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      {task.warmup && <Badge tone="info">daily DSA</Badge>}
      {task.type === 'problem' ? <Badge tone={DIFF_TONE[task.difficulty]}>{task.difficulty}</Badge> : <Badge>{task.type === 'resource' ? 'study' : task.type}</Badge>}
      <Meta task={task} />
    </li>
  );
}
