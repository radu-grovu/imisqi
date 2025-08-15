'use client';
import React from 'react';

type Pt = { x: string; y: number }; // x = date label like '08-12'
export default function LineChart({ data, height = 220 }: { data: Pt[]; height?: number }) {
  const max = Math.max(1, ...data.map(d => d.y));
  const n = data.length || 1;
  const gap = 60; // px per point
  const width = gap * (n - 1) + 40;

  const points = data.map((d, i) => {
    const x = 20 + i * gap;
    const y = height - 30 - Math.round((d.y / max) * (height - 60));
    return { x, y, label: d.x, value: d.y };
  });

  const path = points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} role="img" aria-label="Line chart">
        <path d={path} className="stroke-brand-600 fill-none" strokeWidth={2} />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3} className="fill-brand-700" />
            <text x={p.x} y={height - 10} textAnchor="middle" className="text-[10px] fill-gray-700">{p.label}</text>
            <text x={p.x} y={p.y - 8} textAnchor="middle" className="text-[10px] fill-gray-700">{p.value}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
