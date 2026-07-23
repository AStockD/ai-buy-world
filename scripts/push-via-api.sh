#!/bin/bash
set -euo pipefail

# 通过 GitHub REST API 推送本地提交（绕过 git GnuTLS SSL 问题）
# 用法: ./scripts/push-via-api.sh [branch]

BRANCH="${1:-main}"

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "错误: 请先设置 GITHUB_TOKEN 环境变量" >&2
  echo "  export GITHUB_TOKEN=github_pat_xxx" >&2
  exit 1
fi

TOKEN="$GITHUB_TOKEN"
REPO="AStockD/ai-buy-world"
API="https://api.github.com/repos/$REPO"

AUTH=(-H "Authorization: token $TOKEN" -H "Content-Type: application/json")

log()  { echo -e "\033[1;32m>>>\033[0m $*"; }
err()  { echo -e "\033[1;31m!!!\033[0m $*" >&2; exit 1; }
step() { echo -e "\033[1;36m  →\033[0m $*"; }

api_get() {
  curl -s "${AUTH[@]}" "$API$1"
}

api_post() {
  curl -s -X POST "${AUTH[@]}" "$API$1" -d "$2"
}

api_patch() {
  curl -s -X PATCH "${AUTH[@]}" "$API$1" -d "$2"
}

# 1. 获取远程 HEAD
log "获取远程 $BRANCH HEAD..."
REMOTE_SHA=$(api_get "/git/ref/heads/$BRANCH" | python3 -c "import sys,json; print(json.load(sys.stdin)['object']['sha'])")
step "远程 HEAD: $REMOTE_SHA"

# 2. 获取本地待推送的提交列表（从远程 HEAD 到本地 HEAD）
log "计算待推送提交..."
COMMITS=()

# 远程 SHA 可能不存在于本地（通过 API 推送的提交），需要找到分叉点
if git cat-file -e "$REMOTE_SHA" 2>/dev/null; then
  # 远程 SHA 在本地存在，直接用
  while IFS= read -r sha; do
    [ -n "$sha" ] && COMMITS+=("$sha")
  done < <(git --no-pager rev-list --reverse "$REMOTE_SHA"..HEAD)
else
  # 远程 SHA 不在本地，逐个检查本地提交找到分叉点
  step "远程 HEAD 不在本地，通过 tree 匹配查找分叉点..."
  LOCAL_COMMITS=()
  while IFS= read -r sha; do
    [ -n "$sha" ] && LOCAL_COMMITS+=("$sha")
  done < <(git --no-pager rev-list --reverse HEAD)

  # 从最新的提交往回找，如果某个提交的 tree 和远程某个提交的 tree 一致则停止
  REMOTE_COMMIT_INFO=$(api_get "/git/commits/$REMOTE_SHA")
  REMOTE_TREE=$(echo "$REMOTE_COMMIT_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin)['tree']['sha'])")

  # 尝试在本地找到 tree 匹配的提交
  FOUND_BASE=""
  # 先获取远程提交的父提交链，找到和本地匹配的
  CHECK_SHA="$REMOTE_SHA"
  for i in $(seq 1 50); do
    CHECK_TREE=$(api_get "/git/commits/$CHECK_SHA" | python3 -c "import sys,json; print(json.load(sys.stdin)['tree']['sha'])")
    # 在本地找相同 tree 的提交
    for LOCAL_SHA in "${LOCAL_COMMITS[@]}"; do
      LOCAL_TREE=$(git --no-pager rev-parse "$LOCAL_SHA^{tree}" 2>/dev/null || true)
      if [ "$LOCAL_TREE" = "$CHECK_TREE" ]; then
        FOUND_BASE="$LOCAL_SHA"
        break 2
      fi
    done
    # 获取父提交
    PARENT_SHA=$(api_get "/git/commits/$CHECK_SHA" | python3 -c "import sys,json; ps=json.load(sys.stdin).get('parents',[]); print(ps[0]['sha'] if ps else '')")
    [ -z "$PARENT_SHA" ] && break
    CHECK_SHA="$PARENT_SHA"
  done

  if [ -n "$FOUND_BASE" ]; then
    step "找到分叉点: $(git --no-pager log --oneline -1 $FOUND_BASE)"
    while IFS= read -r sha; do
      [ -n "$sha" ] && COMMITS+=("$sha")
    done < <(git --no-pager rev-list --reverse "$FOUND_BASE"..HEAD)
  else
    step "未找到分叉点，推送所有本地提交..."
    COMMITS=("${LOCAL_COMMITS[@]}")
  fi
fi

if [ ${#COMMITS[@]} -eq 0 ]; then
  log "没有需要推送的提交，已是最新。"
  exit 0
fi

step "待推送 ${#COMMITS[@]} 个提交:"
for c in "${COMMITS[@]}"; do
  echo "    $(git --no-pager log --oneline -1 $c)"
done

# 3. 获取远程 base tree
BASE_TREE=$(api_get "/git/commits/$REMOTE_SHA" | python3 -c "import sys,json; print(json.load(sys.stdin)['tree']['sha'])")
step "Base tree: $BASE_TREE"

# 4. 逐个提交推送到远程
CURRENT_TREE="$BASE_TREE"
PARENT="$REMOTE_SHA"

for COMMIT_SHA in "${COMMITS[@]}"; do
  COMMIT_MSG=$(git --no-pager log -1 --format=%B "$COMMIT_SHA")
  COMMIT_ONELINE=$(git --no-pager log -1 --oneline "$COMMIT_SHA")
  log "推送: $COMMIT_ONELINE"

  # 获取该提交修改的文件
  CHANGED_FILES=()
  while IFS= read -r line; do
    [ -n "$line" ] && CHANGED_FILES+=("$line")
  done < <(git diff-tree --no-commit-id --name-only -r "$COMMIT_SHA")

  if [ ${#CHANGED_FILES[@]} -eq 0 ]; then
    step "无文件变更，跳过"
    # 仍需创建空提交保持历史
    NEW_COMMIT=$(api_post "/git/commits" \
      "{\"message\":$(echo "$COMMIT_MSG" | python3 -c "import sys,json; print(json.dumps(input()))"),\"tree\":\"$CURRENT_TREE\",\"parents\":[\"$PARENT\"]}" \
      | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('sha',''))")
    [ -z "$NEW_COMMIT" ] && err "创建提交失败"
    PARENT="$NEW_COMMIT"
    step "空提交: $NEW_COMMIT"
    continue
  fi

  # 为每个变更文件创建 blob（用临时文件传递 payload，避免大文件 base64 溢出）
  TREE_ITEMS="["
  FIRST=true
  for filepath in "${CHANGED_FILES[@]}"; do
    CONTENT_B64=$(git show "$COMMIT_SHA:$filepath" | base64 -w0)
    PAYLOAD_FILE=$(mktemp)
    python3 -c "
import json,sys
print(json.dumps({'content': sys.argv[1], 'encoding': 'base64'}))
" "$CONTENT_B64" > "$PAYLOAD_FILE"
    BLOB_SHA=$(curl -s -X POST "${AUTH[@]}" "$API/git/blobs" -d @"$PAYLOAD_FILE" \
      | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('sha',''))")
    rm -f "$PAYLOAD_FILE"

    if [ -z "$BLOB_SHA" ]; then
      err "创建 blob 失败: $filepath"
    fi

    $FIRST || TREE_ITEMS+=","
    FIRST=false
    # 检查文件是否被删除
    if git cat-file -e "$COMMIT_SHA:$filepath" 2>/dev/null; then
      TREE_ITEMS+="{\"path\":\"$filepath\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"$BLOB_SHA\"}"
    else
      TREE_ITEMS+="{\"path\":\"$filepath\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"$BLOB_SHA\"}"
    fi
    step "blob: $filepath → ${BLOB_SHA:0:8}"
  done
  TREE_ITEMS+="]"

  # 创建 tree
  NEW_TREE=$(api_post "/git/trees" \
    "{\"base_tree\":\"$CURRENT_TREE\",\"tree\":$TREE_ITEMS}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('sha',''))")
  [ -z "$NEW_TREE" ] && err "创建 tree 失败"
  step "tree: ${NEW_TREE:0:8}"

  # 创建 commit
  ESCAPED_MSG=$(echo "$COMMIT_MSG" | python3 -c "import sys,json; print(json.dumps(input()))")
  NEW_COMMIT=$(api_post "/git/commits" \
    "{\"message\":$ESCAPED_MSG,\"tree\":\"$NEW_TREE\",\"parents\":[\"$PARENT\"]}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('sha',''))")
  [ -z "$NEW_COMMIT" ] && err "创建 commit 失败"
  step "commit: ${NEW_COMMIT:0:8}"

  CURRENT_TREE="$NEW_TREE"
  PARENT="$NEW_COMMIT"
done

# 5. 更新远程 ref
log "更新远程 refs/heads/$BRANCH..."
RESULT=$(api_patch "/git/refs/heads/$BRANCH" "{\"sha\":\"$PARENT\"}")
UPDATED=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('object',{}).get('sha',''))")

if [ "$UPDATED" = "$PARENT" ]; then
  log "推送完成！远程 $BRANCH → ${PARENT:0:8}"
else
  FAIL_MSG=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message','unknown'))")
  err "更新 ref 失败: $FAIL_MSG"
fi
