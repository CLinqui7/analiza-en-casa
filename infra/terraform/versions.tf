terraform {
  required_version = ">= 1.14, < 2.0"
  required_providers {
    google = {
      source = "hashicorp/google", version = "~> 7.0"
    }
  }
  # Engineer must configure an approved remote state backend before any apply.
}
provider "google" {
  project = var.project_id
  region  = var.region
}
