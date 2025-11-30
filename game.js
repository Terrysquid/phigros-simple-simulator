let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");
let startTime;
let chart, music;
let lineLength = 0;

window.addEventListener("resize", () => {
  resizeCanvas();
});

async function init() {
  resizeCanvas();
  audio = new Audio("music.wav");
  bgImage = new Image();
  bgImage.src = "illustration.jpg";
  await loadChart();
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
}

async function loadChart() {
  const res = await fetch("chart.json");
  chart = await res.json();
  for (let l = 0; l < chart.judgeLineList.length; l++) {
    let line = chart.judgeLineList[l];
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
      line.notes.push(note);
    }
    delete line.notesAbove;
    delete line.notesBelow;
  }
}

function drawLines(realTime) {
  if (!chart) return;
  ctx.strokeStyle = "#FFFFBB";
  ctx.lineWidth = (1 / 160) * canvas.height;
  for (let l = 0; l < chart.judgeLineList.length; l++) {
    let line = chart.judgeLineList[l];
    let tps = (32 * line.bpm) / 60; // time (microbeats) per second
    let cx = 0;
    let cy = 0;
    let angle = 0;
    let alpha = 1;
    let time = realTime * tps;
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
      for (let k = 0; k < 4; k++) { // O(4n)
        let noteType = [3, 2, 1, 4][k];
        for (let i = 0; i < notes.length; i++) {
          let note = notes[i];
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
          let xPosition = note.positionX;
          let yPosition = note.floorPosition - floorPosition;
          let noteSize = 1.0;
          let fadeTime = 0.16;
          let xScale = (0.9 / 16) * canvas.width;
          let yScale = 0.6 * canvas.height * note.direction;
          if (note.type != 3) {
            // non-hold
            if (time > note.time + fadeTime * tps) continue;
            yPosition *= note.speed;
            ctx.globalAlpha = Math.min(
              1 - (time - note.time) / (fadeTime * tps),
              1
            );
            ctx.beginPath();
            ctx.moveTo((-noteSize + xPosition) * xScale, -yPosition * yScale);
            ctx.lineTo((noteSize + xPosition) * xScale, -yPosition * yScale);
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
              ctx.moveTo((-noteSize + xPosition) * xScale, -yPosition * yScale);
              ctx.lineTo((noteSize + xPosition) * xScale, -yPosition * yScale);
              ctx.stroke();
            } else yPosition = 0;
            if (time > note.time + fadeTime * tps) ctx.globalAlpha = 0.3;
            else ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.fillRect(
              (-noteSize + xPosition) * xScale,
              -(dyPosition + yPosition) * yScale,
              noteSize * 2 * xScale,
              dyPosition * yScale
            );
          }
        }
      }
    }
  }
}

function loop() {
  let realTime = audio.currentTime;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawLines(realTime);
  if (!audio.ended) {
    requestAnimationFrame(loop);
  }
}

init();