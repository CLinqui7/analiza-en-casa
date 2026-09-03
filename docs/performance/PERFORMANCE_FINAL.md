# Performance FINAL

- Generated: 2026-09-03T14:02:40.904Z
- Login: 56 ms
- Dashboard hot navigation: 54 ms (budget <= 500 ms)
- Patient search (1,000): 29 ms
- Modal open: 66 ms

```json
{
  "mode": "FINAL",
  "startedAt": "2026-09-03T14:02:40.904Z",
  "baseURL": "http://127.0.0.1:4197",
  "routes": {
    "/login": {
      "navigationMs": 611,
      "domContentLoadedMs": 44,
      "loadMs": 159,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    },
    "/dashboard": {
      "navigationMs": 567,
      "domContentLoadedMs": 13,
      "loadMs": 41,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    },
    "/patients": {
      "navigationMs": 565,
      "domContentLoadedMs": 32,
      "loadMs": 49,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    },
    "/hospitalizations": {
      "navigationMs": 570,
      "domContentLoadedMs": 24,
      "loadMs": 41,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    },
    "/quotes": {
      "navigationMs": 563,
      "domContentLoadedMs": 24,
      "loadMs": 43,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    },
    "/insurance": {
      "navigationMs": 551,
      "domContentLoadedMs": 21,
      "loadMs": 32,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    }
  },
  "scenarios": {
    "loginMs": 56,
    "dashboardHotNavigationMs": 54,
    "patientSearch1000Ms": 29,
    "modalOpenMs": 66
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
