const FORECAST = [
  { label: "Lunch rush", window: "12:00-14:00", level: "High" },
  { label: "Evening peak", window: "19:00-21:00", level: "Medium" },
  { label: "Late night", window: "22:00-23:30", level: "Low" },
];

export default function DemandPrediction() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Demand prediction
          </p>
          <p className="text-sm font-semibold text-gray-800">Next 24 hours</p>
        </div>
        <span className="text-xs text-gray-400">Forecast</span>
      </div>
      <div className="mt-4 space-y-3">
        {FORECAST.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium text-gray-700">{row.label}</p>
              <p className="text-xs text-gray-400">{row.window}</p>
            </div>
            <span className="text-xs font-semibold text-gray-600">{row.level}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
