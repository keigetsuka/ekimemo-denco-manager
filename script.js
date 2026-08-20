/**
 * 駅メモ！でんこ管理アプリ - メインスクリプト
 * 
 * 概要: でんこの所持状況とレベル管理を行うWebアプリケーションのメイン機能
 * 主な仕様: JSON データ管理、フィルタ・ソート機能、ローカルストレージでの永続化
 * 制限事項: 静的ファイルのみで動作、単一ユーザー向け
 */

class DenkoManager {
    /** でんこの最大レベル */
    static MAX_LEVEL = 100;

    constructor() {
        // アプリケーションの状態管理
        this.denkoData = { original: [], extra: [] };
        this.userData = { original: {}, extra: {} };
        // でんこ画像ファイル名用の英名キー（list.json の default）
        this.imageKeys = { original: [], extra: [] };
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
            await Promise.all([
                this.loadDenkoData(),
                this.loadImageKeys()
            ]);
            this.loadUserData();
            this.renderDenkoList();
            this.updateStatistics();
        } catch (error) {
            console.error('データの初期化に失敗しました:', error);
            this.showError('データの読み込みに失敗しました。');
        }
    }

    /**
     * でんこ画像キー（list.json default）の読み込み
     */
    async loadImageKeys() {
        try {
            const response = await fetch('./ekihack/list.json');
            if (!response.ok) {
                throw new Error(`list.jsonの読み込みに失敗しました。HTTPステータス: ${response.status}`);
            }

            const data = await response.json();
            const defaults = data && data.default ? data.default : {};
            this.imageKeys = {
                original: Array.isArray(defaults.original) ? defaults.original : [],
                extra: Array.isArray(defaults.extra) ? defaults.extra : []
            };
            console.log(
                `画像キーを読み込みました。オリジナル: ${this.imageKeys.original.length}件, エクストラ: ${this.imageKeys.extra.length}件`
            );
        } catch (error) {
            console.error('画像キーの読み込みエラー:', error);
            // 画像なしでもアプリは継続できるよう空配列で初期化
            this.imageKeys = { original: [], extra: [] };
        }
    }

    /**
     * でんこ画像のURLを返す（無い場合は空文字）
     */
    getDenkoImageUrl(denko) {
        try {
            if (!denko || typeof denko.id !== 'number') {
                return '';
            }
            const keys = this.imageKeys[this.currentTab] || [];
            const index = this.currentTab === 'extra' ? denko.id - 1 : denko.id;
            if (index < 0 || index >= keys.length) {
                return '';
            }
            const key = keys[index];
            if (!key || typeof key !== 'string') {
                return '';
            }
            return `./ekihack/download/default/${encodeURIComponent(key)}_usual.png`;
        } catch (error) {
            console.error('画像URLの生成に失敗しました:', error);
            return '';
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
                    <div class="error-message">
                        <h3>データ読み込みエラー</h3>
                        <p>denko_data.jsonファイルの読み込みに失敗しました。</p>
                        <p>以下を確認してください：</p>
                        <ul>
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
            
            // 名前フィルタ（日本語名・英字名の部分一致）
            const nameFilter = this.elements.nameFilter.value.trim().toLowerCase();
            if (nameFilter) {
                const nameJa = (denko.name || '').toLowerCase();
                const nameEn = (denko.name_en || '').toLowerCase();
                if (!nameJa.includes(nameFilter) && !nameEn.includes(nameFilter)) {
                    return false;
                }
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
            const levelMax = parseInt(this.elements.levelMax.value) || DenkoManager.MAX_LEVEL;
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
     * HTML挿入用に特殊文字をエスケープする
     */
    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /**
     * でんこ要素の作成
     */
    createDenkoElement(denko) {
        const userData = this.getUserData(denko.id);
        const denkoDiv = document.createElement('div');
        denkoDiv.className = `denko-item ${userData.owned ? 'owned' : 'not-owned'}`;
        const nameEnHtml = denko.name_en
            ? `<span class="denko-name-en">${this.escapeHtml(denko.name_en)}</span>`
            : '';
        const imageUrl = this.getDenkoImageUrl(denko);
        const portraitHtml = imageUrl
            ? `<img class="denko-portrait" src="${imageUrl}" alt="${this.escapeHtml(denko.name)}" loading="lazy" width="72" height="72" onerror="this.remove()">`
            : '';
        
        denkoDiv.innerHTML = `
            <div class="ticket-stub">
                <span class="denko-id">No.${denko.id}</span>
            </div>
            <div class="ticket-body">
                <div class="denko-header">
                    <div class="denko-basic-info">
                        ${portraitHtml}
                        <span class="denko-names">
                            <span class="denko-name">${this.escapeHtml(denko.name)}</span>
                            ${nameEnHtml}
                        </span>
                        <span class="denko-type" data-type="${this.escapeHtml(denko.type)}">${this.escapeHtml(denko.type)}</span>
                        <span class="denko-attribute ${this.escapeHtml(denko.attribute)}">${this.escapeHtml(denko.attribute)}</span>
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
                                   min="1" max="${DenkoManager.MAX_LEVEL}"
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
                        <div class="skill-name">${this.escapeHtml(denko.skill_name)}</div>
                        <div class="skill-effect">${this.escapeHtml(denko.skill_effect)}</div>
                    </div>
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
        this.userData[this.currentTab][denkoId].level = Math.max(1, Math.min(DenkoManager.MAX_LEVEL, level));
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
        
        document.body.appendChild(messageDiv);

        setTimeout(() => {
            messageDiv.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                try {
                    if (messageDiv.parentNode) {
                        messageDiv.parentNode.removeChild(messageDiv);
                    }
                } catch (error) {
                    console.error('メッセージ要素の削除に失敗しました:', error);
                }
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
        
        // レベル分布データを作成（1〜最大レベル）
        const maxLevel = DenkoManager.MAX_LEVEL;
        const levelCounts = new Array(maxLevel).fill(0);
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
        
        // 背景（発車標パネル）
        ctx.fillStyle = '#10171d';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // グリッド線を描画
        ctx.strokeStyle = 'rgba(232, 184, 74, 0.16)';
        ctx.lineWidth = 1;
        
        // 縦のグリッド線（レベル・10レベル刻み）
        const levelAxisSteps = maxLevel / 10;
        for (let i = 0; i <= levelAxisSteps; i++) {
            const x = padding + (chartWidth / levelAxisSteps) * i;
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
        ctx.strokeStyle = '#c9b896';
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
        const barWidth = chartWidth / maxLevel;
        ctx.fillStyle = '#e8b84a';
        
        levelCounts.forEach((count, index) => {
            if (count > 0) {
                const barHeight = (count / yAxisMax) * chartHeight;
                const x = padding + index * barWidth;
                const y = padding + chartHeight - barHeight;
                
                ctx.fillRect(x, y, barWidth - 1, barHeight);
            }
        });
        
        // ラベルを描画
        ctx.fillStyle = '#e8dcc4';
        ctx.font = '12px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        
        // X軸ラベル（レベル）
        for (let i = 0; i <= levelAxisSteps; i++) {
            const level = i * 10;
            const x = padding + (chartWidth / levelAxisSteps) * i;
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
        ctx.font = '14px "Kosugi Maru", sans-serif';
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

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', () => {
    new DenkoManager();
});
