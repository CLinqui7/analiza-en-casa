# Synthetic provider only: these tests never authenticate or create cloud resources.
mock_provider "google" {}

variables {
  project_id                   = "synthetic-project"
  private_bucket               = "synthetic-private-bucket"
  existing_sql_connection_name = "synthetic-project:us-central1:analiza-sql-staging"
  sql_connection_budget        = 40
  db_user_secret_id            = "synthetic-runtime-user"
  db_password_secret_id        = "synthetic-runtime-password"
  db_user_secret_version       = "1"
  db_password_secret_version   = "1"
  prepare_operator             = true
  operator_secret_versions     = { user = "1", password = "1", qa = "1" }
  image_digest_uri             = "us-central1-docker.pkg.dev/synthetic-project/analiza/analiza-web@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  operator_image_digest_uri    = "us-central1-docker.pkg.dev/synthetic-project/analiza/analiza-operator@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
}

run "connected_staging_plan" {
  command = plan
  variables {
    deploy_service           = true
    deploy_operator          = true
    deploy_seed_job          = true
    create_state_bucket      = true
    create_private_bucket    = true
    create_secret_containers = true
  }
  assert {
    condition     = google_cloud_run_v2_service.staging[0].template[0].containers[0].ports[0].container_port == 8080 && toset(google_cloud_run_v2_service.staging[0].template[0].volumes[0].cloud_sql_instance[0].instances) == toset([var.existing_sql_connection_name])
    error_message = "Web must use 8080 and the managed SQL socket."
  }
  assert {
    condition     = length(google_cloud_run_v2_job.database) == 2 && google_cloud_run_v2_job.database["seed"].template[0].template[0].max_retries == 0
    error_message = "Migrations and synthetic seed must be explicit jobs, without automatic retries."
  }
  assert {
    condition     = length(google_secret_manager_secret_iam_member.runtime_db) == 2 && !contains(local.secret_ids, var.migration_password_secret_id)
    error_message = "Web must not receive migration or QA credentials."
  }
  assert {
    condition     = toset(google_project_iam_custom_role.private_files.permissions) == toset(["storage.objects.get", "storage.objects.create"])
    error_message = "Runtime must not receive storage deletion or bucket administration."
  }
  assert {
    condition     = google_storage_bucket.terraform_state[0].public_access_prevention == "enforced" && google_storage_bucket.terraform_state[0].versioning[0].enabled && google_storage_bucket.private_files[0].public_access_prevention == "enforced"
    error_message = "State and files must remain private and state must be versioned."
  }
}
run "reject_public_invoker" {
  command = plan
  variables { invokers = ["allUsers"] }
  expect_failures = [var.invokers]
}
run "corporate_schema_without_synthetic_seed" {
  command = plan
  variables {
    deploy_operator              = true
    database_name                = "corporate_qa"
    operator_secret_versions     = { user = "1", password = "1" }
    sql_instance_name            = "corporate-staging"
    existing_sql_connection_name = "synthetic-project:us-central1:corporate-staging"
  }
  assert {
    condition     = length(google_cloud_run_v2_job.database) == 1 && contains(keys(google_cloud_run_v2_job.database), "migrate") && !contains(local.operator_secret_ids, var.qa_password_secret_id)
    error_message = "Corporate migration must not require a seed job or its synthetic credentials."
  }
}
run "reject_production" {
  command = plan
  variables { service_name = "analiza-prod" }
  expect_failures = [var.service_name]
}
run "reserve_connections_for_two_revisions" {
  command = plan
  variables {
    deploy_service        = true
    sql_connection_budget = 25
  }
  expect_failures = [google_cloud_run_v2_service.staging]
}
