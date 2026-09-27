# MR GYM Admin — Next.js

This is the complete Next.js App Router conversion of the original Vite/React MR GYM admin panel.

It uses:

- Next.js 16 with the App Router
- React 19 and TypeScript
- Tailwind CSS 3
- Firebase Authentication and Firestore from the `mrgymunisex` project
- A protected Next.js server API for profile-picture uploads to the existing `dots-f5120` Firebase Storage bucket
- No Firebase Cloud Functions
- No changes to the existing `dots-f5120` Storage rules

## Fastest installation

The ZIP already contains the complete project. You do not need to run `create-next-app` first.

1. Extract the ZIP to a new folder such as `C:\Apps\Mr Gym\mr-gym-admin-next`.
2. Open PowerShell in that folder.
3. Install the packages:

   ```powershell
   npm install
   ```

4. Create the local environment file:

   ```powershell
   Copy-Item .env.example .env.local
   ```

5. Complete the two server-only credential values in `.env.local` as explained below.
6. Start the project:

   ```powershell
   npm run dev
   ```

7. Open `http://localhost:3000`.

Use Node.js 20.9 or newer. Node.js 22 LTS is recommended.

The old `xlsx` package was not imported anywhere in the supplied source and its npm release has unresolved high-severity advisories, so it is intentionally not included. The existing member, payment, and report exports continue to use their original CSV implementation.

## If you want to create a blank project first

Run:

```powershell
npx create-next-app@latest mr-gym-admin-next --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

Then delete the generated project files and copy every file and folder from this ZIP into that project root. Allow Windows to replace matching files. Finally run `npm install`.

Using the ZIP directly is simpler and produces the same result.

## Firebase server credentials

The normal `NEXT_PUBLIC_MRGYM_*` values are already present in `.env.example`. Firebase web configuration is public configuration, not an administrator secret.

Two private service-account values are intentionally empty:

- `MRGYM_SERVICE_ACCOUNT_BASE64`: verifies MR GYM Firebase login tokens and checks the signed-in user in `mrgymunisex/admins/{uid}`.
- `DOTS_SERVICE_ACCOUNT_BASE64`: writes profile pictures to the `dots-f5120` Storage bucket.

Create them as follows:

1. In Firebase Console, open `mrgymunisex`.
2. Open **Project settings → Service accounts → Firebase Admin SDK**.
3. Generate a new private key and save its JSON file securely.
4. Repeat this for the `dots-f5120` project.
5. Convert each complete JSON file to a one-line Base64 value in PowerShell:

   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\secure\mrgym-service-account.json'))
   [Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\secure\dots-service-account.json'))
   ```

6. Paste the first output after `MRGYM_SERVICE_ACCOUNT_BASE64=` and the second output after `DOTS_SERVICE_ACCOUNT_BASE64=` in `.env.local`.

Never add either private JSON file to the project. Never rename these variables with a `NEXT_PUBLIC_` prefix. `.env.local` is ignored by Git.

If the `dots-f5120` upload reports a permissions error, grant that dedicated service account permission to create objects in the `dots-f5120.firebasestorage.app` bucket. `Storage Object Admin` is sufficient for upload/delete management; do not change the Firebase Storage rules.

## Why the existing Storage rules do not need changes

The browser sends the selected image and its MR GYM Firebase ID token to `/api/profile-picture`. The Next.js server then:

1. verifies the login token against `mrgymunisex`;
2. confirms that `admins/{uid}` exists and is not inactive;
3. validates the member identifier, five-megabyte limit, and actual JPEG/PNG/WebP file signature;
4. uploads through the private `dots-f5120` Admin SDK credential;
5. returns the image URL and saves it with the member record in MR GYM Firestore.

Firebase Admin SDK requests are authorized with Google Cloud IAM and do not depend on the client Storage rules. The image is stored under:

```text
public/images/mr-gym/profile-pictures/{membershipId}/{unique-file-name}
```

That remains below the existing public image path, so the already-deployed public-read rule continues to work.

## Vercel deployment

1. Push this project to a private Git repository and import it into Vercel.
2. Add every variable from `.env.example` in **Vercel → Project Settings → Environment Variables**.
3. Fill in the two private Base64 service-account values.
4. Deploy. Vercel runs `next build` automatically.

The `/api/profile-picture` route becomes a Vercel serverless Node.js function. It does not create or use a Firebase Cloud Function.

## Original-to-Next.js file map

| Original Vite file | Next.js destination |
| --- | --- |
| `src/main.tsx` | `src/app/layout.tsx` and `src/app/providers.tsx` |
| `src/App.tsx` | `src/app/page.tsx`, `src/app/login/page.tsx`, `src/app/(admin)/layout.tsx`, and the route `page.tsx` files |
| `src/index.css` | `src/app/globals.css` |
| `src/App.css` | Removed because it was unused |
| `src/pages/Login.tsx` | `src/views/Login.tsx`, rendered by `src/app/login/page.tsx` |
| `src/pages/Dashboard.tsx` | `src/views/Dashboard.tsx`, rendered by `src/app/(admin)/dashboard/page.tsx` |
| `src/pages/Members.tsx` | `src/views/Members.tsx`, rendered by `src/app/(admin)/members/page.tsx` |
| `src/pages/AddMember.tsx` | `src/views/AddMember.tsx` (preserved for reference) |
| `src/pages/MemberForm.tsx` | `src/views/MemberForm.tsx`, used by add/edit member routes |
| `src/pages/MemberDetails.tsx` | `src/views/MemberDetails.tsx`, rendered by the dynamic member route |
| `src/pages/Payments.tsx` | `src/views/Payments.tsx`, rendered by the payments route |
| `src/pages/RecordPayment.tsx` | `src/views/RecordPayment.tsx`, used by record/edit payment routes |
| `src/pages/InvoicePreview.tsx` | `src/views/InvoicePreview.tsx`, rendered by the dynamic invoice route |
| `src/pages/Reports.tsx` | `src/views/Reports.tsx`, rendered by the reports route |
| `src/pages/Settings.tsx` | `src/views/Settings.tsx`, rendered by the settings route |
| `src/components/layout/DashboardLayout.tsx` | Same path, converted from React Router to Next navigation |
| `src/context/AuthContext.tsx` | Same path, marked as a client component |
| `src/services/auth.ts` | Same path |
| `src/services/firebase.ts` | Same path, using `NEXT_PUBLIC_MRGYM_*` environment variables |
| `src/services/members.ts` | Same path, profile uploads now call the protected Next.js API |
| `src/services/payments.ts` | Same path |
| `src/services/reports.ts` | Same path |
| `src/services/settings.ts` | Same path |

New server and framework files include:

- `src/app/api/profile-picture/route.ts`
- `src/lib/firebase/admin.ts`
- `src/components/auth/ProtectedAdmin.tsx`
- `src/components/pwa/RegisterServiceWorker.tsx`
- `src/app/manifest.ts`
- `public/sw.js`
- `next.config.ts`, `next-env.d.ts`, and the Next-compatible TypeScript/ESLint/Tailwind/PostCSS configurations

## Routes

- `/login`
- `/dashboard`
- `/members`
- `/members/add`
- `/members/{id}`
- `/members/edit/{id}`
- `/payments`
- `/payments/record`
- `/payments/edit/{id}`
- `/payments/invoice/{id}`
- `/reminders`
- `/reports`
- `/settings`

## Verification commands

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

The converted source passes ESLint and TypeScript checks.
