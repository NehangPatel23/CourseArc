# Quiz platform — deferred TODOs

Items that need a real backend, LTI/Canvas integration, hardware capture, or CDN.
Tracked from the quiz polish roadmap appendix (`quiz_polish_phases`).

**Future plan:** Quiz platform backend (auth, API, persistent storage, grading service, LTI). Create that plan when ready: *“create Quiz platform backend plan from docs/TODO.md”*.

---

## Server grading & secrets

| # | Item | Why deferred |
|---|------|----------------|
| 29 | Code plagiarism service | Needs external service or heavy server compute |
| 145 | Server-side grading | localStorage cannot truly hide answer keys |
| 1* | QTI zip / IMS content package import | Needs zip packaging + multi-file package parse (XML import stays client P6) |
| 2* | QTI zip / IMS export package | Same |

\* Client XML QTI import/export remains in Phase 6.

## Soft originality / plagiarism (beyond client soft reports)

Client soft originality (peer/self text + code-normalized compare, side-by-side report, quiz settings, submit snapshot, CSV/JSON export) is implemented in-app. The following still need external services or a backend:

| # | Item | Why deferred |
|---|------|----------------|
| 166 | Internet / web originality database | Requires crawling or a commercial index API |
| 167 | Turnitin / iThenticate / Ouriginal LTI | Vendor LTI 1.3 + license + grade/report passback |
| 168 | Institutional repository matching | Shared multi-course/term corpus on a server |
| 169 | Publisher / textbook passage matching | Licensed content indexes |
| 170 | AI-writing detection | Third-party classifier APIs; high false-positive risk |
| 171 | PDF / image OCR originality | File upload pipeline + OCR service (#74/#148 adjacent) |
| 172 | Cross-institution originality network | Multi-tenant backend + privacy agreements |
| 173 | Official originality audit trail | Append-only server log (related to #149) |

## Proctoring (hardware / network)

| # | Item | Why deferred |
|---|------|----------------|
| 40 | Webcam photo capture | Camera permissions + blob storage + privacy |
| 41 | Real IP capture | Requires server request metadata |
| 92 | IP allowlist | Requires server enforcement |

## Media / responses

| # | Item | Why deferred |
|---|------|----------------|
| 74 | File-upload question type | Durable file storage beyond local demo Files |
| 75* | Hotspot CDN hosting | Local data-URL hotspot is client P7; CDN is deferred |
| 78 | Audio/video response | Media recording + storage |
| 110 | Audio feedback comments | Media storage |
| 148 | Attachments CDN | Hosted asset pipeline |

## LTI / Canvas / identity

| # | Item | Why deferred |
|---|------|----------------|
| 147 | LTI / Canvas sync | OAuth, LTI 1.3, grade passback |

## Sync & ops

| # | Item | Why deferred |
|---|------|----------------|
| 146 | Multi-device sync service | Cross-browser/device sync (same-tab sync is client P3) |
| 149 | Audit log service | Append-only server log of key changes / regrades |

---

## Notes

- Client phases P1–P9 implement everything else from appendix #1–165 (except wontfix #9, #39, #53).
- Soft originality client features are live; deferred originality items are #166–173 above (plus legacy #29 for a dedicated code-plagiarism service).
- When a deferred item is later completed, strike it here and in the plan appendix.
