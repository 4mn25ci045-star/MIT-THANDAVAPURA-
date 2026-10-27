# MIT Thandavapura: Android and authorized GPS setup

## Current status
- Existing web app and Security tab are preserved. No college security app or external private GPS API was accessed.
- Travel search uses registered real bus/route numbers. No sample route, location or ETA is created.
- Updates and timetable read published college entries from Lovable Cloud, for approved accounts only. No college notices or times have been invented.
- Issue reporting saves a private report, shows a reference, and reads it back in Your reports. Reports are not an emergency dispatch service.
- Student tracking is a separate limited feed. It requires an approved account and an explicitly student-approved bus. It returns route metadata, current GPS and target-specific provider ETA, never IMEI, driver details, security sessions or passwords. New and existing buses default to not student-visible. Stale positions are omitted after two minutes.

## College content setup
In Lovable Cloud, authorized college staff must add official `college_updates` entries and set `published=true`. Add official `bus_timetable` entries linked by route ID, with weekday 0=Sunday through 6=Saturday, times in IST, and `published=true`. No student/browser write policies exist for official content. An editorial screen and issue-review screen are not included; authorized staff can review `transport_issues` and set submitted/in_review/resolved through Cloud. Automated staff notifications are not connected.

Populate the approved account list using verified college email/phone identities. Enable phone login and configure an SMS provider before expecting OTP delivery. Existing Google login remains; SMS delivery settings have not been verified.

## Official GPS integration contract
1. Obtain written college/provider authorization, provider API documentation, sandbox access and a least-privilege read-only credential or signed webhook contract. IMEI alone is an identifier, not a feed or authorization.
2. Agree on allowed vehicles, mapping of provider device ID/IMEI to existing route IDs, update frequency, retention, student access, route geometry, stops and permitted ETA destinations. College staff explicitly enable `bus_routes.student_visible` only for approved buses.
3. Keep provider credentials in server-only secrets. Never embed them, IMEIs or provider endpoints in the Android/browser client. Do not scrape the college security app or reuse its sessions.
4. Implement an authenticated and bounded server polling adapter, or a signed webhook under `/api/public/` which rejects missing/invalid signatures, timestamps and replayed deliveries before privileged writes. No such endpoint is shipped yet because the provider's actual contract is unknown.
5. Validate coordinates, UTC timestamps, out-of-order messages and vehicle mapping. Store current authorized readings in `bus_positions`; store provider-authorized geometry/stops in `bus_routes`. Use provider ETA with its target latitude/longitude. Do not estimate arrival from straight-line distance or manufacture missing readings.
6. Expose only the limited `student_bus_feed` projection to approved students. Keep device identifiers, credentials, historical vehicle traces and security details out of it. Preserve RLS on private tables.
7. Test with provider-authorized data and authorized accounts: allowed/denied vehicles, stale/offline GPS, revoked student visibility, out-of-order positions, target-specific ETA and provider outages. Google Maps must be validated on an authorized deployed origin; sandbox live Maps checks are unsupported.

## Android preparation (not a signed APK)
Capacitor 8 dependencies, Android config and native scaffold are included. The provisional app ID is `in.mitthandavapura.bustracker`; college ownership must be confirmed before release. This is a **network-dependent hosted evaluation wrapper**, not an offline native bundle. It loads the published HTTPS site, so preview-only app changes will not appear there until published.

Capacitor documents `server.url` for live reload, not production. Do not submit this evaluation configuration as a production-ready Play Store app. The TanStack Start SSR/server-function build cannot simply be copied into `webDir`. A production bundled client strategy and secure connection to the hosted server, including OAuth/deep-link handling, need separate validation before release; preserve TanStack architecture.

On a development computer with Node 22+, Android Studio and its supported Android SDK/JDK:
```sh
bun install
bunx cap sync android
bunx cap open android
```
If regenerating the native folder, run `bunx cap add android` once first. Never copy server bundles or secrets into Android assets. Keep HTTPS and mixed-content blocking; do not use wildcard navigation allowlists. External provider login must use an approved system-browser/deep-link flow; Google OAuth inside WebView is not assumed to work.

Before distribution: validate on emulator and a real Android device, configure signing and final app identity/icons, privacy policy and Play data-safety declarations, handle Android back navigation and network loss, and test Google/phone login. Location, microphone recording, phone dialing, fullscreen and notification behavior require on-device permission handling and validation. No background location or tracking permission is needed for the student view. Native push notifications and background stop alerts are not implemented. Google Maps hosted mode uses the existing authorized HTTPS origin; any future bundled local-origin map needs its own authorized Maps configuration.

## Still requires action
- Official GPS provider authorization, docs, server credentials/webhook signature contract, real geometry/stops and ETA target data.
- Approved accounts and explicit approval of buses for the student feed.
- Official college notices and timetable entries; a staff editorial/review workflow if required.
- SMS provider setup and verification; driver voice-message delivery remains unconnected.
- Android production packaging strategy, OAuth/deep links, permissions, device tests, signing and Play review.
- Live Google Maps validation on the authorized published site.
