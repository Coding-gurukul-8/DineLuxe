import { MessageCircle } from "lucide-react";

export default function ChatbotWidget() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-[#1A3C5E]/10 p-2 text-[#1A3C5E]">
          <MessageCircle size={16} />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">AI Concierge</p>
          <p className="text-xs text-gray-400">Instant answers for staff and guests</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-gray-500">
        Chat and get smart responses about menu items, wait times, and operations.
      </p>
      <button
        className="mt-4 inline-flex items-center justify-center rounded-xl bg-[#1A3C5E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#15304d] transition"
        type="button"
      >
        Open chat
      </button>
    </div>
  );
}
