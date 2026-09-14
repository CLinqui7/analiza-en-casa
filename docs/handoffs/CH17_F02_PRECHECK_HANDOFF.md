# CH17 F02 safe hospitalization-action menu

`CH17-E0005` was opened. The report route now renders the seven observed action labels only after a local menu toggle. The menu has no patient or hospitalization context; every destination is `aria-disabled` and cannot load or disclose clinical, financial, audit, or messaging content.

`CH17-Q007` blocks the authorized record relation, roles, conditions, audit evidence, and safe destination contract. `CH16-Q008` still blocks any sensitive Reporte de salud data source. Selenium remains `PENDING_RUNTIME` because Python is unavailable.
