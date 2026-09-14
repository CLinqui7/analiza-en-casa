# Bootstrap with private local state, then migrate that state into this bucket.
# No secret values enter the state. Creating the bucket is an approved apply, never init.
resource "google_storage_bucket" "terraform_state" {
  count                       = var.create_state_bucket ? 1 : 0
  name                        = "analiza-tfstate-${var.project_id}-staging"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
  versioning { enabled = true }
  lifecycle { prevent_destroy = true }
}
output "terraform_state_bucket" {
  value = try(google_storage_bucket.terraform_state[0].name, null)
}
