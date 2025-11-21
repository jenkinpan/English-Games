document.addEventListener("DOMContentLoaded", function () {
  // --- 1. 获取 DOM 元素 ---
  const wordInput = document.getElementById("wordInput");
  const importBtn = document.getElementById("importBtn");
  const restartBtn = document.getElementById("restartBtn");
  const wordGrid = document.getElementById("wordGrid");
  const gameStatus = document.getElementById("gameStatus");
  const notification = document.getElementById("notification");
  const fileInput = document.getElementById("fileInput");

  // --- 2. 游戏状态变量 ---
  let words = [];
  let gameState = "setup"; // 状态: setup, team1Poison, team2Poison, playing, gameOver
  let team1PoisonWord = null;
  let team2PoisonWord = null;

  // 内部追踪变量（不显示给用户）
  let totalUniquePoisons = 0;
  let foundPoisonsCount = 0;

  // --- 3. 事件监听绑定 ---
  importBtn.addEventListener("click", importWordsFromTextarea);
  restartBtn.addEventListener("click", restartGame);
  fileInput.addEventListener("change", handleFileSelect);

  // --- 4. 核心功能函数 ---

  // 处理文件上传 (支持 Excel 和 TXT)
  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    if (
      file.type.includes("sheet") ||
      file.name.endsWith(".xlsx") ||
      file.name.endsWith(".xls")
    ) {
      reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        words = jsonData
          .flat()
          .map((w) => String(w).trim())
          .filter((w) => w);
        finishImport();
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = function (e) {
        processTextToWords(e.target.result);
        finishImport();
      };
      reader.readAsText(file);
    }
    event.target.value = "";
  }

  // 从文本框导入
  function importWordsFromTextarea() {
    const input = wordInput.value.trim();
    if (!input) {
      alert("请输入单词或选择文件！");
      return;
    }
    processTextToWords(input);
    finishImport();
  }

  // 将文本处理为数组
  function processTextToWords(text) {
    words = text
      .split(/[\n,，]/)
      .map((line) => line.trim())
      .filter((line) => line !== "");
  }

  // 完成导入
  function finishImport() {
    if (words.length === 0) {
      alert("未检测到有效单词，请检查内容。");
      return;
    }
    wordInput.value = words.join("\n");
    renderWordGrid();
    startPoisonSelection();
  }

  // 渲染网格
  function renderWordGrid() {
    wordGrid.innerHTML = "";
    wordGrid.className = "word-grid";
    const count = words.length;

    if (count <= 4) {
      wordGrid.classList.add("layout-huge");
    } else if (count <= 12) {
      wordGrid.classList.add("layout-large");
    } else if (count <= 32) {
      wordGrid.classList.add("layout-medium");
    } else {
      wordGrid.classList.add("layout-compact");
    }

    words.forEach((word, index) => {
      const cell = document.createElement("div");
      cell.className = "word-cell";
      cell.textContent = word;
      cell.dataset.index = index;
      cell.addEventListener("click", handleCellClick);
      wordGrid.appendChild(cell);
    });
  }

  // 进入“埋毒药”阶段
  function startPoisonSelection() {
    gameState = "team1Poison";
    gameStatus.textContent =
      "🤫 第一阶段：请第一组派人点击一个单词藏毒药 (其他人闭眼)";
    gameStatus.style.color = "#ff9e6b";

    restartBtn.disabled = false;
    restartBtn.classList.remove("btn-disabled");
  }

  // 处理卡片点击逻辑
  function handleCellClick(event) {
    const cell = event.currentTarget;
    const index = parseInt(cell.dataset.index, 10);
    const word = words[index];

    if (cell.classList.contains("poisoned") || cell.classList.contains("safe"))
      return;

    // --- 埋毒药逻辑 ---
    if (gameState === "team1Poison") {
      team1PoisonWord = { index, word };
      highlightSelectionTemporary(cell, () => {
        gameState = "team2Poison";
        gameStatus.textContent =
          "🤫 第二阶段：请第二组派人点击一个单词藏毒药 (其他人闭眼)";
      });
    } else if (gameState === "team2Poison") {
      team2PoisonWord = { index, word };
      highlightSelectionTemporary(cell, () => {
        startGamePlay();
      });
    }
    // --- 游戏排雷逻辑 ---
    else if (gameState === "playing") {
      const isTeam1Poison = team1PoisonWord && team1PoisonWord.index === index;
      const isTeam2Poison = team2PoisonWord && team2PoisonWord.index === index;

      if (isTeam1Poison || isTeam2Poison) {
        handlePoisonFound(cell);
      } else {
        markAsSafe(cell);
      }
    }
  }

  // 正式开始游戏
  function startGamePlay() {
    gameState = "playing";
    foundPoisonsCount = 0;

    // 计算逻辑保留，但不告诉用户
    if (team1PoisonWord.index === team2PoisonWord.index) {
      totalUniquePoisons = 1;
    } else {
      totalUniquePoisons = 2;
    }

    // 【修改点】不透露数量，保持神秘
    gameStatus.textContent = "🎮 游戏开始！全班轮流读单词并点击";
    gameStatus.style.color = "#4ecdc4";
  }

  // 处理踩到毒药
  function handlePoisonFound(cell) {
    cell.classList.add("poisoned");
    foundPoisonsCount++;

    // 判断游戏是否结束
    if (foundPoisonsCount >= totalUniquePoisons) {
      // 真正结束
      gameState = "gameOver";
      gameStatus.textContent = "🏆 游戏结束！所有毒药已清除！";
      gameStatus.style.color = "#ff6b6b";
      showNotification("毒药清除完毕！<br>游戏结束！");
    } else {
      // 【修改点】继续游戏，不提示还剩几个
      gameStatus.textContent = "⚠️ 踩中一个毒药！游戏继续！小心...";
      gameStatus.style.color = "#ff9e6b";
      showNotification("啊！有毒！<br>继续寻找！");
    }
  }

  // 选中时的临时高亮动画
  function highlightSelectionTemporary(cell, callback) {
    cell.classList.add("selected-poison");
    setTimeout(() => {
      cell.classList.remove("selected-poison");
      callback();
    }, 500);
  }

  // 标记为安全
  function markAsSafe(cell) {
    cell.classList.add("safe");
  }

  // 显示弹窗通知
  function showNotification(htmlContent) {
    notification.innerHTML = `<i class="fas fa-skull-crossbones"></i><br>${htmlContent}`;
    notification.style.display = "block";

    if (gameState !== "gameOver") {
      setTimeout(() => {
        notification.style.display = "none";
      }, 2000);
    } else {
      setTimeout(() => {
        notification.style.display = "none";
      }, 3000);
    }
  }

  // 重新开始
  function restartGame() {
    if (words.length === 0) return;

    team1PoisonWord = null;
    team2PoisonWord = null;
    foundPoisonsCount = 0;
    totalUniquePoisons = 0;

    const cells = document.querySelectorAll(".word-cell");
    cells.forEach((cell) => {
      cell.className = "word-cell";
    });

    startPoisonSelection();
  }
});
