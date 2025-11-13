#!/bin/bash
# Helper script to create PR branches from the organized commit plan
# Usage: ./scripts/create-pr-branches.sh <pr-number>

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <pr-number>"
  echo "Example: $0 1"
  echo ""
  echo "Available PRs:"
  echo "  1  - Telemetry Infrastructure Foundation"
  echo "  2  - 7TV Performance Optimizations"
  echo "  3  - Emotes System Enhancements"
  echo "  4  - Streamlink Integration"
  echo "  5  - Resizable Split Panes"
  echo "  6  - Support Events & Kick WebSocket Improvements"
  echo "  7  - Live Status & Navbar Improvements"
  echo "  8  - Mention Detection Improvements"
  echo "  9  - Build & CI Infrastructure"
  echo "  10 - Icon Library Migration"
  echo "  11 - Documentation & Release Infrastructure"
  echo "  12 - Telemetry UX & Analytics Prompt"
  echo "  13 - Minor Fixes & Polish"
  exit 1
fi

PR_NUM=$1

case $PR_NUM in
  1)
    BRANCH_NAME="pr/telemetry-foundation"
    COMMITS=(
      "a98871f"
      "6923392"
      "222f8dd"
      "fa86074"
      "091f7e3"
      "3d34103"
      "b5cdfd7"
      "89be798"
      "23e2abf"
      "9b8511c"
      "4b10f97"
      "0a15261"
      "fd65c2a"
      "b4e73d9"
    )
    ;;
  2)
    BRANCH_NAME="pr/7tv-performance"
    COMMITS=(
      "93f2790"
      "b9f249a"
      "8b21c0f"
      "94e7852"
      "6611478"
      "91d091d"
      "421055f"
    )
    ;;
  3)
    BRANCH_NAME="pr/emotes-enhancements"
    COMMITS=(
      "f04b485"
      "6d13711"
      "6ea09c4"
      "5152db6"
      "601c700"
      "2c863ca"
      "5dc45a9"
    )
    ;;
  4)
    BRANCH_NAME="pr/streamlink-integration"
    COMMITS=(
      "7916e57"
      "e3a55d0"
      "cdcb272"
      "3d34103"
      "f08e44d"
      "e40d1c0"
      "496e789"
    )
    ;;
  5)
    BRANCH_NAME="pr/resizable-split-panes"
    COMMITS=(
      "4780990"
      "817b3b7"
      "bd53d4c"
      "f6113ce"
      "7076878"
      "285ae84"
      "a3d9281"
      "3db0624"
    )
    ;;
  6)
    BRANCH_NAME="pr/support-events-websocket"
    COMMITS=(
      "1193760"
      "55ba9d0"
      "280a740"
      "a3fe477"
      "4a1fba4"
      "d1d4e0e"
      "1be41ed"
      "7e8c3f5"
      "b144750"
      "6e6d7ec"
      "1f24e31"
      "2544c6a"
    )
    ;;
  7)
    BRANCH_NAME="pr/live-status-navbar"
    COMMITS=(
      "969ce05"
      "694c9eb"
    )
    ;;
  8)
    BRANCH_NAME="pr/mention-detection"
    COMMITS=(
      "7096972"
      "cfde2da"
    )
    ;;
  9)
    BRANCH_NAME="pr/build-ci-infrastructure"
    COMMITS=(
      "fe15380"
      "266ab1f"
      "1642a02"
      "bb55bb6"
      "c12c81c"
      "2b1d8d3"
      "c4b08f9"
      "47a11c9"
      "d7ca7d7"
      "dfa1772"
      "b09ad8b"
      "465b496"
    )
    ;;
  10)
    BRANCH_NAME="pr/icon-library-migration"
    COMMITS=(
      "7350c69"
    )
    ;;
  11)
    BRANCH_NAME="pr/documentation-improvements"
    COMMITS=(
      "02a2d95"
      "49d9ff6"
      "8b84e69"
      "9239f11"
      "63c7839"
      "da844d2"
    )
    ;;
  12)
    BRANCH_NAME="pr/telemetry-ux-prompt"
    COMMITS=(
      "f27527a"
      "f94b9ff"
    )
    ;;
  13)
    BRANCH_NAME="pr/minor-fixes-polish"
    COMMITS=(
      "94ce458"
      "29521fd"
    )
    ;;
  *)
    echo "Invalid PR number: $PR_NUM"
    exit 1
    ;;
esac

echo "Creating branch: $BRANCH_NAME"
echo "Commits to cherry-pick: ${#COMMITS[@]}"
echo ""

# Check if branch already exists
if git show-ref --verify --quiet refs/heads/$BRANCH_NAME; then
  echo "Branch $BRANCH_NAME already exists!"
  echo "Delete it first with: git branch -D $BRANCH_NAME"
  exit 1
fi

# Create branch from upstream/main
git checkout -b $BRANCH_NAME upstream/main

echo ""
echo "Cherry-picking commits (oldest first)..."

# Reverse array to cherry-pick in chronological order
for ((i=${#COMMITS[@]}-1; i>=0; i--)); do
  COMMIT="${COMMITS[$i]}"
  echo "Cherry-picking $COMMIT..."
  if ! git cherry-pick "$COMMIT"; then
    echo ""
    echo "Cherry-pick conflict! Resolve conflicts and run:"
    echo "  git cherry-pick --continue"
    echo "Or abort with:"
    echo "  git cherry-pick --abort"
    exit 1
  fi
done

echo ""
echo "✓ Branch $BRANCH_NAME created successfully!"
echo ""
echo "Next steps:"
echo "  1. Review the commits: git log upstream/main..$BRANCH_NAME"
echo "  2. Test the changes: npm run dev"
echo "  3. Push to your fork: git push -u origin $BRANCH_NAME"
echo "  4. Create PR to upstream: gh pr create --repo KickTalkOrg/KickTalk --base main"
