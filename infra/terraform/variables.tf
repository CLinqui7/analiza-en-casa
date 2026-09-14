variable "project_id" {
  type        = string
  description = "Existing approved GCP project; never inferred from a repository name."
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "Supply the real approved Project ID."
  }
}
variable "region" {
  type    = string
  default = "us-central1"
}
variable "service_name" {
  type    = string
  default = "analiza-staging"
  validation {
    condition     = var.service_name == "analiza-staging"
    error_message = "This delivery is staging only. Production needs a separately approved configuration/state."
  }
}
variable "artifact_repository" {
  type = string
}
variable "private_bucket" {
  type = string
}
variable "database_name" {
  type = string
}
variable "sql_instance_name" {
  type = string
}
variable "existing_sql_connection_name" {
  type    = string
  default = null
}
variable "create_sql_instance" {
  type    = bool
  default = false
}
variable "create_artifact_repository" {
  type    = bool
  default = false
}
variable "create_private_bucket" {
  type    = bool
  default = false
}
variable "sql_tier" {
  type    = string
  default = "db-custom-1-3840"
}
variable "sql_disk_gb" {
  type    = number
  default = 10
}
variable "image_digest_uri" {
  type    = string
  default = null
  validation {
    condition     = var.image_digest_uri == null || can(regex("^[a-z0-9-]+-docker.pkg.dev/.+@sha256:[a-f0-9]{64}$", var.image_digest_uri))
    error_message = "Deploy the verified Artifact Registry digest, never latest."
  }
}
variable "deploy_service" {
  type    = bool
  default = false
}
variable "cpu" {
  type    = string
  default = "1"
}
variable "memory" {
  type    = string
  default = "512Mi"
}
variable "concurrency" {
  type    = number
  default = 20
}
variable "max_instances" {
  type    = number
  default = 3
}
variable "pool_max" {
  type    = number
  default = 5
}
variable "sql_connection_budget" {
  type = number
}
variable "sql_reserved_connections" {
  type    = number
  default = 10
}
variable "db_user_secret_id" {
  type = string
}
variable "db_password_secret_id" {
  type = string
}
variable "db_user_secret_version" {
  type        = string
  description = "Existing numeric Secret Manager version, populated through a private operator channel."
  validation {
    condition     = can(regex("^[1-9][0-9]*$", var.db_user_secret_version))
    error_message = "Pin a numeric secret version."
  }
}
variable "db_password_secret_version" {
  type        = string
  description = "Existing numeric password secret version; no secret values in Terraform."
  validation {
    condition     = can(regex("^[1-9][0-9]*$", var.db_password_secret_version))
    error_message = "Pin a numeric password secret version."
  }
}
variable "create_secret_containers" {
  type    = bool
  default = false
}
variable "invokers" {
  type    = set(string)
  default = []
  validation {
    condition     = alltrue([for member in var.invokers : !contains(["allUsers", "allAuthenticatedUsers"], member)])
    error_message = "Staging requires explicitly named IAM identities."
  }
}
variable "network" {
  type    = string
  default = null
}
variable "subnetwork" {
  type    = string
  default = null
}
variable "build_repository_resource" {
  type        = string
  default     = null
  description = "Existing Cloud Build v2 repository resource; GitHub app connection must already be approved."
}
variable "image_name" {
  type = string
}
