"use client";

interface InfoCard {
  icon?: string;
  title: string;
  body: string;
}

interface InfoCardsProps {
  topic: string;
  cards: InfoCard[];
}

export default function InfoCards({ topic, cards }: InfoCardsProps) {
  if (!cards || cards.length === 0) {
    return <div className="text-slate-400 text-sm">No info cards available.</div>;
  }

  return (
    <div className="w-full">
      <p className="text-xs font-medium text-slate-500 mb-2">Visual summary · {topic}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map((card, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-sm transition"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden="true">
                {card.icon || "💡"}
              </span>
              <div>
                <p className="font-semibold text-slate-800 text-sm">{card.title}</p>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">{card.body}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
