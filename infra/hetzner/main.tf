terraform {
  required_version = ">= 1.0"

  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.45"
    }
  }
}

provider "hcloud" {
  token = var.hcloud_token
}

resource "hcloud_ssh_key" "main" {
  name       = "${var.server_name}-key"
  public_key = var.ssh_public_key
}

resource "hcloud_firewall" "main" {
  name = "${var.server_name}-fw"

  # allow ssh from anywhere (for initial access)
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "22"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  # allow all outbound tcp
  rule {
    direction       = "out"
    protocol        = "tcp"
    port            = "any"
    destination_ips = ["0.0.0.0/0", "::/0"]
  }

  # allow all outbound udp (needed for tailscale)
  rule {
    direction       = "out"
    protocol        = "udp"
    port            = "any"
    destination_ips = ["0.0.0.0/0", "::/0"]
  }

  # allow icmp outbound
  rule {
    direction       = "out"
    protocol        = "icmp"
    destination_ips = ["0.0.0.0/0", "::/0"]
  }
}

resource "hcloud_server" "openclaw" {
  name        = var.server_name
  server_type = var.server_type
  location    = var.location
  image       = var.image

  ssh_keys     = [hcloud_ssh_key.main.id]
  firewall_ids = [hcloud_firewall.main.id]

  user_data = templatefile("${path.module}/cloud-init.yaml", {
    tailscale_authkey = var.tailscale_authkey
    server_name       = var.server_name
  })

  labels = {
    project = "openclaw"
    managed = "opentofu"
  }
}
