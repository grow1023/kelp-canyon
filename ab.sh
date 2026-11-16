#!/bin/bash
# Wrapper: every agent-browser call goes to this project's own session.
exec agent-browser --session "$(cat "$(dirname "$0")/out/session")" "$@"
