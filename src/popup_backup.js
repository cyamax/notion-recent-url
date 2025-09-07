'use strict';

import './input.css';
import './popup.css';

// グローバル変数
let currentFiles = [];
let pinnedFiles = [];
let currentFilter = 0; // 0: all, 1: pages, 2: databases, 3: favorites
let currentSort = 'recent';
let searchQuery = '';

// 初期化
document.addEventListener('DOMContentLoaded', function() {
  loadPinnedFiles();
  setupEventListeners();
  getRecentFiles(0);
});

// イベントリスナーの設定
function setupEventListeners() {
  // タブイベント
  document.getElementById('getFilesButton_all').addEventListener('click', () => switchTab(0));
  document.getElementById('getFilesButton_pages').addEventListener('click', () => switchTab(1));
  document.getElementById('getFilesButton_databases').addEventListener('click', () => switchTab(2));
  document.getElementById('getFilesButton_favorites').addEventListener('click', () => switchTab(3));

  // 検索イベント
  document.getElementById('searchInput').addEventListener('input', handleSearch);

  // ソートイベント
  document.getElementById('sortSelect').addEventListener('change', handleSort);

  // タブホバーイベント
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('mouseenter', () => {
      if (!tab.classList.contains('active')) {
        const tabId = tab.id;
        const fileType = getFileTypeFromTabId(tabId);
        if (fileType !== null) {
          switchTab(fileType);
        }
      }
    });
  });
}

// タブ切り替え
function switchTab(fileType) {
  currentFilter = fileType;
  
  // アクティブタブの更新
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  const tabIds = ['getFilesButton_all', 'getFilesButton_pages', 'getFilesButton_databases', 'getFilesButton_favorites'];
  document.getElementById(tabIds[fileType]).classList.add('active');
  
  if (fileType === 3) {
    // Favoritesタブの場合は、現在のファイルからピン留めのみ表示
    renderFiles();
  } else {
    getRecentFiles(fileType);
  }
}

function getFileTypeFromTabId(tabId) {
  switch(tabId) {
    case 'getFilesButton_all': return 0;
    case 'getFilesButton_pages': return 1;
    case 'getFilesButton_databases': return 2;
    case 'getFilesButton_favorites': return 3;
    default: return null;
  }
}

// ファイル取得
function getRecentFiles(fileType) {
  showLoading();
  
  chrome.runtime.sendMessage({ action: "getRecentFiles", fileType: fileType }, function (response) {
    hideLoading();
    
    if (response.error) {
      showError(response.error);
      return;
    }

    currentFiles = response.files || [];
    renderFiles();
  });
}

// ファイル描画
function renderFiles() {
  const fileList = document.getElementById("fileList");
  fileList.innerHTML = "";
  
  let filesToShow = filterAndSortFiles(currentFiles);
  
  if (filesToShow.length === 0) {
    const message = currentFilter === 3 ? 'No favorite pages found' : 'No files found';
    fileList.innerHTML = `<div class="no-files">${message}</div>`;
    return;
  }

  filesToShow.forEach(file => {
    const fileElement = createFileElement(file);
    fileList.appendChild(fileElement);
  });
}

function createFileElement(file) {
  const timeStamp = new Date(file.lastVisitTime);
  const textContent = cleanNotionTitle(file.name);
  const boldFlag = file.visitCount > findLargest(currentFiles) ? "↗" : "";
  const pinned = isPinned(file.webViewLink);

  // ファビコン取得
  const faviconUrl = getFaviconUrl(file.webViewLink);

  const fileElement = document.createElement('div');
  fileElement.className = `history-item ${pinned ? 'pinned' : ''}`;
  
  fileElement.innerHTML = `
    <a href="${file.webViewLink}" target="_blank">
      <div class="file-favicon">
        <img src="${faviconUrl}" alt="">
      </div>
      <div class="file-info">
        <div class="file-name" title="${textContent}">${textContent}</div>
      </div>
      <div class="file-meta">
        <div class="access-time">${timeStamp.toLocaleDateString()}</div>
        <div class="highlight">${boldFlag}</div>
      </div>
    </a>
    <button class="pin-button ${pinned ? 'pinned' : ''}" title="${pinned ? 'ピン留め解除' : 'ピン留め'}" data-url="${file.webViewLink}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 17l-5-5h3V5h4v7h3l-5 5z"/>
      </svg>
    </button>
  `;

  // ピンボタンのイベント
  const pinButton = fileElement.querySelector('.pin-button');
  pinButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    togglePin(file.webViewLink, file.name);
  });

  return fileElement;
}

// ファビコンURL取得
function getFaviconUrl(url) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
  } catch (e) {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQgNmgxNk00IDEyaDE2TTQgMThoNyIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+';
  }
}

// フィルタリングとソート
function filterAndSortFiles(files) {
  let filtered = [...files];

  // Favoritesタブの場合は、ピン留めのみ表示
  if (currentFilter === 3) {
    filtered = filtered.filter(file => isPinned(file.webViewLink));
  }

  // 検索フィルター
  if (searchQuery) {
    filtered = filtered.filter(file => 
      file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.webViewLink.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  // ソート
  switch (currentSort) {
    case 'frequent':
      filtered.sort((a, b) => b.visitCount - a.visitCount);
      break;
    case 'alphabetical':
      filtered.sort((a, b) => cleanNotionTitle(a.name).localeCompare(cleanNotionTitle(b.name)));
      break;
    case 'pinned':
      filtered.sort((a, b) => {
        const aPinned = isPinned(a.webViewLink);
        const bPinned = isPinned(b.webViewLink);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        return b.lastVisitTime - a.lastVisitTime;
      });
      break;
    case 'recent':
    default:
      filtered.sort((a, b) => b.lastVisitTime - a.lastVisitTime);
      break;
  }

  return filtered;
}

// 検索ハンドラー
function handleSearch(e) {
  searchQuery = e.target.value.trim();
  renderFiles();
}

// ソートハンドラー
function handleSort(e) {
  currentSort = e.target.value;
  renderFiles();
}

// ピン留め機能
function togglePin(url, title) {
  const pinned = isPinned(url);
  
  if (pinned) {
    removePinnedFile(url);
  } else {
    addPinnedFile(url, title);
  }
  
  savePinnedFiles();
  renderFiles();
}

function isPinned(url) {
  return pinnedFiles.some(file => file.url === url);
}

function addPinnedFile(url, title) {
  if (!isPinned(url)) {
    pinnedFiles.push({
      url: url,
      title: title,
      pinnedAt: Date.now()
    });
  }
}

function removePinnedFile(url) {
  pinnedFiles = pinnedFiles.filter(file => file.url !== url);
}

function loadPinnedFiles() {
  const stored = localStorage.getItem('notionPinnedFiles');
  pinnedFiles = stored ? JSON.parse(stored) : [];
}

function savePinnedFiles() {
  localStorage.setItem('notionPinnedFiles', JSON.stringify(pinnedFiles));
}

// ユーティリティ関数
function cleanNotionTitle(str) {
  const patterns = [
    " | Notion",
    " - Notion",
    /\s+\|\s+Notion$/,
    /\s+-\s+Notion$/
  ];

  let cleaned = str;
  for (let pattern of patterns) {
    if (typeof pattern === 'string') {
      if (cleaned.endsWith(pattern)) {
        cleaned = cleaned.slice(0, -pattern.length);
      }
    } else {
      cleaned = cleaned.replace(pattern, '');
    }
  }

  return cleaned.trim() || str;
}

function findLargest(arr) {
  if (arr.length < 4) {
    return 1000;
  }
  const sortedArr = [...arr].sort((a, b) => b.visitCount - a.visitCount);
  return sortedArr[3].visitCount;
}

function showLoading() {
  document.getElementById("fileList").innerHTML = '<div class="loading">読み込み中...</div>';
}

function hideLoading() {
  // renderFiles関数で内容が置き換えられるため、特別な処理は不要
}

function showError(message) {
  document.getElementById("fileList").innerHTML = `<div class="no-files">エラー: ${message}</div>`;
}
