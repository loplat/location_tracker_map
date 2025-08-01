// UI 컨트롤 관련 함수들

// 위치 데이터를 시간 순서대로 정렬하는 공통 함수
function sortLocationsByTime(locations) {
    return [...locations].sort((a, b) => {
        if (a.timestamp && b.timestamp) {
            return new Date(a.timestamp) - new Date(b.timestamp);
        }
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (dateA > dateB) return 1;
        if (dateA < dateB) return -1;
        return String(a.time).localeCompare(String(b.time));
    });
}

function updateColumnSelector(selectElement) {
    const existingValue = selectElement.value;
    selectElement.innerHTML = '<option value="">없음</option>';
    allColumns.forEach(column => {
        const option = document.createElement('option');
        option.value = column;
        option.textContent = column;
        selectElement.appendChild(option);
    });
    selectElement.value = existingValue;
}

function addGroupSelector(selectedColumn = '') {
    const container = document.getElementById('groupSelectors');
    const selectorId = `group-selector-${container.children.length}`;

    const wrapper = document.createElement('div');
    wrapper.className = 'group-selector-wrapper';
    wrapper.style.display = 'flex';
    wrapper.style.gap = '5px';
    wrapper.style.marginBottom = '5px';

    const select = document.createElement('select');
    select.id = selectorId;
    select.className = 'group-column-selector';
    select.style.flex = '1';
    select.style.padding = '8px';
    select.style.borderRadius = '6px';
    select.style.border = '1px solid #ccc';

    updateColumnSelector(select);
    select.value = selectedColumn;
    select.addEventListener('change', onGroupColumnChange);

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'X';
    removeBtn.style.padding = '0 10px';
    removeBtn.style.border = '1px solid #ccc';
    removeBtn.style.background = '#f0f0f0';
    removeBtn.style.borderRadius = '6px';
    removeBtn.style.cursor = 'pointer';
    removeBtn.addEventListener('click', () => {
        wrapper.remove();
        onGroupColumnChange();
    });

    wrapper.appendChild(select);
    wrapper.appendChild(removeBtn);
    container.appendChild(wrapper);
}

function createGroupedData(columnName, sourceData) {
    const groupedData = {};
    Object.entries(sourceData).forEach(([sheetName, sheetData]) => {
        const headers = sheetData[0];
        const columnIndex = headers.findIndex(h => h && h.toString() === columnName);
        if (columnIndex === -1) return;
        const dataRows = sheetData.slice(1);
        dataRows.forEach(row => {
            const groupValue = row[columnIndex] || 'Unknown';
            if (!groupedData[groupValue]) {
                groupedData[groupValue] = [headers];
            }
            groupedData[groupValue].push(row);
        });
    });
    return groupedData;
}

function createSheetControls() {
    const sheetControlsDiv = document.getElementById('sheetControls');
    sheetControlsDiv.innerHTML = '';

    Object.entries(allData).forEach(([sheetName, sheetData], index) => {
        const color = colors[index % colors.length];
        const rowCount = sheetData.length > 0 ? sheetData.length - 1 : 0; // Subtract header row

        let totalDistance = 0;
        if (rowCount > 1) {
            const headers = sheetData[0];
            const latIndex = findColumnIndex(headers, ['lat', 'latitude', '위도']);
            const lngIndex = findColumnIndex(headers, ['lng', 'longitude', '경도']);
            if (latIndex !== -1 && lngIndex !== -1) {
                for (let i = 1; i < sheetData.length - 1; i++) {
                    const lat1 = parseFloat(sheetData[i][latIndex]);
                    const lon1 = parseFloat(sheetData[i][lngIndex]);
                    const lat2 = parseFloat(sheetData[i + 1][latIndex]);
                    const lon2 = parseFloat(sheetData[i + 1][lngIndex]);
                    if (!isNaN(lat1) && !isNaN(lon1) && !isNaN(lat2) && !isNaN(lon2)) {
                        totalDistance += calculateDistance(lat1, lon1, lat2, lon2);
                    }
                }
            }
        }

        const checkboxWrapper = document.createElement('div');
        checkboxWrapper.className = 'checkbox-item';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `sheet_${sheetName.replace(/\s/g, '_')}`;
        checkbox.checked = selectedSheets.has(sheetName);

        checkbox.addEventListener('change', function () {
            if (this.checked) {
                selectedSheets.add(sheetName);
                console.log(`시트 ${sheetName} 선택됨`);
            } else {
                selectedSheets.delete(sheetName);
                console.log(`시트 ${sheetName} 선택 해제됨`);
            }

            console.log('현재 선택된 시트들:', Array.from(selectedSheets));

            // 시트 변경 시 해당 시트의 레이어만 제거하고 다시 그리기
            const mapApi = getMapApi();

            // 현재 시트의 마커와 경로 제거
            if (mapLayers[sheetName]) {
                mapApi.removeLayers(mapLayers[sheetName]);
                delete mapLayers[sheetName];
            }
            if (pathLayers[sheetName]) {
                mapApi.removeLayers(pathLayers[sheetName]);
                delete pathLayers[sheetName];
            }

            // 그룹 모드인 경우 그룹 레이어도 제거
            if (mapLayers['groupedMarkers']) {
                mapApi.removeLayers(mapLayers['groupedMarkers']);
                delete mapLayers['groupedMarkers'];
            }
            if (pathLayers['groupedPaths']) {
                mapApi.removeLayers(pathLayers['groupedPaths']);
                delete pathLayers['groupedPaths'];
            }

            onGroupColumnChange(); // Refresh map and groups
            clearPopup();
        });

        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = `${sheetName} (${rowCount}건, ${totalDistance.toFixed(2)}km)`;
        label.style.color = color;
        label.style.fontWeight = '600';

        checkboxWrapper.append(checkbox, label);
        sheetControlsDiv.appendChild(checkboxWrapper);
    });
}

function updateMapDisplay() {
    if (currentGroupColumns.length === 0) return;

    const mapApi = getMapApi();

    // 기존 그룹 레이어들 제거
    if (mapLayers['groupedMarkers']) {
        mapApi.removeLayers(mapLayers['groupedMarkers']);
        delete mapLayers['groupedMarkers'];
    }
    if (pathLayers['groupedPaths']) {
        mapApi.removeLayers(pathLayers['groupedPaths']);
        delete pathLayers['groupedPaths'];
    }

    // 선택된 시트의 데이터만 필터링
    const visibleSheetData = {};
    selectedSheets.forEach(sheetName => {
        if (allData[sheetName]) visibleSheetData[sheetName] = allData[sheetName];
    });

    console.log('선택된 시트들:', Array.from(selectedSheets));
    console.log('표시할 데이터:', Object.keys(visibleSheetData));

    // 빠른 지도 업데이트를 위해 기존 로직 재사용 (그룹 컨트롤은 생성하지 않음)
    displayDataAsGroups(currentGroupColumns, visibleSheetData, false);
}

function onGroupColumnChange() {
    const newGroupColumns = Array.from(document.querySelectorAll('.group-column-selector')).map(s => s.value).filter(v => v);

    // If group columns change, reset selected groups
    if (JSON.stringify(newGroupColumns) !== JSON.stringify(currentGroupColumns)) {
        selectedGroups.clear();
    }
    currentGroupColumns = newGroupColumns;

    const mapApi = getMapApi();
    mapApi.clearAllLayers();
    mapLayers = {}; pathLayers = {}; clearPopup();

    // 선택된 시트의 데이터만 필터링
    const visibleSheetData = {};
    selectedSheets.forEach(sheetName => {
        if (allData[sheetName]) visibleSheetData[sheetName] = allData[sheetName];
    });

    if (currentGroupColumns.length > 0) {
        displayDataAsGroups(currentGroupColumns, visibleSheetData);
        switchTab('groups');
    } else {
        createGroupControls({});
        // 선택된 시트만 처리
        Object.entries(visibleSheetData).forEach(([sheetName, sheetData]) => {
            const colorIndex = Object.keys(allData).indexOf(sheetName);
            processAndDisplayData(sheetName, sheetData, colors[colorIndex % colors.length], true);
        });
        switchTab('sheets');
    }
}

// 데이터 로드 완료 후 처리
function processLoadedData(parsedData) {
    console.log('--- processLoadedData 시작 ---');

    // 데이터 및 레이어 초기화
    getMapApi().clearAllLayers();
    allData = {}; mapLayers = {}; pathLayers = {}; allColumns = []; currentGroupColumns = []; selectedSheets.clear();
    document.getElementById('groupSelectors').innerHTML = '';

    function isHeaderRow(row) {
        if (!row || row.length === 0) return false;
        const lowerRow = row.map(cell => cell ? cell.toString().toLowerCase().replace(/[\s_]/g, '') : '');
        const hasCombinedTimestamp = lowerRow.some(cell => ['tslocal', 'timestamp', 'datetime'].some(kw => cell.includes(kw)));
        const hasDate = lowerRow.some(cell => ['date', 'day', '날짜'].some(kw => cell.includes(kw)));
        const hasTime = lowerRow.some(cell => ['time', '시간'].some(kw => cell.includes(kw)));
        const hasLat = lowerRow.some(cell => ['lat', 'latitude', '위도'].some(kw => cell.includes(kw)));
        const hasLng = lowerRow.some(cell => ['lng', 'longitude', '경도'].some(kw => cell.includes(kw)));
        return (hasCombinedTimestamp || (hasDate && hasTime)) && hasLat && hasLng;
    }

    if (parsedData.isXlsx) {
        allData = parsedData.data;
    } else {
        const data = parsedData.data;
        const headerIndices = data.map((row, i) => isHeaderRow(row) ? i : -1).filter(i => i !== -1);

        if (headerIndices.length === 0) {
            allData['Sheet1'] = data.filter(row => !isEmptyRow(row));
        } else {
            for (let i = 0; i < headerIndices.length; i++) {
                const startIndex = headerIndices[i];
                const endIndex = (i < headerIndices.length - 1) ? headerIndices[i + 1] : data.length;
                let sheetData = data.slice(startIndex, endIndex).filter(row => !isEmptyRow(row));
                if (sheetData.length > 1) {
                    const sheetName = `Sheet${i + 1}`;
                    allData[sheetName] = sheetData;
                }
            }
        }

        if (Object.keys(allData).length === 0 && data.length > 0) {
            allData['Sheet1'] = data.filter(row => !isEmptyRow(row));
        }
    }

    Object.values(allData).forEach(sheetData => {
        if (sheetData.length > 0) {
            sheetData[0].forEach(header => {
                if (header && !allColumns.includes(header)) allColumns.push(header);
            });
        }
    });

    addGroupSelector(); // Add the first default group selector

    if (Object.keys(allData).length > 0) {
        selectedSheets.add(Object.keys(allData)[0]);
    }

    createSheetControls();
    onGroupColumnChange(); // Centralized UI refresh

    document.getElementById('status').textContent = `${Object.keys(allData).length}개 시트 로드 완료.`;
    console.log('--- processLoadedData 종료 ---');
}

// 데이터 처리 및 지도에 표시 (지도 라이브러리 독립적으로)
function processAndDisplayData(groupName, data, color, isSheetGroup = true) {
    if (!data || data.length === 0) return;

    const headers = data[0];
    const columnValidation = validateRequiredColumns(headers, groupName);

    if (!columnValidation.valid) {
        alert(columnValidation.error);
        return;
    }

    const locations = processSheetData(data, columnValidation, groupName);

    if (locations.length === 0) return;

    console.log('locations:', locations.slice(0, 10));

    // 시트 모드에서도 시간 순서대로 정렬 확인
    const sortedLocations = sortLocationsByTime(locations);

    const layerGroup = [];
    const pathLayerGroup = [];
    mapLayers[groupName] = layerGroup;
    pathLayers[groupName] = pathLayerGroup;

    const mapApi = getMapApi();

    // 1. Draw markers first
    sortedLocations.forEach((location) => {
        const marker = mapApi.createMarker(location, color, groupName);
        layerGroup.push(marker);
    });
    mapApi.addLayers(layerGroup);

    // 2. Draw paths (시트 내에서만 연결)
    const drawPaths = () => {
        if (sortedLocations.length > 1 && showPaths) {
            const path = mapApi.createPath(sortedLocations, color);
            pathLayerGroup.push(...path);
            mapApi.addLayers(path);
        }
    };

    if (mapProvider === 'naver') {
        setTimeout(drawPaths, 100);
    } else {
        drawPaths();
    }

    // 3. Fit bounds if single sheet
    if (Object.keys(allData).filter(k => selectedSheets.has(k)).length === 1) {
        mapApi.fitBounds(locations);
    }
} 