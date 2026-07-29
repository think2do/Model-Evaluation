const form = document.querySelector("#evaluation-form");
const questionInput = document.querySelector("#question");
const rubricInput = document.querySelector("#rubric");
const questionError = document.querySelector("#question-error");
const rubricError = document.querySelector("#rubric-error");
const formStatus = document.querySelector("#form-status");
const candidatesList = document.querySelector("#candidates-list");
const candidateTabs = document.querySelector("#candidate-tabs");
const addCandidateButton = document.querySelector("#add-candidate");

const evaluationInput = {
  question: "",
  rubric: "",
  candidates: [],
};

let nextCandidateId = 1;

function clearFormStatus() {
  formStatus.textContent = "";
  formStatus.classList.remove("is-success");
}

function getCandidateCards() {
  return [...candidatesList.querySelectorAll(".candidate-card")];
}

function getCandidateTabs() {
  return [...candidateTabs.querySelectorAll(".candidate-tab")];
}

function setActiveCandidate(candidateId, shouldFocusTab = false) {
  getCandidateCards().forEach((card) => {
    const isActive = card.dataset.candidateId === candidateId;
    card.hidden = !isActive;
  });

  getCandidateTabs().forEach((tab) => {
    const isActive = tab.dataset.candidateId === candidateId;
    tab.setAttribute("aria-selected", String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
    if (isActive && shouldFocusTab) {
      tab.focus();
    }
  });
}

function updateCandidateLabels() {
  const cards = getCandidateCards();

  cards.forEach((card, index) => {
    card.querySelector(".candidate-title").textContent = `回答 ${index + 1}`;
    card.querySelector(".delete-button").disabled = cards.length === 1;

    const name = card.querySelector(".candidate-name").value.trim();
    const tab = candidateTabs.querySelector(
      `[data-candidate-id="${card.dataset.candidateId}"]`,
    );
    tab.textContent = name || `回答 ${index + 1}`;
  });
}

function createCandidateCard() {
  const candidateId = `candidate-${nextCandidateId}`;
  nextCandidateId += 1;

  const card = document.createElement("article");
  card.className = "candidate-card";
  card.dataset.candidateId = candidateId;
  card.id = `${candidateId}-panel`;
  card.setAttribute("role", "tabpanel");
  card.setAttribute("aria-labelledby", `${candidateId}-tab`);
  card.innerHTML = `
    <div class="candidate-heading">
      <h4 class="candidate-title"></h4>
      <button
        class="delete-button"
        type="button"
        aria-label="删除这份回答"
      >
        删除
      </button>
    </div>
    <div class="form-field">
      <label for="${candidateId}-name">模型名称</label>
      <input
        id="${candidateId}-name"
        class="candidate-name"
        type="text"
        autocomplete="off"
        aria-describedby="${candidateId}-name-error"
        placeholder="例如：模型 A"
      />
      <p
        class="field-error candidate-name-error"
        id="${candidateId}-name-error"
        role="alert"
      ></p>
    </div>
    <div class="form-field">
      <label for="${candidateId}-answer">模型回答</label>
      <textarea
        id="${candidateId}-answer"
        class="candidate-answer"
        rows="9"
        aria-describedby="${candidateId}-answer-error"
        placeholder="粘贴该模型的完整回答"
      ></textarea>
      <p
        class="field-error candidate-answer-error"
        id="${candidateId}-answer-error"
        role="alert"
      ></p>
    </div>
  `;

  const tab = document.createElement("button");
  tab.className = "candidate-tab";
  tab.id = `${candidateId}-tab`;
  tab.type = "button";
  tab.dataset.candidateId = candidateId;
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-controls", card.id);
  tab.setAttribute("aria-selected", "false");

  candidateTabs.append(tab);
  candidatesList.append(card);
  updateCandidateLabels();
  setActiveCandidate(candidateId);
  updateInputState();
  return card;
}

function updateInputState() {
  evaluationInput.question = questionInput.value;
  evaluationInput.rubric = rubricInput.value;
  evaluationInput.candidates = getCandidateCards().map((card) => ({
    id: card.dataset.candidateId,
    modelName: card.querySelector(".candidate-name").value,
    answer: card.querySelector(".candidate-answer").value,
  }));
}

function setFieldError(input, errorElement, message) {
  input.setAttribute("aria-invalid", String(Boolean(message)));
  errorElement.textContent = message;
}

function validateInput() {
  updateInputState();

  const questionIsEmpty = evaluationInput.question.trim() === "";
  const rubricIsEmpty = evaluationInput.rubric.trim() === "";
  let firstInvalidCandidateInput = null;

  setFieldError(
    questionInput,
    questionError,
    questionIsEmpty ? "请填写原始问题。" : "",
  );
  setFieldError(
    rubricInput,
    rubricError,
    rubricIsEmpty ? "请填写评分标准。" : "",
  );

  getCandidateCards().forEach((card) => {
    const nameInput = card.querySelector(".candidate-name");
    const answerInput = card.querySelector(".candidate-answer");
    const nameError = card.querySelector(".candidate-name-error");
    const answerError = card.querySelector(".candidate-answer-error");
    const nameIsEmpty = nameInput.value.trim() === "";
    const answerIsEmpty = answerInput.value.trim() === "";

    setFieldError(
      nameInput,
      nameError,
      nameIsEmpty ? "请填写模型名称。" : "",
    );
    setFieldError(
      answerInput,
      answerError,
      answerIsEmpty ? "请填写模型回答。" : "",
    );

    if (!firstInvalidCandidateInput && (nameIsEmpty || answerIsEmpty)) {
      firstInvalidCandidateInput = nameIsEmpty ? nameInput : answerInput;
    }
  });

  return {
    isValid:
      !questionIsEmpty && !rubricIsEmpty && !firstInvalidCandidateInput,
    firstInvalidCandidateInput,
  };
}

function getEvaluationInput() {
  updateInputState();
  return {
    ...evaluationInput,
    candidates: evaluationInput.candidates.map((candidate) => ({
      ...candidate,
    })),
  };
}

window.getEvaluationInput = getEvaluationInput;

questionInput.addEventListener("input", () => {
  updateInputState();
  if (questionInput.getAttribute("aria-invalid") === "true") {
    setFieldError(questionInput, questionError, "");
  }
  clearFormStatus();
});

rubricInput.addEventListener("input", () => {
  updateInputState();
  if (rubricInput.getAttribute("aria-invalid") === "true") {
    setFieldError(rubricInput, rubricError, "");
  }
  clearFormStatus();
});

addCandidateButton.addEventListener("click", () => {
  const card = createCandidateCard();
  card.querySelector(".candidate-name").focus();
  clearFormStatus();
});

candidateTabs.addEventListener("click", (event) => {
  const tab = event.target.closest(".candidate-tab");
  if (!tab) {
    return;
  }

  setActiveCandidate(tab.dataset.candidateId);
  clearFormStatus();
});

candidatesList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest(".delete-button");
  if (!deleteButton || deleteButton.disabled) {
    return;
  }

  const card = deleteButton.closest(".candidate-card");
  const cardsBeforeDelete = getCandidateCards();
  const deletedIndex = cardsBeforeDelete.indexOf(card);
  const nextActiveCard =
    cardsBeforeDelete[deletedIndex + 1] || cardsBeforeDelete[deletedIndex - 1];

  candidateTabs
    .querySelector(`[data-candidate-id="${card.dataset.candidateId}"]`)
    .remove();
  card.remove();
  updateCandidateLabels();
  setActiveCandidate(nextActiveCard.dataset.candidateId, true);
  updateInputState();
  clearFormStatus();
});

candidatesList.addEventListener("input", (event) => {
  const input = event.target.closest(".candidate-name, .candidate-answer");
  if (!input) {
    return;
  }

  updateInputState();
  if (input.classList.contains("candidate-name")) {
    updateCandidateLabels();
  }
  if (input.getAttribute("aria-invalid") === "true") {
    const errorElement = input
      .closest(".form-field")
      .querySelector(".field-error");
    setFieldError(input, errorElement, "");
  }
  clearFormStatus();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  formStatus.classList.remove("is-success");

  const validation = validateInput();
  if (!validation.isValid) {
    formStatus.textContent = "请先补全必填内容。";
    const firstInvalidInput =
      questionInput.getAttribute("aria-invalid") === "true"
        ? questionInput
        : rubricInput.getAttribute("aria-invalid") === "true"
          ? rubricInput
          : validation.firstInvalidCandidateInput;
    const invalidCard = firstInvalidInput.closest(".candidate-card");
    if (invalidCard) {
      setActiveCandidate(invalidCard.dataset.candidateId);
    }
    firstInvalidInput.focus();
    return;
  }

  formStatus.textContent = "评测输入已就绪。API 调用将在后续任务中接入。";
  formStatus.classList.add("is-success");
});

createCandidateCard();
