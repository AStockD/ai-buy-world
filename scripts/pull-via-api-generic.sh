#!/bin/bash
set -euo pipefail

# 通过 GitHub REST API 拉取远程更新（绕过 git GnuTLS SSL 问题）
# 用法: pull-via-api.sh [branch]
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

# 获取远程 tree 的所有文件（path|blob_sha 格式，排序）
get_remote_files() {
  local tree_sha="$1"
  api_get "/git/trees/$tree_sha?recursive=1" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for item in d.get('tree',[]):
    if item['type']=='blob':
        print(item['path'] + '|' + item['sha'])
" | sort
}

# 获取本地 tree 的所有文件（path|blob_sha 格式，排序）
get_local_files() {
  git ls-tree -r "$1" | awk '{print $4 "|" $3}' | sort
}

# 1. 获取远程 HEAD
log "拉取 $REPO ($BRANCH)..."
REMOTE_SHA=$(api_get "/git/ref/heads/$BRANCH" | python3 -c "import sys,json; print(json.load(sys.stdin)['object']['sha'])")
step "远程 HEAD: ${REMOTE_SHA:0:8}"

LOCAL_SHA=$(git --no-pager rev-parse HEAD)
step "本地 HEAD: ${LOCAL_SHA:0:8}"

if [ "$REMOTE_SHA" = "$LOCAL_SHA" ]; then
  log "已是最新，无需拉取。"
  exit 0
fi

# 2. 检查远程 SHA 是否已在本地
if git cat-file -e "$REMOTE_SHA" 2>/dev/null; then
  log "远程提交已在本地，无需拉取。"
  exit 0
fi

# 3. 通过文件树对比检查是否已经内容一致
log "比较文件内容..."
REMOTE_TREE_SHA=$(api_get "/git/commits/$REMOTE_SHA" | python3 -c "import sys,json; print(json.load(sys.stdin)['tree']['sha'])")

REMOTE_FILES=$(get_remote_files "$REMOTE_TREE_SHA")
LOCAL_FILES=$(get_local_files "HEAD")

if [ "$REMOTE_FILES" = "$LOCAL_FILES" ]; then
  log "文件内容完全一致，无需拉取。（提交 SHA 不同但内容相同）"
  exit 0
fi

step "检测到文件差异，开始拉取..."

# 4. 检查本地是否有未提交的更改
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
  err "本地有未提交的更改，请先提交或暂存后再拉取。"
fi

# 5. 计算差异并应用
CHANGED_FILES=""
REMOVED_FILES=""

while IFS='|' read -r path sha; do
  [ -z "$path" ] && continue
  LOCAL_FILE_SHA=$(echo "$LOCAL_FILES" | grep "^${path}|" | cut -d'|' -f2 || true)
  if [ -z "$LOCAL_FILE_SHA" ]; then
    CHANGED_FILES+="$path|added"$'\n'
  elif [ "$LOCAL_FILE_SHA" != "$sha" ]; then
    CHANGED_FILES+="$path|changed"$'\n'
  fi
done <<< "$REMOTE_FILES"

while IFS='|' read -r path sha; do
  [ -z "$path" ] && continue
  REMOTE_FILE_SHA=$(echo "$REMOTE_FILES" | grep "^${path}|" | cut -d'|' -f2 || true)
  if [ -z "$REMOTE_FILE_SHA" ]; then
    REMOVED_FILES+="$path"$'\n'
  fi
done <<< "$LOCAL_FILES"

ADDED_COUNT=$(echo "$CHANGED_FILES" | grep -c "|added" || true)
CHANGED_COUNT=$(echo "$CHANGED_FILES" | grep -c "|changed" || true)
REMOVED_COUNT=$(echo "$REMOVED_FILES" | grep -c "." || true)

if [ "$ADDED_COUNT" -eq 0 ] && [ "$CHANGED_COUNT" -eq 0 ] && [ "$REMOVED_COUNT" -eq 0 ]; then
  log "没有需要更新的文件。"
  exit 0
fi

log "变更: ${ADDED_COUNT} 新增, ${CHANGED_COUNT} 修改, ${REMOVED_COUNT} 删除"

# 6. 收集远程提交消息
REMOTE_MSGS=()
CHECK_SHA="$REMOTE_SHA"
for i in $(seq 1 20); do
  MSG=$(api_get "/git/commits/$CHECK_SHA" | python3 -c "import sys,json; print(json.load(sys.stdin)['message'].split(chr(10))[0])")
  REMOTE_MSGS=("$MSG" "${REMOTE_MSGS[@]}")
  PARENT_SHA=$(api_get "/git/commits/$CHECK_SHA" | python3 -c "import sys,json; ps=json.load(sys.stdin).get('parents',[]); print(ps[0]['sha'] if ps else '')")
  [ -z "$PARENT_SHA" ] && break
  git cat-file -e "$PARENT_SHA" 2>/dev/null && break
  CHECK_SHA="$PARENT_SHA"
done

# 7. 应用变更
if [ -n "$REMOVED_FILES" ]; then
  while read -r filepath; do
    [ -z "$filepath" ] && continue
    step "删除: $filepath"
    rm -f "$filepath"
    git rm --quiet "$filepath" 2>/dev/null || true
  done <<< "$REMOVED_FILES"
fi

if [ -n "$CHANGED_FILES" ]; then
  while IFS='|' read -r filepath status; do
    [ -z "$filepath" ] && continue
    step "$status: $filepath"

    DIR=$(dirname "$filepath")
    [ "$DIR" != "." ] && mkdir -p "$DIR"

    FILE_DATA=$(api_get "/contents/$filepath?ref=$REMOTE_SHA")
    echo "$FILE_DATA" | python3 -c "
import sys,json,base64
d=json.load(sys.stdin)
content=base64.b64decode(d['content'])
sys.stdout.buffer.write(content)
" > "$filepath"
    git add "$filepath"
  done <<< "$CHANGED_FILES"
fi

# 8. 创建本地提交
COMMIT_MSG="sync: 从远程同步更新 ($(date +%Y-%m-%d %H:%M))"
if [ ${#REMOTE_MSGS[@]} -gt 0 ]; then
  COMMIT_MSG="sync: ${REMOTE_MSGS[*]}"
fi

git commit --quiet -m "$COMMIT_MSG"
step "本地提交: $(git --no-pager log --oneline -1)"

log "拉取完成！本地 HEAD: $(git --no-pager rev-parse --short HEAD)"
