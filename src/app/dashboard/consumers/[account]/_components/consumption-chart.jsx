'use client';

import { useState } from 'react';

/* Consumption over time. A line reads the trend better, so that is the
   default; bars are a click away for reading off individual cycles. */

// The viewBox scales to the card width, so its proportions decide both the
// rendered height and how large the labels end up. A wide, short box keeps the
// chart from towering over the cards above it and the text near its nominal
// size. The left padding clears the y-axis labels so point values cannot
// collide with them.
const W = 1100;
const H = 240;
const PAD = { top: 18, right: 24, bottom: 34, left: 56 };

const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

// A round number above the peak, so the axis labels are readable.
function niceMax(value) {
  if (value <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

export default function ConsumptionChart({ points, average }) {
  const [mode, setMode] = useState('line');

  if (!points.length) {
    return (
      <div className="rounded-[11px] border border-line bg-white px-4.5 py-10 text-center text-[12.5px] text-muted">
        No readings captured yet — the consumption trend appears once meters are read.
      </div>
    );
  }

  const max = niceMax(Math.max(...points.map((p) => p.usage), 1));
  const step = points.length === 1 ? 0 : PLOT_W / (points.length - 1);

  const x = (index) =>
    points.length === 1 ? PAD.left + PLOT_W / 2 : PAD.left + index * step;
  const y = (usage) => PAD.top + PLOT_H - (usage / max) * PLOT_H;

  const ticks = [0, max / 2, max];
  const line = points.map((p, i) => `${x(i)},${y(p.usage)}`).join(' ');
  const area = `${PAD.left},${PAD.top + PLOT_H} ${line} ${x(points.length - 1)},${PAD.top + PLOT_H}`;

  // Bars need room between them; the line uses the full width.
  const barWidth = Math.min(46, (PLOT_W / points.length) * 0.55);
  const barX = (index) =>
    PAD.left + (PLOT_W / points.length) * index + (PLOT_W / points.length - barWidth) / 2;

  return (
    <div className="rounded-[11px] border border-line bg-white px-4.5 pt-4 pb-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <div className="text-[13.5px] font-semibold">Consumption</div>
        <div className="text-[11.5px] text-muted">
          m³ per cycle
          {average === null ? '' : ` · averaging ${average} m³ across ${points.length} readings`}
        </div>

        <div className="ml-auto flex gap-1.5">
          {['line', 'bar'].map((option) => (
            <button
              key={option}
              onClick={() => setMode(option)}
              aria-pressed={mode === option}
              className={`rounded-[7px] px-2.5 py-1 text-[11.5px] capitalize ${
                mode === option
                  ? 'bg-brand-700 font-medium text-white'
                  : 'border border-line bg-[#F1F5F4] text-muted-deep hover:bg-[#E7EDEC]'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-auto w-full" role="img">
        <title>Consumption in m³ per billing cycle</title>

        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="#EDF1F0"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 8}
              y={y(tick) + 3.5}
              textAnchor="end"
              fontSize="10"
              fill="#8B9A98"
              fontFamily="var(--font-mono)"
            >
              {Math.round(tick)}
            </text>
          </g>
        ))}

        {mode === 'line' ? (
          <>
            <polygon points={area} fill="#E3F0EF" />
            <polyline
              points={line}
              fill="none"
              stroke="#12807C"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((point, index) => (
              <g key={point.period}>
                <circle cx={x(index)} cy={y(point.usage)} r="3.5" fill="#fff" stroke="#12807C" strokeWidth="2">
                  <title>{`${point.label}: ${point.usage} m³`}</title>
                </circle>
                <text
                  // The first point sits on the axis, so its label is pushed
                  // right rather than centred — otherwise it runs into the
                  // y-axis number and the two read as one figure.
                  x={index === 0 ? x(index) + 8 : x(index)}
                  y={y(point.usage) - 10}
                  textAnchor={index === 0 ? 'start' : 'middle'}
                  fontSize="10"
                  fill="#5F7371"
                  fontFamily="var(--font-mono)"
                >
                  {point.usage}
                </text>
              </g>
            ))}
          </>
        ) : (
          points.map((point, index) => (
            <g key={point.period}>
              <rect
                x={barX(index)}
                y={y(point.usage)}
                width={barWidth}
                height={PAD.top + PLOT_H - y(point.usage)}
                rx="3"
                fill="#12807C"
              >
                <title>{`${point.label}: ${point.usage} m³`}</title>
              </rect>
              <text
                x={barX(index) + barWidth / 2}
                y={y(point.usage) - 6}
                textAnchor="middle"
                fontSize="10"
                fill="#5F7371"
                fontFamily="var(--font-mono)"
              >
                {point.usage}
              </text>
            </g>
          ))
        )}

        {points.map((point, index) => (
          <text
            key={`${point.period}-label`}
            x={mode === 'line' ? x(index) : barX(index) + barWidth / 2}
            y={H - 8}
            textAnchor="middle"
            fontSize="10"
            fill="#8B9A98"
            fontFamily="var(--font-mono)"
          >
            {point.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
