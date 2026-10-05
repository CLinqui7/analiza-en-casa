# Performance FINAL

- Generated: 2026-10-05T21:39:45.595Z
- Login: 94 ms
- Dashboard hot navigation: 115 ms (budget <= 500 ms)
- Patient search (1,000): 43 ms
- Modal open: 99 ms

```json
{
  "mode": "FINAL",
  "startedAt": "2026-10-05T21:39:45.595Z",
  "baseURL": "http://127.0.0.1:4197",
  "routes": {
    "/login": {
      "navigationMs": 987,
      "domContentLoadedMs": 53,
      "loadMs": 295,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    },
    "/dashboard": {
      "navigationMs": 742,
      "domContentLoadedMs": 24,
      "loadMs": 97,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    },
    "/patients": {
      "navigationMs": 733,
      "domContentLoadedMs": 46,
      "loadMs": 82,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    },
    "/hospitalizations": {
      "navigationMs": 688,
      "domContentLoadedMs": 30,
      "loadMs": 63,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    },
    "/quotes": {
      "navigationMs": 673,
      "domContentLoadedMs": 31,
      "loadMs": 89,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    },
    "/insurance": {
      "navigationMs": 714,
      "domContentLoadedMs": 27,
      "loadMs": 56,
      "lcpMs": null,
      "cls": 0,
      "longTasksOver500ms": 0,
      "storageBytes": 0
    }
  },
  "scenarios": {
    "loginMs": 94,
    "dashboardHotNavigationMs": 115,
    "patientSearch1000Ms": 43,
    "modalOpenMs": 99
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
