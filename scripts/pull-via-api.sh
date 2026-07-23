#!/bin/bash
set -euo pipefail

# 通过 GitHub REST API 拉取远程更新（绕过 git GnuTLS SSL 问题）
# 用法: ./scripts/pull-via-api.sh [branch]

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

# 1. 获取远程 HEAD
log "获取远程 $BRANCH HEAD..."
REMOTE_SHA=$(api_get "/git/ref/heads/$BRANCH" | python3 -c "import sys,json; print(json.load(sys.stdin)['object']['sha'])")
step "远程 HEAD: $REMOTE_SHA"

LOCAL_SHA=$(git --no-pager rev-parse HEAD)
step "本地 HEAD: $LOCAL_SHA"

if [ "$REMOTE_SHA" = "$LOCAL_SHA" ]; then
  log "已是最新，无需拉取。"
  exit 0
fi

# 2. 检查远程 SHA 是否已在本地
if git cat-file -e "$REMOTE_SHA" 2>/dev/null; then
  log "远程提交已在本地，无需拉取。"
  exit 0
fi

# 3. 从远程 HEAD 往回找，收集所有不在本地的提交
log "收集远程新提交..."
REMOTE_COMMITS=()
CHECK_SHA="$REMOTE_SHA"

for i in $(seq 1 100); do
  # 检查这个提交是否在本地
  if git cat-file -e "$CHECK_SHA" 2>/dev/null; then
    step "找到共同祖先: $(git --no-pager log --oneline -1 $CHECK_SHA)"
    break
  fi

  # 通过 tree 匹配检查本地是否有等价提交
  REMOTE_TREE=$(api_get "/git/commits/$CHECK_SHA" | python3 -c "import sys,json; print(json.load(sys.stdin)['tree']['sha'])")
  FOUND=false
  for LOCAL_CHECK in $(git --no-pager rev-list HEAD); do
    LOCAL_TREE=$(git --no-pager rev-parse "$LOCAL_CHECK^{tree}" 2>/dev/null || true)
    if [ "$LOCAL_TREE" = "$REMOTE_TREE" ]; then
      step "找到等价提交: $(git --no-pager log --oneline -1 $LOCAL_CHECK)"
      CHECK_SHA="$LOCAL_CHECK"
      FOUND=true
      break
    fi
  done
  $FOUND && break

  REMOTE_COMMITS=("$CHECK_SHA" "${REMOTE_COMMITS[@]}")

  # 获取父提交
  PARENT_SHA=$(api_get "/git/commits/$CHECK_SHA" | python3 -c "import sys,json; ps=json.load(sys.stdin).get('parents',[]); print(ps[0]['sha'] if ps else '')")
  [ -z "$PARENT_SHA" ] && break
  CHECK_SHA="$PARENT_SHA"
done

# 反转为时间正序
REMOTE_COMMITS_REV=()
for ((idx=${#REMOTE_COMMITS[@]}-1; idx>=0; idx--)); do
  REMOTE_COMMITS_REV+=("${REMOTE_COMMITS[$idx]}")
done

if [ ${#REMOTE_COMMITS_REV[@]} -eq 0 ]; then
  log "没有新的远程提交。"
  exit 0
fi

step "待拉取 ${#REMOTE_COMMITS_REV[@]} 个提交:"
for c in "${REMOTE_COMMITS_REV[@]}"; do
  MSG=$(api_get "/git/commits/$c" | python3 -c "import sys,json; print(json.load(sys.stdin)['message'].split(chr(10))[0])")
  echo "    ${c:0:8} $MSG"
done

# 4. 检查本地是否有未提交的更改
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
  err "本地有未提交的更改，请先提交或暂存后再拉取。"
fi

# 5. 逐个应用远程提交
for REMOTE_COMMIT in "${REMOTE_COMMITS_REV[@]}"; do
  COMMIT_DATA=$(api_get "/git/commits/$REMOTE_COMMIT")
  COMMIT_MSG=$(echo "$COMMIT_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin)['message'])")
  COMMIT_ONELINE=$(echo "$COMMIT_MSG" | head -1)
  log "应用: ${REMOTE_COMMIT:0:8} $COMMIT_ONELINE"

  # 获取该提交相对父提交的变更文件
  PARENT_DATA=$(echo "$COMMIT_DATA" | python3 -c "
import sys,json
d=json.load(sys.stdin)
ps=d.get('parents',[])
print(ps[0]['sha'] if ps else '')
")

  if [ -n "$PARENT_DATA" ] && git cat-file -e "$PARENT_DATA" 2>/dev/null; then
    # 父提交在本地，用 git diff 获取变更
    PARENT_TREE="$PARENT_DATA"
  else
    PARENT_TREE=""
  fi

  # 获取远程提交的 tree
  REMOTE_TREE=$(echo "$COMMIT_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin)['tree']['sha'])")

  # 通过 API 获取变更的文件列表
  if [ -n "$PARENT_TREE" ]; then
    # 用比较 API 获取变更
    CHANGED_FILES=$(curl -s "${AUTH[@]}" "$API/compare/$PARENT_TREE...$REMOTE_COMMIT" 2>/dev/null \
      | python3 -c "
import sys,json
d=json.load(sys.stdin)
for f in d.get('files',[]):
    print(f['filename'] + '|' + f['status'])
" 2>/dev/null || true)
  fi

  # 如果比较 API 不可用，通过 tree 递归获取所有文件并对比
  if [ -z "$CHANGED_FILES" ]; then
    # 获取远程 tree 的所有文件
    get_tree_recursive() {
      local tree_sha="$1"
      local result
      result=$(api_get "/git/trees/$tree_sha?recursive=1")
      echo "$result" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for item in d.get('tree',[]):
    if item['type']=='blob':
        print(item['path'] + '|' + item['sha'])
"
    }

    REMOTE_FILES=$(get_tree_recursive "$REMOTE_TREE")

    # 获取本地当前 tree 的所有文件
    LOCAL_TREE_SHA=$(git --no-pager rev-parse HEAD^{tree})
    # 本地 tree 没有 recursive API，用 git ls-tree
    LOCAL_FILES=$(git ls-tree -r HEAD | awk '{print $4 "|" $3}')

    # 对比找出差异
    CHANGED_FILES=""
    while IFS='|' read -r path sha; do
      [ -z "$path" ] && continue
      LOCAL_SHA=$(echo "$LOCAL_FILES" | grep "^${path}|" | cut -d'|' -f2 || true)
      if [ "$LOCAL_SHA" != "$sha" ]; then
        CHANGED_FILES+="$path|changed"$'\n'
      fi
    done <<< "$REMOTE_FILES"

    # 检查本地有但远程没有的文件（被删除的）
    while IFS='|' read -r path sha; do
      [ -z "$path" ] && continue
      REMOTE_SHA=$(echo "$REMOTE_FILES" | grep "^${path}|" | cut -d'|' -f2 || true)
      if [ -z "$REMOTE_SHA" ]; then
        CHANGED_FILES+="$path|removed"$'\n'
      fi
    done <<< "$LOCAL_FILES"
  fi

  # 下载并应用变更的文件
  while IFS='|' read -r filepath status; do
    [ -z "$filepath" ] && continue

    if [ "$status" = "removed" ]; then
      step "删除: $filepath"
      rm -f "$filepath"
      git rm --quiet "$filepath" 2>/dev/null || true
    else
      step "更新: $filepath"
      # 从远程下载文件内容
      FILE_DATA=$(api_get "/contents/$filepath?ref=$REMOTE_COMMIT")
      echo "$FILE_DATA" | python3 -c "
import sys,json,base64
d=json.load(sys.stdin)
content=base64.b64decode(d['content'])
sys.stdout.buffer.write(content)
" > "$filepath"
      git add "$filepath"
    fi
  done <<< "$CHANGED_FILES"

  # 创建本地提交
  git commit --quiet -m "$COMMIT_MSG" --allow-empty
  step "本地提交: $(git --no-pager log --oneline -1)"
done

log "拉取完成！本地 HEAD: $(git --no-pager rev-parse --short HEAD)"
