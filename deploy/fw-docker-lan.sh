#!/usr/bin/env bash
# Batasi port Docker yang dipublish agar hanya bisa diakses dari jaringan internal
# (LAN + jaringan Docker + loopback). Docker menulis aturan DNAT/FORWARD sendiri sehingga
# ufw di-bypass; chain DOCKER-USER adalah tempat resmi untuk menambah aturan kita.
# Rollback: iptables -D DOCKER-USER -j DOCKER-LAN-ONLY; iptables -F DOCKER-LAN-ONLY; iptables -X DOCKER-LAN-ONLY
set -euo pipefail

ALLOW="${ALLOW_CIDRS:-172.31.10.0/24 172.16.0.0/12 10.0.0.0/8 192.168.0.0/16 127.0.0.0/8}"
PORTS="${PORTS:-3000 8000 27017}"

iptables -N DOCKER-LAN-ONLY 2>/dev/null || true
iptables -F DOCKER-LAN-ONLY
iptables -A DOCKER-LAN-ONLY -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
for cidr in $ALLOW; do
  for p in $PORTS; do
    iptables -A DOCKER-LAN-ONLY -s "$cidr" -p tcp --dport "$p" -j RETURN
  done
done
for p in $PORTS; do
  iptables -A DOCKER-LAN-ONLY -p tcp --dport "$p" -m limit --limit 10/min -j LOG --log-prefix "DOCKER-LAN-DROP "
  iptables -A DOCKER-LAN-ONLY -p tcp --dport "$p" -j DROP
done
iptables -A DOCKER-LAN-ONLY -j RETURN
iptables -C DOCKER-USER -j DOCKER-LAN-ONLY 2>/dev/null || iptables -I DOCKER-USER 1 -j DOCKER-LAN-ONLY

echo "[fw-docker-lan] aktif | ports=$PORTS"
echo "[fw-docker-lan] allow=$ALLOW"
iptables -S DOCKER-USER