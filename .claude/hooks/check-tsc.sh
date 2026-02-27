#!/bin/bash
# Block direct tsc invocations — use package scripts instead.

COMMAND=$(jq -r '.tool_input.command' < /dev/stdin)

if echo "$COMMAND" | grep -qE '(^|\s|&&|\|)(npx\s+)?tsc(\s|$)'; then
  echo "Do not run tsc directly. Use 'bun run check-types' instead." >&2
  exit 2
fi

exit 0
