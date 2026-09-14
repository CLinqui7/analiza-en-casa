output "registry_prefix" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${var.artifact_repository}"
}
output "runtime_service_account" {
  value = google_service_account.runtime.email
}
output "migration_service_account" {
  value = google_service_account.migrator.email
}
output "build_service_account" {
  value = google_service_account.build.email
}
output "cloud_sql_connection" {
  value = local.connection_name
}
output "staging_url" {
  value = try(google_cloud_run_v2_service.staging[0].uri, null)
}
output "database_jobs" {
  value = { for operation, job in google_cloud_run_v2_job.database : operation => job.name }
}
