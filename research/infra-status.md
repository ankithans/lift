# Lift infrastructure handoff

Completed 2026-10-22 using Google account ankithans1947@gmail.com.

## Cloudflare

- Account: Ankithans1947@gmail.com's Account
- Account ID: `d5b6c3961e09f5db080e9e796d45a2f3`
- Zone: `ankithans.com`
- Zone ID: `fdc05429c830a6f65fffaaafc9ffcf27`
- Confirmed zone is in the requested account. The uplauz account contains only uplauz.com; no zones were moved.
- At initial inspection, lift.ankithans.com had no DNS record. No existing record was deleted.
- Created user API token `lift-deploy` from the Edit Cloudflare Workers template. Restricted to this account and ankithans.com; added Zone DNS Edit. Includes Workers Scripts Edit and Workers Routes Edit.
- `wrangler@latest whoami` succeeded with the scoped environment token and showed ankithans1947@gmail.com and the account ID above.
- Created Worker `lift`, serving static landing and policy pages at https://lift.ankithans.com via a custom domain.
- Bootstrap version: `c77ec43b-4d47-436f-8794-4cad57e5aa67`.
- Bootstrap deployment config/source: `research/infra-bootstrap/`.
- The app deployment can replace this bootstrap Worker. Preserve the custom domain and the public policy URLs.

## Convex

- Team: Ankit Hans's team (`ankit-hans`). It was paused because of a prior Free plan overage; the dashboard restore action succeeded without a billing change.
- New project: `lift`.
- Project dashboard: https://dashboard.convex.dev/t/ankit-hans/lift
- Production deployment: `ardent-butterfly-982`
- Production cloud URL: https://ardent-butterfly-982.convex.cloud
- Production HTTP actions URL: https://ardent-butterfly-982.convex.site
- Development deployment: `giddy-goldfish-291`
- Development cloud URL: https://giddy-goldfish-291.convex.cloud
- Development HTTP actions URL: https://giddy-goldfish-291.convex.site
- Deploy keys named `lift-prod` and `lift-dev`, with deployment:deploy, deployment:env:view, and deployment:env:write permissions.
- Both keys passed `npx -y convex@latest env list`, exit 0, and returned the expected deployment. At verification, no environment variables were set.
- The current CLI requires a package.json declaring convex; verification used isolated temporary directories with that minimal manifest.

## Google OAuth

- Google Cloud project: `Lift` (`lift-512410`).
- OAuth client: `Lift web`, Web application.
- Client ID: `27656444172-i0bglu2371nq85nbjregup23vb9e3vso.apps.googleusercontent.com`
- Audience: External.
- Publishing status: **In production**, confirmed in the dashboard.
- App name: Lift. Support and developer email: ankithans1947@gmail.com.
- Scopes: openid, https://www.googleapis.com/auth/userinfo.email, https://www.googleapis.com/auth/userinfo.profile. No sensitive/restricted scopes.
- Authorized JavaScript origins: https://lift.ankithans.com and http://localhost:3000.
- Redirect URIs:
  - https://ardent-butterfly-982.convex.site/api/auth/callback/google
  - https://giddy-goldfish-291.convex.site/api/auth/callback/google
- Authorized domains: ankithans.com, ardent-butterfly-982.convex.site, giddy-goldfish-291.convex.site. Google rejected the shared convex.site parent as not a top private domain, and accepted the deployment-specific domains.
- Home page: https://lift.ankithans.com
- Privacy policy: https://lift.ankithans.com/privacy
- Terms: https://lift.ankithans.com/terms
- Google initially disabled publishing until public branding links were supplied. The owner authorized choosing and publishing these pages; they are now live, and publishing succeeded.
- Policy source copies are in `public/privacy.html` and `public/terms.html` so future app deployments can keep these URLs.
- Google offers optional brand verification to display the app branding to users. Production status is already enabled; brand verification was not requested or submitted.

## Credentials and checks

All credentials are stored only in `~/.config/lift/secrets.env` (mode 600). Variable names:

- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ACCOUNT_ID
- CLOUDFLARE_ZONE_ID
- CONVEX_DEPLOY_KEY_PROD
- CONVEX_URL_PROD
- CONVEX_SITE_URL_PROD
- CONVEX_DEPLOY_KEY_DEV
- CONVEX_URL_DEV
- CONVEX_SITE_URL_DEV
- AUTH_GOOGLE_ID
- AUTH_GOOGLE_SECRET

No global wrangler/Convex login or logout commands were used. The global CLI logins remain untouched.

Verification: scoped Wrangler identity passed, both scoped Convex keys passed, and curl returned HTTP 200 for /, /privacy, and /terms. Browser inspection confirmed the content and Google's In production status. Screenshots are saved in `research/infra-screens/` and contain no credential values.

No infrastructure blockers remain. This task provisions resources and a bootstrap landing page; it does not claim that the workout application or its end-to-end Google sign-in flow has been deployed and tested. The implementation agent should configure Convex Auth with the protected credentials and deploy the app to Worker lift, keeping the policy URLs public.
