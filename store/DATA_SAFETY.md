# Play Console — Data safety form answers (Handwerk)

Use these answers when filling **Policy → App content → Data safety**. They match the live privacy page at `/privacy`.

## Does your app collect or share any of the required user data types?

**No** — for the default offline / on-device experience.

Optional note: if a user types a free-text scene request **and** the optional hosted helper is available, the **request text only** may be sent to `POST /api/parse` so a server can return a scene JSON. That path does **not** collect name, email, location, contacts, photos, files, device IDs, or payment data. No account is created. Prefer selecting **No** for collected/shared data if you leave the helper disabled for Play builds; if you keep the helper on, declare **App activity → Other in-app user-generated content** (or similar) as collected, not shared with third parties for advertising, and not required for core functionality.

## Recommended form selections

| Question | Answer |
| --- | --- |
| Does your app collect or share user data? | **No** (recommended while `/api/parse` is unused or disabled for store builds) |
| Is all user data encrypted in transit? | N/A if no collection; otherwise **Yes** (HTTPS) |
| Do you provide a way for users to request data deletion? | N/A if no collection |
| Account creation | **No** |
| Independent security review | **No** |

## Data types checklist (if you must declare optional parse text)

- **Location**: Not collected  
- **Personal info** (name, email, phone, address): Not collected  
- **Financial info**: Not collected  
- **Health and fitness**: Not collected (education content only; no personal health records)  
- **Messages**: Not collected  
- **Photos and videos**: Not collected  
- **Audio files**: Not collected  
- **Files and docs**: Not collected  
- **Calendar / Contacts**: Not collected  
- **App activity**: Optional — only free-text scene prompts if `/api/parse` is enabled  
- **Web browsing**: Not collected  
- **App info and performance / Device or other IDs**: Not collected by the app (no analytics SDK). Play / OS may collect install metrics independently.

## Sharing

Not shared with advertisers, analytics vendors, or data brokers. No third-party SDKs for ads or tracking are bundled.

## Privacy policy URL

`https://handwerk-ruddy.vercel.app/privacy`  
(Also valid on any Vercel preview that includes the `/privacy` rewrite.)
