import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/db";

type UserGuestFields = {
  _id?: ObjectId | string;
  isAnonymous?: boolean | null;
  email?: string | null;
};

/** Guest / anonymous accounts — may play, but games & stats are not persisted. */
export function isGuestUser(
  user: { isAnonymous?: boolean | null; email?: string | null } | null | undefined,
): boolean {
  if (!user) return false;
  if (user.isAnonymous) return true;
  const email = (user.email || "").toLowerCase();
  return (
    email.endsWith("@guest.local") ||
    email.endsWith("@localhost.dev")
  );
}

export async function getGuestUserIdSet(userIds: string[]): Promise<Set<string>> {
  const guests = new Set<string>();
  if (userIds.length === 0) return guests;

  const users = await getCollection<UserGuestFields>("user");

  await Promise.all(
    userIds.map(async (id) => {
      const filter = ObjectId.isValid(id)
        ? { _id: new ObjectId(id) }
        : { id };
      let u = await users.findOne(filter, {
        projection: { isAnonymous: 1, email: 1 },
      });
      if (!u && ObjectId.isValid(id)) {
        u = await users.findOne(
          { id },
          { projection: { isAnonymous: 1, email: 1 } },
        );
      }
      if (isGuestUser(u)) guests.add(id);
    }),
  );

  return guests;
}
