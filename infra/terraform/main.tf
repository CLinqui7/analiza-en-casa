locals {
  connection_name     = var.create_sql_instance ? google_sql_database_instance.staging[0].connection_name : var.existing_sql_connection_name
  secret_ids          = toset([var.db_user_secret_id, var.db_password_secret_id])
  operator_secret_ids = var.prepare_operator || var.deploy_operator ? setunion(toset([var.migration_user_secret_id, var.migration_password_secret_id]), var.deploy_seed_job ? toset([var.qa_password_secret_id]) : toset([]), var.provision_runtime_role ? toset([var.db_password_secret_id]) : toset([])) : toset([])
  all_secret_ids      = setunion(local.secret_ids, local.operator_secret_ids)
}
resource "google_artifact_registry_repository" "images" {
  count         = var.create_artifact_repository ? 1 : 0
  location      = var.region
  repository_id = var.artifact_repository
  format        = "DOCKER"
  docker_config {
    immutable_tags = true
  }
  lifecycle {
    prevent_destroy = true
  }
}
resource "google_service_account" "runtime" {
  account_id   = "analiza-run-staging"
  display_name = "Analiza staging runtime (no migration privileges)"
}
resource "google_service_account" "migrator" {
  account_id   = "analiza-staging-migrator"
  display_name = "Analiza explicit migration operator"
}
resource "google_service_account" "build" {
  account_id   = "analiza-staging-build"
  display_name = "Analiza build and push only"
}
resource "google_project_iam_member" "sql_client" {
  for_each = {
    runtime = google_service_account.runtime.email, migrator = google_service_account.migrator.email
  }
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${each.value}"
}
resource "google_artifact_registry_repository_iam_member" "push" {
  location   = var.region
  repository = var.artifact_repository
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.build.email}"
  depends_on = [google_artifact_registry_repository.images]
}
resource "google_project_iam_member" "build_logs" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.build.email}"
}
resource "google_storage_bucket" "private_files" {
  count                       = var.create_private_bucket ? 1 : 0
  name                        = var.private_bucket
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
  versioning {
    enabled = true
  }
  lifecycle {
    prevent_destroy = true
  }
}
resource "google_project_iam_custom_role" "private_files" {
  role_id     = "analizaStagingPrivateFiles"
  title       = "Analiza private object read and create"
  permissions = ["storage.objects.get", "storage.objects.create"]
}
resource "google_storage_bucket_iam_member" "runtime_files" {
  bucket     = var.private_bucket
  role       = google_project_iam_custom_role.private_files.name
  member     = "serviceAccount:${google_service_account.runtime.email}"
  depends_on = [google_storage_bucket.private_files]
}
resource "google_secret_manager_secret" "db" {
  for_each  = var.create_secret_containers ? local.all_secret_ids : toset([])
  secret_id = each.value
  replication {
    auto {
    }
  }
  lifecycle {
    prevent_destroy = true
  }
  # Values/versions intentionally not managed by Terraform (and never stored in its state).
}
resource "google_secret_manager_secret_iam_member" "runtime_db" {
  for_each   = local.secret_ids
  secret_id  = each.value
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${google_service_account.runtime.email}"
  depends_on = [google_secret_manager_secret.db]
}
resource "google_sql_database_instance" "staging" {
  count               = var.create_sql_instance ? 1 : 0
  name                = var.sql_instance_name
  database_version    = "POSTGRES_18"
  region              = var.region
  deletion_protection = true
  settings {
    tier              = var.sql_tier
    edition           = "ENTERPRISE"
    availability_type = "ZONAL"
    disk_size         = var.sql_disk_gb
    disk_autoresize   = false
    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
    }
    ip_configuration {
      ipv4_enabled = true
      ssl_mode     = "ENCRYPTED_ONLY"
      # No authorized_networks. Access through Cloud SQL managed authenticated connection only.
    }
  }
  lifecycle {
    prevent_destroy = true
  }
}
resource "google_sql_database" "staging" {
  count    = var.create_sql_instance ? 1 : 0
  instance = google_sql_database_instance.staging[0].name
  name     = var.database_name
  lifecycle {
    prevent_destroy = true
  }
}
resource "google_cloud_run_v2_service" "staging" {
  count               = var.deploy_service ? 1 : 0
  name                = var.service_name
  location            = var.region
  deletion_protection = true
  ingress             = "INGRESS_TRAFFIC_ALL"
  template {
    service_account                  = google_service_account.runtime.email
    execution_environment            = "EXECUTION_ENVIRONMENT_GEN2"
    max_instance_request_concurrency = var.concurrency
    timeout                          = "60s"
    scaling {
      min_instance_count = 0
      max_instance_count = var.max_instances
    }
    containers {
      image = var.image_digest_uri
      ports {
        container_port = 8080
      }
      resources {
        limits = {
          cpu = var.cpu, memory = var.memory
        }
        cpu_idle = true
      }
      env {
        name  = "ANALIZA_DB_TRANSPORT"
        value = "cloudsql"
      }
      env {
        name  = "PGHOST"
        value = "/cloudsql/${local.connection_name}"
      }
      env {
        name  = "PGDATABASE"
        value = var.database_name
      }
      env {
        name  = "PGPOOL_MAX"
        value = tostring(var.pool_max)
      }
      env {
        name  = "ANALIZA_FILE_STORAGE"
        value = "gcs"
      }
      env {
        name  = "GCS_PRIVATE_BUCKET"
        value = var.private_bucket
      }
      dynamic "env" {
        for_each = {
          PGUSER     = { id = var.db_user_secret_id, version = var.db_user_secret_version }
          PGPASSWORD = { id = var.db_password_secret_id, version = var.db_password_secret_version }
        }
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value.id
              version = env.value.version
            }
          }
        }
      }
      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }
      startup_probe {
        initial_delay_seconds = 0
        timeout_seconds       = 3
        period_seconds        = 5
        failure_threshold     = 24
        http_get {
          path = "/api/health/live"
          port = 8080
        }
      }
      liveness_probe {
        timeout_seconds   = 3
        period_seconds    = 30
        failure_threshold = 3
        http_get {
          path = "/api/health/live"
          port = 8080
        }
      }
    }
    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [local.connection_name]
      }
    }
    dynamic "vpc_access" {
      for_each = var.network == null ? [] : [1]
      content {
        egress = "PRIVATE_RANGES_ONLY"
        network_interfaces {
          network    = var.network
          subnetwork = var.subnetwork
        }
      }
    }
  }
  lifecycle {
    prevent_destroy = true
    precondition {
      condition     = var.image_digest_uri != null
      error_message = "A published, tested digest is required before deploying the service."
    }
    precondition {
      condition     = local.connection_name != null
      error_message = "An approved SQL connection must exist before deploying."
    }
    precondition {
      condition     = 2 * var.max_instances * var.pool_max + var.sql_reserved_connections <= var.sql_connection_budget
      error_message = "Instance pools exceed the approved database connection budget."
    }
  }
  depends_on = [google_secret_manager_secret_iam_member.runtime_db, google_project_iam_member.sql_client, google_storage_bucket_iam_member.runtime_files]
}
resource "google_cloud_run_v2_service_iam_member" "invoker" {
  for_each = var.deploy_service ? var.invokers : toset([])
  name     = google_cloud_run_v2_service.staging[0].name
  location = var.region
  role     = "roles/run.invoker"
  member   = each.value
}
resource "google_cloudbuild_trigger" "build_push" {
  count           = var.build_repository_resource == null ? 0 : 1
  name            = "analiza-staging-build-push"
  location        = var.region
  service_account = google_service_account.build.id
  filename        = "cloudbuild.yaml"
  approval_config {
    approval_required = true
  }
  repository_event_config {
    repository = var.build_repository_resource
    push {
      branch = "^codex/cloud-run-cloud-sql$"
    }
  }
  substitutions = {
    _REGION     = var.region
    _REPOSITORY = var.artifact_repository
    _IMAGE      = var.image_name
    _SOURCE_SHA = "$COMMIT_SHA"
  }
  # Build identity receives no Cloud Run deploy permissions.
}
