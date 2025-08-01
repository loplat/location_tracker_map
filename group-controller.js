// 그룹 컨트롤 관련 함수들

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

function createGroupControls(hierarchicalData) {
    const groupControlsDiv = document.getElementById('groupControls');

    // 기존 details 요소들의 열림/닫힘 상태를 저장
    const existingStates = {};
    if (groupControlsDiv.children.length > 0) {
        const existingDetails = groupControlsDiv.querySelectorAll('details');
        existingDetails.forEach(details => {
            const summary = details.querySelector('summary');
            if (summary) {
                const label = summary.querySelector('.group-label');
                if (label) {
                    const key = label.textContent.split(' (')[0]; // 그룹명만 추출
                    existingStates[key] = details.open;
                }
            }
        });
    }

    groupControlsDiv.innerHTML = '';
    groupControlsDiv.className = 'group-controls group-tree';

    if (Object.keys(hierarchicalData).length === 0) {
        groupControlsDiv.textContent = '표시할 그룹이 없습니다. 시트를 선택하거나 그룹 기준을 설정해주세요.';
        return;
    }

    // 재귀적으로 건수를 계산하는 함수
    function calculateCount(data) {
        console.log('=== calculateCount 호출 ===');
        console.log('data:', data);
        console.log('Array.isArray(data):', Array.isArray(data));

        if (Array.isArray(data)) {
            const result = data.length;
            console.log('배열이므로 결과:', result);
            return result;
        } else {
            let total = 0;
            Object.values(data).forEach(value => {
                total += calculateCount(value);
            });
            console.log('객체이므로 결과:', total);
            return total;
        }
    }

    // 자식이 선택되지 않은 부모를 확인하는 함수
    function hasSelectedChildren(data, level = 0) {
        console.log('=== hasSelectedChildren 호출 ===');
        console.log('data:', data);
        console.log('level:', level);
        console.log('Array.isArray(data):', Array.isArray(data));

        if (Array.isArray(data)) {
            const result = data.length > 0;
            console.log('배열이므로 결과:', result);
            return result;
        } else {
            const result = Object.values(data).some(value => hasSelectedChildren(value, level + 1));
            console.log('객체이므로 결과:', result);
            return result;
        }
    }

    // 부모 그룹 자동 접기/체크 함수 (특정 부모 그룹만 처리)
    function updateParentGroupState(parentDetails) {
        console.log('=== updateParentGroupState 시작 ===');
        console.log('parentDetails:', parentDetails);

        if (!parentDetails) {
            console.log('parentDetails가 null이므로 종료');
            return;
        }

        // 부모 체크박스는 제외하고 직접적인 자식 체크박스만 선택
        const parentCheckbox = parentDetails.querySelector('summary input[type="checkbox"]');
        const allChildCheckboxes = parentDetails.querySelectorAll('details > summary input[type="checkbox"]');
        // 부모 체크박스를 제외한 직접적인 자식 체크박스만 필터링
        const childCheckboxes = Array.from(allChildCheckboxes).filter(checkbox =>
            checkbox !== parentCheckbox &&
            checkbox.closest('details').parentElement === parentDetails
        );

        console.log('childCheckboxes 개수:', childCheckboxes.length);
        console.log('parentCheckbox:', parentCheckbox);

        if (!parentCheckbox || childCheckboxes.length === 0) {
            console.log('parentCheckbox가 없거나 childCheckboxes가 없으므로 종료');
            return;
        }

        const checkedChildren = Array.from(childCheckboxes).filter(checkbox => checkbox.checked);
        const totalChildren = childCheckboxes.length;

        console.log('checkedChildren 개수:', checkedChildren.length);
        console.log('totalChildren:', totalChildren);
        console.log('parentCheckbox 현재 상태:', parentCheckbox.checked);
        console.log('parentCheckbox dataset.key:', parentCheckbox.dataset.key);

        // 모든 자식이 선택되었는지 확인
        const allChildrenSelected = checkedChildren.length === totalChildren;
        // 선택된 자식이 있는지 확인
        const hasSelectedChildren = checkedChildren.length > 0;

        console.log('allChildrenSelected:', allChildrenSelected);
        console.log('hasSelectedChildren:', hasSelectedChildren);

        if (allChildrenSelected) {
            console.log('모든 자식이 선택됨 - 부모도 선택');
            // 모든 자식이 선택되면 부모도 선택
            if (!parentCheckbox.checked) {
                console.log('부모 체크박스를 체크로 변경');
                parentCheckbox.checked = true;
                selectedGroups.add(parentCheckbox.dataset.key);
                console.log('selectedGroups에 추가됨:', parentCheckbox.dataset.key);
            } else {
                console.log('부모가 이미 체크되어 있음');
            }
        } else if (!hasSelectedChildren) {
            console.log('선택된 자식이 없음 - 부모 체크 해제 및 접기');
            // 선택된 자식이 없으면 부모 체크 해제 및 접기
            if (parentCheckbox.checked) {
                console.log('부모 체크박스를 체크 해제로 변경');
                parentCheckbox.checked = false;
                selectedGroups.delete(parentCheckbox.dataset.key);
                console.log('selectedGroups에서 제거됨:', parentCheckbox.dataset.key);
            } else {
                console.log('부모가 이미 체크 해제되어 있음');
            }
            console.log('부모 그룹을 접음 (open = false)');
            forceCollapseDetails(parentDetails);
        } else {
            console.log('일부 자식만 선택됨 - 상태 변경 없음');
        }

        console.log('=== updateParentGroupState 종료 ===');
    }

    // 강제로 details 요소를 접는 함수
    function forceCollapseDetails(detailsElement) {
        if (!detailsElement) return;

        console.log('forceCollapseDetails 호출됨, 현재 details.open:', detailsElement.open);

        // 즉시 접기 시도
        detailsElement.open = false;
        console.log('즉시 접기 후 details.open:', detailsElement.open);

        // CSS를 통한 강제 접기
        detailsElement.style.setProperty('--force-collapse', 'none');
        detailsElement.style.setProperty('display', 'block');

        // 지연을 두어 다른 작업이 완료된 후 다시 접기 시도
        setTimeout(() => {
            detailsElement.open = false;
            console.log('지연 접기 후 details.open:', detailsElement.open);
        }, 50);

        // 추가 지연으로 한 번 더 시도
        setTimeout(() => {
            detailsElement.open = false;
            console.log('최종 접기 후 details.open:', detailsElement.open);
        }, 150);

        // 더 긴 지연으로 한 번 더 시도
        setTimeout(() => {
            detailsElement.open = false;
            console.log('최종 최종 접기 후 details.open:', detailsElement.open);
        }, 500);
    }

    // 전체 부모 그룹 상태 업데이트 함수
    function updateAllParentGroups() {
        const allDetails = groupControlsDiv.querySelectorAll('details');
        allDetails.forEach(details => {
            updateParentGroupState(details);
        });
    }

    // 그룹 깜빡이기 함수
    function blinkGroup(groupKey) {
        const mapApi = getMapApi();

        // 현재 표시된 마커들에서 해당 그룹의 위치 찾기
        const groupLocations = [];

        // mapLayers['groupedMarkers']에서 해당 그룹의 마커들 찾기
        if (mapLayers['groupedMarkers']) {
            mapLayers['groupedMarkers'].forEach((marker) => {
                // 마커에 저장된 위치 데이터 사용
                if (marker.locationData && marker.locationData.group === groupKey) {
                    groupLocations.push(marker.locationData);
                }
            });
        }

        if (groupLocations.length === 0) return;

        // 깜빡이기 효과를 위한 임시 스타일
        const blinkStyle = {
            opacity: 0.3,
            weight: 5,
            color: '#ff0000'
        };

        // 마커와 경로에 깜빡이기 효과 적용
        const blinkElements = [];

        // 마커 깜빡이기
        groupLocations.forEach(loc => {
            if (!isNaN(loc.lat) && !isNaN(loc.lng)) {
                const marker = mapApi.createMarker(loc, '#ff0000', groupKey);
                // Leaflet의 경우 setStyle 메서드 사용
                if (mapProvider === 'osm' && marker.setStyle) {
                    marker.setStyle(blinkStyle);
                }
                blinkElements.push(marker);
            }
        });

        // 경로 깜빡이기
        if (groupLocations.length > 1) {
            // 시간순으로 정렬
            const sortedLocs = sortLocationsByTime(groupLocations);

            for (let i = 0; i < sortedLocs.length - 1; i++) {
                const start = sortedLocs[i];
                const end = sortedLocs[i + 1];
                if (!isNaN(start.lat) && !isNaN(start.lng) && !isNaN(end.lat) && !isNaN(end.lng)) {
                    const path = mapApi.createPath([start, end], '#ff0000');
                    // Leaflet의 경우 setStyle 메서드 사용
                    if (mapProvider === 'osm') {
                        path.forEach(p => {
                            if (p.setStyle) p.setStyle(blinkStyle);
                        });
                    }
                    blinkElements.push(...path);
                }
            }
        }

        // 깜빡이기 요소들을 지도에 추가
        mapApi.addLayers(blinkElements);

        // 1초 후 깜빡이기 효과 제거
        setTimeout(() => {
            mapApi.removeLayers(blinkElements);
        }, 1000);

        // 그룹이 화면 밖에 있으면 포커스 이동
        if (groupLocations.length > 0) {
            mapApi.fitBounds(groupLocations);
        }
    }

    const buildGroupTree = (data, parentElement, level = 0, parentKey = '') => {
        console.log('=== buildGroupTree 호출 ===');
        console.log('data:', data);
        console.log('parentElement:', parentElement);
        console.log('level:', level);
        console.log('parentKey:', parentKey);

        Object.entries(data).forEach(([key, value]) => {
            const currentFullKey = parentKey ? `${parentKey}|${key}` : key;
            const count = calculateCount(value);
            const hasChildren = !Array.isArray(value);
            const shouldCollapse = hasChildren && !hasSelectedChildren(value);

            console.log('key:', key);
            console.log('currentFullKey:', currentFullKey);
            console.log('count:', count);
            console.log('hasChildren:', hasChildren);
            console.log('shouldCollapse:', shouldCollapse);

            const details = document.createElement('details');
            details.className = 'group-tree';

            // 기존 상태가 있으면 적용, 없으면 자동 접기 로직 사용
            if (existingStates.hasOwnProperty(key)) {
                details.open = existingStates[key];
                console.log(`기존 상태 적용: ${key} = ${existingStates[key]}`);
            } else {
                details.open = !shouldCollapse; // 자식이 선택되지 않은 부모는 접기
                console.log(`자동 접기 로직 적용: ${key} = ${!shouldCollapse}`);
            }

            details.style.marginLeft = `${level * 15}px`;

            const summary = document.createElement('summary');
            summary.style.display = 'flex';
            summary.style.alignItems = 'center';
            summary.style.gap = '8px';
            summary.style.cursor = 'pointer';

            // 화살표 아이콘 추가
            const arrow = document.createElement('span');
            arrow.className = 'group-arrow';
            arrow.innerHTML = '▶';

            // details 상태에 따라 화살표 회전
            details.addEventListener('toggle', () => {
                arrow.style.transform = details.open ? 'rotate(90deg)' : 'rotate(0deg)';
            });

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `group-checkbox-${currentFullKey.replace(/[^a-zA-Z0-9]/g, '-')}`;
            checkbox.checked = selectedGroups.has(currentFullKey);
            checkbox.dataset.key = currentFullKey;

            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                const isChecked = e.target.checked;
                const key = e.target.dataset.key;

                // 현재 체크박스 상태 변경
                if (isChecked) {
                    selectedGroups.add(key);
                } else {
                    selectedGroups.delete(key);
                }

                // 하위 체크박스들도 동일하게 설정 (직접적인 자식만)
                const allChildCheckboxes = details.querySelectorAll('details > summary input[type="checkbox"]');
                // 현재 체크박스를 제외한 직접적인 자식 체크박스만 필터링
                const childCheckboxes = Array.from(allChildCheckboxes).filter(checkbox =>
                    checkbox !== e.target &&
                    checkbox.closest('details').parentElement === details
                );
                childCheckboxes.forEach(child => {
                    child.checked = isChecked;
                    if (isChecked) {
                        selectedGroups.add(child.dataset.key);
                    } else {
                        selectedGroups.delete(child.dataset.key);
                    }
                });

                // 부모 그룹 상태 업데이트 (직접 부모만)
                console.log('=== 체크박스 변경 이벤트 ===');
                console.log('변경된 체크박스:', checkbox);
                console.log('체크박스 상태:', checkbox.checked);
                console.log('체크박스 dataset.key:', checkbox.dataset.key);

                const parentDetails = details.parentElement.closest('details');
                console.log('찾은 부모 details:', parentDetails);

                if (parentDetails) {
                    console.log('부모 details가 존재하므로 updateParentGroupState 호출');
                    updateParentGroupState(parentDetails);
                } else {
                    console.log('부모 details가 없음');
                }

                // 지도 업데이트 - 전체를 다시 그리지 않고 선택된 그룹만 처리
                console.log('현재 selectedGroups 상태:', Array.from(selectedGroups));
                console.log('체크박스 변경 후 details.open 상태:', details.open);
                if (currentGroupColumns.length > 0) {
                    // 지연을 두어 collapse 작업이 완료된 후 지도 업데이트
                    setTimeout(() => {
                        console.log('updateMapDisplay 호출 전 details.open 상태:', details.open);
                        updateMapDisplay();
                        console.log('updateMapDisplay 호출 후 details.open 상태:', details.open);
                    }, 300); // 더 긴 지연 시간
                }
            });

            const label = document.createElement('span');
            label.className = 'group-label';
            label.textContent = `${key} (${count}건)`;
            label.style.fontWeight = '600';
            label.style.color = getColorForValue(key);

            // 그룹명 클릭 이벤트
            label.addEventListener('click', (e) => {
                e.stopPropagation();
                blinkGroup(currentFullKey);
            });

            summary.append(arrow, checkbox, label);
            details.appendChild(summary);

            if (Array.isArray(value)) { // Leaf node
                // No further nesting
            } else { // Branch node
                buildGroupTree(value, details, level + 1, currentFullKey);
            }
            parentElement.appendChild(details);
        });
    };

    buildGroupTree(hierarchicalData, groupControlsDiv);
}

// 계층적 데이터 구축
function buildHierarchicalData(groupInfo) {
    const hierarchicalData = {};

    Object.entries(groupInfo).forEach(([groupKey, locations]) => {
        const parts = groupKey.split('|');
        let current = hierarchicalData;

        parts.forEach((part, index) => {
            if (!current[part]) {
                current[part] = {
                    count: 0,
                    children: {}
                };
            }
            current[part].count += locations.length;

            if (index < parts.length - 1) {
                current = current[part].children;
            }
        });
    });

    return hierarchicalData;
}

// displayDataAsGroups 함수 (리팩토링됨)
function displayDataAsGroups(groupColumns, sourceData) {
    const mapApi = getMapApi();
    mapApi.clearAllLayers();

    const allLocations = [];
    const hierarchicalData = {};
    const displayKeyToOriginalKey = {};
    let tsIndex = -1;
    const groupIndices = groupColumns.map(() => -1);

    // 1. 선택된 시트의 데이터만 처리
    Object.entries(sourceData).forEach(([sheetName, sheetData]) => {
        if (!selectedSheets.has(sheetName)) {
            console.log(`시트 ${sheetName}는 선택되지 않아 건너뜁니다.`);
            return;
        }

        const headers = sheetData[0];
        const columnValidation = validateRequiredColumns(headers, sheetName);

        if (!columnValidation.valid) {
            console.log(`시트 ${sheetName}에서 필수 컬럼을 찾을 수 없습니다.`);
            return;
        }

        tsIndex = columnValidation.tsIndex;

        groupColumns.forEach((col, i) => {
            groupIndices[i] = headers.findIndex(h => h && h.toString() === col);
        });

        if (groupIndices.some(i => i === -1)) {
            console.log(`시트 ${sheetName}에서 그룹 컬럼을 찾을 수 없습니다.`);
            return;
        }

        const locations = processSheetData(sheetData, columnValidation, sheetName);

        locations.forEach(location => {
            const groupKey = createGroupKey(location.rawData, groupIndices, groupColumns);
            allLocations.push({
                ...location,
                group: groupKey
            });
        });
    });

    // 2. Build hierarchical data and populate initial selections
    const allGroupKeys = new Set();
    allLocations.forEach(loc => {
        let currentLevel = hierarchicalData;
        const keys = loc.group.split('|');
        keys.forEach((key, i) => {
            const displayKey = key;
            const fullKey = keys.slice(0, i + 1).join('|');
            const displayFullKey = keys.slice(0, i).concat([displayKey]).join('|');
            allGroupKeys.add(fullKey);
            displayKeyToOriginalKey[displayFullKey] = fullKey;

            if (i === keys.length - 1) {
                if (!currentLevel[displayKey]) currentLevel[displayKey] = [];
                currentLevel[displayKey].push(loc);
            } else {
                if (!currentLevel[displayKey]) currentLevel[displayKey] = {};
                currentLevel = currentLevel[displayKey];
            }
        });
    });

    if (selectedGroups.size === 0 && allGroupKeys.size > 0) {
        allGroupKeys.forEach(g => selectedGroups.add(g));
    }

    // 3. Filter visible locations
    const visibleLocations = allLocations.filter(loc => selectedGroups.has(loc.group));

    // 4. Draw markers and paths by group
    if (visibleLocations.length > 0) {
        const mapApi = getMapApi();

        // 그룹별로 위치 데이터 분리
        const locationsByGroup = {};
        visibleLocations.forEach(loc => {
            if (!locationsByGroup[loc.group]) {
                locationsByGroup[loc.group] = [];
            }
            locationsByGroup[loc.group].push(loc);
        });

        // 각 그룹별로 마커 그리기
        Object.entries(locationsByGroup).forEach(([groupKey, groupLocations]) => {
            const groupName = groupKey.split('|')[0]; // 첫 번째 그룹명 사용
            const color = getColorForValue(groupName);

            // 그룹 내에서 시간 순서대로 정렬
            const sortedGroupLocations = sortLocationsByTime(groupLocations);

            // 각 그룹별로 마커 그리기
            sortedGroupLocations.forEach(loc => {
                if (isNaN(loc.lat) || isNaN(loc.lng)) return;
                const marker = mapApi.createMarker(loc, color, groupKey);
                marker.locationData = loc;

                if (!mapLayers['groupedMarkers']) {
                    mapLayers['groupedMarkers'] = [];
                }
                mapLayers['groupedMarkers'].push(marker);
            });

            // 각 그룹별로 독립적인 경로 그리기 (시간 순서대로 연결)
            if (showPaths && sortedGroupLocations.length > 1) {
                const pathLayersArr = [];
                for (let i = 0; i < sortedGroupLocations.length - 1; i++) {
                    const start = sortedGroupLocations[i];
                    const end = sortedGroupLocations[i + 1];
                    if (isNaN(start.lat) || isNaN(start.lng) || isNaN(end.lat) || isNaN(end.lng)) continue;
                    pathLayersArr.push(...mapApi.createPath([start, end], color));
                }

                if (!pathLayers['groupedPaths']) {
                    pathLayers['groupedPaths'] = [];
                }
                pathLayers['groupedPaths'].push(...pathLayersArr);
                mapApi.addLayers(pathLayersArr);
            }
        });

        // 마커들을 한 번에 추가
        if (mapLayers['groupedMarkers']) {
            mapApi.addLayers(mapLayers['groupedMarkers']);
        }

        // 5. 연속된 그룹들 간 경로 연결
        if (showPaths && Object.keys(locationsByGroup).length > 1) {
            const groupKeys = Object.keys(locationsByGroup).sort();
            const pathLayersArr = [];

            for (let i = 0; i < groupKeys.length - 1; i++) {
                const currentGroup = groupKeys[i];
                const nextGroup = groupKeys[i + 1];

                // 현재 그룹의 마지막 위치와 다음 그룹의 첫 번째 위치 연결
                const currentLocations = locationsByGroup[currentGroup];
                const nextLocations = locationsByGroup[nextGroup];

                if (currentLocations.length > 0 && nextLocations.length > 0) {
                    // 각 그룹을 시간 순서대로 정렬
                    const sortedCurrentLocations = sortLocationsByTime(currentLocations);
                    const sortedNextLocations = sortLocationsByTime(nextLocations);

                    const lastLocation = sortedCurrentLocations[sortedCurrentLocations.length - 1];
                    const firstLocation = sortedNextLocations[0];

                    if (!isNaN(lastLocation.lat) && !isNaN(lastLocation.lng) &&
                        !isNaN(firstLocation.lat) && !isNaN(firstLocation.lng)) {

                        // 그룹 간 경로는 회색으로 표시
                        const interGroupPath = mapApi.createPath([lastLocation, firstLocation], '#666666');
                        pathLayersArr.push(...interGroupPath);
                    }
                }
            }

            if (pathLayersArr.length > 0) {
                if (!pathLayers['groupedPaths']) {
                    pathLayers['groupedPaths'] = [];
                }
                pathLayers['groupedPaths'].push(...pathLayersArr);
                mapApi.addLayers(pathLayersArr);
            }
        }

        mapApi.fitBounds(visibleLocations);
    }

    createGroupControls(hierarchicalData);
} 