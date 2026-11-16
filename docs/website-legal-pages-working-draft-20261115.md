# OVRLEE website — legal/support pages (WORKING DRAFT)
**Not approved for publication.** Prepared from verified app/database behavior on November 15, 2026. Replace all [VERIFY] / [DECIDE] fields, test deletion, confirm the legal operator, and obtain appropriate legal review before deploying to Cloudflare Pages. This document is content for the existing `ovrlee-site` project, **not** a new site deployment.

---

## /privacy — Privacy Policy (draft)
**Last updated:** [DATE TO PUBLISH]  
**Operator:** [LEGAL ENTITY / INDIVIDUAL OPERATING OVRLEE — VERIFY]  
**Contact:** support@ovrlee.com [VERIFY DELIVERABILITY]  
**Audience/territory:** [DECIDE]

OVRLEE is a music-centered social network. This notice describes information collected and used when you create an account, customize your profile, share music and posts, or participate in conversations.

### Information collected
- **Account and eligibility:** email, authentication information handled through Supabase Auth, account identifiers, and a self-declared birth date for 18+ beta eligibility. Do not publish until actual server-side age-check activation is verified.
- **Profile and location:** display name, username, biography, profile/header pictures, selected music service, selected city and optional city-level location coordinates and Nearby visibility preference.
- **Music taste and activity:** favorites, Core Four, In Rotation, songs/albums you choose to share, available authorized Apple Music information, optional provider profile references and chosen music taste signals. OVRLEE must not claim access to Spotify verified listening history without actually having it.
- **Posts and interaction:** photos, posts, comments and Song Replies, messages and attachments, likes, saves, follows/blocks/mutes, concert attendance/reviews, First Listen discussions and ratings.
- **Operations and safety:** notification preferences, push tokens, content reports and moderation records; security and service logs [VERIFY SPECIFIC LOGS / ANALYTICS AND PROVIDER RETENTION].

### Why information is used
To create and protect accounts, deliver music-centered profiles and conversations, offer relevant music and concert discovery, notify members, honor safety settings, and investigate abuse. [VERIFY any additional analytics, marketing, research, advertising, profiling or legal purposes.]

### What other people can see
Profile information and content you deliberately share can be visible to other members subject to app permissions. Some counts such as likes and public discussions are visible, while saved posts have private owner-only access according to the current RLS design. Nearby visibility has an opt-in setting that defaults off. [VERIFY exact audience for each profile, post, comment, city and likes feature.]

### Service providers and external links
OVRLEE uses Supabase for account/database/storage/functions and Expo/EAS for distributing and updating its mobile app. Apple Music and Ticketmaster are used for music and event discovery where applicable. Music links may open third-party applications. The website may use Cloudflare for hosting and inbound email forwarding. [VERIFY every SDK, hosting, logs and subprocessor, and whether data is transmitted.] No assertion about advertising or sale of personal data should be made until actually verified.

### How long data is kept
Active account and content information is generally needed to operate the service. Account deletion is available in-app, but the production flow must be fully tested before promising precise deletion timing or completeness. Some information may remain as required by law or in security/moderation records or backups. [DECIDE and document exact retention periods, backup practices, obligations, appeals and removal timelines.]

### Choices and requests
Users can manage their profile, notifications, Nearby visibility, music choices, and blocking. Account deletion is under Settings → Account → Delete Account. For privacy/support concerns use support@ovrlee.com [VERIFY]. [DECIDE request processing deadlines and regional rights and instructions.]

### Age eligibility
The initial closed beta is intended for adults 18 and older; date of birth is self-reported, not an identity check. [VERIFY actual Auth Hook enforcement prior to launch.]

### Security and changes
OVRLEE uses access controls and authenticated operations, but no system can guarantee absolute security. Updates to this notice will appear here with an updated date. [DECIDE material-change notices.]

---

## /terms — Terms of Service (draft outline requiring legal review)
**Effective:** [DATE] · **Operator:** [LEGAL NAME] · **Support:** support@ovrlee.com [VERIFY]

1. **Eligibility and accounts:** initial beta intended for adults 18+; users provide accurate information, secure their accounts and respect others.
2. **What OVRLEE does:** enables music-themed posts, artist discovery, discussions, First Listen rooms and concert chats. Streaming content is supplied by third-party services under their own terms.
3. **User content and rights:** members retain ownership of original content, grant OVRLEE only the license needed to display, store, moderate and operate it, and are responsible for having rights to images/audio/text they submit. [LEGAL REVIEW REQUIRED FOR LICENSE SCOPE AND TERMINATION.]
4. **Acceptable use:** no harassment, hateful abuse, threats, spam, impersonation, copyright infringement, unlawful content, personal-data abuse or technical misuse.
5. **Enforcement:** OVRLEE may review reports and remove content or restrict accounts for violations. [DECIDE appeal, notices and enforcement practices; implement them.]
6. **Third parties:** Apple Music, Spotify link destinations, Ticketmaster and others are separate services and may have their own rules.
7. **Availability and changes:** beta functionality can change and may be unavailable; [LEGAL REVIEW OF DISCLAIMERS, WARRANTY, LIABILITY, LAW AND VENUE].
8. **Ending your account:** deletion is available through Settings; refer to /delete-account and /privacy.
9. **Contact:** support@ovrlee.com [VERIFY].
**MISSING UNTIL REVIEWED:** governing law, legal entity, intellectual-property/takedown contact, disputes, limitation-of-liability language, copyright process, minors/geographic terms.

---

## /guidelines — Community Guidelines (draft)
Music opinions can be passionate; people should still feel welcome and safe.

- Discuss music respectfully; disagree with opinions without harassing people.
- No threats, bullying, hate speech, sexual exploitation, doxxing, unauthorized private images, impersonation, fraudulent schemes or targeted harassment.
- Don't spam posts, chats or artist rooms; don't manipulate activity or abuse reporting tools.
- Share only content you have a right to post; do not upload unlicensed recordings or redistribute copyrighted media.
- Don't seek personal contact details or pressure members to move conversations off-platform.
- Use in-app Report and Block tools for content or members that violate these rules.
- OVRLEE may review reports, remove content and restrict abusive accounts; actual reporting-response and moderation staffing/process must be established before making SLA promises.
- Contact support@ovrlee.com [VERIFY] for safety concerns and appeals [DECIDE].

---

## /delete-account — Account deletion
**Delete in the iPhone app:** Sign in to OVRLEE → Settings → Account → Delete Account → type **DELETE** → confirm **Delete permanently**. The app calls an authenticated deletion service and signs out after the service confirms success.

**What this is designed to remove:** the Auth account, associated profile and music identity, posts, replies, messages, saved content, and user-namespaced photo uploads. FK cascades for `profiles` and `music_dna` were fixed and verified on November 15, 2026.

**Current limitation:** this flow still requires an end-to-end disposable-account test including media, tokens, database rows, retry/failure cases and re-login. [DECIDE backup/retention language.] Avoid promising instant deletion of legal logs or copies held by third parties.

**Need help?** support@ovrlee.com [VERIFY deliverability and operator response].

---

## /support — Contact and safety
Questions about OVRLEE, your account, a music link or a safety concern? Contact **support@ovrlee.com** [VERIFY]. Report harmful posts/messages through the in-app Report controls, and use Block to stop unwanted contact. Never include passwords or sensitive personal information in a report email. [DECIDE business response windows and appeals process.]

---

## Approval checklist before Cloudflare publish
- [ ] Legal operator name and contact confirmed
- [ ] Check actual 18+ Auth Hook activation and live test signup
- [ ] End-to-end deletion verified after new FK migration
- [ ] Data retention, backups, third-party SDKs, analytics and sharing confirmed
- [ ] Moderation/filtering process and response contacts staffed
- [ ] Copyright takedown process, licensing, dispute law and liability terms reviewed
- [ ] Cloudflare Pages project source recovered; publish to existing site and validate each route
- [ ] Forwarding inbox receives messages; decide outbound email mechanism
- [ ] App Settings and App Store Connect links point to published pages
