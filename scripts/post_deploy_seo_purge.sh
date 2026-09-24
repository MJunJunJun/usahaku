#!/bin/bash
# post_deploy_seo_purge.sh - v2.0 (Python-based API calls)
# Automated Cloudflare cache purging with zero shell escaping issues

set -e

cd "$(dirname "$0")"

echo "================================================================================"
echo "🤖 AUTOMATED CLOUDFLARE CACHE PURGE SCRIPT          "
echo "For SEO Metadata Deployment                          "
echo "================================================================================"
echo ""

# Read credentials from environment or .env
if [ -f "/root/usahaku/.env" ]; then
    echo "📄 Loading configuration from /root/usahaku/.env"
    source /root/usahaku/.env 2>/dev/null || true
fi

if [ -z "$CLOUDFLARE_API_TOKEN" ] || [ -z "$ZONE_ID" ]; then
    echo "⚠️  Warning: .env file not found or incomplete, using environment variables only"
    echo "   Make sure to set:"
    echo "   - CLOUDFLARE_API_TOKEN=<your_token>"
    echo "   - ZONE_ID=<your_zone_id>"
    echo ""
else
    # Validate credentials exist
    if [[ ! "${CLOUDFLARE_API_TOKEN}" =~ ^cfut_ ]] && [[ ! "${CLOUDFLARE_API_TOKEN}" =~ ^v1\. ]]; then
        echo "❌ Invalid CLOUDFLARE_API_TOKEN format"
        exit 1
    fi
fi

echo "✅ Credentials validated successfully"
echo ""

# Show target configuration (masked)
echo "🎯 TARGET CONFIGURATION"
echo "======================="
echo "Zone ID: ${ZONE_ID:0:16}...${ZONE_ID: -4}"
echo "Token: ${CLOUDFLARE_API_TOKEN:0:10}...${CLOUDFLARE_API_TOKEN: -4}"
echo ""

# Ask for confirmation
CONFIRM_AUTO="${CONFIRM_AUTO:-false}"
if [ "$CONFIRM_AUTO" != "true" ]; then
    read -p "⚠️  WARNING: This will purge ALL cached content for situska.com. Continue? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Cancelled by user"
        exit 0
    fi
fi

echo "🔥 INITIATING CACHE PURGE"
echo "=========================="

# Create Python script for API call (no shell escaping issues!)
PYTHON_SCRIPT=$(cat << 'PYEND'
import json
import urllib.request
import ssl
import sys
import os

# Configuration from environment
ZONE_ID = os.environ.get('ZONE_ID', '')
API_TOKEN = os.environ.get('CLOUDFLARE_API_TOKEN', '')

if not ZONE_ID or not API_TOKEN:
    print("❌ ERROR: Missing CLOUDFLARE_API_TOKEN or ZONE_ID")
    sys.exit(1)

# Create SSL context
ssl_context = ssl.create_default_context()

# Prepare request
url = f"https://api.cloudflare.com/client/v4/zones/{ZONE_ID}/purge_cache"
headers = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json"
}
data = json.dumps({"purge_everything": True}).encode('utf-8')

try:
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    
    with urllib.request.urlopen(req, context=ssl_context) as response:
        result = json.loads(response.read().decode('utf-8'))
        
        if result.get("success"):
            print("✅ SUCCESS!")
            result_data = result.get("result", {})
            if "id" in result_data:
                print(f"Purge ID: {result_data['id']}")
            if "created_at" in result_data:
                print(f"Created at: {result_data['created_at']}")
            if "entries" in result_data:
                print(f"Entries purged: {result_data['entries']}")
            print("")
            print("💡 Next steps:")
            print("   1. Wait 2-5 minutes for propagation")
            print("   2. Test via Facebook Debugger: https://developers.facebook.com/tools/debug/")
            print("   3. Share URL in WhatsApp/Telegram to trigger fresh fetch")
        else:
            print("❌ FAILED!")
            for error in result.get("errors", []):
                print(f"Error {error['code']}: {error['message']}")
            sys.exit(1)
                
except Exception as e:
    print(f"❌ EXCEPTION: {str(e)}")
    sys.exit(1)
PYEND
)

# Execute Python script
export CLOUDFLARE_API_TOKEN ZONE_ID
echo "$PYTHON_SCRIPT" | python3

echo ""
echo "🏁 DONE!"
