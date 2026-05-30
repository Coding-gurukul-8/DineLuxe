const PRICING_SUGGESTIONS = [
  { item: "Signature Burger", change: "+8%", reason: "High demand" },
  { item: "Iced Latte", change: "+5%", reason: "Peak window" },
  { item: "Garden Salad", change: "-4%", reason: "Slow mover" },
];

export default function SmartPricingWidget() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Smart pricing
          </p>
          <p className="text-sm font-semibold text-gray-800">Suggested adjustments</p>
        </div>
        <span className="text-xs text-gray-400">Today</span>
      </div>
      <div className="mt-4 space-y-3">
        {PRICING_SUGGESTIONS.map((row) => (
          <div
            key={row.item}
            className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium text-gray-700">{row.item}</p>
              <p className="text-xs text-gray-400">{row.reason}</p>
            </div>
            <span className="text-xs font-semibold text-[#1A3C5E]">{row.change}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
