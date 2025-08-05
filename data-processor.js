// 데이터 파싱 공통 함수
const DataParser = {
    parseXlsxData: (data) => {
        try {
            const uint8Array = new Uint8Array(data);
            const workbook = XLSX.read(uint8Array, { type: 'array' });

            if (workbook.SheetNames.length === 0) {
                throw new Error('XLSX 파일에 시트가 없습니다.');
            }

            const sheetData = {};
            workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
                if (jsonData.length > 0) {
                    sheetData[sheetName] = jsonData.filter(row => !isEmptyRow(row));
                }
            });
            return { data: sheetData, isXlsx: true };
        } catch (error) {
            console.error('XLSX 처리 중 오류 발생:', error);
            throw new Error(`XLSX 파일을 처리할 수 없습니다. (${error.message})`);
        }
    },

    parseCsvData: (text) => {
        return new Promise((resolve, reject) => {
            Papa.parse(text, {
                header: false,
                skipEmptyLines: true,
                complete: (results) => {
                    if (results.errors.length > 0) {
                        console.warn('CSV 파싱 오류:', results.errors);
                        reject(new Error(`파싱 오류: ${results.errors[0].message}`));
                        return;
                    }
                    resolve({ data: results.data, isXlsx: false });
                },
                error: (error) => {
                    reject(new Error(`CSV 파싱 오류: ${error.message}`));
                }
            });
        });
    },

    parseUrlData: async (url) => {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.arrayBuffer();
        return DataParser.parseXlsxData(data);
    }
};

// 위치 데이터 변환 공통 함수
function convertLocationData(row, headers, dateIndex, timeIndex, tsIndex, latIndex, lngIndex, index) {
    let date = row[dateIndex];
    let time = row[timeIndex];

    if (typeof date === 'number') {
        const kst = convertToKST(excelSerialDateToJSDate(date));
        date = kst.date;
    }
    if (typeof time === 'number') {
        const kst = convertToKST(excelSerialDateToJSDate(time));
        time = kst.time;
    }

    const timestamp = tsIndex !== -1 ? row[tsIndex] : `${date} ${time}`;

    // 변환된 데이터를 저장할 객체 생성
    const convertedData = [...row];

    // Date 컬럼들을 변환하여 저장
    headers.forEach((header, idx) => {
        if (header && header.toLowerCase().includes('date') && !isNaN(row[idx]) && Number(row[idx]) > 40000) {
            const convertedDate = convertToKST(excelSerialDateToJSDate(Number(row[idx])));
            convertedData[idx] = convertedDate.date;
        }
    });

    return {
        timestamp: timestamp,
        date: date,
        time: time,
        lat: parseFloat(row[latIndex]),
        lng: parseFloat(row[lngIndex]),
        rawData: row,
        convertedData: convertedData,
        headers: headers,
        rowIndex: index + 2
    };
}

// 그룹 키 생성 공통 함수
function createGroupKey(row, groupIndices, groupColumns) {
    return groupColumns.map((col, i) => {
        let value = row[groupIndices[i]] || 'Unknown';

        // Date 컬럼인 경우 정수형을 날짜로 변환
        if (col && col.toLowerCase().includes('date')) {
            if (!isNaN(value) && Number(value) > 40000) {
                const convertedDate = convertToKST(excelSerialDateToJSDate(Number(value)));
                value = convertedDate.date;
            }
        }
        // Time 컬럼인 경우 정수형을 시간으로 변환
        else if (col && col.toLowerCase().includes('time')) {
            if (!isNaN(value) && Number(value) > 0) {
                const convertedTime = convertToKST(excelSerialDateToJSDate(Number(value)));
                value = convertedTime.time;
            }
        }
        return value;
    }).join('|');
}

// 파일 선택 핸들러
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById('status').textContent = '파일 처리 중...';
    const reader = new FileReader();

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        reader.onload = function (e) {
            try {
                const parsedData = DataParser.parseXlsxData(e.target.result);
                processLoadedData(parsedData);
            } catch (error) {
                document.getElementById('status').textContent = error.message;
            }
        };
        reader.readAsArrayBuffer(file);
    } else {
        reader.onload = async (e) => {
            try {
                const parsedData = await DataParser.parseCsvData(e.target.result);
                processLoadedData(parsedData);
            } catch (error) {
                document.getElementById('status').textContent = error.message;
            }
        };
        reader.readAsText(file, 'UTF-8');
    }
}

// URL 로드 핸들러
function handleUrlLoad() {
    const url = document.getElementById('sheetUrl').value;
    if (!url) return alert('구글 스프레드시트 URL을 입력해주세요.');

    const match = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) return alert('유효한 구글 스프레드시트 URL이 아닙니다.');

    const sheetId = match[1];
    const gidMatch = url.match(/[#&]gid=([0-9]+)/);
    const gid = gidMatch ? gidMatch[1] : '0';

    const originalUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx&gid=${gid}`;
    const xlsxUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(originalUrl)}`;

    document.getElementById('status').textContent = 'URL에서 XLSX 데이터 로드 중...';

    DataParser.parseUrlData(xlsxUrl)
        .then(parsedData => {
            processLoadedData(parsedData);
        })
        .catch(error => {
            console.error('URL 로드 오류:', error);
            document.getElementById('status').textContent = 'URL 로드 오류';
            alert('데이터를 불러올 수 없습니다. URL과 시트 공유 설정을 확인해주세요.');
        });
}

// 공통 데이터 처리 함수들
function validateRequiredColumns(headers, sheetName) {
    const tsIndex = findColumnIndex(headers, ['tslocal', 'timestamp', 'datetime']);
    const dateIndex = findColumnIndex(headers, ['date', 'day', '날짜']);
    const timeIndex = findColumnIndex(headers, ['time', '시간']);
    const latIndex = findColumnIndex(headers, ['lat', 'latitude', '위도']);
    const lngIndex = findColumnIndex(headers, ['lng', 'longitude', '경도']);

    const hasTimestamp = tsIndex !== -1 || (dateIndex !== -1 && timeIndex !== -1);

    if (!hasTimestamp || latIndex === -1 || lngIndex === -1) {
        const errorMsg = `필수 컬럼(시간, 위도, 경도)을 찾을 수 없습니다. [ts_local/timestamp/datetime] 또는 [date/날짜]와 [time/시간] 조합, 그리고 [lat/latitude/위도], [lng/longitude/경도] 중 하나를 포함해야 합니다.`;
        console.error(`Could not find required columns in sheet: ${sheetName}`);
        return { valid: false, error: errorMsg };
    }

    return {
        valid: true,
        tsIndex,
        dateIndex,
        timeIndex,
        latIndex,
        lngIndex
    };
}

function processSheetData(sheetData, columnIndices, sheetName) {
    const headers = sheetData[0];
    const { tsIndex, dateIndex, timeIndex, latIndex, lngIndex } = columnIndices;

    return sheetData.slice(1)
        .map((row, index) => {
            let date = row[dateIndex];
            let time = row[timeIndex];

            if (typeof date === 'number') {
                const kst = convertToKST(excelSerialDateToJSDate(date));
                date = kst.date;
            }
            if (typeof time === 'number') {
                const kst = convertToKST(excelSerialDateToJSDate(time));
                time = kst.time;
            }

            const timestamp = tsIndex !== -1 ? row[tsIndex] : `${date} ${time}`;

            // 변환된 데이터를 저장할 배열 생성
            const convertedData = [...row];

            // Date 컬럼들을 변환하여 저장
            headers.forEach((header, idx) => {
                if (header && header.toLowerCase().includes('date') && !isNaN(row[idx]) && Number(row[idx]) > 40000) {
                    const convertedDate = convertToKST(excelSerialDateToJSDate(Number(row[idx])));
                    convertedData[idx] = convertedDate.date;
                }
            });

            // 변환된 date와 time 값을 convertedData에 저장
            convertedData[dateIndex] = date;
            convertedData[timeIndex] = time;

            return {
                timestamp: timestamp,
                date: date,
                time: time,
                lat: parseFloat(row[latIndex]),
                lng: parseFloat(row[lngIndex]),
                rawData: row,
                convertedData: convertedData,
                headers: headers,
                rowIndex: index + 2,
                sheetName: sheetName
            };
        })
        .filter(loc => !isNaN(loc.lat) && !isNaN(loc.lng) && loc.timestamp)
        .sort((a, b) => {
            if (tsIndex !== -1) {
                return new Date(a.timestamp) - new Date(b.timestamp);
            }
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            if (dateA > dateB) return 1;
            if (dateA < dateB) return -1;
            return String(a.time).localeCompare(String(b.time));
        });
}

function drawMapLayers(locations, groupName, color, isGroupMode = false) {
    if (locations.length === 0) return;

    console.log('locations:', locations.slice(0, 10));

    const layerGroup = [];
    const pathLayerGroup = [];
    const layerKey = isGroupMode ? 'groupedMarkers' : groupName;
    const pathKey = isGroupMode ? 'groupedPaths' : groupName;

    mapLayers[layerKey] = layerGroup;
    pathLayers[pathKey] = pathLayerGroup;

    const mapApi = getMapApi();

    // 1. Draw markers first
    locations.forEach((location) => {
        const marker = mapApi.createMarker(location, color, groupName);
        if (isGroupMode) {
            marker.locationData = location;
        }
        layerGroup.push(marker);
    });
    mapApi.addLayers(layerGroup);

    // 2. Draw paths
    const drawPaths = () => {
        if (locations.length > 1 && showPaths) {
            const path = mapApi.createPath(locations, color);
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
    if (!isGroupMode && Object.keys(allData).filter(k => selectedSheets.has(k)).length === 1) {
        mapApi.fitBounds(locations);
    }

    return { layerGroup, pathLayerGroup };
} 