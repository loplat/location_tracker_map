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
            const pathCoords = locations.map(loc => [loc.lat, loc.lng]);
            const polyline = L.polyline(pathCoords, { color: color, weight: 4, opacity: 0.8 });
            const layers = [polyline];

            // 경로 세그먼트에 대한 호버 이벤트 추가
            for (let i = 0; i < locations.length - 1; i++) {
                const start = locations[i];
                const end = locations[i + 1];
                const segmentCoords = [[start.lat, start.lng], [end.lat, end.lng]];
                const segment = L.polyline(segmentCoords, { color: color, weight: 8, opacity: 0 });

                const pathInfo = calculatePathInfo(start, end);
                segment.on('mouseover', function (e) {
                    clearPopup();
                    const popupContent = createPathPopupContent(pathInfo);
                    currentPopup = L.popup({ closeButton: false, className: 'info-popup' })
                        .setLatLng(e.latlng)
                        .setContent(popupContent)
                        .openOn(map);
                });
                segment.on('mouseout', clearPopup);
                layers.push(segment);
            }

            const decorator = L.polylineDecorator(polyline, {
                patterns: [{
                    offset: 25,
                    repeat: 100,
                    symbol: L.Symbol.arrowHead({
                        pixelSize: 12,
                        polygon: false,
                        pathOptions: { stroke: true, weight: 2, color: color }
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
            const pathCoords = locations.map(loc => new naver.maps.LatLng(loc.lat, loc.lng));
            const polyline = new naver.maps.Polyline({
                map: naverMap,
                path: pathCoords,
                strokeColor: color,
                strokeWeight: 4,
                strokeOpacity: 0.8
            });

            naver.maps.Event.addListener(polyline, 'mousemove', (e) => {
                clearPopup();
                const popupContent = `<div class="info-popup" style="padding:10px;"><h4>🛣️ 경로 정보</h4><div>경로 위에 마우스를 올렸습니다.</div></div>`;
                currentPopup = new naver.maps.InfoWindow({
                    content: popupContent,
                    position: e.coord,
                    borderWidth: 0,
                    backgroundColor: 'transparent',
                    disableAnchor: true,
                });
                currentPopup.open(naverMap);
            });
            naver.maps.Event.addListener(polyline, 'mouseout', () => {
                clearPopup();
            });

            return [polyline];
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
        const value = location.convertedData ? location.convertedData[idx] : location.rawData[idx];
        return (value && value.toString().trim()) ?
            `<div class="detail-row"><span class="label">${header}:</span><span class="value">${value}</span></div>` : '';
    }).join('');
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

// 지도 API 어댑터 (리팩토링됨)
function getMapApi() {
    if (mapProvider === 'osm') {
        return MapApiFactory.createLeafletApi(map);
    } else {
        return MapApiFactory.createNaverApi(naverMap);
    }
}
