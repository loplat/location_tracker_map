// 색상을 어둡게 만드는 헬퍼 함수
function darkenColor(hex, percent) {
    if (!hex || typeof hex !== 'string') return '#000000';
    hex = hex.replace('#', '');

    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    r = parseInt(r * (100 - percent) / 100);
    g = parseInt(g * (100 - percent) / 100);
    b = parseInt(b * (100 - percent) / 100);

    r = (r < 0) ? 0 : r;
    g = (g < 0) ? 0 : g;
    b = (b < 0) ? 0 : b;

    const rr = ((r.toString(16).length === 1) ? '0' + r.toString(16) : r.toString(16));
    const gg = ((g.toString(16).length === 1) ? '0' + g.toString(16) : g.toString(16));
    const bb = ((b.toString(16).length === 1) ? '0' + b.toString(16) : b.toString(16));

    return `#${rr}${gg}${bb}`;
}

// 지도 API 공통 인터페이스
const MapApiFactory = {
    createLeafletApi: (map) => ({
        createMarker: (location, color, groupName) => {
            const marker = L.circleMarker([location.lat, location.lng], {
                radius: 8,
                fillColor: color,
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            });
            marker.on('mouseover', function (e) {
                L.DomEvent.stopPropagation(e);
                clearPopup();
                const popupContent = createPopupContent(location, groupName);
                currentPopup = L.popup({ closeButton: false, className: 'info-popup' })
                    .setLatLng(e.latlng)
                    .setContent(popupContent)
                    .openOn(map);
            });
            marker.on('mouseout', clearPopup);
            return marker;
        },
        createPath: (locations, color) => {
            const layers = [];
            const numSegments = locations.length - 1;
            if (numSegments < 1) return [];

            // 경로를 시간 순으로 어두워지게 표시
            for (let i = 0; i < numSegments; i++) {
                const start = locations[i];
                const end = locations[i + 1];
                const segmentCoords = [[start.lat, start.lng], [end.lat, end.lng]];
                
                const darknessPercent = (i / numSegments) * 60; // 최대 60%까지 어둡게
                const segmentColor = darkenColor(color, darknessPercent);

                const segment = L.polyline(segmentCoords, { color: segmentColor, weight: 4, opacity: 0.8 });
                layers.push(segment);

                // 호버 이벤트를 위한 보이지 않는 두꺼운 선
                const hoverSegment = L.polyline(segmentCoords, { color: segmentColor, weight: 10, opacity: 0 });
                const pathInfo = calculatePathInfo(start, end);
                hoverSegment.on('mouseover', function (e) {
                    clearPopup();
                    const popupContent = createPathPopupContent(pathInfo);
                    currentPopup = L.popup({ closeButton: false, className: 'info-popup' })
                        .setLatLng(e.latlng)
                        .setContent(popupContent)
                        .openOn(map);
                });
                hoverSegment.on('mouseout', clearPopup);
                layers.push(hoverSegment);
            }

            // 경로 방향을 나타내는 화살표 데코레이터
            const pathCoords = locations.map(loc => [loc.lat, loc.lng]);
            const decorator = L.polylineDecorator(pathCoords, {
                patterns: [{
                    offset: 25,
                    repeat: 100,
                    symbol: L.Symbol.arrowHead({
                        pixelSize: 12,
                        polygon: false,
                        pathOptions: { stroke: true, weight: 2, color: color } // 화살표는 기본 색상 유지
                    })
                }]
            });

            layers.push(decorator);
            return layers;
        },
        addLayers: (layers) => layers.forEach(layer => layer.addTo(map)),
        removeLayers: (layers) => layers.forEach(layer => map.removeLayer(layer)),
        clearAllLayers: () => {
            Object.values(mapLayers).flat().forEach(layer => map.removeLayer(layer));
            Object.values(pathLayers).flat().forEach(layer => map.removeLayer(layer));
        },
        drawGeofences: (geofences) => {
            const layers = geofences.map(geofence => {
                if (geofence.type === 'polygon') {
                    return L.polygon(geofence.coords, {
                        color: '#FF4136',
                        fillColor: '#FF4136',
                        fillOpacity: 0.2
                    });
                } else { // 'circle'
                    return L.circle([geofence.lat, geofence.lng], {
                        radius: geofence.radius,
                        color: '#FF4136',
                        fillColor: '#FF4136',
                        fillOpacity: 0.2
                    });
                }
            });
            layers.forEach(layer => layer.addTo(map));
            return layers;
        },
        clearGeofenceLayers: () => {
            if (geofenceLayers && geofenceLayers.length > 0) {
                geofenceLayers.forEach(layer => map.removeLayer(layer));
            }
            geofenceLayers = [];
        },
        fitBounds: (locations) => {
            const group = new L.featureGroup(locations.map(loc => L.marker([loc.lat, loc.lng])));
            map.fitBounds(group.getBounds().pad(0.1));
        },
        getBounds: (locations) => {
            if (locations.length === 0) return null;
            const group = new L.featureGroup(locations.map(loc => L.marker([loc.lat, loc.lng])));
            return group.getBounds();
        }
    }),

    createNaverApi: (naverMap) => ({
        createMarker: (location, color, groupName) => {
            const marker = new naver.maps.Marker({
                position: new naver.maps.LatLng(location.lat, location.lng),
                map: naverMap,
                icon: {
                    content: `<div style="background-color:${color}; width:16px; height:16px; border-radius:50%; border: 2px solid white;"></div>`,
                    anchor: new naver.maps.Point(8, 8)
                }
            });

            const popupContent = createPopupContent(location, groupName);
            const infoWindow = new naver.maps.InfoWindow({
                content: popupContent,
                borderWidth: 0,
                backgroundColor: 'transparent',
                disableAnchor: true,
                pixelOffset: new naver.maps.Point(0, -20)
            });

            naver.maps.Event.addListener(marker, 'mouseover', () => {
                clearPopup();
                infoWindow.open(naverMap, marker);
                currentPopup = infoWindow;
            });
            naver.maps.Event.addListener(marker, 'mouseout', () => {
                clearPopup();
            });

            return marker;
        },
        createPath: (locations, color) => {
            const layers = [];
            const numSegments = locations.length - 1;
            if (numSegments < 1) return [];

            // 경로를 시간 순으로 어두워지게 표시
            for (let i = 0; i < numSegments; i++) {
                const start = locations[i];
                const end = locations[i + 1];
                const segmentCoords = [
                    new naver.maps.LatLng(start.lat, start.lng),
                    new naver.maps.LatLng(end.lat, end.lng)
                ];
                
                const darknessPercent = (i / numSegments) * 60; // 최대 60%까지 어둡게
                const segmentColor = darkenColor(color, darknessPercent);

                const segment = new naver.maps.Polyline({
                    map: naverMap,
                    path: segmentCoords,
                    strokeColor: segmentColor,
                    strokeWeight: 4,
                    strokeOpacity: 0.8
                });
                
                const pathInfo = calculatePathInfo(start, end);
                naver.maps.Event.addListener(segment, 'mousemove', (e) => {
                    clearPopup();
                    const popupContent = createPathPopupContent(pathInfo);
                    currentPopup = new naver.maps.InfoWindow({
                        content: popupContent,
                        position: e.coord,
                        borderWidth: 0,
                        backgroundColor: 'transparent',
                        disableAnchor: true,
                    });
                    currentPopup.open(naverMap);
                });
                naver.maps.Event.addListener(segment, 'mouseout', () => {
                    clearPopup();
                });

                layers.push(segment);
            }
            return layers;
        },
        addLayers: (layers) => layers.forEach(layer => layer.setMap(naverMap)),
        removeLayers: (layers) => layers.forEach(layer => layer.setMap(null)),
        clearAllLayers: () => {
            Object.values(mapLayers).forEach(layerArray => layerArray.forEach(layer => layer.setMap(null)));
            Object.values(pathLayers).forEach(layerArray => layerArray.forEach(layer => layer.setMap(null)));
        },
        drawGeofences: (geofences) => {
            const layers = geofences.map(geofence => {
                if (geofence.type === 'polygon') {
                    const paths = geofence.coords.map(coord => new naver.maps.LatLng(coord[0], coord[1]));
                    return new naver.maps.Polygon({
                        map: naverMap,
                        paths: [paths],
                        strokeColor: '#FF4136',
                        fillColor: '#FF4136',
                        fillOpacity: 0.2
                    });
                } else { // 'circle'
                    return new naver.maps.Circle({
                        map: naverMap,
                        center: new naver.maps.LatLng(geofence.lat, geofence.lng),
                        radius: geofence.radius,
                        strokeColor: '#FF4136',
                        fillColor: '#FF4136',
                        fillOpacity: 0.2
                    });
                }
            });
            return layers;
        },
        clearGeofenceLayers: () => {
            if (geofenceLayers && geofenceLayers.length > 0) {
                geofenceLayers.forEach(layer => layer.setMap(null));
            }
            geofenceLayers = [];
        },
        fitBounds: (locations) => {
            const bounds = new naver.maps.LatLngBounds(
                new naver.maps.LatLng(locations[0].lat, locations[0].lng),
                new naver.maps.LatLng(locations[0].lat, locations[0].lng)
            );
            locations.forEach(loc => bounds.extend(new naver.maps.LatLng(loc.lat, loc.lng)));
            naverMap.fitBounds(bounds);
        },
        getBounds: (locations) => {
            if (locations.length === 0) return null;
            const bounds = new naver.maps.LatLngBounds(
                new naver.maps.LatLng(locations[0].lat, locations[0].lng),
                new naver.maps.LatLng(locations[0].lat, locations[0].lng)
            );
            locations.forEach(loc => bounds.extend(new naver.maps.LatLng(loc.lat, loc.lng)));
            return bounds;
        }
    })
};

// 팝업 내용 생성 공통 함수
function createPopupContent(location, groupName) {
    const detailsHtml = location.headers.map((header, idx) => {
        let value = location.convertedData ? location.convertedData[idx] : location.rawData[idx];
        if (value && value.toString().length > 100) {
            value = value.toString().substring(0, 100) + '...';
        }
        return (value && value.toString().trim()) ?
            `<div class="detail-row"><span class="label">${header}:</span><span class="value">${value}</span></div>` : '';
    }).join('');

    if (groupName && groupName.length > 100) {
        groupName = groupName.substring(0, 100) + '...';
    }

    return `<div class="info-popup"><h4>📍 위치 정보 (Row ${location.rowIndex})</h4>${detailsHtml}<div class="detail-row"><span class="label">그룹:</span><span class="value">${groupName}</span></div></div>`;
}

// 경로 정보 팝업 내용 생성
function createPathPopupContent(pathInfo) {
    return `<div class="info-popup"><h4>🛣️ 경로 정보</h4>
        <div class="detail-row"><span class="label">거리:</span><span class="value">${pathInfo.distance.toFixed(2)} km</span></div>
        <div class="detail-row"><span class="label">시간:</span><span class="value">${pathInfo.timeDiff}</span></div>
        <div class="detail-row"><span class="label">속도:</span><span class="value">${pathInfo.speed} km/h</span></div>
    </div>`;
}

// 경로 정보 계산 공통 함수
function calculatePathInfo(start, end) {
    const distance = calculateDistance(start.lat, start.lng, end.lat, end.lng);
    const timeDiffMinutes = calculateTimeDiff(start.timestamp, end.timestamp, true);
    const timeDiffFormatted = calculateTimeDiff(start.timestamp, end.timestamp);
    const speed = (timeDiffMinutes > 0) ? (distance / (timeDiffMinutes / 60)).toFixed(1) : 'N/A';

    return { distance, timeDiff: timeDiffFormatted, speed };
}

// 임시 마커 관리
let tempMarker = null;

// 임시 마커 생성/삭제 기능 추가
const TempMarkerManager = {
    createTempMarker: (lat, lng) => {
        const mapApi = getMapApi();
        
        // 기존 임시 마커 제거
        if (tempMarker) {
            TempMarkerManager.removeTempMarker();
        }
        
        const location = { lat: parseFloat(lat), lng: parseFloat(lng) };
        const color = '#FF0000'; // 빨간색으로 구분
        
        if (mapProvider === 'osm') {
            tempMarker = L.circleMarker([location.lat, location.lng], {
                radius: 12,
                fillColor: color,
                color: '#fff',
                weight: 3,
                opacity: 1,
                fillOpacity: 0.9
            });
            
            const popupContent = `<div class="info-popup"><h4>📍 임시 마커</h4>
                <div class="detail-row"><span class="label">위도:</span><span class="value">${lat}</span></div>
                <div class="detail-row"><span class="label">경도:</span><span class="value">${lng}</span></div>
            </div>`;
            
            tempMarker.bindPopup(popupContent);
            tempMarker.addTo(map);
        } else {
            tempMarker = new naver.maps.Marker({
                position: new naver.maps.LatLng(location.lat, location.lng),
                map: naverMap,
                icon: {
                    content: `<div style="background-color:${color}; width:24px; height:24px; border-radius:50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
                    anchor: new naver.maps.Point(12, 12)
                }
            });
            
            const popupContent = `<div class="info-popup"><h4>📍 임시 마커</h4>
                <div class="detail-row"><span class="label">위도:</span><span class="value">${lat}</span></div>
                <div class="detail-row"><span class="label">경도:</span><span class="value">${lng}</span></div>
            </div>`;
            
            const infoWindow = new naver.maps.InfoWindow({
                content: popupContent,
                borderWidth: 0,
                backgroundColor: 'transparent',
                disableAnchor: true,
                pixelOffset: new naver.maps.Point(0, -20)
            });
            
            naver.maps.Event.addListener(tempMarker, 'click', () => {
                infoWindow.open(naverMap, tempMarker);
            });
        }
        
        // 임시 마커로 지도 중심 이동
        if (mapProvider === 'osm') {
            map.setView([location.lat, location.lng], map.getZoom());
        } else {
            naverMap.setCenter(new naver.maps.LatLng(location.lat, location.lng));
        }
        
        return tempMarker;
    },
    
    removeTempMarker: () => {
        if (tempMarker) {
            if (mapProvider === 'osm') {
                map.removeLayer(tempMarker);
            } else {
                tempMarker.setMap(null);
            }
            tempMarker = null;
        }
    },
    
    hasTempMarker: () => {
        return tempMarker !== null;
    }
};

// 지도 API 어댑터 (리팩토링됨)
function getMapApi() {
    if (mapProvider === 'osm') {
        return MapApiFactory.createLeafletApi(map);
    } else {
        return MapApiFactory.createNaverApi(naverMap);
    }
}
