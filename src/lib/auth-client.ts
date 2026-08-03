"use client";

import { createAuthClient } from "better-auth/react";
import { magicLinkClient, anonymousClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : undefined,
  plugins: [magicLinkClient(), anonymousClient()],
});
