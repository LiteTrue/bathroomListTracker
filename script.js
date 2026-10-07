const FIVE_MINUTES_MS = 5 * 60 * 1000;

const bathroomLine = [];
let nextId = 1;
let listMode = "normal";
let session = null;
let timerInterval = null;
let dragPersonId = null;

const addForm = document.getElementById("add-form");
const nameInput = document.getElementById("person-name");
const lineList = document.getElementById("bathroom-line");
const emptyMessage = document.getElementById("empty-message");
const editListButton = document.getElementById("edit-list");
const removePersonButton = document.getElementById("remove-person");
const resetListButton = document.getElementById("reset-list");
const modeHint = document.getElementById("mode-hint");

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function overtimeLabel(ms) {
  return `Overtime: ${formatElapsed(ms)}`;
}

function remainingMs() {
  if (!session) {
    return 0;
  }
  return session.endsAt - Date.now();
}

function clearSession() {
  session = null;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function showResetWarning() {
  let warning = document.getElementById("reset-warning");
  if (!warning) {
    warning = document.createElement("div");
    warning.id = "reset-warning";
    warning.className = "reset-warning";
    warning.setAttribute("role", "dialog");
    warning.setAttribute("aria-modal", "true");

    const content = document.createElement("div");
    content.className = "reset-warning-content";

    const text = document.createElement("p");
    text.className = "reset-warning-text";
    text.textContent = "Completely delete the list? This action cannot be undone.";

    const actions = document.createElement("div");
    actions.className = "reset-warning-actions";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "secondary";
    cancelButton.textContent = "Cancel";
    cancelButton.addEventListener("click", () => hideResetWarning());

    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.className = "danger";
    resetButton.textContent = "Reset";
    resetButton.addEventListener("click", () => {
      hideResetWarning();
      bathroomLine.length = 0;
      clearSession();
      listMode = "normal";
      renderLine();
    });

    actions.appendChild(cancelButton);
    actions.appendChild(resetButton);
    content.appendChild(text);
    content.appendChild(actions);
    warning.appendChild(content);
    document.body.appendChild(warning);
  }

  warning.hidden = false;
  warning.classList.remove("visible");
  void warning.offsetWidth;
  warning.classList.add("visible");
}

function hideResetWarning() {
  const warning = document.getElementById("reset-warning");
  if (!warning) {
    return;
  }

  warning.classList.remove("visible");
  setTimeout(() => {
    warning.hidden = true;
  }, 180);
}

function showTimeExpiredWarning() {
  if (!session) {
    return;
  }

  const warning = document.getElementById("time-expired-warning");
  const person = bathroomLine.find((candidate) => candidate.id === session.personId);
  const personName = person ? person.name : "Person";

  if (!warning) {
    const modal = document.createElement("div");
    modal.id = "time-expired-warning";
    modal.className = "reset-warning";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    const content = document.createElement("div");
    content.className = "reset-warning-content";

    const text = document.createElement("p");
    text.className = "reset-warning-text";

    const actions = document.createElement("div");
    actions.className = "reset-warning-actions";

    const okButton = document.createElement("button");
    okButton.type = "button";
    okButton.className = "secondary";
    okButton.textContent = "Confirm";
    okButton.addEventListener("click", () => {
      modal.classList.remove("visible");
      setTimeout(() => {
        modal.hidden = true;
      }, 180);
    });

    actions.appendChild(okButton);
    content.appendChild(text);
    content.appendChild(actions);
    modal.appendChild(content);
    document.body.appendChild(modal);

    modal.querySelector(".reset-warning-text").textContent = `Person "${personName}" has passed the time of five minutes.`;
    modal.hidden = false;
    modal.classList.remove("visible");
    void modal.offsetWidth;
    modal.classList.add("visible");
    return;
  }

  warning.querySelector(".reset-warning-text").textContent = `Person "${personName}" has passed the time of  five minutes.`;
  warning.hidden = false;
  warning.classList.remove("visible");
  void warning.offsetWidth;
  warning.classList.add("visible");
}

function tickTimer() {
  if (!session) {
    return;
  }

  if (remainingMs() <= 0) {
    if (!session.elapsed) {
      session.elapsed = true;
      showTimeExpiredWarning();
    }
    const timer = document.getElementById("session-timer");
    if (timer) {
      timer.textContent = overtimeLabel(Date.now() - session.endsAt);
    }
    return;
  }

  const timer = document.getElementById("session-timer");
  if (timer) {
    timer.textContent = formatCountdown(remainingMs());
  }
}

function startSession(personId) {
  if (session) {
    return;
  }

  session = {
    personId,
    endsAt: Date.now() + FIVE_MINUTES_MS,
    elapsed: false,
  };

  timerInterval = setInterval(tickTimer, 250);
  renderLine();
}

function finishSession(personId) {
  const index = bathroomLine.findIndex((person) => person.id === personId);
  if (index === -1) {
    return;
  }

  bathroomLine.splice(index, 1);
  clearSession();
  renderLine();
}

function removePersonById(personId) {
  const index = bathroomLine.findIndex((person) => person.id === personId);
  if (index === -1) {
    return;
  }

  if (session && session.personId === personId) {
    clearSession();
  }

  bathroomLine.splice(index, 1);
  renderLine();
}

function resetList() {
  showResetWarning();
}

function getDragAfterElement(y) {
  const rows = [...lineList.querySelectorAll(".person-row:not(.dragging)")];

  return rows.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
}

function syncLineFromDom() {
  const ids = [...lineList.querySelectorAll(".person-row")].map((row) =>
    Number(row.dataset.id)
  );
  bathroomLine.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
}

function renderLine() {
  lineList.innerHTML = "";
  emptyMessage.hidden = bathroomLine.length > 0;
  lineList.classList.toggle("edit-mode", listMode === "edit");
  lineList.classList.toggle("remove-mode", listMode === "remove");

  editListButton.classList.toggle("active", listMode === "edit");
  removePersonButton.classList.toggle("active", listMode === "remove");
  editListButton.textContent = listMode === "edit" ? "Finish Editing" : "Edit List";
  removePersonButton.textContent =
    listMode === "remove" ? "Finish Removing" : "Remove Person";

  if (listMode === "edit") {
    modeHint.hidden = false;
    modeHint.textContent = "Drag names to reorder line.";
  } else if (listMode === "remove") {
    modeHint.hidden = false;
    modeHint.textContent = "Click remove to delete any person.";
  } else {
    modeHint.hidden = true;
    modeHint.textContent = "";
  }

  bathroomLine.forEach((person, index) => {
    const item = document.createElement("li");
    item.className = "person-row";
    item.dataset.id = String(person.id);

    if (listMode === "edit") {
      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = "drag-handle";
      handle.setAttribute("aria-label", `Drag ${person.name}`);
      handle.innerHTML = "<span></span><span></span><span></span>";
      handle.addEventListener("pointerdown", () => {
        item.draggable = true;
      });
      handle.addEventListener("pointerup", () => {
        item.draggable = false;
      });
      item.appendChild(handle);
    }

    const name = document.createElement("span");
    name.className = "person-name";
    name.textContent = `${index + 1}. ${person.name}`;
    item.appendChild(name);

    const isSessionPerson = session && session.personId === person.id;
    const isFirst = index === 0;

    if (isSessionPerson) {
      const status = document.createElement("span");
      status.className = "session-status";
      if (session.elapsed) {
        status.id = "session-timer";
        status.textContent = overtimeLabel(Date.now() - session.endsAt);
      } else {
        status.id = "session-timer";
        status.textContent = formatCountdown(remainingMs());
      }
      item.appendChild(status);
    }

    const actions = document.createElement("div");
    actions.className = "row-actions";

    if (listMode === "normal" && isFirst && !session) {
      const startButton = document.createElement("button");
      startButton.type = "button";
      startButton.textContent = "Start";
      startButton.addEventListener("click", () => startSession(person.id));
      actions.appendChild(startButton);
    }

    if (listMode === "normal" && isSessionPerson) {
      const finishButton = document.createElement("button");
      finishButton.type = "button";
      finishButton.textContent = "Finish";
      finishButton.addEventListener("click", () => finishSession(person.id));
      actions.appendChild(finishButton);
    }

    if (listMode === "remove") {
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "danger";
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", () => removePersonById(person.id));
      actions.appendChild(removeButton);
    }

    item.appendChild(actions);

    item.addEventListener("dragstart", (event) => {
      if (listMode !== "edit") {
        event.preventDefault();
        return;
      }
      dragPersonId = person.id;
      item.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(person.id));
    });

    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
      item.draggable = false;
      dragPersonId = null;
      syncLineFromDom();
      renderLine();
    });

    lineList.appendChild(item);
  });
}

lineList.addEventListener("dragover", (event) => {
  if (listMode !== "edit" || dragPersonId === null) {
    return;
  }

  event.preventDefault();
  const dragging = lineList.querySelector(".dragging");
  if (!dragging) {
    return;
  }

  const after = getDragAfterElement(event.clientY);
  if (!after) {
    lineList.appendChild(dragging);
  } else {
    lineList.insertBefore(dragging, after);
  }
});

lineList.addEventListener("drop", (event) => {
  event.preventDefault();
});

addForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  if (!name) {
    return;
  }

  bathroomLine.push({ id: nextId, name });
  nextId += 1;
  nameInput.value = "";
  nameInput.focus();
  renderLine();
});

editListButton.addEventListener("click", () => {
  listMode = listMode === "edit" ? "normal" : "edit";
  renderLine();
});

removePersonButton.addEventListener("click", () => {
  listMode = listMode === "remove" ? "normal" : "remove";
  renderLine();
});

resetListButton.addEventListener("click", () => {
  if (bathroomLine.length === 0) {
    return;
  }
  resetList();
});

renderLine();
