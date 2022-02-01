const sounds = [
    "example sound 1",
    "example sound 2",
];
let i;
createTracklist(sounds);

let loading = true;
let CSScolorMode = 0;
const modeColors = [
    {
        "background": "#111",
        "background-hover": "#222",
        "foreground": "white",
        "active": "#0f6",
    },
    {
        "background": "#eee",
        "background-hover": "#ddd",
        "foreground": "black",
        "active": "#0a1",
    },
];
changeColors();
let darkModeToggle = document.querySelector(".darkModeToggle");
darkModeToggle.onclick = function() {
    CSScolorMode = 1 - CSScolorMode;
    let buttonText;
    switch (CSScolorMode) {
        case 0:
            buttonText = "Lights on";
            break;
        case 1:
            buttonText = "Lights off";
            break;
    }
    darkModeToggle.innerHTML = buttonText;
    changeColors();
}
const drawCircles = true;
const drawRectangles = true;
const drawLines = true;
let circles = [];
const maxCircles = 150;
let rects = [];
let rectId = 0;
const rectDirections = [
    {dx: -1, dy: 0, dz: 0},
    {dx: 0, dy: -1, dz: 0},
    {dx: 1, dy: 0, dz: 0},
    {dx: 0, dy: 1, dz: 0},
    {dx: 0, dy: 0, dz: -1},
    {dx: 0, dy: 0, dz: 1},
];
const maxRects = 600;
let lines = [];
let lineId = 0;
const maxLines = 50;
let hueShift = Math.random() * 360;
let hueArea = 90;
let hueV = 0;
let hueLimit = 360;
let width = window.innerWidth;
let height = window.innerHeight;
let catchRadius = 100;
const bpm = 126;
const bps = bpm / 60;
const spb = (1 / bps);
let autoplay = false;

let sound, amplitude, fft;
let bass, lowMid, mid, highMid, treble;
const showSpectrum = true;
const adjustSpectrumToBase = false;
let savedMillis, yRotation;
let waitForNextPeak = false;
let audioPlayed = false;
let wave = {
    active: false,
    state: 0,
    max: 120,
    satState: 0,
}
let specificSat, specificBright;
let cameraDist;

let currentSound = 0;
const volume = 1;

window.onresize = function() {
    windowResized();
}

let scrub = document.querySelector("#currentTimeScrub");
scrub.onchange = function() {
    scrubTime(scrub);
};

function changeColors() {
    Object.keys(modeColors[CSScolorMode]).forEach(variable => {
        document.querySelector(":root").style.setProperty('--'+variable, modeColors[CSScolorMode][variable]);
    });
}

async function togglePlay() {
    if (getAudioContext().state === 'running') {
        await getAudioContext().suspend();
    } else {
        await startPlay();
    }
}

async function startPlay() {
    await getAudioContext().resume();
    if (getAudioContext().state !== 'running' || !audioPlayed) {
        sound.play(0);
        while (!sound.isPlaying()) {}
    }
    audioPlayed = true;
}

function playNewSound() {
    loading = true;
    sound.stop();
    sound.setPath("sounds/"+sounds[currentSound], function() {
        if (getAudioContext().state !== 'running') getAudioContext().resume();
        document.title = sounds[currentSound];
        if (!autoplay) autoplay = true;
        sound.play(0);
        while (!sound.isPlaying()) {}
        getAnalyzers();
        updateTitle(sounds[currentSound]);
        updateTracklist();
        updateDuration(sound.duration());
        loading = false;
    });
}

function updateDuration(duration) {
    let durationEl = document.querySelector("#duration");
    let durationStr = new Date(1000 * duration).toISOString().substr(11, 8);
    durationEl.innerHTML = durationStr;
}

function scrubTime(el) {
    let duration = sound.duration();
    let newTime = (el.value / el.max) * duration;
    jumpToTime(newTime);
}

function jumpToTime(newTime, duration) {
    getAudioContext().resume();
    if (!sound.isPlaying()) {
        sound.play(newTime);
        while (!sound.isPlaying()) {}
        updateCurrentTime(newTime);
        return;
    }
    try {
        sound.jump(newTime, duration);
    } catch(e) {
        console.log(e);
    }
    updateCurrentTime(newTime);
}

function updateCurrentTime(currentTime) {
    let currentTimeEl = document.querySelector("#currentTime");
    let currentTimeStr = new Date(1000 * currentTime).toISOString().substr(11, 8);
    currentTimeEl.innerHTML = currentTimeStr;
    let scrubTimeEl = document.querySelector("#currentTimeScrub");
    scrubTimeEl.value = 100 * currentTime / sound.duration();
}

window.onkeydown = function(ev) {
    if (ev.key === "ArrowRight") playNextSound();
    if (ev.key === "ArrowLeft") playPrevSound();
    if (ev.key === " ") togglePlay();
    if (ev.key === "t") toggleTrackList();
}

function updateTitle(trackName) {
    document.querySelector("h1").innerHTML = trackName;
}

function createTracklist(sounds) {
    let tracklist = document.querySelector(".trackListContent");
    i = 0;
    sounds.forEach(soundName => {
        let soundEl = document.createElement("div");
        soundEl.classList.add("trackListTrack");
        soundEl.id = i;
        soundEl.innerHTML = soundName;
        soundEl.onclick = function() {
            playTrack(soundEl);
        };
        tracklist.appendChild(soundEl);
        i++;
    });
}

function updateTracklist() {
    let tracklistTracks = document.querySelectorAll(".trackListTrack");
    tracklistTracks.forEach(trackListTrack => {
        if (parseInt(trackListTrack.id) === currentSound) {
            trackListTrack.classList.add("active");
        } else {
            trackListTrack.classList.remove("active");
        }
    });
}

function playTrack(el) {
    let listIndex = parseInt(el.id);
    currentSound = max(0, min(sounds.length, listIndex));
    if (sounds[currentSound]) {
        playNewSound();
    }
}

function playNextSound() {
    currentSound++;
    if (currentSound > sounds.length - 1) currentSound = 0;
    playNewSound();
}

function playPrevSound() {
    currentSound = currentSound - 1;
    if (currentSound < 0) currentSound = sounds.length;
    playNewSound();
}

function getAnalyzers() {
    amplitude = new p5.Amplitude();
    amplitude.setInput(sound);
    fft = new p5.FFT();
    fft.setInput(sound);
}

function showProgress(value) {
    let progress = document.querySelector("progress");
    progress.value = value;
}

async function preload() {
    soundFormats('mp3', 'ogg');
    let progress = document.querySelector("progress");
    progress.style.opacity = "1";
    sound = loadSound("sounds/"+sounds[0], function() {}, function() {}, showProgress);
    progress.style.opacity = "0";
}

function setup() {
    createCanvas(width, height - 4, WEBGL);
    cameraDist = width / 2;
    camera(0, 0, cameraDist);
    colorMode(HSL);
    strokeWeight(.5);
    stroke(0);
    getAnalyzers();
    updateTitle(sounds[currentSound]);
    updateTracklist();
    updateDuration(sound.duration());
    background(0, 1);
    savedMillis = millis();
    yRotation = 0;
    getAudioContext().suspend();
    loading = false;
}

function windowResized() {
    width = window.innerWidth;
    height = window.innerHeight;
    resizeCanvas(width, height - 4);
    cameraDist = (width / 2);
}

function getFrequencyRanges(fft) {
    let freq = [];
    freq[0] = fft.getEnergy("bass");
    freq[1] = fft.getEnergy("lowMid");
    freq[2] = fft.getEnergy("mid");
    freq[3] = fft.getEnergy("highMid");
    freq[4] = fft.getEnergy("treble");
    return freq;
}

function draw() {
    // hue mod, random
    hueShift += .1;
    hueLimit = random(90, 360);
    hueV = min(max(-3, hueV + random(-.1, .1)), 3);
    hueArea = min(max(90, hueArea + hueV), hueLimit);
    if (hueShift >= 360) hueShift -= 360;

    // audio
    if (!loading && sound.currentTime() >= sound.duration() - 0.01 && !sound.isPlaying() && getAudioContext().state === 'running') {
        playNextSound();
    }
    if (sound.isPlaying()) {
        updateCurrentTime(sound.currentTime());
    }
    let spectrum = fft.analyze();
    let freq = getFrequencyRanges(fft);
    let avg = [
        (freq[0] + freq[1]) / (2 * 255),
        (freq[3] + freq[4]) / (255),
    ];

    let treshhold = [];
    treshhold[0] = .7;
    treshhold[1] = .7;
    if (avg[0] < treshhold[0]) { avg[0] = 0 } else { avg[0] = pow((avg[0] - treshhold[0]) / (1 - treshhold[0]), 1.5) }
    if (avg[1] < treshhold[1]) { avg[1] = 0 } else { avg[1] = pow((avg[1] - treshhold[1]) / (1 - treshhold[1]), 4) }
    let speed = min(1, (avg[0] + avg[1]) * .5);
    let speedFactor = pow((speed + .5), 8);
    let brightness = speed * 50;
    let saturation = speed * 100;

    // change hue if lucky :D
    let peakTreshhold = .99;
    if (speed > peakTreshhold && random(0, 1) > .3 && !waitForNextPeak) {
        hueShift += 120;
        if (hueShift >= 360) hueShift -= 360;
        waitForNextPeak = true;
    } else if (speed < peakTreshhold) {
        waitForNextPeak = false;
    }

    if (CSScolorMode !== 1) {
        background(0);
    } else {
        background(255);
    }
    camera(0, 0, cameraDist + (speedFactor * height * .001));

    let millisDif = millis() - savedMillis;
    yRotation = yRotation + (millisDif / 400) + speed * .4;
    angleMode(DEGREES);
    rotateY(yRotation);
    savedMillis = millis();

    /* Frequency bars */
    if (showSpectrum) {0
        let visWidth = 20 * (width / 2000);
        let visHeight = height / 4;

        // range bars
        strokeWeight(1.5);
        if (CSScolorMode !== 1) {
            fill(0);
            stroke(0, 0, 100, 255);
        } else {
            fill(240);
            stroke(0, 0, 0, 255);
        }
        let oddity = (freq.length % 2) * visWidth * 1.125;
        let freqOffset = -((freq.length - 1) / 2) * visWidth * 1.25 - oddity;
        i = freq.length - 1;
        freq.forEach(range => {
            range /= 255;
            freqOffset += visWidth * 1.25;
            let x = freqOffset;
            let h = visHeight * pow(range, 1 + (i * 1.5));
            let y;
            if (adjustSpectrumToBase) {
                y = -h / 2;
            } else {
                y = 0;
            }
            translate(x, y, 0);
            box(visWidth, h, visWidth);
            translate(-x, -y, 0);
            i--;
        });
        strokeWeight(.5);
    }

    if (!wave.active && random(0, 1) > 1 - (1 / 1000)) {
        wave.active = true;
        wave.max = random(120, 300); // frames
        wave.state = 0;
    } else {
        if (wave.active && wave.state < wave.max) {
            wave.state++;
            wave.satState = (wave.state - (wave.max / 2)) / (wave.max / 2);
            wave.satState *= width;
        } else {
            wave.active = false;
            wave.state = 0;
        }
    }

    if (drawCircles) {
        if (circles.length < maxCircles) {
            addCircle();
        } else {
            circles.shift();
            addCircle();
        }
    }
    if (drawRectangles) {
        if (frameCount % round(16 / speedFactor) === 0) {
            if (rects.length < maxRects) {
                addRect();
            } else {
                rects.shift();
                addRect();
            }
        }
    }
    if (drawLines) {
        if (frameCount % round(16 / speedFactor) === 0) {
            if (lines.length < maxLines) {
                addLine();
            } else {
                lines.shift();
                addLine();
            }
        }
    }

    i = 0;
    lines.forEach(lineEl => {
        i++;
        let opacity = i / lines.length;
        let hue = (opacity * hueArea) + hueShift;
        while (hue > 360) hue -= 360;
        opacity = max(0, opacity - random(0, 0.1));
        let satResults = getWaveStates(lineEl.x, saturation, brightness, opacity, hue);
        let specificSat = satResults.specificSat;
        let specificBright = satResults.specificBright;
        opacity = satResults.opacity;
        hue = satResults.hue;

        // draw
        opacity = opacity * speedFactor * random(0.5, 1);
        if (CSScolorMode !== 1) {
            stroke(hue, specificSat, specificBright, opacity);
        } else {
            stroke(hue, specificSat, 100 - specificBright, opacity);
        }
        if (opacity > .8 && avg[0] > .1) {
            line(lineEl.x, lineEl.y, lineEl.z, lineEl.x2, lineEl.y2, lineEl.z2);
        }

        let bounds = random(.001, .005);
        let index = i - 2;
        if (i === 1) {
            lineEl.vx = lineEl.vx + random(-bounds, bounds);
            lineEl.vy = lineEl.vy + random(-bounds, bounds);
            lineEl.vz = lineEl.vz + random(-bounds, bounds);
        } else {
            lineEl.vx = lines[index].vx2;
            lineEl.vy = lines[index].vy2;
            lineEl.vz = lines[index].vz2;
        }
        lineEl.x += lineEl.vx * speedFactor;
        lineEl.y += lineEl.vy * speedFactor;
        lineEl.z += lineEl.vz * speedFactor;
        lineEl.vx2 = lineEl.vx2 + random(-bounds, bounds);
        lineEl.vy2 = lineEl.vy2 + random(-bounds, bounds);
        lineEl.vz2 = lineEl.vz2 + random(-bounds, bounds);
        lineEl.x2 += lineEl.vx2 * speedFactor;
        lineEl.y2 += lineEl.vy2 * speedFactor;
        lineEl.z2 += lineEl.vz2 * speedFactor;
    });

    i = 0;
    rects.forEach(rectEl => {
        i++;
        let opacity = i / rects.length;
        let hue = (opacity * hueArea) + hueShift;
        while (hue > 360) hue -= 360;
        opacity = max(0, opacity - random(0, 0.1));
        let satResults = getWaveStates(rectEl.x, saturation, brightness, opacity, hue);
        let specificSat = satResults.specificSat;
        let specificBright = satResults.specificBright;
        opacity = satResults.opacity;
        hue = satResults.hue;

        // draw
        translate(rectEl.x, rectEl.y, rectEl.z);
        if (CSScolorMode !== 1) {
            fill(hue, saturation, brightness, opacity * (brightness / 50) * (saturation * 100));
            stroke(hue, specificSat, specificBright, (1 - opacity) * speedFactor);
        } else {
            fill(hue, saturation, 100 - brightness, opacity * (brightness / 50) * (saturation * 100));
            stroke(hue, specificSat, 100 - specificBright, (1 - opacity) * speedFactor);
        }
        if (rectEl.s < 16 + (20 * avg[0]) && rectEl.s > 16 - (10 * avg[1])) box(rectEl.s);
        translate(-rectEl.x, -rectEl.y, -rectEl.z);

        let bounds = random(.001, .005);
        let halfSize = rectEl.s / 2;
        rectEl.vx = min(max(rectEl.vx + random(-bounds, bounds), -halfSize), halfSize);
        rectEl.vy = min(max(rectEl.vy + random(-bounds, bounds), -halfSize), halfSize);
        rectEl.vz = min(max(rectEl.vz + random(-bounds, bounds), -halfSize), halfSize);
        rectEl.x += rectEl.vx * speedFactor;
        rectEl.y += rectEl.vy * speedFactor;
        rectEl.z += rectEl.vz * speedFactor;
    });

    i = 0;
    circles.forEach(circleEl => {
        i++;
        let opacity = i / circles.length;
        opacity *= opacity;
        let hue = (opacity * hueArea) + hueShift + (circleEl.Hoffset / 10);
        while (hue > 360) hue -= 360;
        let satResults = getWaveStates(circleEl.x, saturation, brightness, opacity, hue);
        let specificSat = satResults.specificSat;
        let specificBright = satResults.specificBright;
        opacity = satResults.opacity;
        hue = satResults.hue;

        // draw
        translate(circleEl.x, circleEl.y, circleEl.z);
        if (CSScolorMode !== 1) {
            stroke(hue, specificSat, specificBright, opacity * speedFactor);
        } else {
            stroke(hue, specificSat, 100 - specificBright, opacity * speedFactor);
        }
        fill(0, 0);
        circle(0, 0, circleEl.size);
        translate(-circleEl.x, -circleEl.y, -circleEl.z);
        let bounds = random(.001, .1);
        circleEl.vx = min(max(circleEl.vx + random(-bounds, bounds), -circleEl.size / 2), circleEl.size / 2);
        circleEl.vy = min(max(circleEl.vy + random(-bounds, bounds), -circleEl.size / 2), circleEl.size / 2);
        circleEl.vz = min(max(circleEl.vz + random(-bounds, bounds), -circleEl.size / 2), circleEl.size / 2);
        circleEl.x += circleEl.vx * speedFactor;
        circleEl.y += circleEl.vy * speedFactor;
        circleEl.z += circleEl.vz * speedFactor;
        circleEl.size += random(-bounds / 5, bounds / 5);
    });

    function getWaveStates(x, saturation, brightness, opacity, hue) {
        let specificSat, specificBright;
        if (wave.active) {
            let dist = max(x, wave.satState) - min(x, wave.satState);
            let part = 1 - (dist / (2 * width));
            if (part > .9) {
                specificSat = 100 * part;
                specificBright = part * 50;
                opacity = 1;
                hue = millis() % 360;
            } else {
                specificSat = saturation;
                specificBright = brightness;
                opacity: 0;
            }
        } else {
            specificSat = saturation;
            specificBright = brightness;
        }
        return {specificSat, specificBright, opacity, hue};
    }

    function addCircle() {
        let x, y, z;
        x = random(-width / 2, width / 2);
        y = random(-height / 2, height / 2);
        z = random(-width, width);
        let startV = .2;
        let vx = random(-startV, startV);
        let vy = random(-startV, startV);
        let vz = random(-startV, startV);
        let size = random(1, 40);
        let Hoffset = random(0, 360);
        circles.push({x, y, z, vx, vy, vz, size, Hoffset});
    }

    function addRect() {
        let x, y, z, s;
        let idCount = rects.filter(rect => rect.rectId === rectId).length;
        if (idCount > random(50, 100) || rects.length === 0) {
            rectId++;
            let maxSize = 22;
            x = random(-width / 2, width / 2);
            y = random(-height / 2, height / 2);
            z = random(-width, width);
            s = random(12, maxSize);
        } else {
            let index = rects.length - 1;
            let offset = (rects[index].s * 2);

            let direction = rectDirections[round(random(0, 5))];

            x = rects[index].x + (direction.dx * offset);
            y = rects[index].y + (direction.dy * offset);
            z = rects[index].z + (direction.dz * offset);
            let change = .3;
            s = rects[index].s + random(-rects[index].s * change, rects[index].s * change);
        }
        const startV = .0005;
        let vx = random(-startV, startV);
        let vy = random(-startV, startV);
        let vz = random(-startV, startV);
        rects.push({x, y, z, vx, vy, vz, s, rectId});
    }

    function addLine() {
        let x, y, z, x2, y2, z2;
        let vx, vy, vz, vx2, vy2, vz2;
        let dist = 500;
        let idCount = lines.filter(line => line.lineId === lineId).length;
        const startV = .0005;
        if (idCount > random(10, 100) || lines.length === 0) {
            lineId++;
            x = random(-width / 2, width / 2);
            y = random(-height / 2, height / 2);
            z = random(-width, width);
            x2 = x + random(-dist, dist);
            y2 = y + random(-dist, dist);
            z2 = z + random(-dist, dist);
            vx = random(-startV, startV);
            vy = random(-startV, startV);
            vz = random(-startV, startV);
        } else {
            let index = lines.length - 1;
            x = lines[index].x2;
            y = lines[index].y2;
            z = lines[index].z2;
            vx = lines[index].vx2;
            vy = lines[index].vy2;
            vz = lines[index].vz2;
            x2 = x + random(-dist, dist);
            y2 = y + random(-dist, dist);
            z2 = z + random(-dist, dist);
        }
        vx2 = random(-startV, startV);
        vy2 = random(-startV, startV);
        vz2 = random(-startV, startV);
        lines.push({x, y, z, x2, y2, z2, vx, vy, vz, vx2, vy2, vz2, lineId});
    }
}

window.preload = preload;
window.setup = setup;
window.draw = draw;