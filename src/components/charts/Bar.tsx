'use client';
import React from 'react';

type Datum = { label: string; value: number };

export default function BarChart({
  data,
  height,                 // ignored in horizontal mode; computed from data
  maxWidth = 760,
  horizontal = true,       // ← default to horizontal to avoid label overlap
}: {
  data: Datum[];
  height?: number;
  maxWidth?: number;
  horizontal?: boolean;
}) {
  if (!data?.length) return null;

  const maxV = Math.max(1, ...data.map(d => d.value));

  if (horizontal) {
    // ---- Horizontal layout ----
    const barH = 24;
    const gap = 12;
    const leftLabelW = 280;    // space for labels
    const rightValueW = 32;    // space for value numbers
    const topPad = 12;
    const bottomPad = 12;
    const innerW = Math.max(240, maxWidth - leftLabelW - rightValueW - 24);
    const svgW = leftLabelW + innerW + rightValueW + 24;
    const svgH = topPad + data.length * (barH + gap) - gap + bottomPad;

    return (
      <div className="overflow-x-auto">
        <svg width={svgW} height={svgH} role="img" aria-label="Bar chart (horizontal)">
          {data.map((d, i) => {
            const y = topPad + i * (barH + gap);
            const w = Math.round((d.value / maxV) * innerW);
            return (
              <g key={i} title={`${d.label}: ${d.value}`}>
                {/* Label (left) */}
                <text
                  x={12}
                  y={y + barH * 0.7}
                  className="text-[11px] fill-gray-800"
                >
                  {d.label}
                </text>

                {/* Bar */}
                <rect
                  x={leftLabelW}
                  y={y}
                  width={w}
                  height={barH}
                  rx={6}
                  className="fill-brand-600"
                />

                {/* Value (right of bar) */}
                <text
                  x={leftLabelW + w + 6}
                  y={y + barH * 0.7}
                  className="text-[11px] fill-gray-700"
                >
                  {d.value}
                </text>
              </g>
            );
          })}
          {/* Axis line */}
          <line
            x1={leftLabelW}
            y1={svgH - bottomPad + 4}
            x2={leftLabelW + innerW}
            y2={svgH - bottomPad + 4}
            className="stroke-gray-300"
            strokeWidth={1}
          />
        </svg>
      </div>
    );
  }

  // ---- (Optional) Vertical fallback, not used now ----
  const barW = 28;
  const gap = 14;
  const h = height ?? 220;
  const w = data.length * (barW + gap) + gap;

  return (
    <div className="overflow-x-auto">
      <svg width={w} height={h} role="img" aria-label="Bar chart">
        {data.map((d, i) => {
          const bh = Math.round((d.value / maxV) * (h - 50));
          const x = gap + i * (barW + gap);
          const y = h - 30 - bh;
          return (
            <g key={i} title={`${d.label}: ${d.value}`}>
              <rect x={x} y={y} width={barW} height={bh} rx={6} className="fill-brand-600" />
              <text
                x={x + barW / 2}
                y={h - 10}
                textAnchor="middle"
                className="text-[10px] fill-gray-700"
              >
                {d.label}
              </text>
              <text
                x={x + barW / 2}
                y={y - 6}
                textAnchor="middle"
                className="text-[10px] fill-gray-700"
              >
                {d.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
