#!/usr/bin/env bash
# Re-vendor pdf.js into extension/media/pdfjs. Pinned and integrity-checked.
set -euo pipefail
VERSION="6.3.289"
INTEGRITY="sha512-ZHjSVpDa3D6izMq8/04lvkhkATUmL9px6ChPaXc1k6nU2Mrhlg1/7F0bdUqCwUjw3NsPTfPZsMDUU6ZIcRaeQw=="
DEST="$(cd "$(dirname "$0")/.." && pwd)/extension/media/pdfjs"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-${VERSION}.tgz" -o "$TMP/pdfjs.tgz"
ACTUAL="sha512-$(openssl dgst -sha512 -binary "$TMP/pdfjs.tgz" | openssl base64 -A)"
[ "$ACTUAL" = "$INTEGRITY" ] || { echo "integrity mismatch: $ACTUAL" >&2; exit 1; }
tar -xzf "$TMP/pdfjs.tgz" -C "$TMP"
mkdir -p "$DEST"
cp "$TMP/package/build/pdf.min.mjs" "$TMP/package/build/pdf.worker.min.mjs" "$TMP/package/LICENSE" "$DEST/"
( cd "$DEST" && shasum -a 256 LICENSE pdf.min.mjs pdf.worker.min.mjs > CHECKSUMS.txt )
echo "vendored pdfjs-dist ${VERSION} into ${DEST}"
