#!/bin/bash

# CORS issues caused by missing Dependency Injections can be hard to track down
# because the warning is not usually displayed immediately, and is hence not next
# to the problem test.
# Running each test separately and multiple times gives enough time for the error to appear.

for test in src/*.test.tsx; do
  echo "=== Running $test ==="
  output=$(bun run test --rerun-each=10 "$test" 2>&1)
  if echo "$output" | grep -q "Cross-Origin Request Blocked"; then
    echo "!!! CORS ERROR FOUND in $test !!!"
    echo "$output" | grep "Cross-Origin Request Blocked"
    echo ""
  fi
done
