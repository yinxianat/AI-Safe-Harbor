"use client";

const LEVEL_STYLES = {
  green: {
    bg: "bg-emerald-500",
    ring: "ring-emerald-200",
    label: "Open",
  },
  yellow: {
    bg: "bg-amber-400",
    ring: "ring-amber-200",
    label: "Gentle",
  },
  red: {
    bg: "bg-red-500",
    ring: "ring-red-200",
    label: "Not Ready",
  },
};

const CYCLE_ORDER = ["green", "yellow", "red"];

export default function TrafficLight({ topicName, label, comfortLevel, onToggle }) {
  const style = LEVEL_STYLES[comfortLevel] || LEVEL_STYLES.green;
  const displayLabel = label || topicName;

  function handleClick() {
    const currentIndex = CYCLE_ORDER.indexOf(comfortLevel);
    const nextLevel = CYCLE_ORDER[(currentIndex + 1) % CYCLE_ORDER.length];
    onToggle(topicName, nextLevel);
  }

  return (
    <button
      onClick={handleClick}
      className="flex flex-col items-center p-3 sm:p-4 rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow active:scale-95"
    >
      <div className={`w-10 h-10 rounded-full ${style.bg} ring-4 ${style.ring} mb-2 transition-colors`} />
      <span className="text-sm font-medium text-gray-800">{displayLabel}</span>
      <span className="text-xs text-gray-500 mt-0.5">{style.label}</span>
    </button>
  );
}
