#!/usr/bin/env bash
# Purpose: Vercel ignoreCommand. Exit 0 = skip the build, 1 = build. Copied from property-landing-pages.
# Skips non-main branches, and main when EVERY file changed since the last deployed commit ($VERCEL_GIT_PREVIOUS_SHA, else HEAD^) is under docs/.
# Unknown base (first deploy, or a commit missing from the shallow clone) = build, so a push is never silently skipped.
if [ -n "${VERCEL_GIT_COMMIT_REF:-}" ] && [ "$VERCEL_GIT_COMMIT_REF" != "main" ]; then echo "ignore: branch $VERCEL_GIT_COMMIT_REF is not main, skipping"; exit 0; fi
base="${VERCEL_GIT_PREVIOUS_SHA:-}"
[ -z "$base" ] && base="$(git rev-parse -q --verify HEAD^ 2>/dev/null)"
if [ -z "$base" ]; then echo "ignore: no base commit, building"; exit 1; fi
if ! git cat-file -e "${base}^{commit}" 2>/dev/null; then
  git fetch -q --depth=100 origin "$base" 2>/dev/null || true
  if ! git cat-file -e "${base}^{commit}" 2>/dev/null; then echo "ignore: base ${base:0:7} not in clone, building"; exit 1; fi
fi
changed="$(git diff --name-only "$base" HEAD -- . ':(exclude)docs/**' ':(exclude)docs')" || { echo "ignore: diff failed, building"; exit 1; }
if [ -z "$changed" ]; then echo "ignore: only docs/ changed since ${base:0:7}, skipping"; exit 0; fi
echo "ignore: code changed since ${base:0:7}, building"; exit 1
