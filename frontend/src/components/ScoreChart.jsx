import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { pct } from '../lib/format';

function Tip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-tab border border-ink-600 bg-ink-800 px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold">{pct(p.score)}</p>
      <p className="text-xs text-mute">{p.when}</p>
    </div>
  );
}

/** One series per chart: the title names it, so no legend box is needed. */
export default function ScoreChart({ history, label, height = 190 }) {
  const data = history.map((h, i) => ({
    n: i + 1,
    score: h.score,
    when: h.date ? new Date(h.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : `Test ${i + 1}`,
  }));
  return (
    <div role="img" aria-label={`${label} score history: ${data.map((d) => `${d.when} ${pct(d.score)}`).join(', ')}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 14, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="#1B3438" vertical={false} />
          <XAxis dataKey="when" stroke="#27474C" tick={{ fill: '#8EA9A5', fontSize: 12 }} tickLine={false} />
          <YAxis domain={[0, 1]} ticks={[0, 0.5, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} stroke="#27474C" tick={{ fill: '#8EA9A5', fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip content={<Tip />} cursor={{ stroke: '#27474C' }} />
          <Line type="monotone" dataKey="score" stroke="#F0B03A" strokeWidth={2} dot={{ r: 4, fill: '#F0B03A', stroke: '#0D1B1E', strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
