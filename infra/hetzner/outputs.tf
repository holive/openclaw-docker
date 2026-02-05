output "server_ip" {
  value       = hcloud_server.openclaw.ipv4_address
  description = "server public ipv4 address"
}

output "server_ipv6" {
  value       = hcloud_server.openclaw.ipv6_address
  description = "server public ipv6 address"
}

output "server_status" {
  value       = hcloud_server.openclaw.status
  description = "server status"
}

output "server_id" {
  value       = hcloud_server.openclaw.id
  description = "server id"
}

output "ssh_command" {
  value       = "ssh root@${hcloud_server.openclaw.ipv4_address}"
  description = "ssh connection command"
}

output "next_steps" {
  value = <<-EOT

    server created: ${hcloud_server.openclaw.ipv4_address}

    1. wait ~3 minutes for cloud-init to complete
    2. ssh in: ssh root@${hcloud_server.openclaw.ipv4_address}
    3. check status: cd /opt/openclaw-docker && make status
    4. get gateway token: grep OPENCLAW_GATEWAY_TOKEN /opt/openclaw-docker/.env

    connect via tailscale (once authenticated):
      tailscale status  # find the server's tailscale ip
      OPENCLAW_GATEWAY_URL=http://<tailscale-ip>:18789 make chat
  EOT
  description = "post-deployment instructions"
}
