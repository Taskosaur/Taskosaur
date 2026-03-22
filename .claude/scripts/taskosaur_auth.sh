#!/bin/bash
# taskosaur_auth.sh

BASE_URL="https://task.khanhocipersonal.dpdns.org/api"
SESSION_FILE=".taskosaur_session"

login() {
    echo "Logging in to Taskosaur..."
    RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\": \"$TASK_USER\", \"password\": \"$TASK_PASS\"}")
    
    # Extract tokens (Assumes JSON response: { "accessToken": "...", "refreshToken": "..." })
    echo "$RESPONSE" > "$SESSION_FILE"
    echo "Tokens saved to $SESSION_FILE"
}

get_token() {
    if [ ! -f "$SESSION_FILE" ]; then
        login
    fi
    # Logic to check if token is expired could go here, or just try and refresh
    cat "$SESSION_FILE" | jq -r '.accessToken'
}

# Add logic for refresh_token if the API returns 401
refresh_token() {
    REFRESH=$(cat "$SESSION_FILE" | jq -r '.refreshToken')
    RESPONSE=$(curl -s -X POST "$BASE_URL/auth/refresh" \
        -H "Content-Type: application/json" \
        -d "{\"refresh_token\": \"$REFRESH\"}")
    echo "$RESPONSE" > "$SESSION_FILE"
}

case "$1" in
    login) login ;;
    token) get_token ;;
    refresh) refresh_token ;;
esac