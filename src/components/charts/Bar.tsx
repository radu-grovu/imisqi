'use client';
import React from 'react';

type Datum = { label: string; value: number };
export default function BarChart({ data, height = 220 }: { data: Datum[]; height?: number }) {
  const max = Math.max(1, ...data.map(d => d.value));
  const barW = 28;
  const gap = 14;
  const width = data.length * (barW + gap) + gap;

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} role="img" aria-label="Bar chart">
        {data.map((d, i) => {
          const h = Math.round((d.value / max) * (height - 50));
          const x = gap + i * (barW + gap);
          const y = height - 30 - h;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={h} rx={6} className="fill-brand-600" />
              <text x={x + barW / 2} y={height - 10} textAnchor="middle" className="text-[10px] fill-gray-700">
                {d.label}
              </text>
              <text x={x + barW / 2} y={y - 6} textAnchor="middle" className="text-[10px] fill-gray-700">
                {d.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
