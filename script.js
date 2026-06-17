/**
 * 駅メモ！でんこ管理アプリ - メインスクリプト
 * 
 * 概要: でんこの所持状況とレベル管理を行うWebアプリケーションのメイン機能
 * 主な仕様: JSON データ管理、フィルタ・ソート機能、ローカルストレージでの永続化
 * 制限事項: 静的ファイルのみで動作、単一ユーザー向け
 */

class DenkoManager {
    constructor() {
        // アプリケーションの状態管理
        this.denkoData = { original: [], extra: [] };
        this.userData = { original: {}, extra: {} };
        this.currentTab = 'original';
        this.sortDirection = 'asc';
        this.currentSortBy = 'id';
        
        // DOM要素の参照
        this.initializeDomElements();
        
        // イベントリスナーの設定
        this.setupEventListeners();
        
        // データの初期化
        this.initializeData();
    }

    /**
     * DOM要素の参照を初期化
     */
    initializeDomElements() {
        this.elements = {
            // タブ
            tabButtons: document.querySelectorAll('.tab-button'),
            
            // フィルタ要素
            nameFilter: document.getElementById('name-filter'),
            typeFilter: document.getElementById('type-filter'),
            attributeFilter: document.getElementById('attribute-filter'),
            ownedFilter: document.getElementById('owned-filter'),
            levelMin: document.getElementById('level-min'),
            levelMax: document.getElementById('level-max'),
            classMin: document.getElementById('class-min'),
            classMax: document.getElementById('class-max'),
            
            // ソート要素
            sortBy: document.getElementById('sort-by'),
            sortDirection: document.getElementById('sort-direction'),
            
            // 統計要素
            totalCount: document.getElementById('total-count'),
            ownedCount: document.getElementById('owned-count'),
            notOwnedCount: document.getElementById('not-owned-count'),
            averageLevel: document.getElementById('average-level'),
            averageClass: document.getElementById('average-class'),
            
            // でんこリスト
            denkoList: document.getElementById('denko-list'),
            
            // データ管理
            showGraph: document.getElementById('show-graph'),
            exportData: document.getElementById('export-data'),
            importData: document.getElementById('import-data'),
            importDataBtn: document.getElementById('import-data-btn'),
            
            // グラフモーダル
            graphModal: document.getElementById('graph-modal'),
            graphClose: document.querySelector('#graph-modal .close'),
            graphTypeRadios: document.querySelectorAll('input[name="graph-type"]'),
            levelChart: document.getElementById('level-chart'),
            graphTotalCount: document.getElementById('graph-total-count'),
            graphOwnedCount: document.getElementById('graph-owned-count'),
            graphAverageLevel: document.getElementById('graph-average-level')
        };
    }

    /**
     * イベントリスナーの設定
     */
    setupEventListeners() {
        // タブ切り替え
        this.elements.tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // フィルタイベント
        const filterElements = [
            this.elements.nameFilter,
            this.elements.typeFilter,
            this.elements.attributeFilter,
            this.elements.ownedFilter,
            this.elements.levelMin,
            this.elements.levelMax,
            this.elements.classMin,
            this.elements.classMax
        ];

        filterElements.forEach(element => {
            element.addEventListener('input', () => this.applyFiltersAndSort());
        });

        // ソートイベント
        this.elements.sortBy.addEventListener('change', (e) => {
            this.currentSortBy = e.target.value;
            this.applyFiltersAndSort();
        });

        this.elements.sortDirection.addEventListener('click', () => {
            this.toggleSortDirection();
        });

        // データ管理イベント
        this.elements.showGraph.addEventListener('click', () => this.showGraphModal());
        this.elements.exportData.addEventListener('click', () => this.exportUserData());
        this.elements.importDataBtn.addEventListener('click', () => this.elements.importData.click());
        this.elements.importData.addEventListener('change', (e) => this.importUserData(e));
        
        // グラフモーダルイベント
        this.elements.graphClose.addEventListener('click', () => this.hideGraphModal());
        this.elements.graphModal.addEventListener('click', (e) => {
            if (e.target === this.elements.graphModal) {
                this.hideGraphModal();
            }
        });
        
        // グラフタイプ変更イベント
        this.elements.graphTypeRadios.forEach(radio => {
            radio.addEventListener('change', () => this.updateGraph());
        });
    }

    /**
     * データの初期化
     */
    async initializeData() {
        try {
            await this.loadDenkoData();
            this.loadUserData();
            this.renderDenkoList();
            this.updateStatistics();
        } catch (error) {
            console.error('データの初期化に失敗しました:', error);
            this.showError('データの読み込みに失敗しました。');
        }
    }

    /**
     * でんこマスターデータの読み込み
     */
    async loadDenkoData() {
        try {
            const response = await fetch('./denko_data.json');
            if (!response.ok) {
                throw new Error(`denko_data.jsonの読み込みに失敗しました。HTTPステータス: ${response.status}`);
            }
            
            const data = await response.json();
            
            // データの妥当性チェック
            if (!data || typeof data !== 'object') {
                throw new Error('でんこデータの形式が正しくありません。');
            }
            
            if (!Array.isArray(data.original) || !Array.isArray(data.extra)) {
                throw new Error('でんこデータにoriginalまたはextraの配列が見つかりません。');
            }
            
            this.denkoData = data;
            console.log(`でんこデータを正常に読み込みました。オリジナル: ${data.original.length}体, エクストラ: ${data.extra.length}体`);
            
        } catch (error) {
            console.error('でんこデータの読み込みエラー:', error);
            
            // エラーメッセージをユーザーに表示
            this.showError(`でんこデータの読み込みに失敗しました: ${error.message}`);
            
            // 空のデータ構造で初期化（アプリケーションがクラッシュしないように）
            this.denkoData = {
                original: [],
                extra: []
            };
            
            // エラー状態を示すメッセージを表示
            const denkoList = document.getElementById('denko-list');
            if (denkoList) {
                denkoList.innerHTML = `
                    <div class="error-message" style="
                        text-align: center; 
                        padding: 40px; 
                        background: #fff3cd; 
                        border: 1px solid #ffeaa7; 
                        border-radius: 10px; 
                        color: #856404;
                        margin: 20px 0;
                    ">
                        <h3>⚠️ データ読み込みエラー</h3>
                        <p>denko_data.jsonファイルの読み込みに失敗しました。</p>
                        <p>以下を確認してください：</p>
                        <ul style="text-align: left; display: inline-block;">
                            <li>denko_data.jsonファイルが存在するか</li>
                            <li>ファイルの形式が正しいか</li>
                            <li>HTTPサーバー経由でアクセスしているか</li>
                        </ul>
                        <p><small>詳細なエラー情報はブラウザのコンソールを確認してください。</small></p>
                    </div>
                `;
            }
        }
    }

    /**
     * ユーザーデータの読み込み（ローカルストレージから）
     */
    loadUserData() {
        try {
            const savedData = localStorage.getItem('ekimemo-denko-user-data');
            if (savedData) {
                this.userData = JSON.parse(savedData);
            } else {
                // 初期化
                this.userData = { original: {}, extra: {} };
            }
        } catch (error) {
            console.error('ユーザーデータの読み込みエラー:', error);
            this.userData = { original: {}, extra: {} };
        }
    }

    /**
     * ユーザーデータの自動保存（ローカルストレージに）
     */
    saveUserData() {
        try {
            localStorage.setItem('ekimemo-denko-user-data', JSON.stringify(this.userData));
        } catch (error) {
            console.error('ユーザーデータの保存エラー:', error);
        }
    }

    /**
     * タブの切り替え
     */
    switchTab(tabName) {
        this.currentTab = tabName;
        
        // タブボタンの状態更新
        this.elements.tabButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.tab === tabName);
        });
        
        // リストの再描画
        this.renderDenkoList();
        this.updateStatistics();
    }

    /**
     * ソート方向の切り替え
     */
    toggleSortDirection() {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        this.elements.sortDirection.textContent = this.sortDirection === 'asc' ? '昇順 ↑' : '降順 ↓';
        this.applyFiltersAndSort();
    }

    /**
     * フィルタとソートの適用
     */
    applyFiltersAndSort() {
        this.renderDenkoList();
        this.updateStatistics();
    }

    /**
     * でんこリストの描画
     */
    renderDenkoList() {
        const currentData = this.denkoData[this.currentTab] || [];
        let filteredData = this.applyFilters(currentData);
        filteredData = this.applySorting(filteredData);
        
        this.elements.denkoList.innerHTML = '';
        
        if (filteredData.length === 0) {
            this.elements.denkoList.innerHTML = '<div class="no-results">条件に一致するでんこが見つかりません。</div>';
            return;
        }
        
        filteredData.forEach(denko => {
            const denkoElement = this.createDenkoElement(denko);
            this.elements.denkoList.appendChild(denkoElement);
        });
    }

    /**
     * フィルタの適用
     */
    applyFilters(data) {
        return data.filter(denko => {
            // オリジナルでんこのNo.0「のぞみ」は例外のため除外
            if (this.currentTab === 'original' && denko.id === 0) {
                return false;
            }
            
            const userData = this.getUserData(denko.id);
            
            // 名前フィルタ
            const nameFilter = this.elements.nameFilter.value.toLowerCase();
            if (nameFilter && !denko.name.toLowerCase().includes(nameFilter)) {
                return false;
            }
            
            // タイプフィルタ
            const typeFilter = this.elements.typeFilter.value;
            if (typeFilter && denko.type !== typeFilter) {
                return false;
            }
            
            // 属性フィルタ
            const attributeFilter = this.elements.attributeFilter.value;
            if (attributeFilter && denko.attribute !== attributeFilter) {
                return false;
            }
            
            // 所持状況フィルタ
            const ownedFilter = this.elements.ownedFilter.value;
            if (ownedFilter === 'owned' && !userData.owned) {
                return false;
            }
            if (ownedFilter === 'not-owned' && userData.owned) {
                return false;
            }
            
            // レベル範囲フィルタ
            const levelMin = parseInt(this.elements.levelMin.value) || 1;
            const levelMax = parseInt(this.elements.levelMax.value) || 80;
            const currentLevel = userData.level || 1;
            
            if (userData.owned && (currentLevel < levelMin || currentLevel > levelMax)) {
                return false;
            }
            
            // クラス範囲フィルタ
            const classMin = parseInt(this.elements.classMin.value) || 1;
            const classMax = parseInt(this.elements.classMax.value) || 12;
            const currentClass = userData.class || 1;
            
            if (userData.owned && (currentClass < classMin || currentClass > classMax)) {
                return false;
            }
            
            return true;
        });
    }

    /**
     * ソートの適用
     */
    applySorting(data) {
        return data.sort((a, b) => {
            let valueA, valueB;
            
            switch (this.currentSortBy) {
                case 'id':
                    valueA = a.id;
                    valueB = b.id;
                    break;
                case 'name':
                    valueA = a.name;
                    valueB = b.name;
                    break;
                case 'level':
                    valueA = this.getUserData(a.id).level || 1;
                    valueB = this.getUserData(b.id).level || 1;
                    break;
                case 'class':
                    valueA = this.getUserData(a.id).class || 1;
                    valueB = this.getUserData(b.id).class || 1;
                    break;
                default:
                    valueA = a.id;
                    valueB = b.id;
            }
            
            let comparison = 0;
            if (valueA > valueB) {
                comparison = 1;
            } else if (valueA < valueB) {
                comparison = -1;
            }
            
            return this.sortDirection === 'asc' ? comparison : -comparison;
        });
    }

    /**
     * でんこ要素の作成
     */
    createDenkoElement(denko) {
        const userData = this.getUserData(denko.id);
        const denkoDiv = document.createElement('div');
        denkoDiv.className = `denko-item ${userData.owned ? 'owned' : 'not-owned'}`;
        
        denkoDiv.innerHTML = `
            <div class="denko-header">
                <div class="denko-basic-info">
                    <span class="denko-id">No.${denko.id}</span>
                    <span class="denko-name">${denko.name}</span>
                    <span class="denko-type">${denko.type}</span>
                    <span class="denko-attribute ${denko.attribute}">${denko.attribute}</span>
                </div>
                <div class="denko-controls">
                    <div class="ownership-control">
                        <input type="checkbox" class="ownership-checkbox" 
                               ${userData.owned ? 'checked' : ''} 
                               data-denko-id="${denko.id}">
                        <label>所持</label>
                    </div>
                    <div class="level-control">
                        <label>Lv:</label>
                        <input type="number" class="level-input" 
                               min="1" max="80" 
                               value="${userData.level || 1}"
                               ${!userData.owned ? 'disabled' : ''}
                               data-denko-id="${denko.id}">
                    </div>
                    <div class="class-control">
                        <label>Class:</label>
                        <input type="number" class="class-input" 
                               min="1" max="12" 
                               value="${userData.class || 1}"
                               ${!userData.owned ? 'disabled' : ''}
                               data-denko-id="${denko.id}">
                    </div>
                </div>
            </div>
            <div class="denko-details">
                <div class="skill-info">
                    <div class="skill-name">${denko.skill_name}</div>
                    <div class="skill-effect">${denko.skill_effect}</div>
                </div>
            </div>
        `;
        
        // イベントリスナーの追加
        const checkbox = denkoDiv.querySelector('.ownership-checkbox');
        const levelInput = denkoDiv.querySelector('.level-input');
        const classInput = denkoDiv.querySelector('.class-input');
        
        checkbox.addEventListener('change', (e) => {
            this.updateOwnership(denko.id, e.target.checked);
            levelInput.disabled = !e.target.checked;
            classInput.disabled = !e.target.checked;
            denkoDiv.className = `denko-item ${e.target.checked ? 'owned' : 'not-owned'}`;
            this.updateStatistics();
        });
        
        levelInput.addEventListener('change', (e) => {
            this.updateLevel(denko.id, parseInt(e.target.value));
            this.updateStatistics();
        });
        
        classInput.addEventListener('change', (e) => {
            this.updateClass(denko.id, parseInt(e.target.value));
            this.updateStatistics();
        });
        
        return denkoDiv;
    }

    /**
     * ユーザーデータの取得
     */
    getUserData(denkoId) {
        const key = `${this.currentTab}_${denkoId}`;
        return this.userData[this.currentTab][denkoId] || { owned: false, level: 1, class: 1 };
    }

    /**
     * 所持状況の更新
     */
    updateOwnership(denkoId, owned) {
        if (!this.userData[this.currentTab][denkoId]) {
            this.userData[this.currentTab][denkoId] = { owned: false, level: 1, class: 1 };
        }
        this.userData[this.currentTab][denkoId].owned = owned;
        this.saveUserData();
    }

    /**
     * レベルの更新
     */
    updateLevel(denkoId, level) {
        if (!this.userData[this.currentTab][denkoId]) {
            this.userData[this.currentTab][denkoId] = { owned: false, level: 1, class: 1 };
        }
        this.userData[this.currentTab][denkoId].level = Math.max(1, Math.min(80, level));
        this.saveUserData();
    }

    /**
     * クラスの更新
     */
    updateClass(denkoId, classValue) {
        if (!this.userData[this.currentTab][denkoId]) {
            this.userData[this.currentTab][denkoId] = { owned: false, level: 1, class: 1 };
        }
        this.userData[this.currentTab][denkoId].class = Math.max(1, Math.min(12, classValue));
        this.saveUserData();
    }

    /**
     * 統計情報の更新
     */
    updateStatistics() {
        const currentData = this.denkoData[this.currentTab] || [];
        const filteredData = this.applyFilters(currentData);
        
        let ownedCount = 0;
        let totalLevel = 0;
        let totalClass = 0;
        let ownedWithLevel = 0;
        
        filteredData.forEach(denko => {
            const userData = this.getUserData(denko.id);
            if (userData.owned) {
                ownedCount++;
                totalLevel += userData.level || 1;
                totalClass += userData.class || 1;
                ownedWithLevel++;
            }
        });
        
        const notOwnedCount = filteredData.length - ownedCount;
        const averageLevel = ownedWithLevel > 0 ? (totalLevel / ownedWithLevel).toFixed(1) : 0;
        const averageClass = ownedWithLevel > 0 ? (totalClass / ownedWithLevel).toFixed(1) : 0;
        
        this.elements.totalCount.textContent = filteredData.length;
        this.elements.ownedCount.textContent = ownedCount;
        this.elements.notOwnedCount.textContent = notOwnedCount;
        this.elements.averageLevel.textContent = averageLevel;
        this.elements.averageClass.textContent = averageClass;
    }

    /**
     * ユーザーデータのエクスポート
     */
    exportUserData() {
        try {
            const dataStr = JSON.stringify(this.userData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `ekimemo-denko-data-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            this.showSuccess('データをエクスポートしました。');
        } catch (error) {
            console.error('エクスポートエラー:', error);
            this.showError('データのエクスポートに失敗しました。');
        }
    }

    /**
     * ユーザーデータのインポート
     */
    importUserData(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                this.userData = importedData;
                this.saveUserData();
                this.renderDenkoList();
                this.updateStatistics();
                this.showSuccess('データをインポートしました。');
            } catch (error) {
                console.error('インポートエラー:', error);
                this.showError('データのインポートに失敗しました。ファイル形式を確認してください。');
            }
        };
        reader.readAsText(file);
        
        // ファイル選択をリセット
        event.target.value = '';
    }

    /**
     * 成功メッセージの表示
     */
    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    /**
     * エラーメッセージの表示
     */
    showError(message) {
        this.showMessage(message, 'error');
    }

    /**
     * メッセージの表示
     */
    showMessage(message, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: bold;
            z-index: 1000;
            animation: slideIn 0.3s ease;
            background: ${type === 'success' ? '#28a745' : '#dc3545'};
        `;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(messageDiv);
            }, 300);
        }, 3000);
    }

    /**
     * グラフモーダルを表示
     */
    showGraphModal() {
        this.elements.graphModal.style.display = 'block';
        this.updateGraph();
    }

    /**
     * グラフモーダルを非表示
     */
    hideGraphModal() {
        this.elements.graphModal.style.display = 'none';
    }

    /**
     * グラフを更新
     */
    updateGraph() {
        const selectedType = document.querySelector('input[name="graph-type"]:checked').value;
        let targetData = [];
        
        switch (selectedType) {
            case 'original':
                targetData = this.denkoData.original || [];
                break;
            case 'extra':
                targetData = this.denkoData.extra || [];
                break;
            case 'all':
                targetData = [...(this.denkoData.original || []), ...(this.denkoData.extra || [])];
                break;
        }
        
        this.drawLevelDistributionChart(targetData, selectedType);
    }

    /**
     * レベル分布グラフを描画
     */
    drawLevelDistributionChart(data, type) {
        const canvas = this.elements.levelChart;
        const ctx = canvas.getContext('2d');
        
        // キャンバスをクリア
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // レベル分布データを作成（1-80レベル）
        const levelCounts = new Array(80).fill(0);
        let totalOwned = 0;
        let totalLevel = 0;
        let ownedCount = 0;
        
        data.forEach((denko, index) => {
            // オリジナルでんこのNo.0「のぞみ」は例外のため除外
            if (type === 'original' && denko.id === 0) {
                return;
            }
            if (type === 'all' && index < (this.denkoData.original ? this.denkoData.original.length : 0) && denko.id === 0) {
                return;
            }
            
            const userData = this.getUserDataForGraph(denko.id, type, index, data);
            if (userData.owned) {
                const level = userData.level || 1;
                levelCounts[level - 1]++;
                totalLevel += level;
                ownedCount++;
            }
            totalOwned++;
        });
        
        // 統計情報を更新（No.0除外を考慮）
        let displayTotalCount = data.length;
        if (type === 'original' || type === 'all') {
            // オリジナルまたは全体の場合、No.0を除外した数を表示
            displayTotalCount = totalOwned;
        }
        
        this.elements.graphTotalCount.textContent = displayTotalCount;
        this.elements.graphOwnedCount.textContent = ownedCount;
        this.elements.graphAverageLevel.textContent = ownedCount > 0 ? (totalLevel / ownedCount).toFixed(1) : '0';
        
        // グラフの描画設定
        const padding = 60;
        const chartWidth = canvas.width - padding * 2;
        const chartHeight = canvas.height - padding * 2;
        const maxCount = Math.max(...levelCounts, 1);
        
        // Y軸の最大値を適切に設定（5の倍数に切り上げ）
        const yAxisMax = Math.ceil(maxCount / 5) * 5;
        const yAxisStep = yAxisMax / 5;
        
        // 背景
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // グリッド線を描画
        ctx.strokeStyle = '#e9ecef';
        ctx.lineWidth = 1;
        
        // 縦のグリッド線（レベル）
        for (let i = 0; i <= 8; i++) {
            const x = padding + (chartWidth / 8) * i;
            ctx.beginPath();
            ctx.moveTo(x, padding);
            ctx.lineTo(x, padding + chartHeight);
            ctx.stroke();
        }
        
        // 横のグリッド線（でんこ数）
        for (let i = 0; i <= 5; i++) {
            const y = padding + (chartHeight / 5) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(padding + chartWidth, y);
            ctx.stroke();
        }
        
        // 軸を描画
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        
        // X軸
        ctx.beginPath();
        ctx.moveTo(padding, padding + chartHeight);
        ctx.lineTo(padding + chartWidth, padding + chartHeight);
        ctx.stroke();
        
        // Y軸
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, padding + chartHeight);
        ctx.stroke();
        
        // バーを描画
        const barWidth = chartWidth / 80;
        ctx.fillStyle = '#667eea';
        
        levelCounts.forEach((count, index) => {
            if (count > 0) {
                const barHeight = (count / yAxisMax) * chartHeight;
                const x = padding + index * barWidth;
                const y = padding + chartHeight - barHeight;
                
                ctx.fillRect(x, y, barWidth - 1, barHeight);
            }
        });
        
        // ラベルを描画
        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        
        // X軸ラベル（レベル）
        for (let i = 0; i <= 8; i++) {
            const level = i * 10;
            const x = padding + (chartWidth / 8) * i;
            ctx.fillText(level.toString(), x, padding + chartHeight + 20);
        }
        
        // Y軸ラベル（でんこ数）
        ctx.textAlign = 'right';
        for (let i = 0; i <= 5; i++) {
            const count = Math.round(yAxisStep * (5 - i));
            const y = padding + (chartHeight / 5) * i + 5;
            ctx.fillText(count.toString(), padding - 10, y);
        }
        
        // 軸タイトル
        ctx.textAlign = 'center';
        ctx.font = 'bold 14px Arial';
        ctx.fillText('レベル', padding + chartWidth / 2, canvas.height - 10);
        
        ctx.save();
        ctx.translate(15, padding + chartHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('でんこ数', 0, 0);
        ctx.restore();
    }

    /**
     * グラフ用のユーザーデータ取得
     */
    getUserDataForGraph(denkoId, type, index, data) {
        let targetType = type;
        if (type === 'all') {
            // 全体の場合、配列内の位置から判断
            // オリジナルでんこの数を取得
            const originalCount = this.denkoData.original ? this.denkoData.original.length : 0;
            targetType = index < originalCount ? 'original' : 'extra';
        }
        
        return this.userData[targetType] && this.userData[targetType][denkoId] 
            ? this.userData[targetType][denkoId] 
            : { owned: false, level: 1, class: 1 };
    }
}

// アニメーション用CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    .no-results {
        text-align: center;
        padding: 40px;
        color: #666;
        font-size: 1.1rem;
        background: white;
        border-radius: 10px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    }
`;
document.head.appendChild(style);

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', () => {
    new DenkoManager();
});
