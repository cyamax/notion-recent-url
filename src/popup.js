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

// タブ切り替えとファイルタイプ変換の適化
const TAB_IDS = ['getFilesButton_all', 'getFilesButton_pages', 'getFilesButton_databases', 'getFilesButton_favorites'];

function getFileTypeFromTabId(tabId) {
  return TAB_IDS.indexOf(tabId) !== -1 ? TAB_IDS.indexOf(tabId) : null;
}

function switchTab(fileType) {
  currentFilter = fileType;
  
  // アクティブタブの更新
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.getElementById(TAB_IDS[fileType]).classList.add('active');
  
  if (fileType === 3) {
    // Favoritesタブの場合は、現在のファイルからピン留めのみ表示
    renderFiles();
  } else {
    getRecentFiles(fileType);
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

// DOM操作の最適化とコード簡略化
function createFileElement(file) {
  const timeStamp = new Date(file.lastVisitTime);
  const textContent = cleanNotionTitle(file.name);
  const isFrequentlyAccessed = file.visitCount > findLargest(currentFiles);
  const pinned = isPinned(file.webViewLink);
  const faviconUrl = getFaviconUrl(file.webViewLink);

  // メインコンテナ作成
  const fileElement = document.createElement('div');
  fileElement.className = `history-item ${pinned ? 'pinned' : ''}`;
  
  // HTMLテンプレートを使用してDOM操作を最適化
  fileElement.innerHTML = `
    <a href="${file.webViewLink}" target="_blank">
      <div class="file-favicon">
        <img src="${faviconUrl}" alt="">
      </div>
      <div class="file-info">
        <div class="file-name" title="${textContent}">${textContent}</div>
      </div>
      <div class="file-meta">
        ${isFrequentlyAccessed ? `
          <div class="frequent-badge" title="アクセス数: ${file.visitCount}回 - よくアクセスしているページです">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
            <span>よく見る</span>
          </div>
        ` : ''}
        <div class="access-time">${timeStamp.toLocaleDateString()}</div>
      </div>
    </a>
    <button class="pin-button ${pinned ? 'pinned' : ''}" 
            title="${pinned ? 'ピン留め解除' : 'ピン留め'}" 
            data-url="${file.webViewLink}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="${pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
      </svg>
    </button>
  `;

  // ピンボタンのイベントリスナー
  const pinButton = fileElement.querySelector('.pin-button');
  pinButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    togglePin(file.webViewLink, file.name);
  });

  return fileElement;
}

// Chrome公式のFavicon APIを使用してChrome履歴と同じファビコンを表示
function getFaviconUrl(url) {
  try {
    // Chrome公式のFavicon APIを使用
    const faviconUrl = new URL(chrome.runtime.getURL("/_favicon/"));
    faviconUrl.searchParams.set("pageUrl", url);
    faviconUrl.searchParams.set("size", "16");
    return faviconUrl.toString();
  } catch (e) {
    // エラー時はフォールバックとしてGoogle Faviconsを使用
    try {
      const urlObj = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=16`;
    } catch (fallbackError) {
      return 'https://www.notion.so/images/favicon.ico';
    }
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

// ユーティリティ関数の最適化
function cleanNotionTitle(str) {
  return str.replace(/\s+(\||-)\s+Notion$/i, '').trim() || str;
}

// キャッシュを使用して性能最適化
let largestCountCache = null;
let lastFilesLength = 0;

function findLargest(arr) {
  if (arr.length !== lastFilesLength) {
    lastFilesLength = arr.length;
    largestCountCache = null;
  }
  
  if (largestCountCache !== null) {
    return largestCountCache;
  }
  
  if (arr.length < 4) {
    largestCountCache = 1000;
  } else {
    const counts = arr.map(item => item.visitCount).sort((a, b) => b - a);
    largestCountCache = counts[3];
  }
  
  return largestCountCache;
}

// 簡略化されたユーティリティ関数
const showLoading = () => document.getElementById("fileList").innerHTML = '<div class="loading">読み込み中...</div>';
const hideLoading = () => {}; // renderFiles関数で内容が置き換えられる
const showError = (message) => document.getElementById("fileList").innerHTML = `<div class="no-files">エラー: ${message}</div>`;
