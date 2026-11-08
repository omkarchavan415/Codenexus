import { levelColor, levelWord, pct } from '../lib/format';

export default function SkillRing({ value, tested = true, size = 120, label, sublabel }) {
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = tested && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const color = tested ? levelColor(value) : '#27474C';
  const full = c;
  return (
    <figure className="flex flex-col items-center text-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${label}: ${tested ? `${pct(value)}, ${levelWord(value)}` : 'not tested yet'}`}
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1B3438" strokeWidth={stroke} />
        <circle
          className="ring-arc"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ '--ring-full': full }}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="fill-bone font-display" style={{ fontSize: size * 0.24, fontWeight: 800 }}>
          {tested ? pct(value) : '-'}
        </text>
      </svg>
      <figcaption className="mt-2">
        <span className="block text-sm font-semibold">{label}</span>
        {sublabel && <span className="block text-xs text-mute">{sublabel}</span>}
      </figcaption>
    </figure>
  );
}
