import { avatarSrc } from "@/lib/avatars";

type Props = { id?: string | null; size?: number; ring?: boolean; className?: string; alt?: string };

export function Avatar({ id, size = 40, ring = false, className = "", alt = "" }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarSrc(id)}
      alt={alt}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`shrink-0 rounded-full bg-[var(--surface-2)] ${
        ring ? "ring-2 ring-[var(--brass)] ring-offset-2 ring-offset-[var(--bg)]" : "ring-1 ring-white/10"
      } ${className}`}
    />
  );
}
