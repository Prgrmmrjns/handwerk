#!/usr/bin/env bash
# Generate a Play upload keystore for Handwerk and print values for GitHub secrets.
# Do NOT commit the .jks file. Do NOT run this in CI.
set -euo pipefail

OUT_DIR="${1:-./secrets}"
ALIAS="${ANDROID_KEY_ALIAS:-handwerk-upload}"
STORE_PASS="${ANDROID_KEYSTORE_PASSWORD:-}"
KEY_PASS="${ANDROID_KEY_PASSWORD:-}"
VALIDITY_DAYS="${VALIDITY_DAYS:-10000}"

mkdir -p "$OUT_DIR"
KEYSTORE="$OUT_DIR/handwerk-upload.jks"

if [[ -z "$STORE_PASS" ]]; then
  STORE_PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
fi
if [[ -z "$KEY_PASS" ]]; then
  KEY_PASS="$STORE_PASS"
fi

if [[ -f "$KEYSTORE" ]]; then
  echo "Refusing to overwrite existing $KEYSTORE" >&2
  exit 1
fi

echo "Creating upload keystore at $KEYSTORE (alias=$ALIAS)…"
keytool -genkeypair \
  -keystore "$KEYSTORE" \
  -alias "$ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity "$VALIDITY_DAYS" \
  -storepass "$STORE_PASS" \
  -keypass "$KEY_PASS" \
  -dname "CN=Handwerk Upload, OU=Handwerk, O=Jonas, L=Aachen, ST=NRW, C=DE"

B64="$(base64 -w0 "$KEYSTORE" 2>/dev/null || base64 "$KEYSTORE" | tr -d '\n')"

cat <<EOF

Add these GitHub Actions secrets (Settings → Secrets and variables → Actions):

  ANDROID_KEYSTORE_BASE64
  $(echo "$B64" | head -c 48)…  (${#B64} chars total — paste the full value)

  ANDROID_KEYSTORE_PASSWORD
  $STORE_PASS

  ANDROID_KEY_ALIAS
  $ALIAS

  ANDROID_KEY_PASSWORD
  $KEY_PASS

Keep $KEYSTORE offline / in a password manager. Never commit it.
For Play App Signing, upload this as the *upload* key; Google holds the app signing key.

EOF
