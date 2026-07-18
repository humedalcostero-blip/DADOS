const diceContainer = document.getElementById("diceContainer");
const dieTemplate = document.getElementById("dieTemplate");
const diceType = document.getElementById("diceType");
const addDieButton = document.getElementById("addDie");
const rollAllButton = document.getElementById("rollAll");
const resetAllButton = document.getElementById("resetAll");
const clearHistoryButton = document.getElementById("clearHistory");
const historyList = document.getElementById("historyList");
const emptyHistory = document.getElementById("emptyHistory");
const themeToggle = document.getElementById("themeToggle");

const totalValue = document.getElementById("totalValue");
const maxValue = document.getElementById("maxValue");
const minValue = document.getElementById("minValue");
const diceCount = document.getElementById("diceCount");

const allowedFaces = [4, 6, 8, 10, 12, 20];
let dice = [];
let history = [];
let nextId = 1;
let rolling = false;

function secureRandomInt(min, max) {
  const range = max - min + 1;
  if (window.crypto?.getRandomValues) {
    const maxUint = 0xffffffff;
    const limit = maxUint - (maxUint % range);
    const buffer = new Uint32Array(1);
    do {
      window.crypto.getRandomValues(buffer);
    } while (buffer[0] >= limit);
    return min + (buffer[0] % range);
  }
  return Math.floor(Math.random() * range) + min;
}

function createDie(faces = 6) {
  const validFaces = allowedFaces.includes(Number(faces)) ? Number(faces) : 6;
  const die = {
    id: nextId++,
    faces: validFaces,
    value: 1,
    locked: false
  };
  dice.push(die);
  renderDie(die);
  updateSummary();
}

function renderDie(die) {
  const node = dieTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.id = die.id;

  const shape = node.querySelector(".die-shape");
  const resultValue = node.querySelector(".result-value");
  const dieLabel = node.querySelector(".die-label");
  const lockState = node.querySelector(".lock-state");
  const facesSelect = node.querySelector(".faces-select");
  const rollOneButton = node.querySelector(".roll-one");
  const lockButton = node.querySelector(".lock-btn");
  const removeButton = node.querySelector(".remove-btn");
  const faces = [...node.querySelectorAll(".face")];

  function sync() {
    dieLabel.textContent = `D${die.faces}`;
    resultValue.textContent = die.value;
    facesSelect.value = String(die.faces);
    lockState.textContent = die.locked ? "Bloqueado" : "Activo";
    lockButton.textContent = die.locked ? "🔒 Desbloquear" : "🔓 Bloquear";
    node.classList.toggle("locked", die.locked);
    shape.setAttribute("aria-label", `Dado de ${die.faces} caras, resultado ${die.value}`);

    const displayValues = [
      die.value,
      ((die.value + 1 - 1) % die.faces) + 1,
      ((die.value + 2 - 1) % die.faces) + 1,
      ((die.value + 3 - 1) % die.faces) + 1,
      ((die.value + 4 - 1) % die.faces) + 1,
      ((die.value + 5 - 1) % die.faces) + 1
    ];
    faces.forEach((face, index) => {
      face.textContent = displayValues[index];
    });
  }

  node._syncDie = sync;
  node._shape = shape;

  facesSelect.addEventListener("change", () => {
    die.faces = Number(facesSelect.value);
    die.value = Math.min(die.value, die.faces);
    sync();
    updateSummary();
    saveState();
  });

  rollOneButton.addEventListener("click", async () => {
    if (rolling || die.locked) return;
    await rollDice([die]);
  });

  lockButton.addEventListener("click", () => {
    die.locked = !die.locked;
    sync();
    saveState();
  });

  removeButton.addEventListener("click", () => {
    if (dice.length === 1) {
      alert("Debe quedar al menos un dado.");
      return;
    }
    dice = dice.filter(item => item.id !== die.id);
    node.remove();
    updateSummary();
    saveState();
  });

  diceContainer.appendChild(node);
  sync();
}

function getNodeByDieId(id) {
  return diceContainer.querySelector(`[data-id="${id}"]`);
}

async function rollDice(targetDice) {
  const activeDice = targetDice.filter(die => !die.locked);
  if (!activeDice.length) return;

  rolling = true;
  setButtonsDisabled(true);

  activeDice.forEach(die => {
    const node = getNodeByDieId(die.id);
    node?._shape.classList.add("rolling");
  });

  await new Promise(resolve => setTimeout(resolve, 820));

  activeDice.forEach(die => {
    die.value = secureRandomInt(1, die.faces);
    const node = getNodeByDieId(die.id);
    if (node) {
      node._shape.classList.remove("rolling");
      node._shape.style.transform =
        `rotateX(${secureRandomInt(680, 980)}deg) rotateY(${secureRandomInt(640, 980)}deg) rotateZ(${secureRandomInt(300, 700)}deg)`;
      node._syncDie();
    }
  });

  updateSummary();
  addHistoryEntry();
  saveState();

  rolling = false;
  setButtonsDisabled(false);
}

function setButtonsDisabled(disabled) {
  rollAllButton.disabled = disabled;
  addDieButton.disabled = disabled;
  resetAllButton.disabled = disabled;
  diceContainer.querySelectorAll("button, select").forEach(control => {
    control.disabled = disabled;
  });
}

function updateSummary() {
  const values = dice.map(die => die.value);
  const total = values.reduce((sum, value) => sum + value, 0);

  totalValue.textContent = total;
  maxValue.textContent = values.length ? Math.max(...values) : "—";
  minValue.textContent = values.length ? Math.min(...values) : "—";
  diceCount.textContent = dice.length;
}

function addHistoryEntry() {
  const stamp = new Date();
  const entry = {
    time: stamp.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    values: dice.map(die => `D${die.faces}: ${die.value}${die.locked ? " 🔒" : ""}`),
    total: dice.reduce((sum, die) => sum + die.value, 0)
  };

  history.unshift(entry);
  history = history.slice(0, 30);
  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = "";
  emptyHistory.classList.toggle("hidden", history.length > 0);

  history.forEach(entry => {
    const item = document.createElement("li");
    item.className = "history-item";
    item.innerHTML = `
      <div>
        <strong>${entry.values.join(" · ")}</strong>
        <div>Total: ${entry.total}</div>
      </div>
      <small>${entry.time}</small>
    `;
    historyList.appendChild(item);
  });
}

function resetAll() {
  dice = [];
  history = [];
  nextId = 1;
  diceContainer.innerHTML = "";
  createDie(6);
  renderHistory();
  saveState();
}

function saveState() {
  localStorage.setItem("dados3d-state", JSON.stringify({
    dice,
    history,
    nextId,
    dark: document.body.classList.contains("dark")
  }));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem("dados3d-state"));
    if (!saved || !Array.isArray(saved.dice) || !saved.dice.length) {
      createDie(6);
      return;
    }

    dice = saved.dice.map(die => ({
      id: Number(die.id),
      faces: allowedFaces.includes(Number(die.faces)) ? Number(die.faces) : 6,
      value: Math.max(1, Math.min(Number(die.value) || 1, Number(die.faces) || 6)),
      locked: Boolean(die.locked)
    }));
    history = Array.isArray(saved.history) ? saved.history.slice(0, 30) : [];
    nextId = Math.max(Number(saved.nextId) || 1, ...dice.map(die => die.id + 1));

    if (saved.dark) {
      document.body.classList.add("dark");
      themeToggle.textContent = "☀️";
    }

    dice.forEach(renderDie);
    updateSummary();
    renderHistory();
  } catch {
    createDie(6);
  }
}

addDieButton.addEventListener("click", () => {
  createDie(Number(diceType.value));
  saveState();
});

rollAllButton.addEventListener("click", () => rollDice(dice));

resetAllButton.addEventListener("click", () => {
  if (confirm("¿Deseas reiniciar todos los dados y borrar el historial?")) {
    resetAll();
  }
});

clearHistoryButton.addEventListener("click", () => {
  history = [];
  renderHistory();
  saveState();
});

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  themeToggle.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
  saveState();
});

loadState();
