"use client";

import { createAuthClient } from "better-auth/react";
import { magicLinkClient, anonymousClient } from "better-auth/client/plugins";

export const isDevAuthClient =
  process.env.NEXT_PUBLIC_ALLOW_DEV_AUTH === "true";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : undefined,
  plugins: isDevAuthClient
    ? [magicLinkClient(), anonymousClient()]
    : [magicLinkClient()],
});
