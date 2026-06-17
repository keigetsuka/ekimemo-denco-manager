/**
 * ねこぱんち計算機
 *
 * 概要: でんこの現在レベル・経験値とねこぱんち種別から、獲得経験値と到達レベルを計算する
 * 主な仕様: exp_table.json のレベル別必要経験値テーブルを使用（非累積）
 * 制限事項: スキル効果等の経験値増加は未対応
 */

/** ねこぱんち種別と獲得経験値 */
const NEKOPANCHI_TYPES = {
    weak: { label: 'ねこぱんち（弱）', exp: 150 },
    medium: { label: 'ねこぱんち（中）', exp: 250 },
    strong: { label: 'ねこぱんち（強）', exp: 400 },
    music: { label: 'ねこぱんち（♪）', exp: 100000 },
    event: { label: 'ねこぱんち（イベント）', exp: 300000 }
};

/** 経験値ボーナス定義（+N% のボーナス率。複数選択時は加算して基本経験値に適用） */
const EXP_BONUSES = {
    birthday: { label: '誕生日', rate: 0.25 },
    film: { label: 'フィルム', rate: 0.30 },
    anniversaryFilm: { label: '周年フィルム', rate: 0.70 },
    weekend: { label: '土日', rate: 1.50 },
    levelGungun: { label: 'レベルグングン', rate: 1.20 }
};

class NekopanchiCalculator {
    constructor() {
        /** @type {number[]} レベル別必要経験値（index 0 = Lv1） */
        this.expTable = [];
        this.maxLevel = 80;
        this.elements = {};
        this.init();
    }

    /**
     * 初期化処理
     */
    async init() {
        try {
            this.cacheElements();
            await this.loadExpTable();
            this.bindEvents();
            this.updateExpHint();
            this.calculate();
        } catch (error) {
            console.error('ねこぱんち計算機の初期化に失敗しました:', error);
            this.showError('経験値データの読み込みに失敗しました。HTTPサーバー経由でアクセスしてください。');
        }
    }

    /**
     * DOM要素をキャッシュ
     */
    cacheElements() {
        this.elements = {
            levelInput: document.getElementById('current-level'),
            expInput: document.getElementById('current-exp'),
            expHint: document.getElementById('exp-hint'),
            punchRadios: document.querySelectorAll('input[name="nekopanchi-type"]'),
            bonusCheckboxes: {
                birthday: document.getElementById('bonus-birthday'),
                film: document.getElementById('bonus-film'),
                anniversaryFilm: document.getElementById('bonus-anniversary-film'),
                weekend: document.getElementById('bonus-weekend'),
                levelGungun: document.getElementById('bonus-level-gungun')
            },
            resultSection: document.getElementById('result-section'),
            gainedExp: document.getElementById('gained-exp'),
            gainedExpDetail: document.getElementById('gained-exp-detail'),
            finalLevel: document.getElementById('final-level'),
            finalExp: document.getElementById('final-exp'),
            levelUpCount: document.getElementById('level-up-count'),
            stateBefore: document.getElementById('state-before'),
            stateAfter: document.getElementById('state-after'),
            progressBar: document.getElementById('exp-progress-bar'),
            progressText: document.getElementById('exp-progress-text'),
            errorMessage: document.getElementById('error-message')
        };
    }

    /**
     * 経験値テーブルを読み込む
     */
    async loadExpTable() {
        const response = await fetch('exp_table.json');
        if (!response.ok) {
            throw new Error(`exp_table.json の読み込みに失敗しました: ${response.status}`);
        }

        const data = await response.json();
        if (!Array.isArray(data.requiredExp) || data.requiredExp.length === 0) {
            throw new Error('経験値テーブルの形式が不正です');
        }

        this.expTable = data.requiredExp;
        this.maxLevel = data.maxLevel || this.expTable.length;
    }

    /**
     * イベントリスナーを設定
     */
    bindEvents() {
        this.elements.levelInput.addEventListener('input', () => {
            this.updateExpHint();
            this.calculate();
        });
        this.elements.expInput.addEventListener('input', () => this.calculate());
        this.elements.punchRadios.forEach((radio) => {
            radio.addEventListener('change', () => this.calculate());
        });
        Object.values(this.elements.bonusCheckboxes).forEach((checkbox) => {
            checkbox.addEventListener('change', () => this.calculate());
        });
    }

    /**
     * 次レベルに上げるのに必要な経験値を取得
     * @param {number} level - 現在レベル
     * @returns {number}
     */
    getExpToNextLevel(level) {
        if (level >= this.maxLevel) {
            return 0;
        }
        // LvN行の値 = Lv(N-1)からLvNに上げるのに必要な経験値
        return this.expTable[level];
    }

    /**
     * 経験値を加算してレベルアップをシミュレート
     * @param {number} level - 開始レベル
     * @param {number} currentExp - 現在レベル内の経験値
     * @param {number} gainedExp - 獲得経験値
     * @returns {{ level: number, expInLevel: number, overflowExp: number }}
     */
    simulateLevelUp(level, currentExp, gainedExp) {
        let exp = currentExp + gainedExp;
        let overflowExp = 0;

        while (level < this.maxLevel) {
            const required = this.getExpToNextLevel(level);
            if (exp < required) {
                break;
            }
            exp -= required;
            level += 1;
        }

        if (level >= this.maxLevel) {
            overflowExp = exp;
            exp = 0;
        }

        return { level, expInLevel: exp, overflowExp };
    }

    /**
     * レベルと経験値の状態を表示用文字列に整形
     * @param {number} level
     * @param {number} expInLevel
     * @returns {string}
     */
    formatState(level, expInLevel) {
        if (level >= this.maxLevel) {
            return `Lv ${level}（最大レベル）`;
        }
        const required = this.getExpToNextLevel(level);
        return `Lv ${level}（${expInLevel.toLocaleString()} / ${required.toLocaleString()} exp）`;
    }

    /**
     * 選択中のねこぱんち種別を取得
     * @returns {{ key: string, label: string, exp: number }}
     */
    getSelectedPunch() {
        const selected = document.querySelector('input[name="nekopanchi-type"]:checked');
        const key = selected ? selected.value : 'weak';
        return { key, ...NEKOPANCHI_TYPES[key] };
    }

    /**
     * 有効な経験値ボーナスを取得
     * @returns {Array<{ key: string, label: string, rate: number }>}
     */
    getActiveBonuses() {
        return Object.entries(EXP_BONUSES)
            .filter(([key]) => this.elements.bonusCheckboxes[key]?.checked)
            .map(([key, bonus]) => ({ key, ...bonus }));
    }

    /**
     * ボーナス適用後の獲得経験値を計算
     * 計算式: 基本exp + 基本exp × (ボーナス率の合計)
     * @param {number} baseExp - ねこぱんちの基本経験値
     * @returns {{ baseExp: number, gainedExp: number, bonusRateSum: number, bonusExp: number, activeBonuses: Array }}
     */
    calculateGainedExp(baseExp) {
        const activeBonuses = this.getActiveBonuses();
        const bonusRateSum = activeBonuses.reduce((total, bonus) => total + bonus.rate, 0);
        const bonusExp = baseExp * bonusRateSum;
        const gainedExp = Math.floor(baseExp + bonusExp);

        return { baseExp, gainedExp, bonusRateSum, bonusExp, activeBonuses };
    }

    /**
     * 獲得経験値の内訳を表示用文字列に整形
     * @param {{ baseExp: number, gainedExp: number, bonusRateSum: number, activeBonuses: Array }} expResult
     * @returns {string}
     */
    formatGainedExpDetail(expResult) {
        if (expResult.activeBonuses.length === 0) {
            return '';
        }

        const rateText = expResult.activeBonuses
            .map((bonus) => this.formatBonusRate(bonus.rate))
            .join(' + ');
        return `${expResult.baseExp.toLocaleString()} + ${expResult.baseExp.toLocaleString()} × (${rateText}) = ${expResult.gainedExp.toLocaleString()}`;
    }

    /**
     * ボーナス率を表示用文字列に整形
     * @param {number} rate
     * @returns {string}
     */
    formatBonusRate(rate) {
        return `${rate * 100}%`;
    }

    /**
     * 入力値のバリデーション
     * @returns {{ valid: boolean, message: string, level: number, currentExp: number }}
     */
    validateInput() {
        const level = parseInt(this.elements.levelInput.value, 10);
        const currentExp = parseInt(this.elements.expInput.value, 10) || 0;

        if (Number.isNaN(level) || level < 1 || level > this.maxLevel) {
            return {
                valid: false,
                message: `レベルは1〜${this.maxLevel}の範囲で入力してください`,
                level: 1,
                currentExp: 0
            };
        }

        if (Number.isNaN(currentExp) || currentExp < 0) {
            return {
                valid: false,
                message: '経験値は0以上の数値で入力してください',
                level,
                currentExp: 0
            };
        }

        const maxExpInLevel = this.getExpToNextLevel(level);
        if (level < this.maxLevel && currentExp >= maxExpInLevel) {
            return {
                valid: false,
                message: `Lv${level}では経験値は0〜${(maxExpInLevel - 1).toLocaleString()}の範囲で入力してください`,
                level,
                currentExp
            };
        }

        if (level === this.maxLevel && currentExp > 0) {
            return {
                valid: false,
                message: `Lv${this.maxLevel}（最大レベル）では経験値は0のみ入力できます`,
                level,
                currentExp
            };
        }

        return { valid: true, message: '', level, currentExp };
    }

    /**
     * 経験値入力のヒントを更新
     */
    updateExpHint() {
        const level = parseInt(this.elements.levelInput.value, 10) || 1;
        const expToNext = this.getExpToNextLevel(level);

        if (level >= this.maxLevel) {
            this.elements.expHint.textContent = '最大レベルのため、経験値は0で固定です';
            this.elements.expInput.value = 0;
            this.elements.expInput.disabled = true;
            this.elements.expInput.max = 0;
            return;
        }

        this.elements.expInput.disabled = false;
        this.elements.expInput.max = Math.max(expToNext - 1, 0);
        this.elements.expHint.textContent =
            `Lv${level}→Lv${level + 1}に必要: ${expToNext.toLocaleString()} exp（入力は 0〜${(expToNext - 1).toLocaleString()}）`;
    }

    /**
     * 計算を実行して結果を表示
     */
    calculate() {
        try {
            this.hideError();
            const validation = this.validateInput();
            if (!validation.valid) {
                this.showError(validation.message);
                this.elements.resultSection.hidden = true;
                return;
            }

            const { level, currentExp } = validation;
            const punch = this.getSelectedPunch();
            const expResult = this.calculateGainedExp(punch.exp);
            const gainedExp = expResult.gainedExp;
            const afterState = this.simulateLevelUp(level, currentExp, gainedExp);
            const levelUpCount = afterState.level - level;

            this.elements.gainedExp.textContent = `${gainedExp.toLocaleString()} exp`;
            this.elements.gainedExpDetail.textContent = this.formatGainedExpDetail(expResult);
            this.elements.finalLevel.textContent = `Lv ${afterState.level}`;
            this.elements.finalExp.textContent = `${afterState.expInLevel.toLocaleString()} exp`;
            this.elements.levelUpCount.textContent = levelUpCount > 0
                ? `+${levelUpCount} レベル`
                : 'レベルアップなし';
            this.elements.stateBefore.textContent = this.formatState(level, currentExp);
            this.elements.stateAfter.textContent = this.formatState(afterState.level, afterState.expInLevel);

            this.updateProgressBar(afterState);

            if (afterState.overflowExp > 0) {
                this.showError(
                    `最大レベル（Lv${this.maxLevel}）に到達したため、${afterState.overflowExp.toLocaleString()} exp は繰り越されません`
                );
            }

            this.elements.resultSection.hidden = false;
        } catch (error) {
            console.error('計算処理でエラーが発生しました:', error);
            this.showError('計算中にエラーが発生しました');
            this.elements.resultSection.hidden = true;
        }
    }

    /**
     * 経験値プログレスバーを更新
     * @param {{ level: number, expInLevel: number }} state
     */
    updateProgressBar(state) {
        const expToNext = this.getExpToNextLevel(state.level);

        if (state.level >= this.maxLevel || expToNext === 0) {
            this.elements.progressBar.style.width = '100%';
            this.elements.progressText.textContent = '最大レベル';
            return;
        }

        const percent = Math.min((state.expInLevel / expToNext) * 100, 100);
        this.elements.progressBar.style.width = `${percent}%`;
        this.elements.progressText.textContent =
            `${state.expInLevel.toLocaleString()} / ${expToNext.toLocaleString()} exp`;
    }

    /**
     * エラーメッセージを表示
     * @param {string} message
     */
    showError(message) {
        this.elements.errorMessage.textContent = message;
        this.elements.errorMessage.hidden = false;
    }

    /**
     * エラーメッセージを非表示
     */
    hideError() {
        this.elements.errorMessage.hidden = true;
        this.elements.errorMessage.textContent = '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new NekopanchiCalculator();
});
