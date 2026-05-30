export default function SocialDining() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        Social dining
      </p>
      <h3 className="mt-2 text-lg font-semibold text-gray-800">Invite your group</h3>
      <p className="mt-2 text-sm text-gray-500">
        Create a shared table link so friends can add their orders before you arrive.
      </p>
      <div className="mt-4 flex items-center gap-2">
        <button
          className="rounded-xl bg-[#1A3C5E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#15304d] transition"
          type="button"
        >
          Create invite
        </button>
        <button
          className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800"
          type="button"
        >
          Copy link
        </button>
      </div>
    </div>
  );
}
