# Browser classroom demo: product and acceptance

## Scope
A host creates a code, participants join a browser room, and the host observes chat-based participation and suggested interventions. This is a chat room with local camera preview, **not a WebRTC video meeting**. The observer/admin role, external meetings, account login and deployment are future work.

## Journeys and checklist
- [ ] A host creates a session and shares the code; a second browser joins with a name.
- [ ] The host sees join/leave and chat updates. Three messages indicating confusion trigger a suggestion; cooldown prevents repeated alerts. Rules are heuristics, not diagnoses.
- [ ] After three minutes without chat, a silent-participant suggestion appears on the next graph cycle. Silence is measured from chat, not from video or audio.
- [ ] A host reviews and launches a manual, topic starter, or PDF starter question. Students answer once; scores update live and the correct answer is revealed at expiry.
- [ ] End the session and open the recap, including attendance, alerts, quiz scores and JSON export. The ended recap survives a Node restart.
- [ ] The participant explicitly opts in before experimental camera/microphone analysis. Media is off by default.

Targets: creation within a few seconds; ordinary chat/quiz updates within 5–15 seconds on a healthy local network. Silent alerts intentionally require a three-minute threshold plus one monitoring cycle. This is not a benchmark guarantee.

## Boundaries
The default classifier and suggestions are deterministic rules. Topic/PDF starters without a configured model are clearly identified and must be edited by the host. The Python signal/LLM services are experimental and optional; Python's socket events are not bridged to the Node room, so multimodal feedback is not part of the verified flow. Local SQLite holds text and quiz records; it is not shared or multi-process distributed storage. Active sessions are not recovered after a backend restart, only ended recaps. The graph is not a persisted/replayable event-sourced system. Participant identity and host tokens are demo controls, not accounts or strong authorization; the Python endpoints and recap are not protected. Do not expose this demo publicly or use real student data. No Postgres, Redis, real meeting integration, full authentication, PDF report export, or production deployment is included.
