# Performance FINAL

- Generated: 2026-08-31T15:30:30.128Z
- Login: 67 ms
- Patient search (1,000): 28 ms
- Modal open: 72 ms

```json
{
  "mode": "FINAL",
  "startedAt": "2026-08-31T15:30:30.128Z",
  "baseURL": "http://127.0.0.1:4197",
  "routes": {
    "/login": {
      "navigationMs": 590,
      "domContentLoadedMs": 32,
      "loadMs": 89,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    },
    "/dashboard": {
      "navigationMs": 561,
      "domContentLoadedMs": 13,
      "loadMs": 38,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    },
    "/patients": {
      "navigationMs": 561,
      "domContentLoadedMs": 29,
      "loadMs": 43,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    },
    "/hospitalizations": {
      "navigationMs": 561,
      "domContentLoadedMs": 21,
      "loadMs": 34,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    },
    "/quotes": {
      "navigationMs": 550,
      "domContentLoadedMs": 22,
      "loadMs": 35,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    },
    "/insurance": {
      "navigationMs": 560,
      "domContentLoadedMs": 23,
      "loadMs": 34,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    }
  },
  "scenarios": {
    "loginMs": 67,
    "patientSearch1000Ms": 28,
    "modalOpenMs": 72
  },
  "notes": [
    "Production local measurement; LCP/CLS use browser timing when available.",
    "Mock provider currently uses workspace.v2 for the 1,000-patient fixture."
  ]
}
```
