ALTER TABLE analiza.feedback_reports
  DROP CONSTRAINT IF EXISTS feedback_reports_module_check,
  ADD CONSTRAINT feedback_reports_module_check
    CHECK (module IN ('DASHBOARD','PATIENTS','AGENDA','HOSPITALIZATIONS','QUOTES','RECEIVABLES','PAYABLES','PAYMENTS','INSURANCE','CLINICAL','NURSING','MEDICATIONS','DOCTORS','INVENTORY','PURCHASES','CATALOGS','REPORTS','FILES','ACCESS','NAVIGATION','OTHER'));

ALTER TABLE analiza.feedback_reports
  DROP CONSTRAINT IF EXISTS feedback_reports_category_check,
  ADD CONSTRAINT feedback_reports_category_check
    CHECK (category IN ('ERROR','QUESTION','NEW_FEATURE','CHANGE','IMPROVEMENT'));
