// ===========================
// 1. 音效系统
// ===========================
const SoundFX = (() => {
  let ctx = null;
  const init = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  };
  const playTone = (freq, type, duration, vol = 0.1) => {
    if (!ctx) init();
    if (ctx.state === "suspended") ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  };
  return {
    shoot: () => {
      playTone(600, "square", 0.1, 0.05);
      setTimeout(() => playTone(800, "square", 0.1, 0.05), 50);
    },
    hit: () => {
      playTone(440, "sine", 0.1);
      setTimeout(() => playTone(880, "sine", 0.2), 100);
    },
    error: () => {
      playTone(150, "sawtooth", 0.3, 0.15);
      setTimeout(() => playTone(100, "sawtooth", 0.3, 0.15), 150);
    },
    click: () => {
      playTone(1200, "sine", 0.05, 0.03);
    },
    win: () => {
      [440, 554, 659, 880].forEach((f, i) =>
        setTimeout(() => playTone(f, "square", 0.3, 0.05), i * 100),
      );
    },
    loss: () => {
      [300, 250, 200, 150].forEach((f, i) =>
        setTimeout(() => playTone(f, "sawtooth", 0.4, 0.1), i * 150),
      );
    },
  };
})();

// ===========================
// 2. 特效系统
// ===========================
const VFX = {
  floatText: (targetId, text, type) => {
    const target = document.getElementById(targetId);
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const el = document.createElement("div");
    el.textContent = text;
    el.className = `vfx-float ${type === "gain" ? "vfx-up" : "vfx-down"}`;
    el.style.left = `${rect.left + rect.width / 2}px`;
    el.style.top = `${rect.top}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  },
  shakeScreen: () => {
    const shell = document.getElementById("gameShell");
    shell.classList.remove("shake");
    void shell.offsetWidth;
    shell.classList.add("shake");
  },
  pulseElement: (targetId, className) => {
    const el = document.getElementById(targetId);
    if (!el) return;
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
    setTimeout(() => el.classList.remove(className), 500);
  },
};

// ===========================
// 3. 游戏逻辑
// ===========================
const defaultVocabulary = [
  { correct: "floor", clue: "n. 地板" },
  { correct: "window", clue: "n. 窗户" },
  { correct: "chair", clue: "n. 椅子" },
  { correct: "table", clue: "n. 桌子" },
  { correct: "sofa", clue: "n. 沙发" },
  { correct: "door", clue: "n. 门" },
  { correct: "phone", clue: "n. 电话" },
  { correct: "clean", clue: "v. 打扫" },
  { correct: "please", clue: "int. 请" },
  { correct: "television", clue: "n. 电视" },
];

let isGameActive = false;
let activeVocabulary = [];
let queue = [];
let current = null;
let score = 0;
let shield = 3;
let wave = 0;
let timer = 0;
let timerId = null;
const ANSWER_TIME = 18;

let currentSlots = [];
let currentPool = [];

const refs = {
  enemy: document.getElementById("enemyWord"),
  hint: document.getElementById("hint"),
  log: document.getElementById("log"),
  answerSlots: document.getElementById("answerSlots"),
  letterPool: document.getElementById("letterPool"),
  resetInput: document.getElementById("resetInput"),
  fire: document.getElementById("fire"),
  start: document.getElementById("start"),
  stop: document.getElementById("stop"),
  skip: document.getElementById("skip"),
  wave: document.getElementById("wave"),
  score: document.getElementById("score"),
  shield: document.getElementById("shield"),
  timer: document.getElementById("timer"),
  editBtn: document.getElementById("editBtn"),
  editorModal: document.getElementById("editorModal"),
  editorList: document.getElementById("editorList"),
  addWordBtn: document.getElementById("addWordBtn"),
  saveEditorBtn: document.getElementById("saveEditorBtn"),
  closeEditorBtn: document.getElementById("closeEditorBtn"),
};

const scrambleWord = (word) => {
  if (word.length <= 1) return word;
  const arr = word.split("");
  let limit = 10;
  while (limit > 0) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const result = arr.join("");
    if (result.toLowerCase() !== word.toLowerCase()) return result;
    limit--;
  }
  return arr.join("");
};

const simpleShuffle = (arr) => {
  const newArr = [...arr];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

const loadData = () => {
  const stored = localStorage.getItem("lexicon_vocab");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {}
  }
  return JSON.parse(JSON.stringify(defaultVocabulary));
};
const saveData = (data) =>
  localStorage.setItem("lexicon_vocab", JSON.stringify(data));

const initGame = () => {
  activeVocabulary = loadData();
  refs.editBtn.disabled = false;
  refs.stop.disabled = true;
};

const resetState = () => {
  SoundFX.shoot();
  activeVocabulary = loadData();
  if (activeVocabulary.length === 0) {
    alert("词库为空！请先添加单词。");
    openEditor();
    return;
  }

  const preparedList = activeVocabulary.map((item) => ({
    ...item,
    miss: scrambleWord(item.correct),
  }));

  queue = simpleShuffle(preparedList);
  score = 0;
  shield = 3;
  wave = 0;
  current = null;
  isGameActive = true;

  refs.fire.disabled = true;
  refs.resetInput.disabled = true;
  refs.editBtn.disabled = true;
  refs.stop.disabled = false;

  refs.log.textContent = "准备作战！";
  refs.log.classList.remove("error");

  refs.hint.classList.remove("hint-active");

  updateHUD();
  spawnEnemy();
};

const updateHUD = () => {
  refs.wave.textContent = `${wave}/${activeVocabulary.length}`;
  refs.score.textContent = score;
  refs.shield.textContent = shield;
  refs.timer.textContent = timer > 0 ? `${timer}s` : "—";

  if (isGameActive) {
    if (timer <= 5 && timer > 0) {
      refs.timer.classList.add("timer-warning");
    } else {
      refs.timer.classList.remove("timer-warning");
    }

    if (current) {
      if (timer <= 10) {
        refs.hint.textContent = `提示：${current.clue}`;
        refs.hint.classList.add("hint-active");
      } else {
        const waitTime = timer - 10;
        refs.hint.textContent = `提示：线索分析中... (${waitTime}s)`;
        refs.hint.classList.remove("hint-active");
      }
    }

    if (current && score > 0) {
      refs.skip.disabled = false;
    } else {
      refs.skip.disabled = true;
    }
  }
};

const spawnEnemy = () => {
  if (timerId) window.clearInterval(timerId);
  if (!queue.length) {
    victory();
    return;
  }

  current = queue.shift();
  wave++;
  refs.enemy.textContent = current.miss;

  refs.log.textContent = "点击字母进行排序...";
  refs.log.classList.remove("error");

  initInputZone(current.correct);

  timer = ANSWER_TIME;
  timerId = window.setInterval(() => {
    timer--;
    if (timer <= 0) {
      window.clearInterval(timerId);
      damage("倒计时耗尽，护盾 -1。");
    }
    updateHUD();
  }, 1000);
  updateHUD();
};

const initInputZone = (correctWord) => {
  currentSlots = new Array(correctWord.length).fill(null);
  currentPool = simpleShuffle(correctWord.split(""));
  renderInputUI();
};

const renderInputUI = () => {
  refs.answerSlots.innerHTML = "";
  refs.letterPool.innerHTML = "";

  currentSlots.forEach((char, index) => {
    const slot = document.createElement("div");
    slot.className = "letter-slot";
    if (char) {
      slot.textContent = char;
      slot.onclick = () => returnLetterToPool(index);
    } else {
      slot.classList.add("empty");
    }
    refs.answerSlots.appendChild(slot);
  });

  currentPool.forEach((char, index) => {
    const tile = document.createElement("div");
    tile.className = "letter-tile";
    tile.textContent = char;
    tile.onclick = () => moveLetterToSlot(index);
    refs.letterPool.appendChild(tile);
  });

  const isFull = currentSlots.every((c) => c !== null);
  refs.fire.disabled = !isGameActive || !isFull;

  const hasInput = currentSlots.some((c) => c !== null);
  refs.resetInput.disabled = !isGameActive || !hasInput;
};

const moveLetterToSlot = (poolIndex) => {
  if (!isGameActive) return;
  const emptySlotIndex = currentSlots.findIndex((c) => c === null);
  if (emptySlotIndex === -1) return;

  const char = currentPool[poolIndex];
  currentSlots[emptySlotIndex] = char;
  currentPool.splice(poolIndex, 1);

  SoundFX.click();
  renderInputUI();
};

const returnLetterToPool = (slotIndex) => {
  if (!isGameActive) return;
  const char = currentSlots[slotIndex];
  if (!char) return;

  currentSlots[slotIndex] = null;
  currentPool.push(char);

  SoundFX.click();
  renderInputUI();
};

const resetInputAll = () => {
  if (!isGameActive || !current) return;
  currentSlots.forEach((char) => {
    if (char) currentPool.push(char);
  });
  currentSlots.fill(null);
  renderInputUI();
};

const checkAnswer = () => {
  if (!isGameActive || !current) return;

  const attempt = currentSlots.join("").toLowerCase();

  if (attempt === current.correct.toLowerCase()) {
    score += 2;
    SoundFX.hit();
    VFX.floatText("score", "+2", "gain");
    updateHUD();
    refs.log.textContent = `命中！正确拼写：${current.correct}`;
    refs.log.classList.remove("error");
    spawnEnemy();
  } else {
    shield--;
    SoundFX.error();
    VFX.shakeScreen();
    VFX.floatText("shield", "-1", "loss");
    VFX.pulseElement("shield", "shield-damage");

    refs.log.textContent = "拼写错误，护盾 -1！";
    refs.log.classList.add("error");
    if (shield <= 0) gameOver();
    updateHUD();
  }
};

const damage = (msg) => {
  shield--;
  SoundFX.error();
  VFX.shakeScreen();
  VFX.floatText("shield", "-1", "loss");
  VFX.pulseElement("shield", "shield-damage");

  refs.log.textContent = msg;
  refs.log.classList.add("error");
  if (shield <= 0) {
    gameOver();
  } else {
    spawnEnemy();
  }
  updateHUD();
};

const skipWave = () => {
  if (!isGameActive || !current || score <= 0) return;
  score = Math.max(0, score - 1);
  SoundFX.shoot();
  VFX.floatText("score", "-1", "loss");
  refs.log.textContent = `跳过，答案是：${current.correct}`;
  refs.log.classList.remove("error");
  spawnEnemy();
  updateHUD();
};

const quitGame = () => {
  if (isGameActive) endGame("游戏已手动结束。");
};
const victory = () => {
  SoundFX.win();
  endGame("恭喜！所有错词已被纠正。");
};
const gameOver = () => {
  SoundFX.loss();
  endGame(`护盾耗尽！答案应为：${current ? current.correct : "未知"}`);
};

const endGame = (msg) => {
  isGameActive = false;
  current = null;
  refs.enemy.textContent = shield > 0 && queue.length === 0 ? "胜利！" : "结束";

  refs.hint.textContent = msg;
  refs.hint.classList.add("hint-active");

  refs.fire.disabled = true;
  refs.resetInput.disabled = true;
  refs.editBtn.disabled = false;
  refs.stop.disabled = true;
  updateHUD();
  refs.log.textContent = `最终得分：${score}`;
  if (timerId) window.clearInterval(timerId);
  refs.timer.textContent = "—";
  refs.timer.classList.remove("timer-warning");
};

const createInputRow = (word = "", clue = "") => {
  const div = document.createElement("div");
  div.className = "word-item";
  div.innerHTML = `
        <input type="text" class="w-correct" placeholder="正确单词" value="${word}">
        <input type="text" class="w-clue" placeholder="线索" value="${clue}">
        <button class="btn-icon" onclick="this.parentElement.remove()">×</button>
    `;
  return div;
};

// --- 关键修复：JS 锁定背景滚动 ---
const openEditor = () => {
  const data = loadData();
  refs.editorList.innerHTML = "";
  data.forEach((item) => {
    refs.editorList.appendChild(createInputRow(item.correct, item.clue));
  });
  if (data.length === 0) refs.editorList.appendChild(createInputRow());

  document.body.style.overflow = "hidden"; // 锁定背景
  refs.editorModal.classList.add("active");
};

const closeEditor = () => {
  document.body.style.overflow = ""; // 解锁背景
  refs.editorModal.classList.remove("active");
};

const saveAndCloseEditor = () => {
  const rows = refs.editorList.querySelectorAll(".word-item");
  const newData = [];
  rows.forEach((row) => {
    const correct = row.querySelector(".w-correct").value.trim();
    const clue = row.querySelector(".w-clue").value.trim();
    if (correct && clue) newData.push({ correct, clue });
  });
  if (newData.length === 0 && !confirm("词库为空，确定要保存吗？")) return;
  saveData(newData);
  activeVocabulary = newData;
  closeEditor(); // 使用封装的关闭函数
  refs.log.textContent = "词库已更新，点击“开始新一局”生效。";
};

refs.start.addEventListener("click", resetState);
refs.stop.addEventListener("click", quitGame);
refs.fire.addEventListener("click", checkAnswer);
refs.resetInput.addEventListener("click", resetInputAll);
refs.skip.addEventListener("click", skipWave);

refs.editBtn.addEventListener("click", openEditor);
refs.closeEditorBtn.addEventListener("click", closeEditor);
refs.addWordBtn.addEventListener("click", () => {
  refs.editorList.appendChild(createInputRow());
  refs.editorList.scrollTop = refs.editorList.scrollHeight;
});
refs.saveEditorBtn.addEventListener("click", saveAndCloseEditor);

initGame();
