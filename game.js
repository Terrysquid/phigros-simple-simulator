const UNJUDGED = -1;
const PERFECT = 0;
const GOOD = 1;
const BAD = 2;
const MISS = 3;

let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");
let startTime;
let chart, audio;
let lineLength = 3 * canvas.width;
let xScale = (0.9 / 16) * canvas.width;
let yScale = 0.6 * canvas.height;
let currentTime = 0;
let judge = [0.08, 0.16, 0.18];

let hitEffects = []; // debug

// debug function, written by AI
function drawHitEffects() {
  if (!hitEffects.length) return;

  const life = 0.25;
  const baseRadius = 50;

  const now = currentTime;
  hitEffects = hitEffects.filter((e) => {
    const age = now - e.t0;
    if (age < 0 || age > life) return false;

    const t = age / life;
    const alpha = 1 - t;
    const radius = baseRadius * (1 + 0.2 * t);

    let color = "#888888";
    if (e.judge === PERFECT) color = "#ffd900";
    else if (e.judge === GOOD) color = "#00aaff";
    else if (e.judge === BAD) color = "#ff0000";

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.restore();

    return true;
  });
}

window.addEventListener("resize", () => {
  resizeCanvas();
});

function onPointerDown(ev) {
  ev.preventDefault();
  if (!chart || !audio) return;
  currentTime = audio.currentTime;
  let rect = canvas.getBoundingClientRect();
  let x = ev.clientX - rect.left;
  let y = ev.clientY - rect.top;
  hitEffects.push({ x, y, judge: MISS, t0: currentTime }); // debug
  let hit = null;
  for (let l = 0; l < chart.judgeLineList.length; l++) {
    let line = chart.judgeLineList[l];
    let tps = (32 * line.bpm) / 60;
    let dx = x - line.cx;
    let dy = y - line.cy;
    let sinA = Math.sin(-line.angle);
    let cosA = Math.cos(-line.angle);
    let xPosition = (dx * cosA - dy * sinA) / xScale;
    for (let i = 0; i < line.notes.length; i++) {
      let note = line.notes[i];
      if (note.judge != UNJUDGED) continue;
      if (Math.abs(xPosition - note.xPosition) > 1.5) continue;
      let dt = currentTime - note.time / tps;
      if (Math.abs(dt) > judge[BAD]) continue;
      if (!hit || dt > hit.dt) {
        hit = { l, i, dt };
      }
    }
  }
  if (hit) {
    let note = chart.judgeLineList[hit.l].notes[hit.i];
    if (Math.abs(hit.dt) <= judge[PERFECT]) note.judge = PERFECT;
    else if (Math.abs(hit.dt) <= judge[GOOD]) note.judge = GOOD;
    else if (Math.abs(hit.dt) <= judge[BAD]) note.judge = BAD;

    hitEffects.push({ x, y, judge: note.judge, t0: currentTime }); // debug
  }
}

async function init() {
  resizeCanvas();
  audio = new Audio("music.wav");
  bgImage = new Image();
  bgImage.src = "illustration.jpg";
  await loadChart();
  canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
  canvas.addEventListener(
    "click",
    async () => {
      audio.currentTime = 0;
      await audio.play();
      requestAnimationFrame(loop);
    },
    { once: true }
  );
}

function resizeCanvas() {
  canvas.width = canvas.getBoundingClientRect().width;
  canvas.height = canvas.getBoundingClientRect().height;
  lineLength = 3 * canvas.width;
  xScale = (0.9 / 16) * canvas.width;
  yScale = 0.6 * canvas.height;
}

async function loadChart() {
  const res = await fetch("chart.json");
  chart = await res.json();
  for (let l = 0; l < chart.judgeLineList.length; l++) {
    let line = chart.judgeLineList[l];
    line.cx = 0.5 * canvas.width;
    line.cy = 0.5 * canvas.height;
    line.angle = 0;
    line.notes = []; // merge notesAbove and notesBelow using time
    let i = 0;
    let j = 0;
    let note;
    while (i < line.notesAbove.length || j < line.notesBelow.length) {
      if (
        !(j < line.notesBelow.length) ||
        (i < line.notesAbove.length &&
          line.notesAbove[i].time <= line.notesBelow[j].time)
      ) {
        note = { ...line.notesAbove[i], direction: 1 };
        i += 1;
      } else {
        note = { ...line.notesBelow[j], direction: -1 };
        j += 1;
      }
      note.hl = false;
      if (line.notes.length != 0) {
        if (note.time == line.notes[line.notes.length - 1].time) {
          note.hl = true;
          line.notes[line.notes.length - 1].hl = true;
        }
      }
      note.judge = UNJUDGED;
      note.xPosition = note.positionX;
      delete note.positionX;
      line.notes.push(note);
    }
    delete line.notesAbove;
    delete line.notesBelow;
  }
}

function drawLines() {
  if (!chart || !audio) return;
  ctx.strokeStyle = "#FFFFBB";
  ctx.lineWidth = (1 / 160) * canvas.height;
  for (let l = 0; l < chart.judgeLineList.length; l++) {
    let line = chart.judgeLineList[l];
    let tps = (32 * line.bpm) / 60; // time (microbeats) per second
    let cx = 0;
    let cy = 0;
    let angle = 0;
    let alpha = 1;
    let time = currentTime * tps;
    let events = line.judgeLineMoveEvents;
    for (let i = 0; i < events.length; i++) {
      let e = events[i];
      if (time >= e.startTime && time <= e.endTime) {
        let p = (time - e.startTime) / (e.endTime - e.startTime);
        let x = (e.end - e.start) * p + e.start;
        let y = (e.end2 - e.start2) * p + e.start2;
        cx = x * canvas.width;
        cy = (1 - y) * canvas.height;
        break;
      }
    }
    line.cx = cx;
    line.cy = cy;
    events = line.judgeLineRotateEvents;
    for (let i = 0; i < events.length; i++) {
      let e = events[i];
      if (time >= e.startTime && time <= e.endTime) {
        let p = (time - e.startTime) / (e.endTime - e.startTime);
        let ang = (e.end - e.start) * p + e.start;
        angle = -(ang * Math.PI) / 180;
        break;
      }
    }
    line.angle = angle;
    events = line.judgeLineDisappearEvents;
    for (let i = 0; i < events.length; i++) {
      let e = events[i];
      if (time >= e.startTime && time <= e.endTime) {
        let p = (time - e.startTime) / (e.endTime - e.startTime);
        alpha = (e.end - e.start) * p + e.start;
        break;
      }
    }
    let floorPosition = 0;
    events = line.speedEvents;
    for (let i = 0; i < events.length; i++) {
      let e = events[i];
      let t0 = e.startTime; // 得确保官谱都是从0开始积的
      let t1 = Math.min(time, e.endTime);
      let dt = t1 - t0;
      floorPosition += (e.value / tps) * dt;
      if (time <= e.endTime) break;
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-lineLength, 0);
    ctx.lineTo(lineLength, 0);
    ctx.stroke();

    ctx.lineWidth = (1 / 80) * canvas.height; // thick notes

    drawNotes(line.notes);
    ctx.restore();

    function drawNotes(notes) {
      for (let k = 0; k < 4; k++) {
        // O(4n)
        let noteType = [3, 2, 1, 4][k];
        for (let i = 0; i < notes.length; i++) {
          let note = notes[i];
          if (note.judge != UNJUDGED) continue;
          if (note.type != noteType) continue;
          // if (time < note.time - 3 * tps) continue; // hide distant notes
          let colors = ["#0AC3FF", "#F0ED69", "#0AC3FF", "#FE4365"];
          let hlColors = ["#7ce5ff", "#fffeba", "#7ce5ff", "#ff7369"];
          if (note.hl) {
            ctx.strokeStyle = hlColors[note.type - 1];
          } else {
            ctx.strokeStyle = colors[note.type - 1];
          }
          ctx.fillStyle = colors[note.type - 1];
          let xPosition = note.xPosition;
          let yPosition = note.floorPosition - floorPosition;
          let noteSize = 1.0;
          let fadeTime = 0.16;
          let yScale_ = yScale * note.direction;
          if (note.type != 3) {
            // non-hold
            if (time > note.time + fadeTime * tps) continue;
            yPosition *= note.speed;
            ctx.globalAlpha = Math.min(
              1 - (time - note.time) / (fadeTime * tps),
              1
            );
            ctx.beginPath();
            ctx.moveTo((-noteSize + xPosition) * xScale, -yPosition * yScale_);
            ctx.lineTo((noteSize + xPosition) * xScale, -yPosition * yScale_);
            ctx.stroke();
          } else if (note.type == 3) {
            // hold
            let dTime = Math.min(
              note.time + note.holdTime - time,
              note.holdTime
            );
            let dyPosition = (note.speed / tps) * dTime;
            if (dyPosition <= 0) continue;
            if (time < note.time) {
              ctx.globalAlpha = 1;
              ctx.beginPath();
              ctx.moveTo((xPosition - noteSize) * xScale, -yPosition * yScale_);
              ctx.lineTo((xPosition + noteSize) * xScale, -yPosition * yScale_);
              ctx.stroke();
            } else yPosition = 0;
            if (time > note.time + fadeTime * tps) ctx.globalAlpha = 0.3;
            else ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.fillRect(
              (-noteSize + xPosition) * xScale,
              -(dyPosition + yPosition) * yScale_,
              noteSize * 2 * xScale,
              dyPosition * yScale_
            );
          }
        }
      }
    }
  }
}

function loop() {
  currentTime = audio.currentTime;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawLines();
  drawHitEffects(); // debug
  if (!audio.ended) {
    requestAnimationFrame(loop);
  }
}

init();
