"use client";

function initials(name) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("") || "?";
}

const SIZES = {
  xs: "w-7 h-7 text-[10px]",
  sm: "w-9 h-9 text-xs",
  md: "w-11 h-11 text-sm",
  lg: "w-14 h-14 text-base",
  xl: "w-20 h-20 text-xl",
};

/**
 * Renders a user's photo when they have one, falling back to their initials
 * on a tinted circle. `tone` picks the fallback palette so a sent message
 * and a received one stay visually distinguishable.
 */
export default function Avatar({ src, name, size = "md", tone = "slate", className = "" }) {
  const dims = SIZES[size] || SIZES.md;
  const toneClass = {
    slate: "bg-slate-100 text-slate-600",
    emerald: "bg-emerald-100 text-emerald-700",
    solid: "bg-emerald-600 text-white",
  }[tone] || "bg-slate-100 text-slate-600";

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name || ""}
        className={`${dims} rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${dims} rounded-full flex items-center justify-center font-bold shrink-0 ${toneClass} ${className}`}
      aria-label={name || undefined}
    >
      {initials(name)}
    </div>
  );
}

/**
 * Downscales and re-encodes an image file to a square JPEG data URL.
 * Doing this client-side is what keeps the stored row small enough to live
 * in the User table instead of needing object storage.
 */
export async function fileToAvatarDataUrl(file, { max = 320, quality = 0.82 } = {}) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = max;
  canvas.height = max;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, max, max);
  bitmap.close?.();

  return canvas.toDataURL("image/jpeg", quality);
}
