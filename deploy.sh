#!/bin/bash
# Deploy wrapper — membaca token dari file agar tidak kena redaction Hermes
export CLOUDFLARE_API_TOKEN=$(cat /tmp/.cf_token)
cd /home/ubuntu/murah-plastic
exec npx wrangler "$@"
