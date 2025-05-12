#!/bin/bash

# Step 1 : Prompt for a custom commit message
echo "Enter your commit message (e.g., 'Fixed bug with highlight feature')"
read COMMIT_MESSAGE

# Step 2 : Check if the commit message is empty
if [ -z "$COMMIT_MESSAGE" ]; then
  echo "Commit message cannot be empty. Exiting..."
  exit 1
fi

# Step 3 : Increment the version in package.json
# Get the current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")

# Split the version into major, minor, and patch parts
IFS='.' read -r -a VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}

# Increment the patch version (you can adjust this to minor/major if needed)
PATCH=$((PATCH + 1))

# Create the new version string
NEW_VERSION="$MAJOR.$MINOR.$PATCH"

# Update package.json with the new version
npm version $NEW_VERSION --no-git-tag-version

# Step 4 : Stage all changes (including updated package.json)
git add .

# Step 5 : Commit with the custom message
git commit -m "$COMMIT_MESSAGE"

# Step 6 : Push to the default branch (e.g., main or master)
git push origin main

# Step 7 : Publish to VSCode Marketplace
vsce publish

# Optional : Print a success message
echo "Successfully committed, pushed, and published your extension with version $NEW_VERSION!"
