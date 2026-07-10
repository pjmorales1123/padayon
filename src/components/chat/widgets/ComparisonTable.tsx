"use client";

interface ComparisonTableProps {
  topic: string;
  headers: string[];
  rows: string[][];
}

export default function ComparisonTable({ topic, headers, rows }: ComparisonTableProps) {
  if (!headers || headers.length === 0 || !rows || rows.length === 0) {
    return <div className="text-slate-400 text-sm">No comparison data available.</div>;
  }

  return (
    <div className="w-full">
      <p className="text-xs font-medium text-slate-500 mb-2">Comparison · {topic}</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              {headers.map((h, i) => (
                <th
                  key={i}
                  className="px-4 py-3 text-left font-semibold text-slate-800 border-b border-slate-200"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 1 ? "bg-slate-50" : "bg-white"}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-4 py-3 text-slate-700 border-b border-slate-100">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
