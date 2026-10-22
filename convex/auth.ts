import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google,
    Password({
      profile(params) {
        const name = typeof params.name === "string" && params.name.trim() ? params.name.trim() : undefined;
        return { email: String(params.email).trim().toLowerCase(), ...(name ? { name } : {}) };
      },
    }),
  ],
});
