#!/usr/bin/env bash
# Creates ScanPilot's Android upload key and (optionally) stores it as GitHub
# Actions secrets, so every push to main builds a signed APK + AAB.
#
#   bash scripts/create-upload-key.sh                # interactive
#   REPO=owner/name bash scripts/create-upload-key.sh
#
# Run it on YOUR computer (needs Java's keytool; `gh` CLI optional).
# Back up the .jks file and passwords: without them you cannot update the app on Google Play.
set -euo pipefail

KEYSTORE="${KEYSTORE:-scanpilot-upload.jks}"
ALIAS="${ALIAS:-scanpilot}"
REPO="${REPO:-ABISHEK-K-DEV/SCANPILOT}"

command -v keytool >/dev/null || { echo "keytool not found: install a JDK (e.g. Temurin 17) first." >&2; exit 1; }
if [ -e "$KEYSTORE" ]; then echo "$KEYSTORE already exists — refusing to overwrite it." >&2; exit 1; fi

read -r -s -p "Choose a keystore password (min 6 characters): " STORE_PW; echo
read -r -s -p "Repeat it: " STORE_PW2; echo
[ "$STORE_PW" = "$STORE_PW2" ] || { echo "Passwords differ." >&2; exit 1; }
[ ${#STORE_PW} -ge 6 ] || { echo "Password too short." >&2; exit 1; }
read -r -p "Your name or organisation (for the certificate): " CN

# PKCS12 keystores use one password for the store and the key.
keytool -genkeypair -v -storetype PKCS12 -keystore "$KEYSTORE" -alias "$ALIAS" \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -storepass "$STORE_PW" -keypass "$STORE_PW" -dname "CN=${CN:-ScanPilot}"

echo
echo "Created $KEYSTORE (alias: $ALIAS). Keep it and the password safe."

if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  read -r -p "Store it as GitHub secrets in $REPO now? [y/N] " yes
  if [[ "$yes" =~ ^[Yy]$ ]]; then
    base64 < "$KEYSTORE" | tr -d '\n' | gh secret set SCANPILOT_UPLOAD_KEYSTORE_BASE64 --repo "$REPO"
    printf '%s' "$STORE_PW" | gh secret set SCANPILOT_UPLOAD_STORE_PASSWORD --repo "$REPO"
    printf '%s' "$ALIAS" | gh secret set SCANPILOT_UPLOAD_KEY_ALIAS --repo "$REPO"
    printf '%s' "$STORE_PW" | gh secret set SCANPILOT_UPLOAD_KEY_PASSWORD --repo "$REPO"
    echo "Secrets set. The next push to main produces a signed APK and AAB."
    exit 0
  fi
fi

echo
echo "Add these four secrets in GitHub → Settings → Secrets and variables → Actions:"
echo "  SCANPILOT_UPLOAD_KEYSTORE_BASE64  = contents of $KEYSTORE.base64 (created next)"
echo "  SCANPILOT_UPLOAD_STORE_PASSWORD   = your password"
echo "  SCANPILOT_UPLOAD_KEY_ALIAS        = $ALIAS"
echo "  SCANPILOT_UPLOAD_KEY_PASSWORD     = your password"
base64 < "$KEYSTORE" | tr -d '\n' > "$KEYSTORE.base64"
echo "Wrote $KEYSTORE.base64 — delete it after pasting it into GitHub."
