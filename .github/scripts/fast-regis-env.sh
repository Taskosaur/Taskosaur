#!/bin/sh
set -e
file=".env"
while IFS='=' read -r key value
do
  # skip comments/empty
  [[ "$key" =~ ^\s*# ]] && continue
  [[ -z "$key" ]] && continue
  # trim whitespace
  key=$(echo "$key" | xargs)
  value=$(echo "$value" | sed 's/^"//;s/"$//' | xargs)
  if [[ -n "$key" ]]; then
    echo "Setting secret: $key"
    echo -n "$value" | gh secret set "$key" --repo "$GITHUB_REPOSITORY"
  fi
done < <(grep -v '^\s*$' .env)