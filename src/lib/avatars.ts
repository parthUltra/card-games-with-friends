export const AVATARS = Array.from({ length: 24 }, (_, i) => {
  const id = `avatar_${String(i).padStart(2, "0")}`;
  return { id, src: `/avatars/${id}.svg`, label: `Avatar ${i + 1}` };
});

export function avatarSrc(id?: string | null) {
  const found = AVATARS.find((a) => a.id === id) ?? AVATARS[0];
  return found.src;
}
