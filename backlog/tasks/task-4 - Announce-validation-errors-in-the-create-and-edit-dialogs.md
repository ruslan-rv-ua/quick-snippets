---
id: TASK-4
title: Announce validation errors in the create and edit dialogs
status: To Do
assignee: []
created_date: '2026-11-15T23:03:00Z'
labels:
  - accessibility frontend
dependencies: []
priority: medium
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The create and edit dialogs show validation errors (empty title, empty content, password mismatch) as a newly inserted role="alert" element and add aria-describedby to the field at the same moment. The password dialog had the same pattern: inside the app root (role="application") NVDA read only "alert" without the text, and the describedby change made NVDA repeat the message. It was fixed with an always-present assertive live region and no describedby (see PasswordModal.tsx). The create and edit dialogs have not been checked with NVDA yet.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 just smoke has steps that trigger each validation error in the create and edit dialogs and checks what NVDA says
- [ ] #2 NVDA says each validation message exactly once, with its text
- [ ] #3 Focus moves to the first invalid field as today
- [ ] #4 Unit tests cover the live region and the absence of a newly inserted role="alert"
<!-- AC:END -->
