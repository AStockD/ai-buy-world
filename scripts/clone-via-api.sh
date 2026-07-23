#!/bin/bash
set -euo pipefail

# 通过 GitHub REST API 克隆仓库（绕过 git GnuTLS SSL 问题）
# 用法: clone-via-api.sh <owner/repo> [target_dir] [branch]
# 示例: clone-via-api.sh AStockD/stock-media-ai-bot
#        clone-via-api.sh AStockD/stock-media-ai-bot /var/projects/my-bot develop

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "错误: 请先设置 GITHUB_TOKEN 环境变量" >&2
  echo "  export GITHUB_TOKEN=github_pat_xxx" >&2
  exit 1
fi

REPO="${1:-}"
if [ -z "$REPO" ]; then
  echo "用法: clone-via-api.sh <owner/repo> [target_dir] [branch]" >&2
  echo "示例: clone-via-api.sh AStockD/stock-media-ai-bot" >&2
  exit 1
fi

# 默认目标目录 = repo 名
REPO_NAME=$(echo "$REPO" | cut -d'/' -f2)
TARGET_DIR="${2:-$REPO_NAME}"
BRANCH="${3:-main}"

TOKEN="$GITHUB_TOKEN"
API="https://api.github.com/repos/$REPO"
AUTH=(-H "Authorization: token $TOKEN" -H "Content-Type: application/json")

log()  { echo -e "\033[1;32m>>>\033[0m $*"; }
err()  { echo -e "\033[1;31m!!!\033[0m $*" >&2; exit 1; }
step() { echo -e "\033[1;36m  →\033[0m $*"; }

api_get() {
  curl -s "${AUTH[@]}" "$API$1"
}

# 1. 检查仓库是否存在
log "克隆 $REPO → $TARGET_DIR (分支: $BRANCH)..."
REPO_INFO=$(api_get "")
REPO_FULL_NAME=$(echo "$REPO_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('full_name',''))")
if [ -z "$REPO_FULL_NAME" ]; then
  MSG=$(echo "$REPO_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('message','unknown'))")
  err "仓库不存在或无权访问: $MSG"
fi
step "仓库: $REPO_FULL_NAME"

# 2. 检查默认分支
DEFAULT_BRANCH=$(echo "$REPO_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('default_branch','main'))")
# 如果用户没指定分支或指定的分支不存在，使用默认分支
REF_CHECK=$(api_get "/branches/$BRANCH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('name',''))")
if [ -z "$REF_CHECK" ]; then
  step "分支 $BRANCH 不存在，使用默认分支 $DEFAULT_BRANCH"
  BRANCH="$DEFAULT_BRANCH"
fi

# 3. 获取远程 HEAD
REMOTE_SHA=$(api_get "/git/ref/heads/$BRANCH" | python3 -c "import sys,json; print(json.load(sys.stdin)['object']['sha'])")
step "远程 HEAD: ${REMOTE_SHA:0:8}"

# 4. 获取完整文件树
log "获取文件列表..."
TREE_DATA=$(api_get "/git/trees/$REMOTE_SHA?recursive=1")
FILE_COUNT=$(echo "$TREE_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len([i for i in d.get('tree',[]) if i['type']=='blob']))")
step "共 $FILE_COUNT 个文件"

if [ "$FILE_COUNT" = "0" ]; then
  err "仓库为空，没有文件"
fi

# 5. 创建目标目录
if [ -d "$TARGET_DIR" ]; then
  err "目录已存在: $TARGET_DIR"
fi
mkdir -p "$TARGET_DIR"
cd "$TARGET_DIR"

# 6. 下载所有文件
log "下载文件..."
DOWNLOADED=0
echo "$TREE_DATA" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for item in d.get('tree',[]):
    if item['type']=='blob':
        print(item['path'] + '|' + item.get('url',''))
" | while IFS='|' read -r filepath blob_url; do
  [ -z "$filepath" ] && continue

  # 确保目录存在
  DIR=$(dirname "$filepath")
  [ "$DIR" != "." ] && mkdir -p "$DIR"

  # 通过 contents API 下载文件（base64 编码）
  FILE_DATA=$(curl -s "${AUTH[@]}" "$API/contents/$filepath?ref=$REMOTE_SHA")
  echo "$FILE_DATA" | python3 -c "
import sys,json,base64
d=json.load(sys.stdin)
if 'content' in d:
    content=base64.b64decode(d['content'])
    sys.stdout.buffer.write(content)
elif d.get('encoding') == 'base64':
    content=base64.b64decode(d.get('content',''))
    sys.stdout.buffer.write(content)
else:
    # 可能是大文件，需要用 download_url
    import urllib.request
    url = d.get('download_url','')
    if url:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as resp:
            sys.stdout.buffer.write(resp.read())
" > "$filepath"

  DOWNLOADED=$((DOWNLOADED + 1))
  # 每 50 个文件打印一次进度
  if [ $((DOWNLOADED % 50)) -eq 0 ]; then
    step "已下载 $DOWNLOADED / $FILE_COUNT ..."
  fi
done

step "下载完成: $FILE_COUNT 个文件"

# 7. 初始化 git 仓库
log "初始化 git 仓库..."
git init --quiet
git checkout -b "$BRANCH" --quiet
git remote add origin "https://github.com/$REPO.git"

# 8. 添加所有文件并创建初始提交
git add -A
COMMIT_MSG="initial clone: 从 $REPO ($BRANCH) 通过 API 克隆 ($(date +%Y-%m-%d %H:%M))"
git commit --quiet -m "$COMMIT_MSG"

step "本地提交: $(git --no-pager log --oneline -1)"

log "克隆完成！"
log "  目录: $(pwd)"
log "  文件: $FILE_COUNT 个"
log "  分支: $BRANCH"
log ""
log "后续操作："
log "  cd $TARGET_DIR"
log "  source /var/projects/ai-buy-world/.env.token"
log "  /var/projects/scripts/pull-via-api.sh   # 拉取更新"
log "  /var/projects/scripts/push-via-api.sh   # 推送提交"
