/**
 * ウェブ広告エキスパートBronze 問題集アプリ
 * メインロジック
 */

// ===== アプリ状態管理 =====
const AppState = {
  phase: 'SELECT_CHAPTER', // SELECT_CHAPTER | CONFIRM_OK | IN_QUIZ | RESULT
  selectedChapter: null,
  currentQuestionIndex: 0, // 0-9
  questions: [],           // 選出された10問
  answers: [],             // ユーザー回答履歴 {questionId, userAnswer, isCorrect}
  score: 0,
  awaitingAnswer: false,
};

// ===== 章データマップ =====
const CHAPTER_DATA = {
  1: typeof QUESTIONS_CH1 !== 'undefined' ? QUESTIONS_CH1 : null,
  2: typeof QUESTIONS_CH2 !== 'undefined' ? QUESTIONS_CH2 : null,
  3: typeof QUESTIONS_CH3 !== 'undefined' ? QUESTIONS_CH3 : null,
  4: typeof QUESTIONS_CH4 !== 'undefined' ? QUESTIONS_CH4 : null,
  5: typeof QUESTIONS_CH5 !== 'undefined' ? QUESTIONS_CH5 : null,
};

// ===== ユーティリティ =====
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 10問の選出ロジック
 * 前半3問 / 中盤4問 / 後半3問
 * タイプA 5問 / タイプB 5問 になるよう調整
 */
function selectQuestions(chapterData) {
  const { blocks } = chapterData;

  // 各ブロックをシャッフル
  const frontPool = shuffleArray([...blocks.front]);
  const middlePool = shuffleArray([...blocks.middle]);
  const backPool = shuffleArray([...blocks.back]);

  // 各ブロックから指定数選出
  let frontSelected = frontPool.slice(0, 3);
  let middleSelected = middlePool.slice(0, 4);
  let backSelected = backPool.slice(0, 3);

  let selected = [...frontSelected, ...middleSelected, ...backSelected];

  // タイプA/Bの比率調整（A:5問 / B:5問）
  selected = balanceQuestionTypes(selected, frontPool, middlePool, backPool);

  return selected;
}

/**
 * A/Bタイプの比率を50:50に調整する
 */
function balanceQuestionTypes(selected, frontPool, middlePool, backPool) {
  const MAX_ATTEMPTS = 20;
  let attempts = 0;

  while (attempts < MAX_ATTEMPTS) {
    const typeACnt = selected.filter(q => q.type === 'A').length;
    const typeBCnt = selected.filter(q => q.type === 'B').length;

    if (typeACnt === 5 && typeBCnt === 5) break;

    // 不均衡な場合は差し替えを試みる（超過タイプの問題を不足タイプに差し替え）
    const excessType = typeACnt > 5 ? 'A' : 'B';
    const deficitType = typeACnt > 5 ? 'B' : 'A';

    // 差し替え対象（超過タイプの問題）を1つランダムに選ぶ
    const excessIndices = selected
      .map((q, i) => q.type === excessType ? i : -1)
      .filter(i => i >= 0);
    const replaceIdx = excessIndices[Math.floor(Math.random() * excessIndices.length)];

    // 不足タイプの代替候補を探す（ブロック内で未選択のもの）
    const selectedIds = selected.map(q => q.id);
    const allPoolCandidates = [...frontPool, ...middlePool, ...backPool]
      .filter(q => q.type === deficitType && !selectedIds.includes(q.id));

    if (allPoolCandidates.length === 0) break; // 候補がなければ終了

    const replacement = allPoolCandidates[Math.floor(Math.random() * allPoolCandidates.length)];
    selected[replaceIdx] = replacement;
    attempts++;
  }

  return selected;
}

// ===== DOM要素取得 =====
const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const chapterBadge = document.getElementById('chapter-badge');

// ===== メッセージ表示 =====
function addMessage(content, sender = 'bot', isHtml = false) {
  const wrapper = document.createElement('div');
  wrapper.className = `message-wrapper ${sender === 'bot' ? 'bot-wrapper' : 'user-wrapper'}`;

  const bubble = document.createElement('div');
  bubble.className = `message-bubble ${sender === 'bot' ? 'bot-bubble' : 'user-bubble'}`;

  if (isHtml) {
    bubble.innerHTML = content;
  } else {
    bubble.textContent = content;
  }

  wrapper.appendChild(bubble);
  chatContainer.appendChild(wrapper);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return bubble;
}

function addTypingIndicator() {
  const wrapper = document.createElement('div');
  wrapper.className = 'message-wrapper bot-wrapper';
  wrapper.id = 'typing-indicator';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble bot-bubble typing-bubble';
  bubble.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';

  wrapper.appendChild(bubble);
  chatContainer.appendChild(wrapper);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function removeTypingIndicator() {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) indicator.remove();
}

function botReply(htmlContent, delay = 600) {
  return new Promise(resolve => {
    addTypingIndicator();
    setTimeout(() => {
      removeTypingIndicator();
      addMessage(htmlContent, 'bot', true);
      resolve();
    }, delay);
  });
}

// ===== 初期表示 =====
function showWelcomeMessage() {
  const html = `
    <div class="welcome-msg">
      <div class="welcome-title">📚 2026年ウェブ広告エキスパートBronze認定資格試験</div>
      <div class="welcome-body">
        <p>これから演習問題を始めます。<br>演習したい章を選んでください。</p>
        <div class="chapter-select-grid">
          <button class="chapter-btn" onclick="handleChapterSelect(1)">第1章<br><span>ウェブ広告全般</span></button>
          <button class="chapter-btn" onclick="handleChapterSelect(2)">第2章<br><span>検索広告</span></button>
          <button class="chapter-btn" onclick="handleChapterSelect(3)">第3章<br><span>ディスプレイ広告</span></button>
          <button class="chapter-btn" onclick="handleChapterSelect(4)">第4章<br><span>SNS広告</span></button>
          <button class="chapter-btn" onclick="handleChapterSelect(5)">第5章<br><span>動画広告・その他広告</span></button>
        </div>
        <p class="input-hint">または入力欄に「第1章」などと入力してください。</p>
      </div>
    </div>
  `;
  addMessage(html, 'bot', true);
}

// ===== 章選択ボタンハンドラ =====
function handleChapterSelect(chNum) {
  addMessage(`第${chNum}章`, 'user');
  processChapterSelection(chNum);
}

// ===== 章選択処理 =====
function processChapterSelection(chNum) {
  const chapterTitles = {
    1: 'ウェブ広告全般',
    2: '検索広告',
    3: 'ディスプレイ広告',
    4: 'SNS広告',
    5: '動画広告・その他広告'
  };

  AppState.selectedChapter = chNum;
  AppState.phase = 'CONFIRM_OK';
  chapterBadge.textContent = `第${chNum}章`;
  chapterBadge.style.display = 'inline-block';

  const html = `
    <div class="confirm-msg">
      <p>✅ <strong>第${chNum}章「${chapterTitles[chNum]}」</strong>を選択しました。</p>
      <p>全<strong>10問</strong>の演習問題を出題します。</p>
      <p>準備ができたら <strong>「OK」</strong> と入力して開始してください。</p>
      <button class="ok-btn" onclick="handleOkButton()">OK ▶ 演習開始</button>
    </div>
  `;
  botReply(html);
}

// ===== OKボタンハンドラ =====
function handleOkButton() {
  addMessage('OK', 'user');
  startQuiz();
}

// ===== クイズ開始 =====
function startQuiz() {
  const chData = CHAPTER_DATA[AppState.selectedChapter];
  if (!chData) {
    botReply('<p>⚠️ 問題データの読み込みに失敗しました。ページをリロードしてください。</p>');
    return;
  }

  AppState.questions = selectQuestions(chData);
  AppState.currentQuestionIndex = 0;
  AppState.answers = [];
  AppState.score = 0;
  AppState.phase = 'IN_QUIZ';
  AppState.awaitingAnswer = true;

  updateProgress();
  showQuestion(0);
}

// ===== 問題表示 =====
function showQuestion(index) {
  const q = AppState.questions[index];
  const qNum = index + 1;
  const typeLabel = q.type === 'A'
    ? '下記の中から<strong>最も適切な選択肢</strong>を選びなさい。'
    : '下記の中から<strong>誤っている選択肢</strong>を選びなさい。';

  const typeTag = q.type === 'A'
    ? '<span class="type-tag type-a">正しいものを選ぶ</span>'
    : '<span class="type-tag type-b">誤っているものを選ぶ</span>';

  const html = `
    <div class="question-card">
      <div class="question-header">
        <span class="question-num">第${qNum}問 / 全10問</span>
        ${typeTag}
      </div>
      <div class="question-direction">${typeLabel}</div>
      <div class="question-text">${escapeHtml(q.question)}</div>
      <div class="choices-list">
        <button class="choice-btn" onclick="handleAnswer('A', this)"><span class="choice-label">A</span><span class="choice-text">${escapeHtml(q.choices.A)}</span></button>
        <button class="choice-btn" onclick="handleAnswer('B', this)"><span class="choice-label">B</span><span class="choice-text">${escapeHtml(q.choices.B)}</span></button>
        <button class="choice-btn" onclick="handleAnswer('C', this)"><span class="choice-label">C</span><span class="choice-text">${escapeHtml(q.choices.C)}</span></button>
        <button class="choice-btn" onclick="handleAnswer('D', this)"><span class="choice-label">D</span><span class="choice-text">${escapeHtml(q.choices.D)}</span></button>
      </div>
      <p class="input-hint">A〜Dのボタンを押すか、入力欄に「A」「B」「C」「D」と入力してください。</p>
    </div>
  `;

  botReply(html, 400);
}

// ===== HTMLエスケープ =====
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ===== 回答処理 =====
function handleAnswer(answer, btnElement) {
  if (!AppState.awaitingAnswer || AppState.phase !== 'IN_QUIZ') return;
  AppState.awaitingAnswer = false;

  // ボタン無効化
  disableChoiceButtons();

  addMessage(answer, 'user');
  processAnswer(answer);
}

function disableChoiceButtons() {
  const btns = document.querySelectorAll('.choice-btn');
  btns.forEach(b => b.disabled = true);
}

function processAnswer(answer) {
  const q = AppState.questions[AppState.currentQuestionIndex];
  const isCorrect = answer.toUpperCase() === q.answer;

  AppState.answers.push({
    questionId: q.id,
    userAnswer: answer,
    correctAnswer: q.answer,
    isCorrect
  });

  if (isCorrect) AppState.score++;

  showResult(q, answer, isCorrect);
}

// ===== 結果表示（正誤 + 解説） =====
function showResult(q, userAnswer, isCorrect) {
  const resultIcon = isCorrect ? '✅ 正解！' : '❌ 不正解';
  const resultClass = isCorrect ? 'result-correct' : 'result-incorrect';

  // 解説HTML生成
  let explanationHtml = '';
  ['A', 'B', 'C', 'D'].forEach(key => {
    const isAnswer = key === q.answer;
    const isUserChoice = key === userAnswer;
    let labelExtra = '';
    if (isAnswer) labelExtra += ' <span class="correct-mark">✓ 正解</span>';
    if (isUserChoice && !isAnswer) labelExtra += ' <span class="user-mark">← あなたの回答</span>';
    if (isUserChoice && isAnswer) labelExtra += ' <span class="user-correct-mark">← あなたの回答</span>';

    explanationHtml += `
      <div class="explanation-item ${isAnswer ? 'explanation-correct-item' : ''}">
        <div class="explanation-choice"><strong>${key}：</strong>${escapeHtml(q.choices[key])}${labelExtra}</div>
        <div class="explanation-reason">${escapeHtml(q.explanation[key])}</div>
      </div>
    `;
  });

  const isLast = AppState.currentQuestionIndex === 9;
  const nextBtnHtml = isLast
    ? `<button class="next-btn" onclick="showFinalResult()">📊 結果を見る</button>`
    : `<button class="next-btn" onclick="goToNextQuestion()">次の問題へ ▶</button>`;

  const html = `
    <div class="result-card ${resultClass}">
      <div class="result-header">${resultIcon}</div>
      <div class="result-answer-info">
        <span>正解：<strong>${q.answer}</strong></span>
        ${!isCorrect ? `<span>あなたの回答：<strong>${userAnswer}</strong></span>` : ''}
      </div>
      <div class="explanation-block">
        <div class="explanation-title">【解説】</div>
        ${explanationHtml}
      </div>
      <div class="source-block">
        <span class="source-label">【出典】</span>
        2026年ウェブ広告エキスパートBronze認定資格公式テキスト<br>
        ${escapeHtml(q.source)}
      </div>
      <div class="next-btn-area">${nextBtnHtml}</div>
    </div>
  `;

  botReply(html, 500);
  updateProgress();
}

// ===== 次の問題へ =====
function goToNextQuestion() {
  AppState.currentQuestionIndex++;
  AppState.awaitingAnswer = true;
  updateProgress();
  showQuestion(AppState.currentQuestionIndex);
}

// ===== 最終結果表示 =====
function showFinalResult() {
  AppState.phase = 'RESULT';
  const score = AppState.score;
  const total = 10;
  const rate = Math.round((score / total) * 100);

  let evalComment = '';
  let evalClass = '';
  if (rate >= 80) {
    evalComment = '🎉 十分理解できています！この調子で全章の演習を続けましょう。';
    evalClass = 'eval-great';
  } else if (rate >= 60) {
    evalComment = '📖 もう少しです！間違えた箇所を中心にテキストを復習しましょう。';
    evalClass = 'eval-good';
  } else {
    evalComment = '📚 テキストの再読をおすすめします。基礎から丁寧に確認しましょう。';
    evalClass = 'eval-poor';
  }

  // 問題別結果リスト
  let detailHtml = '';
  AppState.answers.forEach((ans, i) => {
    const q = AppState.questions[i];
    detailHtml += `
      <div class="detail-row ${ans.isCorrect ? 'detail-correct' : 'detail-wrong'}">
        <span class="detail-num">第${i + 1}問</span>
        <span class="detail-icon">${ans.isCorrect ? '✅' : '❌'}</span>
        <span class="detail-summary">${escapeHtml(q.question.substring(0, 40))}…</span>
        <span class="detail-ans">正解：${ans.correctAnswer} / あなた：${ans.userAnswer}</span>
      </div>
    `;
  });

  const html = `
    <div class="final-result-card">
      <div class="final-title">🏆 演習結果</div>
      <div class="score-display">
        <div class="score-circle">
          <span class="score-num">${score}</span>
          <span class="score-denom">/ ${total}</span>
        </div>
        <div class="score-rate">${rate}%</div>
      </div>
      <div class="eval-comment ${evalClass}">${evalComment}</div>
      <div class="detail-list">
        <div class="detail-title">問題別結果</div>
        ${detailHtml}
      </div>
    </div>
  `;

  botReply(html, 400).then(() => {
    showContinueMessage();
  });

  updateProgress(true);
}

// ===== 終了後の継続案内 =====
function showContinueMessage() {
  const html = `
    <div class="welcome-msg">
      <div class="welcome-title">📚 引き続き演習を続けましょう</div>
      <div class="welcome-body">
        <p>引き続き2026年ウェブ広告エキスパートBronze認定資格試験の演習問題を出題します。<br>演習したい章を選んでください。</p>
        <div class="chapter-select-grid">
          <button class="chapter-btn" onclick="handleChapterSelect(1)">第1章<br><span>ウェブ広告全般</span></button>
          <button class="chapter-btn" onclick="handleChapterSelect(2)">第2章<br><span>検索広告</span></button>
          <button class="chapter-btn" onclick="handleChapterSelect(3)">第3章<br><span>ディスプレイ広告</span></button>
          <button class="chapter-btn" onclick="handleChapterSelect(4)">第4章<br><span>SNS広告</span></button>
          <button class="chapter-btn" onclick="handleChapterSelect(5)">第5章<br><span>動画広告・その他広告</span></button>
        </div>
      </div>
    </div>
  `;
  botReply(html, 800);
  AppState.phase = 'SELECT_CHAPTER';
  chapterBadge.style.display = 'none';
  updateProgress(false, true);
}

// ===== プログレスバー更新 =====
function updateProgress(isComplete = false, isReset = false) {
  if (isReset) {
    progressBar.style.width = '0%';
    progressText.textContent = '章を選んで演習を開始してください';
    return;
  }
  if (AppState.phase === 'IN_QUIZ' || AppState.phase === 'RESULT') {
    const answered = AppState.answers.length;
    const pct = isComplete ? 100 : Math.round((answered / 10) * 100);
    progressBar.style.width = pct + '%';
    if (isComplete) {
      progressText.textContent = `演習完了 ${AppState.score}/10問正解 (${Math.round(AppState.score / 10 * 100)}%)`;
    } else {
      progressText.textContent = `進捗：${answered}/10問 (正解：${AppState.score}問)`;
    }
  }
}

// ===== テキスト入力処理 =====
function handleUserInput() {
  const rawInput = userInput.value.trim();
  if (!rawInput) return;
  userInput.value = '';

  addMessage(rawInput, 'user');

  // フェーズ別処理
  switch (AppState.phase) {
    case 'SELECT_CHAPTER':
      handleChapterInputText(rawInput);
      break;
    case 'CONFIRM_OK':
      handleConfirmInput(rawInput);
      break;
    case 'IN_QUIZ':
      if (AppState.awaitingAnswer) {
        handleAnswerInput(rawInput);
      }
      break;
    case 'RESULT':
      handleChapterInputText(rawInput);
      break;
  }
}

function handleChapterInputText(input) {
  const match = input.match(/第?\s*([1-5一二三四五])\s*章/);
  const numMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5 };

  if (match) {
    let chNum = parseInt(match[1]);
    if (isNaN(chNum)) chNum = numMap[match[1]];
    if (chNum >= 1 && chNum <= 5) {
      processChapterSelection(chNum);
      return;
    }
  }
  botReply('<p>章番号を認識できませんでした。「第1章」〜「第5章」の形式で入力してください。</p>');
}

function handleConfirmInput(input) {
  if (input.toUpperCase() === 'OK' || input === 'ok' || input === 'ОК') {
    startQuiz();
  } else {
    botReply('<p>演習を開始する場合は「<strong>OK</strong>」と入力してください。</p>');
  }
}

function handleAnswerInput(input) {
  const answer = input.toUpperCase().trim();
  if (['A', 'B', 'C', 'D'].includes(answer)) {
    AppState.awaitingAnswer = false;
    disableChoiceButtons();
    processAnswer(answer);
  } else {
    botReply('<p>「<strong>A</strong>」「<strong>B</strong>」「<strong>C</strong>」「<strong>D</strong>」のいずれかを入力してください。</p>');
    AppState.awaitingAnswer = true;
  }
}

// ===== イベントリスナー =====
sendButton.addEventListener('click', handleUserInput);
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleUserInput();
  }
});

// ===== 初期化 =====
document.addEventListener('DOMContentLoaded', () => {
  updateProgress(false, true);
  showWelcomeMessage();
});
