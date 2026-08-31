# Performance FINAL

- Generated: 2026-08-31T17:20:14.005Z
- Login: 64 ms
- Dashboard hot navigation: 57 ms (budget <= 500 ms)
- Patient search (1,000): 29 ms
- Modal open: 41 ms

```json
{
  "mode": "FINAL",
  "startedAt": "2026-08-31T17:20:14.005Z",
  "baseURL": "http://127.0.0.1:4197",
  "routes": {
    "/login": {
      "navigationMs": 608,
      "domContentLoadedMs": 32,
      "loadMs": 147,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    },
    "/dashboard": {
      "navigationMs": 570,
      "domContentLoadedMs": 15,
      "loadMs": 49,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    },
    "/patients": {
      "navigationMs": 559,
      "domContentLoadedMs": 27,
      "loadMs": 44,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    },
    "/hospitalizations": {
      "navigationMs": 542,
      "domContentLoadedMs": 16,
      "loadMs": 28,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    },
    "/quotes": {
      "navigationMs": 557,
      "domContentLoadedMs": 20,
      "loadMs": 36,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    },
    "/insurance": {
      "navigationMs": 543,
      "domContentLoadedMs": 16,
      "loadMs": 29,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    }
  },
  "scenarios": {
    "loginMs": 64,
    "dashboardHotNavigationMs": 57,
    "patientSearch1000Ms": 29,
    "modalOpenMs": 41
  },
  "budgets": {
    "dashboardHotNavigationMs": 500,
    "dashboardBudgetPass": true
  },
  "notes": [
    "Production local measurement; LCP/CLS use browser timing when available.",
    "Mock provider currently uses workspace.v2 for the 1,000-patient fixture."
  ]
}
```
