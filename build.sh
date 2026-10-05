#!/bin/bash
# 把 src/ 合併成單一 HTML 檔案：元素週期表背誦.html
cd "$(dirname "$0")"
OUT="元素週期表背誦.html"
{
  cat src/1-head.html
  echo "<style>"; cat src/2a-style.css src/2b-style.css; echo "</style>"
  echo "</head>"; echo "<body>"
  cat src/3-body.html
  echo "<script>"; cat src/4a-data.js src/4b-data.js src/5-core.js src/6-review.js src/7-quiz.js; echo "</script>"
  echo "</body>"; echo "</html>"
} > "$OUT"
echo "built $OUT ($(wc -c < "$OUT") bytes)"
# GitHub Pages 版本（main 分支 /docs）
mkdir -p docs && cp "$OUT" docs/index.html && touch docs/.nojekyll
