import { Star } from "lucide-react";

const SAMPLE_FEEDBACK = [
  {
    id: "f1",
    role: "Waiter",
    rating: 4.5,
    note: "Great shift flow, but the prep queue needs clearer labels.",
    date: "2026-05-28",
  },
  {
    id: "f2",
    role: "Chef",
    rating: 4.0,
    note: "Rush hours are manageable with one extra prep station.",
    date: "2026-05-27",
  },
  {
    id: "f3",
    role: "Host",
    rating: 5.0,
    note: "Seating automation reduced wait time for walk-ins.",
    date: "2026-05-25",
  },
];

export default function StaffFeedbackViewer() {
  return (
    <div className="space-y-4">
      {SAMPLE_FEEDBACK.map((item) => (
        <div
          key={item.id}
          className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">{item.role}</p>
              <p className="text-xs text-gray-400">{item.date}</p>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-[#1A3C5E]">
              <Star size={12} /> {item.rating.toFixed(1)}
            </div>
          </div>
          <p className="mt-3 text-sm text-gray-600">{item.note}</p>
        </div>
      ))}
    </div>
  );
}
