#!/usr/bin/env bash
# Build the one-click download the product site links to:
#   product-site/downloads/ownvoice-extension.zip
#
# Packs the COMMITTED extension/ via git archive, so the zip matches a commit
# rather than whatever is lying around in the working tree (.DS_Store, edits in
# progress). Files sit under ownvoice-extension/ so that, after unzipping, the
# folder a user picks in "Load unpacked" has an obvious name.
#
# Re-run and commit the zip whenever extension/ changes; the site serves the
# file as is and nothing rebuilds it automatically.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
if ! git diff --quiet HEAD -- extension; then
  echo "extension/ has uncommitted changes; commit them first so the zip matches a commit." >&2
  exit 1
fi
mkdir -p product-site/downloads
git archive --format=zip --prefix=ownvoice-extension/ \
  -o product-site/downloads/ownvoice-extension.zip HEAD:extension
echo "wrote product-site/downloads/ownvoice-extension.zip from $(git rev-parse --short HEAD)"
