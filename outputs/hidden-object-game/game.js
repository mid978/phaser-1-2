/* global Phaser */
const SIZE = 1254;
const LIMIT_SECONDS = 60;

const items = [
  { name: "壁の大きな時計", x: 414, y: 105, radius: 52 },
  { name: "レジスター", x: 741, y: 245, radius: 45 },
  { name: "赤いひさし", x: 109, y: 470, radius: 80 },
  { name: "招き猫", x: 1053, y: 720, radius: 40 },
  { name: "オムライスのポスター", x: 87, y: 217, radius: 52 },
  { name: "傘立て", x: 518, y: 922, radius: 55 },
  { name: "りんごのかご", x: 310, y: 1050, radius: 55 },
  { name: "黄色いごみ箱", x: 624, y: 1174, radius: 38 }
];

const ui = {
  timer: document.querySelector('#timer'), target: document.querySelector('#target-name'),
  progress: document.querySelector('#progress'), message: document.querySelector('#message'),
  restart: document.querySelector('#restart'), answerCard: document.querySelector('#answer-card'),
  answerList: document.querySelector('#answer-list')
};
let scene;

// 外部音源を使わず、Web Audio API で短いゲーム音を鳴らす。
const sound = {
  context: null,
  play(notes, type = 'sine') {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context ||= new AudioContext();
    if (this.context.state === 'suspended') this.context.resume();
    const start = this.context.currentTime;
    notes.forEach(([frequency, offset, duration, volume = 0.08]) => {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start + offset);
      gain.gain.setValueAtTime(0.001, start + offset);
      gain.gain.exponentialRampToValueAtTime(volume, start + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + offset + duration);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + duration + 0.02);
    });
  },
  correct() { this.play([[659, 0, 0.11], [880, 0.11, 0.18]], 'triangle'); },
  wrong() { this.play([[180, 0, 0.18, 0.09]], 'sawtooth'); },
  clear() { this.play([[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.28]], 'triangle'); },
  timeout() { this.play([[330, 0, 0.17], [247, 0.18, 0.25]], 'sine'); }
};

function setMessage(text, kind = '') {
  ui.message.textContent = text;
  ui.message.className = `message ${kind}`;
}
function formatTime(seconds) { return `00:${String(Math.max(0, seconds)).padStart(2, '0')}`; }

class FindScene extends Phaser.Scene {
  constructor() { super('find-scene'); }
  preload() { this.load.image('bistro', 'assets/bistro-scene.png'); }
  create() {
    scene = this;
    this.add.image(SIZE / 2, SIZE / 2, 'bistro').setDisplaySize(SIZE, SIZE);
    this.overlay = this.add.graphics();
    this.items = items.map(item => ({ ...item, found: false }));
    this.current = 0;
    this.remaining = LIMIT_SECONDS;
    this.ended = false;
    ui.answerCard.hidden = true;
    this.updatePanel();
    this.input.on('pointerdown', pointer => this.checkClick(pointer));
    this.clock = this.time.addEvent({ delay: 1000, loop: true, callback: this.tick, callbackScope: this });
    setMessage('「' + this.items[0].name + '」はどこかな？');
  }
  updatePanel() {
    ui.timer.textContent = formatTime(this.remaining);
    ui.progress.textContent = `${this.current} / ${this.items.length} 個みつけた`;
    ui.target.textContent = this.ended ? 'ゲーム終了' : this.items[this.current].name;
  }
  tick() {
    if (this.ended) return;
    this.remaining--;
    this.updatePanel();
    if (this.remaining <= 0) this.finish(false);
  }
  checkClick(pointer) {
    if (this.ended) return;
    const item = this.items[this.current];
    const distance = Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, item.x, item.y);
    if (distance <= item.radius) {
      this.flash(item.x, item.y, item.radius, 0x78e598);
      sound.correct();
      this.current++;
      if (this.current === this.items.length) this.finish(true);
      else { this.updatePanel(); setMessage('正解！ 次は「' + this.items[this.current].name + '」を探そう。', 'correct'); }
    } else {
      this.flash(pointer.worldX, pointer.worldY, 28, 0xf07070);
      sound.wrong();
      setMessage('おしい！ お題のものをもう一度よく見てみよう。', 'wrong');
      this.cameras.main.shake(100, 0.002);
    }
  }
  flash(x, y, radius, color) {
    const ring = this.add.circle(x, y, radius, color, 0.16).setStrokeStyle(7, color, 1);
    this.tweens.add({ targets: ring, alpha: 0, scale: 1.7, duration: 520, ease: 'Quad.out', onComplete: () => ring.destroy() });
  }
  finish(won) {
    this.ended = true;
    this.clock.remove();
    this.updatePanel();
    ui.answerList.textContent = items.map(item => item.name).join(' ／ ');
    ui.answerCard.hidden = false;
    if (won) {
      sound.clear();
      setMessage('🎉 全部見つけた！ 洋食まつもとを満喫しました。', 'correct');
      this.cameras.main.flash(350, 126, 234, 159);
    } else {
      sound.timeout();
      setMessage('時間切れ！ 「' + this.items[this.current].name + '」を探しきれなかった…', 'timeout');
      this.overlay.fillStyle(0x1b0c08, 0.48).fillRect(0, 0, SIZE, SIZE);
    }
  }
  restart() { this.scene.restart(); }
}

new Phaser.Game({ type: Phaser.AUTO, parent: 'game', width: SIZE, height: SIZE, backgroundColor: '#1a1008', scene: FindScene, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH } });
ui.restart.addEventListener('click', () => scene && scene.restart());
