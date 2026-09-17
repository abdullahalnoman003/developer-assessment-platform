# CodeArena  Developer Assessment Platform  API Documentation

> Manual-testing guide for the backend. All 32+ routes below are live under **`/api/v1`**.
> Base URL (local): `http://localhost:5000`
> Format: authenticated endpoints take `Authorization: Bearer <accessToken>` (or the `accessToken` httpOnly cookie set at login).

---

## 1. Run the server

```bash
npm.cmd run dev          # dev (tsx watch), reads .env  seeds demo accounts on boot
npm.cmd run seed         # full seed: demo accounts + demo data (company, questions, assessments, invitations, attempt, payment)
npx.cmd prisma generate  # required after clone / schema change
npx.cmd prisma db push   # sync PostgreSQL schema
```

Server boots on `PORT` from `.env` (default 5000). Health check: `GET /` → `Hello From CodeArena!`

---

## 2. Standard response envelope

**Success**
```json
{ "success": true, "message": "Operation successful", "data": {} }
```

**Error**
```json
{ "success": false, "message": "Something went wrong", "errors": [] }
```

**Common status codes**
| Status | Meaning |
|---|---|
| 200 / 201 | OK / Created |
| 400 | Validation failed or invalid business action (`message` = `field: reason`, `errors: []`) |
| 401 | Missing / invalid / expired access token |
| 403 | Wrong role OR resource belongs to another company/user |
| 404 | Resource not found |
| 409 | Duplicate / conflicting resource (e.g. already invited) |
| 429 | Rate limited (100 req / 15 min / IP on `/api/v1`; webhook exempt) |
| 500 | Server / DB error |

**Auth errors**
```json
// no token / invalid token
{ "success": false, "message": "Access token is required. Please login again.", "errors": [] }
{ "success": false, "message": "Invalid or expired access token.", "errors": [] }
// authenticated but wrong role
{ "success": false, "message": "You are not authorized to access this resource.", "errors": [] }
```

---

## 3. Roles & permission matrix

| Action | Candidate | Recruiter | Admin |
|---|:---:|:---:|:---:|
| Register / Login | yes | yes | login only* |
| Own profile (`/users/me`) | yes | yes | yes |
| Own company (`/companies/me`) |  | yes | yes |
| Questions (`/questions`) |  | yes (own company) |  |
| Assessments (`/assessments`) |  | yes (own company) |  |
| Invite candidates |  | yes |  |
| Start / save / submit attempt | yes (own only) |  |  |
| Evaluate & results |  | yes (own assessment) |  |
| Payments |  | yes (own company) | view only |
| Admin (users / stats / audit logs) |  |  | yes |

\* **Admin cannot self-register** (`POST /auth/register` with `role: ADMIN` → 400). Three **demo accounts** are seeded automatically at server boot via `src/seed/index.ts` — **user accounts only** (idempotent: skips roles that already exist), usable immediately to test auth/users endpoints. The full demo dataset is **not** created at boot; run `npm run seed` to additionally seed a demo company, questions, assessments, invitations, a submitted attempt, and a paid payment (it also runs standalone and idempotently):

| Role | Email | Password |
|---|---|---|
| **ADMIN** | `admin@codearena.com` | `admin1234` |
| **RECRUITER (demo)** | `recruiter@codearena.com` | `recruiter123` |
| **CANDIDATE (demo)** | `candidate@codearena.com` | `candidate123` |

Override any of them in `.env` via `DEMO_ADMIN_* / DEMO_RECRUITER_* / DEMO_CANDIDATE_*`.

---

## 4. End-to-end flow (test in this exact order)

> Use **two browsers/Postman windows or two token variables**  one logged in as RECRUITER, one as CANDIDATE, one as ADMIN.

```text
1.  POST /auth/register        recruiter account  (role: RECRUITER)
2.  POST /auth/register        candidate account  (role: CANDIDATE)
3.  POST /auth/login           both → save accessToken / refreshToken
4.  GET  /users/me             verify profile (any role)
5.  PUT  /companies/me         recruiter creates company (upsert)
6.  GET  /companies/me/dashboard  all zeros  valid baseline
7.  POST /questions            x2 MCQ, x1 WRITTEN, x1 CODING
8.  GET  /questions?q=         search your questions
9.  POST /assessments          create DRAFT assessment
10. PATCH /assessments/:id     { questionIds: [...] } attach questions (DRAFT only)
11. PATCH /assessments/:id     { status: "PUBLISHED" } (requires ≥1 question)
12. POST /assessments/:id/invitations  { candidateEmails: ["candidate@..."] }
13. GET  /invitations/me       candidate sees PENDING invitation
14. PATCH /invitations/:id     candidate { status: "ACCEPTED" }
15. POST /invitations/:id/start   candidate → creates IN_PROGRESS attempt + deadline
16. PATCH /attempts/:id        candidate { answers: [...] } save progress
17. PATCH /attempts/:id        candidate { status: "SUBMITTED" } → MCQ auto-graded
18. GET  /attempts/:id         recruiter checks submitted attempt
19. POST /attempts/:id/evaluate  recruiter { scores: [...], releaseResult: true }
20. GET  /assessments/:id/results  recruiter paginated results
21. GET  /companies/me/dashboard  same call as step 6  now has real numbers
22. GET  /attempts/:id         candidate views own score (released)
23. POST /payments/initiate    recruiter { plan: "STARTER" } → Stripe checkout URL
24. (Stripe) pay in test mode → webhook marks PAID + credits granted
25. GET  /payments + /payments/:id  verify payment history & credit balance
26. GET  /admin/stats, /admin/users, /admin/audit-logs   (admin token)
27. PATCH /admin/users/:id     { status: "SUSPENDED" } → that user's login fails 403
```

---

## 5. Endpoint reference

---

### A. Authentication `/api/v1/auth` (5 endpoints)

#### A1. `POST /api/v1/auth/register`  public

Register a candidate or recruiter. **Admin registration is rejected.**

**Body**
```json
{ "name": "John Recruiter", "email": "recruiter@hire.com", "password": "secret123", "role": "RECRUITER" }
```
| Field | Type | Rules |
|---|---|---|
| `name` | string | required, 1–100 chars |
| `email` | string | required, valid email, lowercased, unique |
| `password` | string | required, 6–128 chars (bcrypt-hashed) |
| `role` | `"CANDIDATE"` \| `"RECRUITER"` | required |

**Success 201**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "id": "ckup1...", "name": "John Recruiter", "email": "recruiter@hire.com",
    "role": "RECRUITER", "status": "ACTIVE", "authProvider": "LOCAL",
    "avatarUrl": null, "phone": null, "bio": null, "skills": [],
    "resumeUrl": null, "githubUrl": null, "passwordHash": null,
    "createdAt": "2026-09-12T10:00:00.000Z", "updatedAt": "...", "deletedAt": null
  }
}
```
**Errors:** `400` name/email/password/role invalid; `400` "Admin accounts cannot be self-registered..."; `409` "User already exists".

---

#### A2. `POST /api/v1/auth/login`  public

**Body**
```json
{ "email": "recruiter@hire.com", "password": "secret123" }
```

**Success 200**  tokens returned *and* set as httpOnly cookies (`accessToken` 1d, `refreshToken` 7d).
```json
{ "success": true, "message": "User logged in successfully",
  "data": { "accessToken": "<jwt>", "refreshToken": "<jwt>" } }
```
**Errors:** `404` "User not found"; `401` "Invalid email or password"; `403` "Your account has been suspended...".

> **Postman hint:** copy `accessToken` into an environment variable and set header `Authorization: Bearer {{accessToken}}`.

---

#### A3. `POST /api/v1/auth/google`  public

Verifies a Google **ID token** server-side (requires `GOOGLE_CLIENT_ID` in `.env`).

**Body**
```json
{ "idToken": "<google-id-token>", "role": "RECRUITER" }
```
| Field | Type | Rules |
|---|---|---|
| `idToken` | string | required |
| `role` | optional | `"CANDIDATE"` (default) \| `"RECRUITER"`  used only on first sign-in |

**Success 200**  same shape as A2 (`accessToken` + `refreshToken`).
**Errors:** `400` invalid body; `401` "Invalid Google ID token" / no email; `502` "Google login is not configured".

---

#### A4. `POST /api/v1/auth/refresh-token`  public

Rotates the refresh token (old one is revoked; stored hashed in DB).

**Body (optional)**  falls back to the `refreshToken` cookie:
```json
{ "refreshToken": "<refresh-token>" }
```

**Success 200**
```json
{ "success": true, "message": "Token refreshed successfully",
  "data": { "accessToken": "<jwt>", "refreshToken": "<jwt>" } }
```
**Errors:** `400` "Refresh token is required"; `401` invalid / expired / already-used token.

---

#### A5. `GET /api/v1/auth/me`  Bearer token (any role)

Convenience alias of `GET /users/me`. Returns your profile **including company membership**.

**Success 200**
```json
{
  "success": true, "message": "User profile fetched successfully",
  "data": {
    "id": "...", "name": "John Recruiter", "email": "recruiter@hire.com",
    "role": "RECRUITER", "status": "ACTIVE", "authProvider": "LOCAL",
    "avatarUrl": null, "phone": null, "bio": null, "skills": [],
    "resumeUrl": null, "githubUrl": null, "deletedAt": null,
    "companyMembership": { "id": "...", "userId": "...", "companyId": "...",
        "company": { "id": "...", "name": "HireCorp", "website": null,
                     "logoUrl": null, "creditsRemaining": 0,
                     "createdAt": "...", "updatedAt": "...", "deletedAt": null }
    },
    "createdAt": "...", "updatedAt": "..."
  }
}
```

---

### B. Users `/api/v1/users` (2 endpoints)

#### B1. `GET /api/v1/users/me`  Bearer (any role)

See A5  identical profile payload.

---

#### B2. `PATCH /api/v1/users/me`  Bearer (any role)

Update profile. `name` / `avatarUrl` work for every role; the **candidate-only fields are only applied when role is CANDIDATE** (silently ignored otherwise).

**Body** (all optional)
```json
{
  "name": "John R.",
  "avatarUrl": "https://img/avatar.png",
  "phone": "+8801700000000",
  "bio": "Full-stack dev",
  "skills": ["Node.js", "TypeScript", "PostgreSQL"],
  "resumeUrl": "https://resume/pdf",
  "githubUrl": "https://github.com/john"
}
```
| Field | Role gate | Type |
|---|---|---|
| `name` | all | string |
| `avatarUrl` | all | string |
| `phone` `bio` `skills` `resumeUrl` `githubUrl` | candidate only | string / string / string[] / string / string |

**Success 200**  updated user (same payload as GET `/users/me`, without `companyMembership`).
**Errors:** `400` invalid field values (e.g. `skills` not an array).

---

### C. Companies `/api/v1/companies` (3 endpoints)

#### C1. `GET /api/v1/companies/me`  RECRUITER or ADMIN

**Success 200**
```json
{ "success": true, "message": "Company fetched successfully",
  "data": { "id": "...", "name": "HireCorp", "website": "https://hire.com",
            "logoUrl": null, "creditsRemaining": 0,
            "createdAt": "...", "updatedAt": "...", "deletedAt": null } }
```
**Errors:** `404` "No company found for this user".

---

#### C2. `PUT /api/v1/companies/me`  RECRUITER

**Upsert:** first call creates the company + binds your `CompanyMembership`; later calls update it.

**Body** (all optional  `name` defaults to `"My Company"` on create)
```json
{ "name": "HireCorp", "website": "https://hire.com", "logoUrl": "https://img/logo.png" }
```

**Success 200**  company object (same shape as C1).
**Errors:** `403` candidate tries it.

---

#### C3. `GET /api/v1/companies/me/dashboard`  RECRUITER

Company report: counts + funnel + avg score + credits.

**Success 200**
```json
{
  "success": true, "message": "Dashboard fetched successfully",
  "data": {
    "company": { "id": "...", "name": "HireCorp", "website": null,
                 "logoUrl": null, "creditsRemaining": 25, "createdAt": "..." },
    "assessmentCount": 2,
    "assessmentsByStatus": { "PUBLISHED": 1, "DRAFT": 1 },
    "invitationCount": 4,
    "invitationsByStatus": { "PENDING": 1, "ACCEPTED": 2, "DECLINED": 1 },
    "attemptCount": 3,
    "attemptsByStatus": { "IN_PROGRESS": 1, "SUBMITTED": 1, "EVALUATED": 1 },
    "averageScore": 7.5
  }
}
```
**Errors:** `403` "No company profile found. Create your company first."

---

### D. Questions `/api/v1/questions` (3 endpoints)  RECRUITER only

#### D1. `POST /api/v1/questions`

**Body**  `options` / `correctAnswer` are JSON (typical for MCQ).
```json
{
  "type": "MCQ",
  "difficulty": "EASY",
  "title": "What is 2+2?",
  "body": "Choose the correct answer.",
  "options": ["2", "3", "4", "5"],
  "correctAnswer": "4",
  "tags": ["math"]
}
```
```json
{ "type": "WRITTEN", "difficulty": "MEDIUM",
  "title": "Explain REST", "body": "Write 3–5 sentences.", "tags": ["architecture"] }
```
```json
{ "type": "CODING", "difficulty": "HARD", "title": "Two Sum",
  "body": "Write a solution for two-sum.", "tags": ["algorithms"] }
```
| Field | Type | Rules |
|---|---|---|
| `type` | `"MCQ"` \| `"WRITTEN"` \| `"CODING"` | required |
| `difficulty` | `"EASY"` \| `"MEDIUM"` \| `"HARD"` | required |
| `title` | string | required |
| `body` | string | required |
| `options` | JSON | optional (MCQ choices) |
| `correctAnswer` | JSON | optional (MCQ key) |
| `tags` | string[] | optional |

> CODING is stored as text and graded manually (no sandbox execution).

**Success 201**  created question (with its `id`, `companyId`, timestamps).
**Errors:** `400` validation / no company at all (`403`).

---

#### D2. `GET /api/v1/questions`  search + filter + pagination

**Query**
| Param | Type | Notes |
|---|---|---|
| `type` | `MCQ` \| `WRITTEN` \| `CODING` | optional filter |
| `difficulty` | `EASY` \| `MEDIUM` \| `HARD` | optional filter |
| `q` | string | case-insensitive search on title/body |
| `page` | number | default 1 |
| `limit` | number | default 10, max 100 |

**Success 200**
```json
{ "success": true, "message": "Questions fetched successfully",
  "data": { "items": [ { "id": "...", "companyId": "...", "type": "MCQ",
      "difficulty": "EASY", "title": "...", "body": "...", "options": [...],
      "correctAnswer": "...", "tags": ["math"], "createdAt": "...",
      "updatedAt": "...", "deletedAt": null } ],
    "meta": { "page": 1, "limit": 10, "total": 4, "totalPages": 1 } } }
```
**Errors:** `403` no company.

---

#### D3. `PATCH /api/v1/questions/:id`  update or soft delete

**Option 1  update** (any subset)
```json
{ "type": "WRITTEN", "difficulty": "HARD", "title": "Rewrite title",
  "body": "New body", "options": [...], "correctAnswer": "...", "tags": ["new"] }
```

**Option 2  soft delete**
```json
{ "deletedAt": "now" }
```
Sets `deletedAt` to now; the question disappears from all list endpoints.

**Success 200**  updated question (deleted row returned with a `deletedAt` timestamp).
**Errors:** `404` "Question not found" (also if it belongs to another company → `404`, non-leaky).

---

### E. Assessments `/api/v1/assessments` (4 endpoints)  RECRUITER only

#### E1. `POST /api/v1/assessments`

**Body**
```json
{ "title": "Backend Engineer Test", "description": "60 min general test",
  "durationMins": 60, "passScore": 70 }
```
| Field | Type | Rules |
|---|---|---|
| `title` | string | required |
| `description` | string | optional |
| `durationMins` | number | required, positive int |
| `passScore` | number | optional, 0–100 |

**Success 201**  created assessment (`status: "DRAFT"`).
**Errors:** `400` validation; `403` no company.

---

#### E2. `GET /api/v1/assessments`  filter + sort + pagination

**Query**
| Param | Type | Notes |
|---|---|---|
| `status` | `DRAFT` \| `PUBLISHED` \| `CLOSED` \| `ARCHIVED` | optional |
| `sortBy` | `createdAt` (default) \| `title` | optional |
| `sortOrder` | `desc` (default) \| `asc` | optional |
| `page` / `limit` | number | 1 / 10 (max 100) |

**Success 200**
```json
{ "success": true, "message": "Assessments fetched successfully",
  "data": { "items": [ { "id": "...", "companyId": "...", "title": "...",
      "description": null, "status": "DRAFT", "durationMins": 60,
      "passScore": 70, "createdAt": "...", "updatedAt": "...", "deletedAt": null,
      "_count": { "questions": 4, "invitations": 2 } } ],
    "meta": { "page": 1, "limit": 10, "total": 2, "totalPages": 1 } } }
```

---

#### E3. `GET /api/v1/assessments/:id`  full detail + stats

**Success 200**
```json
{ "success": true, "message": "Assessment fetched successfully",
  "data": { "id": "...", "companyId": "...", "title": "...", "description": null,
    "status": "PUBLISHED", "durationMins": 60, "passScore": 70,
    "questions": [ { "assessmentId": "...", "questionId": "...", "points": 1,
        "order": 0, "question": { "id": "...", "type": "MCQ", "difficulty": "EASY",
           "title": "...", "body": "...", "options": [...], "correctAnswer": "...",
           "tags": [], "createdAt": "...", "updatedAt": "...", "deletedAt": null } } ],
    "_count": { "invitations": 2 },
    "stats": { "invitationCount": 2,
      "invitationsByStatus": { "PENDING": 1, "ACCEPTED": 1 },
      "attemptCount": 1, "attemptsByStatus": { "SUBMITTED": 1 },
      "averageScore": null },
    "createdAt": "...", "updatedAt": "...", "deletedAt": null } }
```
**Errors:** `404` not found / not your company.

---

#### E4. `PATCH /api/v1/assessments/:id`  **one endpoint, three uses**

Detected by which field is present. Only one use per call.

**Use 1  lifecycle transition** (status must not already be there)
```json
{ "status": "PUBLISHED" }   // DRAFT → PUBLISHED   (requires ≥1 question)
{ "status": "CLOSED" }      // PUBLISHED → CLOSED
{ "status": "ARCHIVED" }    // CLOSED → ARCHIVED
```
Writes an audit log `ASSESSMENT_STATUS_CHANGE`.
Errors: `400` "Cannot transition assessment from X to Y"; `400` "Add at least one question before publishing".

**Use 2  replace question set** (DRAFT only, atomic swap, all points default 1)
```json
{ "questionIds": ["q1", "q2", "q3"] }
```
Order in the array = question order. Errors: `400` "Questions can only be modified on draft assessments"; `400` "One or more questions are invalid or not owned by your company".
Success returns the assessment **with its questions embedded**.

**Use 3  edit details** (DRAFT only)
```json
{ "title": "Renamed", "description": "New desc", "durationMins": 90, "passScore": 80 }
```
Errors: `400` "Only draft assessments can be edited".

**Use 4  soft delete**
```json
{ "deletedAt": "now" }
```
Sets `deletedAt` to now; the assessment disappears from all list/detail endpoints.

**Success 200**  updated assessment object.

---

### F. Invitations `/api/v1/invitations` + `/api/v1/assessments/:id/invitations` (3 endpoints)

#### F1. `POST /api/v1/assessments/:id/invitations`  RECRUITER

Bulk-invite candidates **by email**. All emails must belong to existing `CANDIDATE` accounts. Duplicate emails inside the array are removed. Token (uuid, unique) + `expiresAt` = now + 7 days are generated server-side. Re-inviting a candidate whose previous invitation is `DECLINED` or `EXPIRED` **reactivates** it (status → `PENDING`, fresh token + expiry) instead of erroring; `409` is still returned for an existing `PENDING`/`ACCEPTED` invitation or a candidate who already attempted the assessment.

**Body**
```json
{ "candidateEmails": ["dev.a@gmail.com", "dev.b@gmail.com"] }
```

**Success 201**
```json
{ "success": true, "message": "Invitations sent successfully",
  "data": [ { "id": "...", "assessmentId": "...", "candidateId": "...",
      "status": "PENDING", "token": "<uuid>", "expiresAt": "2026-09-19T...Z",
      "createdAt": "2026-09-12T...Z",
      "candidate": { "id": "...", "name": "Dev A", "email": "dev.a@gmail.com" } } ] }
```
Writes audit log `INVITATIONS_SENT`.

**Errors:** `404` "Assessment not found" (not yours → 404); `400` "No candidate account found for: ..."; `409` "One or more candidates are already invited to this assessment".

---

#### F2. `GET /api/v1/invitations/me`  CANDIDATE

**Query:** `status` (`PENDING`\|`ACCEPTED`\|`DECLINED`\|`EXPIRED`) optional, `page`/`limit`.

**Success 200**
```json
{ "success": true, "message": "Invitations fetched successfully",
  "data": { "items": [ { "id": "...", "assessmentId": "...", "candidateId": "...",
      "status": "PENDING", "token": "<uuid>", "expiresAt": "...", "createdAt": "...",
      "assessment": { "id": "...", "title": "Backend Engineer Test",
        "description": "...", "durationMins": 60, "status": "PUBLISHED" },
      "attempt": null } ],
    "meta": { "page": 1, "limit": 10, "total": 2, "totalPages": 1 } } }
```
`attempt` is populated once started: `{ id, status, deadline, resultReleased }` (the score is **not** exposed here  it is only visible via `GET /attempts/:id` once the result is released).

---

#### F3. `PATCH /api/v1/invitations/:id`  CANDIDATE or RECRUITER

Only works while the invitation is `PENDING` (and not expired). An expired invitation is flipped to `EXPIRED` and rejected.

**Candidate**  accept or decline (own invitation only, else 403):
```json
{ "status": "ACCEPTED" }    // or "DECLINED"
```

**Recruiter**  revoke: any body status is forced to `"DECLINED"` (own company's invitation only):
```json
{ "status": "DECLINED" }
```

**Success 200**  updated invitation.
**Errors:** `404`; `400` "This invitation is no longer pending"; `400` "This invitation has expired"; `403` other's invitation.

---

### G. Attempts `/api/v1/invitations` + `/api/v1/attempts` (4 endpoints)

#### G1. `POST /api/v1/invitations/:id/start`  CANDIDATE

Starts the attempt. Auto-accepts a `PENDING` invitation. Computes `deadline = startedAt + assessment.durationMins` **server-side**.

**Success 201**
```json
{ "success": true, "message": "Attempt started successfully",
  "data": { "id": "...", "invitationId": "...", "candidateId": "...",
    "status": "IN_PROGRESS", "startedAt": "2026-09-12T10:00:00Z",
    "submittedAt": null, "deadline": "2026-09-12T11:00:00Z",
    "score": null, "maxScore": null, "resultReleased": false, "evaluatorNote": null,
    "invitation": { "id": "...", "status": "ACCEPTED",
      "assessment": { "id": "...", "title": "Backend Engineer Test", "durationMins": 60 } } } }
```
**Errors:** `404` invitation; `403` not your invitation; `400` declined/expired invitation; `400` "This invitation has expired"; `400` "An attempt already exists for this invitation"; `400` "This assessment is not currently published".

---

#### G2. `PATCH /api/v1/attempts/:id`  CANDIDATE (own attempt)

Save answers repeatedly, then submit once. **Timer:** if `deadline` has passed, any write first flips the attempt to `EXPIRED` and is rejected. Only `IN_PROGRESS` attempts can be written. `questionId` must belong to the assessment (else 400).

**Body  save progress**
```json
{ "answers": [ { "questionId": "q-mcq", "response": "4" },
               { "questionId": "q-wr", "response": "REST is an architectural style..." } ] }
```
Answers are **upserted** (unique per `attemptId+questionId`).

**Body  submit (finalizes; triggers MCQ auto-grade)**
```json
{ "status": "SUBMITTED" }
```
On submit the server: updates `submittedAt`, computes `maxScore` (sum of assessment question points), auto-grades every answered MCQ (`isCorrect`, `pointsAwarded`), stores `score`. Written/coding answers keep `pointsAwarded: null` until manual evaluation.

**Success 200**
```json
{ "success": true, "message": "Attempt updated successfully",
  "data": { "id": "...", "status": "SUBMITTED", "submittedAt": "...", "score": 3,
    "maxScore": 5, "resultReleased": false,
    "answers": [ { "id": "ans1", "attemptId": "...", "questionId": "q-mcq",
        "response": "4", "isCorrect": true, "pointsAwarded": 1 },
      { "id": "ans2", "...": "...", "response": "REST is...", "isCorrect": null, "pointsAwarded": null } ],
    "invitation": { "id": "...", "assessment": { "id": "...", "title": "...", "durationMins": 60 } } } }
```
**Errors:** `404`; `403` not your attempt; `400` "Attempt has expired before submission"; `400` "Cannot update an attempt with status X"; `400` "Question X is not part of this assessment"; `409` "Attempt has already been submitted" (double-submit).

---

#### G3. `GET /api/v1/attempts/:id`  CANDIDATE (own) or RECRUITER (own assessment)

Full state incl. answers and the question set. A stale `IN_PROGRESS` attempt is first flipped to `EXPIRED` (and returned as such).

**Result gating (CANDIDATE):** until the recruiter calls evaluate with `releaseResult: true`, a candidate reading their own attempt sees `score`, `maxScore`, `evaluatorNote` as `null` and every answer's `isCorrect` / `pointsAwarded` masked to `null`. Recruiters/admins always see the real values; a released result is fully visible to the candidate too.

**Success 200**  attempt object with `answers[]`, plus nested `invitation.assessment` including `questions[]` (each `{ points, order, question: {...} }`).
**Errors:** `404`; `403` different user's attempt / different company's assessment.

---

#### G4. `POST /api/v1/attempts/:id/evaluate`  RECRUITER

Manual grading of WRITTEN / CODING answers. Only `SUBMITTED` attempts can be evaluated. `answerId` must belong to this attempt. MCQ points are left untouched  passing an MCQ answerId in `scores` is rejected with `400`. Recomputes total `score` (auto + manual) and `maxScore`.

**Body**
```json
{
  "scores": [ { "answerId": "ans2", "points": 4 } ],
  "releaseResult": true
}
```
| Field | Type | Rules |
|---|---|---|
| `scores` | array | required, min 1; `{ answerId: string, points: number 0–10000 }` |
| `releaseResult` | boolean | optional; when `true` the candidate can see the result + an audit log `RESULT_RELEASED` is written |

**Success 200**  attempt with `status: "EVALUATED"`, `score`, `maxScore`, `resultReleased`, answers (with awarded points).
**Errors:** `404`; `403` not your assessment; `400` "Only submitted attempts can be evaluated"; `400` "Answer X does not belong to this attempt".

---

### H. Results `/api/v1/assessments/:id/results` (1 endpoint)  RECRUITER

#### H1. `GET /api/v1/assessments/:id/results`  paginated

**Query:** `page`, `limit` (default 1 / 10, max 100).

**Success 200**
```json
{ "success": true, "message": "Results fetched successfully",
  "data": { "items": [ { "id": "attempt-id", "invitationId": "...", "candidateId": "...",
      "status": "EVALUATED", "startedAt": "...", "submittedAt": "...",
      "deadline": "...", "score": 7, "maxScore": 10,
      "resultReleased": true, "evaluatorNote": null,
      "candidate": { "id": "...", "name": "Dev A", "email": "dev.a@gmail.com" },
      "invitation": { "status": "ACCEPTED" } } ],
    "meta": { "page": 1, "limit": 10, "total": 3, "totalPages": 1 } } }
```
**Errors:** `404` assessment (or not yours); `403` no company.

---

### I. Payments `/api/v1/payments` (4 endpoints)

Credit plans:

| Plan | Credits | Price (USD) |
|---|---|---|
| `STARTER` | 25 | $20.00 |
| `PRO` | 100 | $75.00 |
| `ENTERPRISE` | 300 | $200.00 |

#### I1. `POST /api/v1/payments/initiate`  RECRUITER

Creates a Stripe Checkout Session and a `PENDING` Payment row (`providerRef` = session id, **unique → webhook idempotency key**).

**Body**
```json
{ "plan": "STARTER" }
```

**Success 201**
```json
{ "success": true, "message": "Payment initiated successfully",
  "data": { "checkoutUrl": "https://checkout.stripe.com/c/pay/...",
    "payment": { "id": "pay_...", "companyId": "company-id", "provider": "STRIPE",
      "amount": "20", "status": "PENDING", "providerRef": "cs_test_...",
      "creditsGranted": 25, "createdAt": "...", "updatedAt": "..." } } }
```
**Errors:** `400` invalid plan; `403` no company; `500` Stripe not configured / session failed. Requires `STRIPE_SECRET_KEY` in `.env`.

---

#### I2. `POST /api/v1/payments/webhook`  public (Stripe-signed)

Registered **before** `express.json()` as a raw-body route. Verifies the `Stripe-Signature` header via `stripe.webhooks.constructEvent`. Only a valid signature can mark a payment `PAID`.

**Headers:** `Stripe-Signature: <sig>`
**Body:** raw JSON (the Stripe event)  tested with Stripe CLI:
```bash
stripe listen --forward-to localhost:5000/api/v1/payments/webhook
stripe trigger checkout.session.completed
```

**Behavior**
- `checkout.session.completed` + `payment_status: "paid"` → inside a transaction: Payment → `PAID`, `company.creditsRemaining += creditsGranted`, audit log `PAYMENT_CONFIRMED`.
- **Replayed webhook for the same `providerRef` = no-op, still 200** (idempotency).
- Other event types → early return, 200.

**Success 200**
```json
{ "success": true, "message": "Webhook processed successfully", "data": null }
```
**Errors:** `500` webhook not configured; `404` "Payment not found"; non-AppError (bad signature) → `400` "Webhook processing failed".

---

#### I3. `GET /api/v1/payments`  RECRUITER (own company)

**Query:** `page`, `limit` (default 1 / 10, max 100).

**Success 200**
```json
{ "success": true, "message": "Payments fetched successfully",
  "data": { "items": [ { "id": "pay_...", "companyId": "...", "provider": "STRIPE",
      "amount": "20", "status": "PAID", "providerRef": "cs_test_...",
      "creditsGranted": 25, "createdAt": "...", "updatedAt": "..." } ],
    "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 } } }
```

---

#### I4. `GET /api/v1/payments/:id`  RECRUITER (own company) or ADMIN

**Success 200**
```json
{ "success": true, "message": "Payment fetched successfully",
  "data": { "id": "pay_...", "companyId": "...", "provider": "STRIPE",
    "amount": "20", "status": "PAID", "providerRef": "cs_test_...",
    "creditsGranted": 25, "createdAt": "...", "updatedAt": "...",
    "company": { "id": "...", "name": "HireCorp" } } }
```
**Errors:** `404`; `403` another company's payment (ADMIN bypasses).

---

### J. Admin `/api/v1/admin` (4 endpoints)  ADMIN only (app-level guard)

#### J1. `GET /api/v1/admin/users`  search + filter + pagination

**Query**
| Param | Type | Notes |
|---|---|---|
| `role` | `CANDIDATE` \| `RECRUITER` \| `ADMIN` | optional |
| `status` | `ACTIVE` \| `SUSPENDED` | optional |
| `q` / `search` | string | case-insensitive match on name/email (`q` and `search` are aliases) |
| `page` / `limit` | number | 1 / 10 (max 100) |

**Success 200**
```json
{ "success": true, "message": "Users fetched successfully",
  "data": { "items": [ { "id": "...", "name": "Dev A", "email": "dev.a@gmail.com",
      "role": "CANDIDATE", "status": "ACTIVE", "authProvider": "LOCAL",
      "avatarUrl": null, "createdAt": "...",
      "companyMembership": null,
      "_count": { "invitations": 3, "attempts": 1, "auditLogs": 0 } } ],
    "meta": { "page": 1, "limit": 10, "total": 3, "totalPages": 1 } } }
```

---

#### J2. `PATCH /api/v1/admin/users/:id`  suspend / restore / soft delete

**Body  suspend / restore**
```json
{ "status": "SUSPENDED" }   // or "ACTIVE"
```

**Body  soft delete**
```json
{ "deletedAt": "now" }
```
Sets the user's `deletedAt`; the user disappears from all lists and can no longer log in. Writes audit log `USER_DELETED`.

Cannot suspend or delete an ADMIN user (`400`). Suspend/restore writes audit log `USER_STATUS_UPDATED`.

**Success 200**
```json
{ "success": true, "message": "User status updated successfully",
  "data": { "id": "...", "name": "Dev A", "email": "dev.a@gmail.com",
            "role": "CANDIDATE", "status": "SUSPENDED" } }
```
**Errors:** `404` "User not found"; `400` "Cannot suspend an admin user"; `400` "Cannot delete an admin user"; `400` "Either status or deletedAt must be provided".

---

#### J3. `GET /api/v1/admin/stats`  platform-wide numbers

**Success 200**
```json
{ "success": true, "message": "Stats fetched successfully",
  "data": { "users": { "total": 6, "recruiters": 2, "candidates": 3, "admins": 1 },
    "companies": 2, "questions": 12, "assessments": 4, "attempts": 9,
    "payments": { "paidCount": 1, "totalRevenue": 20 } } }
```

---

#### J4. `GET /api/v1/admin/audit-logs`  activity trail

**Query:** `entity` (`Assessment` \| `User` \| `Payment` \| `Attempt`...), `action`, `page`, `limit`.

**Success 200**
```json
{ "success": true, "message": "Audit logs fetched successfully",
  "data": { "items": [ { "id": "...", "userId": "admin-id", "action": "USER_STATUS_UPDATED",
      "entity": "User", "entityId": "user-id", "meta": { "from": "ACTIVE", "to": "SUSPENDED" },
      "createdAt": "...",
      "user": { "id": "admin-id", "name": "Admin", "email": "admin@codearena.com" } } ],
    "meta": { "page": 1, "limit": 10, "total": 8, "totalPages": 1 } } }
```

---

## 6. Rule summary (business logic you should verify in Postman)

| Rule | Where |
|---|---|
| Assessment lifecycle is **one-directional**: `DRAFT → PUBLISHED → CLOSED → ARCHIVED` | E4 |
| Can't edit questions/details after publish (must stay DRAFT) | E4 |
| Publish requires at least one question | E4 |
| Invitation can only be accepted/declined/revoked while `PENDING`; expired → `EXPIRED` | F3 |
| Attempt deadline is **server-computed**; past the deadline every read/write flips status to `EXPIRED` | G |
| Duplicate pending/accepted invite to same candidate+assessment → 409 | F1 |
| MCQ auto-graded at submit; WRITTEN/CODING graded via evaluate; result released only when `releaseResult: true` | G2/G4 |
| Candidates see `score`/`maxScore`/per-answer correctness only after the result is released (`null` before) | G3 |
| Double-submit of an attempt → `409 CONFLICT` (status guarded with a conditional update) | G2 |
| Payment is set to `PAID` **only** by a signature-verified webhook; duplicate webhooks are no-ops that still return 200 | I1/I2 |
| Multi-tenancy: company scoping always comes from your `CompanyMembership`, never from the body | everywhere |
| Soft deletes: question / assessment `{ deletedAt: "now" }` and admin user `{ deletedAt: "now" }` set a timestamp; lists filter `deletedAt: null` | D3, E4, J2 |
| Rate limit: 100 req / 15 min per IP on `/api/v1` (webhook exempt); helmet + CORS allow-list active | global |

## 7. .env keys you still need to fill (not committed)

```bash
GOOGLE_CLIENT_ID=...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```