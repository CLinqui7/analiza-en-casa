# These resources PREPARE jobs. Terraform never executes migrations or seeds.
resource "google_secret_manager_secret_iam_member" "operator" {
  for_each   = local.operator_secret_ids
  secret_id  = each.value
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${google_service_account.migrator.email}"
  depends_on = [google_secret_manager_secret.db]
}
resource "google_cloud_run_v2_job" "database" {
  for_each            = var.deploy_operator ? { migrate = "--migrate", seed = "--seed-synthetic" } : {}
  name                = "analiza-staging-${each.key}"
  location            = var.region
  deletion_protection = true
  template {
    task_count  = 1
    parallelism = 1
    template {
      service_account = google_service_account.migrator.email
      max_retries     = 0
      timeout         = "300s"
      containers {
        image = var.operator_image_digest_uri
        args  = concat([each.value], each.key == "migrate" && var.provision_runtime_role ? ["--provision-runtime"] : [])
        resources {
          limits = { cpu = "1", memory = "512Mi" }
        }
        dynamic "env" {
          for_each = {
            PGHOST                             = "/cloudsql/${local.connection_name}"
            PGDATABASE                         = var.database_name
            ANALIZA_PG_RUNTIME_ROLE            = var.runtime_sql_role
            ANALIZA_MIGRATION_APPROVED         = "1"
            ANALIZA_ENVIRONMENT                = "staging"
            ANALIZA_SQL_CONNECTION_NAME        = local.connection_name
            ANALIZA_STAGING_SEED_APPROVED      = each.key == "seed" || var.provision_runtime_role ? "1" : "0"
            ANALIZA_PROVISION_RUNTIME_APPROVED = var.provision_runtime_role ? "1" : "0"
          }
          content {
            name  = env.key
            value = env.value
          }
        }
        dynamic "env" {
          for_each = merge({
            PGUSER     = { id = var.migration_user_secret_id, version = try(var.operator_secret_versions.user, null) }
            PGPASSWORD = { id = var.migration_password_secret_id, version = try(var.operator_secret_versions.password, null) }
            }, each.key == "seed" ? {
            ANALIZA_QA_PASSWORD = { id = var.qa_password_secret_id, version = try(var.operator_secret_versions.qa, null) }
            } : {}, each.key == "migrate" && var.provision_runtime_role ? {
            ANALIZA_PG_RUNTIME_PASSWORD = { id = var.db_password_secret_id, version = var.db_password_secret_version }
          } : {})
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
      }
      volumes {
        name = "cloudsql"
        cloud_sql_instance { instances = [local.connection_name] }
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
  }
  lifecycle {
    prevent_destroy = true
    precondition {
      condition     = var.operator_image_digest_uri != null && var.operator_secret_versions != null && local.connection_name != null
      error_message = "The operator needs its published digest, real secret versions and SQL connection."
    }
    precondition {
      condition     = var.database_name == "analiza_en_casa" && var.sql_instance_name == "analiza-sql-staging" && var.region == "us-central1"
      error_message = "The synthetic seed job is restricted to the explicitly selected staging database."
    }
  }
  depends_on = [google_secret_manager_secret_iam_member.operator, google_project_iam_member.sql_client]
}
