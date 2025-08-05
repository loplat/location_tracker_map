// 전역 변수
let map;
let naverMap;
let mapProvider = 'osm'; // 'osm' or 'naver'
let allData = {};
let mapLayers = {};
let pathLayers = {};
let geofenceLayers = {};
let colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD', '#FF7675', '#74B9FF', '#A29BFE', '#6C5CE7', '#00B894', '#00CEC9', '#E84393', '#FD79A8'];
let currentPopup = null;
let showPaths = true;
let currentGroupColumns = [];
let allColumns = [];
let activeTab = 'sheets';
let selectedSheets = new Set();
let selectedGroups = new Set();
let allLocations = []; // 전역 변수로 선언
let tsIndex = -1; // 전역 변수로 선언

// 유틸리티 함수들
function excelSerialDateToJSDate(serial) {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);

    const fractional_day = serial - Math.floor(serial) + 0.0000001;

    let total_seconds = Math.floor(86400 * fractional_day);

    const seconds = total_seconds % 60;
    total_seconds -= seconds;

    const hours = Math.floor(total_seconds / (60 * 60));
    const minutes = Math.floor(total_seconds / 60) % 60;

    return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds);
}

function convertToKST(date) {
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstDate = new Date(date.getTime() + kstOffset);
    return {
        date: kstDate.toISOString().slice(0, 10),
        time: kstDate.toISOString().slice(11, 19)
    };
}

function isEmptyRow(row) {
    return !row || row.every(cell => !cell || cell.toString().trim() === '');
}

// 거리 계산 함수 (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // 지구 반지름 (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// 시간 차이 계산 함수
function calculateTimeDiff(time1, time2, returnMinutes = false) {
    const diff = Math.abs(new Date(time2) - new Date(time1)); // ms
    if (returnMinutes) return diff / (1000 * 60);

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
}

// 팝업 제거 함수
function clearPopup() {
    if (currentPopup) {
        if (mapProvider === 'osm') {
            map.closePopup(currentPopup);
        } else {
            currentPopup.close();
        }
        currentPopup = null;
    }
}

// 지도 초기화
function initMap() {
    if (map) {
        map.remove();
        map = null;
    }
    if (naverMap) {
        naverMap.destroy();
        naverMap = null;
    }

    if (mapProvider === 'osm') {
        initLeafletMap();
    } else {
        initNaverMap();
    }
}

function initLeafletMap() {
    map = L.map('map').setView([37.5665, 126.9780], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    map.on('click', clearPopup);
}

function initNaverMap() {
    const mapOptions = {
        center: new naver.maps.LatLng(37.5665, 126.9780),
        tileTransition: false,
        zoom: 11,
        mapTypes: new naver.maps.MapTypeRegistry({
            'normal': naver.maps.NaverStyleMapTypeOptions.getNormalMap(
                {
                    overlayType: 'bg.ol.ts.lko'
                }
            )
        })
    };
    naverMap = new naver.maps.Map('map', mapOptions);
}

// 색상 해시 함수
function getColorForValue(value, index = 0) {
    if (!value) return colors[index % colors.length];

    let hash = 0;
    for (let i = 0; i < value.toString().length; i++) {
        hash = value.toString().charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

function findColumnIndex(headers, keywords, exact = false) {
    for (const keyword of keywords) {
        const index = headers.findIndex(h => {
            if (!h) return false;
            const headerText = h.toString().toLowerCase().replace(/[\s_]/g, '');
            return exact ? headerText === keyword : headerText.includes(keyword);
        });
        if (index !== -1) return index;
    }
    return -1;
}

// 경로 표시/숨김
function togglePaths() {
    showPaths = !showPaths;
    const pathToggle = document.getElementById('pathToggle');
    pathToggle.classList.toggle('active', showPaths);

    const mapApi = getMapApi();
    const allPathLayers = Object.values(pathLayers).flat();

    if (showPaths) {
        onGroupColumnChange();
    } else {
        mapApi.removeLayers(allPathLayers);
    }
}

// 지도 프로바이더 토글
function toggleMapProvider() {
    const toggle = document.getElementById('mapProviderToggle');
    mapProvider = toggle.classList.contains('active') ? 'osm' : 'naver';
    toggle.classList.toggle('active');

    // 네이버 지도를 사용하려면 Client ID가 필요합니다.
    const naverApiScript = document.getElementById('naverMapApi');
    if (mapProvider === 'naver' && naverApiScript.src.includes('[YOUR_CLIENT_ID_HERE]')) {
        alert('네이버 지도 API를 사용하려면 index.html 파일에서 [YOUR_CLIENT_ID_HERE]를 실제 클라이언트 ID로 변경해야 합니다.');
        mapProvider = 'osm';
        toggle.classList.remove('active');
        return;
    }

    // Reset layers before re-initializing the map and redrawing data
    mapLayers = {};
    pathLayers = {};

    initMap();
    onGroupColumnChange(); // 지도 변경 후 데이터 다시 그리기
}

// 탭 전환
function switchTab(tabId) {
    activeTab = tabId;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    const tabButton = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (tabButton) tabButton.classList.add('active');

    // 모든 탭 컨텐츠를 숨기고 선택된 탭만 표시
    const sheetControls = document.getElementById('sheetControls');
    const groupControls = document.getElementById('groupControls');

    if (sheetControls) sheetControls.style.display = 'none';
    if (groupControls) groupControls.style.display = 'none';

    const contentId = (tabId === 'sheets') ? 'sheetControls' : 'groupControls';
    const contentElement = document.getElementById(contentId);
    if (contentElement) {
        contentElement.classList.add('active');
        contentElement.style.display = 'block';
    }
}

function handleGeofenceFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById('status').textContent = '지오펜스 파일 처리 중...';
    const reader = new FileReader();

    reader.onload = async (e) => {
        try {
            const parsedData = await DataParser.parseCsvData(e.target.result);
            processGeofenceData(parsedData.data);
        } catch (error) {
            document.getElementById('status').textContent = error.message;
        }
    };
    reader.readAsText(file, 'UTF-8');
}

function handleGeofenceUrlLoad() {
    const url = document.getElementById('geofenceUrl').value;
    if (!url) return alert('지오펜스 CSV URL을 입력해주세요.');

    document.getElementById('status').textContent = 'URL에서 지오펜스 데이터 로드 중...';

    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;

    fetch(proxyUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
        })
        .then(csvText => DataParser.parseCsvData(csvText))
        .then(parsedData => {
            processGeofenceData(parsedData.data);
        })
        .catch(error => {
            console.error('지오펜스 URL 로드 오류:', error);
            document.getElementById('status').textContent = '지오펜스 URL 로드 오류';
            alert('데이터를 불러올 수 없습니다. URL을 확인해주세요.');
        });
}

function processGeofenceData(data) {
    try {
        const geofences = parseGeofenceData(data);
        const mapApi = getMapApi();
        mapApi.clearGeofenceLayers();
        geofenceLayers = mapApi.drawGeofences(geofences);
        document.getElementById('status').textContent = `${geofences.length}개의 지오펜스를 로드했습니다.`;
    } catch (error) {
        document.getElementById('status').textContent = `지오펜스 처리 오류: ${error.message}`;
        alert(`지오펜스 처리 오류: ${error.message}`);
    }
}

// 이벤트 리스너 등록
document.addEventListener('DOMContentLoaded', function () {
    initMap();

    document.getElementById('csvFile').addEventListener('change', handleFileSelect);
    document.getElementById('loadFromUrl').addEventListener('click', handleUrlLoad);
    document.getElementById('geofenceFile').addEventListener('change', handleGeofenceFileSelect);
    document.getElementById('geofenceUrl').addEventListener('click', handleGeofenceUrlLoad);
    document.getElementById('addGroupLevel').addEventListener('click', () => addGroupSelector());
    document.getElementById('pathToggle').addEventListener('click', togglePaths);
    document.getElementById('mapProviderToggle').addEventListener('click', toggleMapProvider);

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
});
