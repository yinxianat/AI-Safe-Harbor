"use client";

export default function MessageCard({ senderName, content, sentAt }) {
  const timeString = sentAt
    ? new Date(sentAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-800">{senderName}</span>
        {timeString && (
          <span className="text-xs text-gray-400">{timeString}</span>
        )}
      </div>
      <p className="text-gray-700 text-base leading-relaxed">{content}</p>
    </div>
  );
}
