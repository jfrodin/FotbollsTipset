import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { db } from "@/db";
import { users, accounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      displayName: string;
      role: "player" | "admin";
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email || !account) return false;

      const email = user.email.toLowerCase();

      // Upsert user
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      let dbUser = existing;
      if (!dbUser) {
        const displayName = user.name ?? email.split("@")[0];
        [dbUser] = await db
          .insert(users)
          .values({ email, displayName })
          .returning();
      }

      // Upsert account link
      const [existingAccount] = await db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.provider, account.provider),
            eq(accounts.providerAccountId, account.providerAccountId)
          )
        )
        .limit(1);

      if (!existingAccount) {
        await db.insert(accounts).values({
          userId: dbUser.id,
          type: account.type,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          accessToken: account.access_token as string | undefined,
          refreshToken: account.refresh_token as string | undefined,
          expiresAt: account.expires_at as number | undefined,
          tokenType: account.token_type as string | undefined,
          scope: account.scope as string | undefined,
          idToken: account.id_token as string | undefined,
        });
      }

      // Store userId in user object so JWT callback can access it
      user.id = dbUser.id;
      return true;
    },

    async jwt({ token, user }) {
      if (user?.id) {
        token.userId = user.id;
        // Fetch role
        const [dbUser] = await db
          .select({ role: users.role, displayName: users.displayName })
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1);
        token.role = dbUser?.role ?? "player";
        token.displayName = dbUser?.displayName ?? (token.name as string);
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.role = (token.role as "player" | "admin") ?? "player";
      session.user.displayName = (token.displayName as string) ?? session.user.name ?? "";
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
