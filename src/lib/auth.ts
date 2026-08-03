import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { anonymous } from "better-auth/plugins";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";
import { Resend } from "resend";

async function sendMagicLinkEmail(email: string, url: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log("\n========== MAGIC LINK ==========");
    console.log(`To: ${email}`);
    console.log(`URL: ${url}`);
    console.log("================================\n");
    return;
  }
  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "Card Games <onboarding@resend.dev>",
    to: email,
    subject: "Your Card Games With Friends sign-in link",
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
        <h1 style="color: #0B3D2E;">Card Games With Friends</h1>
        <p>Click the button below to sign in. This link expires in 5 minutes.</p>
        <p><a href="${url}" style="display:inline-block;background:#D4A017;color:#06261C;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;">Sign in</a></p>
        <p style="color:#666;font-size:12px;">Or paste this URL:<br/>${url}</p>
      </div>
    `,
  });
}

const uri = process.env.MONGODB_URI;
if (!uri && process.env.NEXT_PHASE !== "phase-production-build") {
  console.warn("MONGODB_URI is not set");
}

const client = new MongoClient(
  uri || "mongodb://127.0.0.1:27017/cardgames",
);
const db = client.db(process.env.MONGODB_DB || "cardgames");

void client.connect().catch((err) => {
  console.error("MongoDB connection error", err);
});

/** Local multi-window testing without email */
export const isDevAuthEnabled =
  process.env.ALLOW_DEV_AUTH === "true" ||
  process.env.NODE_ENV === "development";

export const auth = betterAuth({
  database: mongodbAdapter(db, {
    client,
    transaction: false,
  }),
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL,
  secret: process.env.BETTER_AUTH_SECRET || "dev-secret-change-me",
  user: {
    additionalFields: {
      avatarId: {
        type: "string",
        required: false,
        defaultValue: "avatar_00",
        input: true,
      },
      onboardingComplete: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: true,
      },
      statsWins: {
        type: "number",
        required: false,
        defaultValue: 0,
        input: false,
      },
      statsTop3: {
        type: "number",
        required: false,
        defaultValue: 0,
        input: false,
      },
      statsPlayed: {
        type: "number",
        required: false,
        defaultValue: 0,
        input: false,
      },
    },
  },
  plugins: [
    magicLink({
      expiresIn: 60 * 5,
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail(email, url);
      },
    }),
    ...(isDevAuthEnabled
      ? [
          anonymous({
            emailDomainName: "localhost.dev",
            generateName: () => `Guest`,
          }),
        ]
      : []),
  ],
});

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  avatarId?: string | null;
  onboardingComplete?: boolean | null;
  statsWins?: number;
  statsTop3?: number;
  statsPlayed?: number;
};
