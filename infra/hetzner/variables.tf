variable "hcloud_token" {
  type        = string
  sensitive   = true
  description = "hetzner cloud api token"
}

variable "tailscale_authkey" {
  type        = string
  sensitive   = true
  description = "tailscale auth key for headless authentication"
}

variable "ssh_public_key" {
  type        = string
  description = "ssh public key for server access"
}

variable "server_name" {
  type        = string
  default     = "openclaw"
  description = "server hostname (also used for tailscale)"
}

variable "server_type" {
  type        = string
  default     = "cax21"
  description = "hetzner server type (cax21 = arm 4vcpu/8gb ~$7/mo)"
}

variable "location" {
  type        = string
  default     = "fsn1"
  description = "hetzner datacenter (fsn1, nbg1, hel1, ash, hil)"
}

variable "image" {
  type        = string
  default     = "ubuntu-24.04"
  description = "server os image"
}
