# Performance BASELINE

- Generated: 2026-08-31T15:17:45.657Z
- Login: 68 ms
- Patient search (1,000): 38 ms
- Modal open: 85 ms

```json
{
  "mode": "BASELINE",
  "startedAt": "2026-08-31T15:17:45.657Z",
  "baseURL": "http://127.0.0.1:4185",
  "routes": {
    "/login": {
      "navigationMs": 574,
      "domContentLoadedMs": 43,
      "loadMs": 108,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    },
    "/dashboard": {
      "navigationMs": 589,
      "domContentLoadedMs": 34,
      "loadMs": 55,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    },
    "/patients": {
      "navigationMs": 562,
      "domContentLoadedMs": 18,
      "loadMs": 39,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    },
    "/hospitalizations": {
      "navigationMs": 548,
      "domContentLoadedMs": 18,
      "loadMs": 30,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    },
    "/quotes": {
      "navigationMs": 564,
      "domContentLoadedMs": 20,
      "loadMs": 36,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    },
    "/insurance": {
      "navigationMs": 560,
      "domContentLoadedMs": 19,
      "loadMs": 32,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    }
  },
  "scenarios": {
    "loginMs": 68,
    "patientSearch1000Ms": 38,
    "modalOpenMs": 85
  },
  "notes": [
    "Production local measurement; LCP/CLS use browser timing when available.",
    "Mock provider currently uses workspace.v2 for the 1,000-patient fixture."
  ]
}
```
