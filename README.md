# 薪酬結構設計平台 v2

> **交接文件** — 給接手開發者（antiGravity）

## 快速開始

```bash
git clone https://github.com/eason1491/performance-bonus-simulator.git
cd performance-bonus-simulator
npm install
npm run dev        # 本機 http://localhost:5173
npm run build      # 產出 dist/
```

## 部署

- **GitHub Pages**：push to `master` → `.github/workflows/deploy.yml` 自動部署
- **Netlify**：`netlify.toml` 已設定 cache headers
- **生產 URL**：https://eason1491.github.io/performance-bonus-simulator/

## 技術棧

| 項目 | 選擇 |
|------|------|
| 框架 | **無**（Vanilla JS，純 ES module） |
| 打包 | Vite |
| 認證 | Supabase Auth + Google OAuth |
| 儲存 | localStorage（key: `salary_v2`） |
| 樣式 | 全部寫在 `index.html` 的 `<style>` 中 |

## 架構總覽

```
index.html          ← 唯一 HTML：login + app shell + CSS
src/
  main.js           ← 核心：~1,600 行，全部邏輯
  data.js           ← 資料模型：產業/部門/職等級距/預設值
  auth.js           ← Supabase 認證
public/             ← favicon, manifest.json 等靜態檔
netlify.toml        ← Netlify 快取設定
```

## 核心設計

### 1. 資料是全域的
```js
let data = {
  industry: '科技/軟體/電商',
  departments: [...],
  monthlyRevenue: 500,
  laborRatio: 25,
  headcounts: { 'd1_xxx': 3, ... },
  deptConfigs: { 'd1_xxx': { gradeAllocation: [...] } },
  deptGradeMatrix: { 'd1_xxx': [...] },
  gradeMatrix: { '管理系': [...] },  // 舊版，仍保留
  step: 1
};
```
- 所有元件直接讀寫 `data`
- 每次修改後呼叫 `save()` → `JSON.stringify(data)` 寫入 localStorage
- 畫面更新：`renderStepContent()` → 整頁重建 HTML

### 2. 薪酬計算核心：`calcAllocRow(a)`（main.js 約 line 110）
```js
function calcAllocRow(a) {
  // a.annualTotal = 年薪總包（目標）
  // a.fixedRatio / behaviorRatio / performanceRatio
  // a.subjects = { base: [{name, annual}], behavior: [...], performance: [...] }
  //
  // 回傳：
  // - targetBase / targetBehav / targetPerf（各類目標金額）
  // - monthlyBase / monthlyBehavior / monthlyPerf（月薪）
  // - pctSum / unallocated / pctOver
  // - baseCat / behaviorCat / performanceCat（含 auto-balance）
}
```
- **Step 3/4/5 都用同一個函式**，確保數字一致
- auto-balance 邏輯：每個分類的第一個科目 `annual: null` 會自動補差額

### 3. 5 步驟流程
1. 設定總預算：月營收 × 人事比例 → 年預算
2. 配置部門人數：各部門人數，設定部門型態
3. **薪酬結構設計**：各部門各職等的人員配置、科目金額
4. **部門職等職級對照**：Tab1 檢核表 + Tab2 級距編輯
5. 總覽報表 + 匯出

### 4. Step 4（最新改動）
- **Tab1**：全部門現有職位總表 — 讀 Step 3 的 `calcAllocRow` + `deptGradeMatrix` 級距做檢核
- **Tab2**：部門職等職級附表 — 每個部門獨立級距表，支援中點/薪幅雙向計算
- **`deptGradeMatrix[deptId]`**：每部門獨立級距資料結構
  ```js
  [{ grade, title, levels: [{ level, min, max }] }]
  ```

### 5. Modal 統一關閉系統
```js
window.closeAllModals()  // 關閉所有 modal
// 全域 Esc listener
// 所有 modal overlay: data-modal-overlay
```

## 關鍵函式速查

| 函式 | 檔案:行 | 用途 |
|------|---------|------|
| `calcAllocRow(a)` | main.js ~110 | 核心計算 |
| `save()` | main.js ~90 | 寫 localStorage |
| `renderStepContent()` | main.js ~170 | 重建目前 step HTML |
| `renderSidebar()` | main.js ~1250 | 更新預算概覽 |
| `step3HTML()` | main.js ~420 | Step 3 全部門卡片 |
| `step4HTML()` | main.js ~830 | Step 4 雙 Tab |
| `showDeptGradeEditor(id)` | main.js ~1000 | 部門級距編輯彈窗 |
| `getIndustryDepts(ind)` | data.js ~200 | 產業預設部門 |
| `createDefaultAllocation()` | data.js ~310 | 預設金字塔配置 |

## 認證

- Supabase 專案：`cncmdkqhtsdscsbnctek.supabase.co`
- 只允許 `rcbc.a001@gmail.com` 登入（`ALLOWED_EMAILS` in main.js ~line 8）
- 非授權帳號會看到拒絕頁面

## 注意事項

1. **不要用框架** — 目前 Vanilla JS 運作良好，bundle < 90KB
2. **所有修改都從 feature branch 開始**
   ```bash
   git checkout -b feature/xxx
   # ... 開發 ...
   git push origin feature/xxx
   # 驗收後 merge 到 master
   ```
3. **`data` 物件變更後記得 `save()`**，否則重整頁面會遺失
4. **inline onclick 必須掛在 `window.*`** — module scope 函式無法被 HTML onclick 存取
5. **每次改 `vite.config.js` 後 rebuild** — commit hash 是 build-time 注入的

## 待辦

- [ ] 自訂部門時，型態切換後自動更新預設比例
- [ ] Step 3 科目金額的月薪/年薪單位標示更清楚
- [ ] Tab2 刪除職等後的級距缺失提示自動化
- [ ] Supabase 連線狀態顯示在 UI

---

**最後更新**：2026-05-21 · commit `88f5a3a` · branch `master`
