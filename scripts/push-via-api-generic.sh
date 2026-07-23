#!/bin/bash
set -euo pipefail

# 通过 GitHub REST API 推送本地提交（绕过 git GnuTLS SSL 问题）
# 用法: push-via-api.sh [branch]
# 自动从当前目录的 git remote 读取 repo 信息，可在任意 git 仓库中使用

BRANCH="${1:-main}"

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "错误: 请先设置 GITHUB_TOKEN 环境变量" >&2
  echo "  export GITHUB_TOKEN=github_pat_xxx" >&2
  exit 1
fi

# 从 git remote 自动检测 repo
REMOTE_URL=$(git remote get-url origin 2>/dev/null || true)
if [ -z "$REMOTE_URL" ]; then
  echo "错误: 当前目录不是 git 仓库或没有配置 origin remote" >&2
  exit 1
fi
REPO=$(echo "$REMOTE_URL" | sed -E 's|.*github\.com[:/](.+)/(.+)(\.git)?$|\1/\2|')
if [ -z "$REPO" ] || [ "$REPO" = "$REMOTE_URL" ]; then
  echo "错误: 无法从 remote URL 解析 repo: $REMOTE_URL" >&2
  exit 1
fi

TOKEN="$GITHUB_TOKEN"
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
log "推送 $REPO ($BRANCH)..."
REMOTE_SHA=$(api_get "/git/ref/heads/$BRANCH" | python3 -c "import sys,json; print(json.load(sys.stdin)['object']['sha'])")
step "远程 HEAD: ${REMOTE_SHA:0:8}"

# 2. 获取本地待推送的提交列表
log "计算待推送提交..."
COMMITS=()

if git cat-file -e "$REMOTE_SHA" 2>/dev/null; then
  while IFS= read -r sha; do
    [ -n "$sha" ] && COMMITS+=("$sha")
  done < <(git --no-pager rev-list --reverse "$REMOTE_SHA"..HEAD)
else
  step "远程 HEAD 不在本地，通过 tree 匹配查找分叉点..."
  LOCAL_COMMITS=()
  while IFS= read -r sha; do
    [ -n "$sha" ] && LOCAL_COMMITS+=("$sha")
  done < <(git --no-pager rev-list --reverse HEAD)

  REMOTE_COMMIT_INFO=$(api_get "/git/commits/$REMOTE_SHA")
  REMOTE_TREE=$(echo "$REMOTE_COMMIT_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin)['tree']['sha'])")

  FOUND_BASE=""
  CHECK_SHA="$REMOTE_SHA"
  for i in $(seq 1 50); do
    CHECK_TREE=$(api_get "/git/commits/$CHECK_SHA" | python3 -c "import sys,json; print(json.load(sys.stdin)['tree']['sha'])")
    for LOCAL_SHA in "${LOCAL_COMMITS[@]}"; do
      LOCAL_TREE=$(git --no-pager rev-parse "$LOCAL_SHA^{tree}" 2>/dev/null || true)
      if [ "$LOCAL_TREE" = "$CHECK_TREE" ]; then
        FOUND_BASE="$LOCAL_SHA"
        break 2
      fi
    done
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
step "Base tree: ${BASE_TREE:0:8}"

# 4. 逐个提交推送到远程
CURRENT_TREE="$BASE_TREE"
PARENT="$REMOTE_SHA"

for COMMIT_SHA in "${COMMITS[@]}"; do
  COMMIT_MSG=$(git --no-pager log -1 --format=%B "$COMMIT_SHA")
  COMMIT_ONELINE=$(git --no-pager log -1 --oneline "$COMMIT_SHA")
  log "推送: $COMMIT_ONELINE"

  CHANGED_FILES=()
  while IFS= read -r line; do
    [ -n "$line" ] && CHANGED_FILES+=("$line")
  done < <(git diff-tree --no-commit-id --name-only -r "$COMMIT_SHA")

  if [ ${#CHANGED_FILES[@]} -eq 0 ]; then
    step "无文件变更，跳过"
    NEW_COMMIT=$(api_post "/git/commits" \
      "{\"message\":$(echo "$COMMIT_MSG" | python3 -c "import sys,json; print(json.dumps(input()))"),\"tree\":\"$CURRENT_TREE\",\"parents\":[\"$PARENT\"]}" \
      | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('sha',''))")
    [ -z "$NEW_COMMIT" ] && err "创建提交失败"
    PARENT="$NEW_COMMIT"
    step "空提交: ${NEW_COMMIT:0:8}"
    continue
  fi

  TREE_ITEMS="["
  FIRST=true
  for filepath in "${CHANGED_FILES[@]}"; do
    CONTENT_B64=$(git show "$COMMIT_SHA:$filepath" | base64 -w0)
    PAYLOAD_FILE=$(mktemp)
    echo "$CONTENT_B64" | python3 -c "
import json,sys
content = sys.stdin.read().strip()
print(json.dumps({'content': content, 'encoding': 'base64'}))
" > "$PAYLOAD_FILE"
    BLOB_SHA=$(curl -s -X POST "${AUTH[@]}" "$API/git/blobs" -d @"$PAYLOAD_FILE" \
      | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('sha',''))")
    rm -f "$PAYLOAD_FILE"

    if [ -z "$BLOB_SHA" ]; then
      err "创建 blob 失败: $filepath"
    fi

    $FIRST || TREE_ITEMS+=","
    FIRST=false
    if git cat-file -e "$COMMIT_SHA:$filepath" 2>/dev/null; then
      TREE_ITEMS+="{\"path\":\"$filepath\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"$BLOB_SHA\"}"
    else
      TREE_ITEMS+="{\"path\":\"$filepath\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"$BLOB_SHA\"}"
    fi
    step "blob: $filepath → ${BLOB_SHA:0:8}"
  done
  TREE_ITEMS+="]"

  NEW_TREE=$(api_post "/git/trees" \
    "{\"base_tree\":\"$CURRENT_TREE\",\"tree\":$TREE_ITEMS}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('sha',''))")
  [ -z "$NEW_TREE" ] && err "创建 tree 失败"
  step "tree: ${NEW_TREE:0:8}"

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
