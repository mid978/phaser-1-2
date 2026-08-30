/* global Phaser */
const SIZE = 1254;
const LIMIT_SECONDS = 60;

const items = [
  { id: 'clock', x: 414, y: 105, radius: 52 }, { id: 'register', x: 741, y: 245, radius: 45 },
  { id: 'awning', x: 109, y: 470, radius: 80 }, { id: 'cat', x: 1053, y: 720, radius: 40 },
  { id: 'poster', x: 87, y: 217, radius: 52 }, { id: 'umbrellaStand', x: 518, y: 922, radius: 55 },
  { id: 'appleBasket', x: 310, y: 1050, radius: 55 }, { id: 'bin', x: 624, y: 1174, radius: 38 }
];

const text = {
  ja: {
    title: '洋食まつもと<br /><span>探し物ゲーム</span>', eyebrow: 'HIDDEN OBJECT GAME', lead: 'にぎやかな洋食店の中から、お題の品を見つけてクリックしよう。',
    timerLabel: 'のこり時間', targetLabel: 'さがすもの', answers: '正解一覧', restart: 'もう一度あそぶ', hint: '正解は緑、不正解は赤く表示されます。',
    progress: '{current} / {total} 個みつけた', intro: '「{item}」はどこかな？', correct: '正解！ 次は「{item}」を探そう。', wrong: 'おしい！ お題のものをもう一度よく見てみよう。',
    finished: 'ゲーム終了', clear: '🎉 全部見つけた！ 洋食まつもとを満喫しました。', timeout: '時間切れ！ 「{item}」を探しきれなかった…',
    items: { clock: '壁の大きな時計', register: 'レジスター', awning: '赤いひさし', cat: '招き猫', poster: 'オムライスのポスター', umbrellaStand: '傘立て', appleBasket: 'りんごのかご', bin: '黄色いごみ箱' }
  },
  en: {
    title: 'Matsumoto Diner<br /><span>Hidden Object Game</span>', eyebrow: 'HIDDEN OBJECT GAME', lead: 'Find the requested item in this lively diner and click it.',
    timerLabel: 'TIME LEFT', targetLabel: 'FIND THIS', answers: 'ANSWER LIST', restart: 'PLAY AGAIN', hint: 'Correct clicks are green. Incorrect clicks are red.',
    progress: '{current} / {total} found', intro: 'Can you find the {item}?', correct: 'Correct! Now find the {item}.', wrong: 'Not quite. Take another careful look!',
    finished: 'GAME OVER', clear: '🎉 You found everything! Enjoyed Matsumoto Diner!', timeout: 'Time is up! You did not find the {item}.',
    items: { clock: 'large wall clock', register: 'cash register', awning: 'red awning', cat: 'lucky cat', poster: 'omelet rice poster', umbrellaStand: 'umbrella stand', appleBasket: 'basket of apples', bin: 'yellow bin' }
  }
};

let language = 'ja';
let scene;
let selectedLanguage = false;
const ui = {
  timer: document.querySelector('#timer'), target: document.querySelector('#target-name'), progress: document.querySelector('#progress'), message: document.querySelector('#message'),
  restart: document.querySelector('#restart'), answerCard: document.querySelector('#answer-card'), answerList: document.querySelector('#answer-list'), languageSelect: document.querySelector('#language-select'),
  eyebrow: document.querySelector('#eyebrow'), title: document.querySelector('#game-title'), lead: document.querySelector('#lead'), timerLabel: document.querySelector('#timer-label'),
  targetLabel: document.querySelector('#target-label'), answerHeading: document.querySelector('#answer-heading'), hint: document.querySelector('#hint')
};

function tr(key, values = {}) { return Object.entries(values).reduce((result, [name, value]) => result.replace(`{${name}}`, value), text[language][key]); }
function itemName(item) { return text[language].items[item.id]; }
function applyText() {
  document.documentElement.lang = language;
  document.title = language === 'ja' ? '洋食まつもと 探し物ゲーム' : 'Matsumoto Diner – Hidden Object Game';
  ui.eyebrow.textContent = text[language].eyebrow; ui.title.innerHTML = text[language].title; ui.lead.textContent = text[language].lead;
  ui.timerLabel.textContent = text[language].timerLabel; ui.targetLabel.textContent = text[language].targetLabel; ui.answerHeading.textContent = text[language].answers;
  ui.restart.textContent = text[language].restart; ui.hint.textContent = text[language].hint;
}
function setMessage(message, kind = '') { ui.message.textContent = message; ui.message.className = `message ${kind}`; }
function formatTime(seconds) { return `00:${String(Math.max(0, seconds)).padStart(2, '0')}`; }

const sound = {
  context: null,
  play(notes, type = 'sine') {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context ||= new AudioContext(); if (this.context.state === 'suspended') this.context.resume();
    const start = this.context.currentTime;
    notes.forEach(([frequency, offset, duration, volume = 0.08]) => {
      const oscillator = this.context.createOscillator(); const gain = this.context.createGain(); oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start + offset); gain.gain.setValueAtTime(0.001, start + offset);
      gain.gain.exponentialRampToValueAtTime(volume, start + offset + 0.015); gain.gain.exponentialRampToValueAtTime(0.001, start + offset + duration);
      oscillator.connect(gain).connect(this.context.destination); oscillator.start(start + offset); oscillator.stop(start + offset + duration + 0.02);
    });
  },
  correct() { this.play([[659, 0, 0.11], [880, 0.11, 0.18]], 'triangle'); }, wrong() { this.play([[180, 0, 0.18, 0.09]], 'sawtooth'); },
  clear() { this.play([[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.28]], 'triangle'); }, timeout() { this.play([[330, 0, 0.17], [247, 0.18, 0.25]], 'sine'); }
};

class FindScene extends Phaser.Scene {
  constructor() { super('find-scene'); }
  preload() { this.load.image('bistro', 'assets/bistro-scene.png'); }
  create() {
    scene = this; this.add.image(SIZE / 2, SIZE / 2, 'bistro').setDisplaySize(SIZE, SIZE); this.overlay = this.add.graphics();
    this.input.on('pointerdown', pointer => this.checkClick(pointer)); this.resetGame(); applyText();
    if (selectedLanguage) this.startGame(); else setMessage(language === 'ja' ? '言語を選択してスタート！' : 'Choose a language to start!');
  }
  resetGame() { this.items = items.map(item => ({ ...item })); this.current = 0; this.remaining = LIMIT_SECONDS; this.ended = false; this.started = false; this.clock?.remove(); ui.answerCard.hidden = true; this.updatePanel(); }
  startGame() { this.resetGame(); this.started = true; this.updatePanel(); this.clock = this.time.addEvent({ delay: 1000, loop: true, callback: this.tick, callbackScope: this }); setMessage(tr('intro', { item: itemName(this.items[0]) })); }
  updatePanel() { ui.timer.textContent = formatTime(this.remaining); ui.progress.textContent = tr('progress', { current: this.current, total: this.items.length }); ui.target.textContent = !this.started ? '…' : (this.ended ? tr('finished') : itemName(this.items[this.current])); }
  tick() { if (!this.ended) { this.remaining--; this.updatePanel(); if (this.remaining <= 0) this.finish(false); } }
  checkClick(pointer) {
    if (!this.started || this.ended) return;
    const item = this.items[this.current]; const distance = Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, item.x, item.y);
    if (distance <= item.radius) { this.flash(item.x, item.y, item.radius, 0x78e598); sound.correct(); this.current++; if (this.current === this.items.length) this.finish(true); else { this.updatePanel(); setMessage(tr('correct', { item: itemName(this.items[this.current]) }), 'correct'); } }
    else { this.flash(pointer.worldX, pointer.worldY, 28, 0xf07070); sound.wrong(); setMessage(tr('wrong'), 'wrong'); this.cameras.main.shake(100, 0.002); }
  }
  flash(x, y, radius, color) { const ring = this.add.circle(x, y, radius, color, 0.16).setStrokeStyle(7, color, 1); this.tweens.add({ targets: ring, alpha: 0, scale: 1.7, duration: 520, ease: 'Quad.out', onComplete: () => ring.destroy() }); }
  finish(won) {
    this.ended = true; this.clock.remove(); this.updatePanel(); ui.answerList.textContent = this.items.map(itemName).join(' ／ '); ui.answerCard.hidden = false;
    if (won) { sound.clear(); setMessage(tr('clear'), 'correct'); this.cameras.main.flash(350, 126, 234, 159); }
    else { sound.timeout(); setMessage(tr('timeout', { item: itemName(this.items[this.current]) }), 'timeout'); this.overlay.fillStyle(0x1b0c08, 0.48).fillRect(0, 0, SIZE, SIZE); }
  }
  restart() { this.overlay.clear(); this.startGame(); }
}

new Phaser.Game({ type: Phaser.AUTO, parent: 'game', width: SIZE, height: SIZE, backgroundColor: '#1a1008', scene: FindScene, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH } });
ui.restart.addEventListener('click', () => scene?.restart());
document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => { language = button.dataset.language; selectedLanguage = true; applyText(); ui.languageSelect.hidden = true; scene?.startGame(); }));
