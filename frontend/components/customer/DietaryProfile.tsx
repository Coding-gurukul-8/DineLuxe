const DIETARY_TAGS = [
  "Vegan",
  "Gluten free",
  "Nut free",
  "Low sugar",
];

export default function DietaryProfile() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        Dietary profile
      </p>
      <h3 className="mt-2 text-lg font-semibold text-gray-800">Your preferences</h3>
      <p className="mt-2 text-sm text-gray-500">
        Save dietary needs to personalize menu recommendations.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {DIETARY_TAGS.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
