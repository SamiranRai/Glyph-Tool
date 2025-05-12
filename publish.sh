#!/bin/bash

# Step 1 : Prompt for a custom commit message
echo "Enter your commit message (e.g., 'Fixed bug with highlight feature')"
read COMMIT_MESSAGE

# Step 2 : Check if the commit message is empty
if [ -z "$COMMIT_MESSAGE" ]; then
  echo "Commit message cannot be empty. Exiting..."
  exit 1
fi

# Step 3 : Stage all changes
git add .

# Step 4 : Commit with the custom message
git commit -m "$COMMIT_MESSAGE"

# Step 5 : Push to the default branch (e.g., main or master)
git push origin main

# Step 6 : Publish to VSCode Marketplace
vsce publish

# Optional : Print a success message
echo "Successfully committed, pushed, and published your extension!"