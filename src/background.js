chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "getRecentFiles") {
    // 全てのタイプで同じ検索ワードを使用し、後でフィルタリング
    const searchText = 'notion.so';
    
    console.log('Searching for:', searchText);
    
    chrome.history.search({
      'text': searchText,
      'startTime': 0, 
      'maxResults': 200
    }, function(historyItems) {
      const files = [];
      const seenUrls = new Set();

      historyItems.forEach(item => {
        if (item.url.startsWith('https://www.notion.so') && item.title && item.title !== 'Notion') {
          // URL から引数を削除
          const urlWithoutParams = new URL(item.url).origin + new URL(item.url).pathname;

          // 重複チェック
          if (!seenUrls.has(urlWithoutParams)) {
            const isDatabase = isNotionDatabase(item.url, item.title);
            
            // fileType によるフィルタリング
            let shouldInclude = true;
            if (request.fileType === 2) { // Databases only
              shouldInclude = isDatabase;
            } else if (request.fileType === 1) { // Pages only
              shouldInclude = !isDatabase;
            }
            
            if (shouldInclude) {
              files.push({
                name: item.title,
                webViewLink: item.url,
                lastVisitTime: item.lastVisitTime,
                visitCount: item.visitCount,
                type: isDatabase ? 'database' : 'page'
              });
              seenUrls.add(urlWithoutParams);
            }
          }
        }
      });

      // 最終訪問時間でソート
      files.sort((a, b) => b.lastVisitTime - a.lastVisitTime);

      sendResponse({ files: files });
    });

    return true; 
  }
});

// Notionデータベースかどうかを判定する関数
function isNotionDatabase(url, title) {
  // URLベースの判定
  if (url.includes('?v=') || url.includes('/database/')) {
    return true;
  }
  
  // タイトルベースの判定
  const databaseKeywords = [
    'database', 'データベース', 'DB', 'table', 'テーブル',
    'list', 'リスト', 'board', 'ボード', 'calendar', 'カレンダー',
    'gallery', 'ギャラリー', 'timeline', 'タイムライン'
  ];
  
  const lowerTitle = title.toLowerCase();
  return databaseKeywords.some(keyword => lowerTitle.includes(keyword.toLowerCase()));
}


