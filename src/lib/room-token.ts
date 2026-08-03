import { SignJWT, jwtVerify } from "jose";

export type RoomTokenPayload = {
  userId: string;
  lobbyCode: string;
  name: string;
  avatarId: string;
};

function secretKey() {
  const s = process.env.PARTYKIT_TOKEN_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("PARTYKIT_TOKEN_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function mintRoomToken(
  payload: RoomTokenPayload,
  expiresIn = "2h",
) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey());
}

export async function verifyRoomToken(token: string): Promise<RoomTokenPayload> {
  const { payload } = await jwtVerify(token, secretKey());
  return {
    userId: String(payload.userId),
    lobbyCode: String(payload.lobbyCode),
    name: String(payload.name),
    avatarId: String(payload.avatarId ?? "avatar_00"),
  };
}
