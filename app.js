/* ============================================================
   Disk Scheduling Algorithm Visualizer — Enhanced App Logic
   ============================================================ */

// ── DOM References ──────────────────────────────────────────
const requestInput = document.getElementById('request-input');
const headInput = document.getElementById('head-input');
const diskSizeInput = document.getElementById('disk-size-input');
const directionSelect = document.getElementById('direction-select');
const algoFCFS = document.getElementById('algo-fcfs');
const algoSSTF = document.getElementById('algo-sstf');
const algoSCAN = document.getElementById('algo-scan');
const visualizeBtn = document.getElementById('visualize-btn');
const sampleBtn = document.getElementById('sample-btn');
const clearBtn = document.getElementById('clear-btn');
const resultsSection = document.getElementById('results-section');
const metricsRow = document.getElementById('metrics-row');
const vizCanvas = document.getElementById('viz-canvas');
const legendEl = document.getElementById('legend');
const comparisonBody = document.getElementById('comparison-body');
const breakdownGrid = document.getElementById('breakdown-grid');
const starvationPanel = document.getElementById('starvation-panel');
const starvationChart = document.getElementById('starvation-chart');
const viewTabs = document.getElementById('view-tabs');
const viewDesc = document.getElementById('view-desc');
const btnRestart = document.getElementById('btn-restart');
const btnPrevStep = document.getElementById('btn-prev-step');
const btnPlayPause = document.getElementById('btn-play-pause');
const btnNextStep = document.getElementById('btn-next-step');
const stepSlider = document.getElementById('step-slider');
const stepCounter = document.getElementById('step-counter');
const speedSelect = document.getElementById('speed-select');
const stepExplanation = document.getElementById('step-explanation');
const playIcon = document.getElementById('play-icon');
const playLabel = document.getElementById('play-label');
const radarCanvas = document.getElementById('radar-canvas');
const heatmapGrid = document.getElementById('heatmap-grid');
const diskArmCanvas = document.getElementById('disk-arm-canvas');
const diskArmControls = document.getElementById('disk-arm-controls');
const themeToggleBtn = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');

// ── Colors ───────────────────────────────────────────────────
const ALGO_COLORS = { FCFS: '#4f8ef7', SSTF: '#14b8a6', SCAN: '#f59e0b' };
const ALGO_CLASSES = { FCFS: 'fcfs-card', SSTF: 'sstf-card', SCAN: 'scan-card' };

// ── Animation State ──────────────────────────────────────────
const anim = {
    results: [],
    diskSize: 0,
    requests: [],
    currentStep: 0,
    maxSteps: 0,
    isPlaying: false,
    speed: 450,
    timerId: null,
    viewMode: 'path',
    diskArmAlgo: null,
};

// ── Theme Toggle ─────────────────────────────────────────────

function getCanvasBg() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? '#e4e8f0' : '#0a1628';
}

function initTheme() {
    const saved = localStorage.getItem('disk-viz-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
}

function updateThemeIcon(theme) {
    if (theme === 'light') {
        themeIcon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
    } else {
        themeIcon.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
    }
}

themeToggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('disk-viz-theme', next);
    updateThemeIcon(next);
    if (!resultsSection.classList.contains('hidden')) {
        redrawCurrentView();
        drawRadarChart(anim.results);
        if (anim.diskArmAlgo) drawDiskArm(anim.results, anim.diskSize, anim.currentStep);
    }
});

initTheme();

// ── Algorithm Implementations (with explanations) ────────────

function fcfs(requests, head) {
    const order = [head, ...requests];
    let totalMovement = 0;
    const movements = [];
    const stepExplanations = [];

    for (let i = 1; i < order.length; i++) {
        const dist = Math.abs(order[i] - order[i - 1]);
        totalMovement += dist;
        movements.push({ from: order[i - 1], to: order[i], distance: dist });
        stepExplanations.push({
            from: order[i - 1],
            to: order[i],
            distance: dist,
            reason: `Serving request <strong>#${i}</strong> of ${requests.length} in arrival order — cylinder <strong>${order[i]}</strong>.`,
            insight: `FCFS doesn't optimize. It blindly follows the queue, regardless of how far away the next cylinder is.`,
            isLargeJump: dist > (totalMovement / i) * 1.5 && i > 1,
        });
    }

    return {
        name: 'FCFS',
        sequence: order,
        totalMovement,
        avgSeekTime: requests.length ? (totalMovement / requests.length).toFixed(2) : 0,
        movements,
        stepExplanations,
        waitSteps: null,
    };
}

function sstf(requests, head) {
    const pendingWithMeta = requests.map((r, i) => ({ val: r, arrivalIdx: i, waitedSteps: 0 }));
    const order = [head];
    let totalMovement = 0;
    const movements = [];
    const stepExplanations = [];
    let current = head;
    let stepNum = 0;

    while (pendingWithMeta.length > 0) {
        // Increment wait for all non-chosen requests
        pendingWithMeta.forEach(p => p.waitedSteps++);

        let minIdx = 0;
        let minDist = Math.abs(pendingWithMeta[0].val - current);
        for (let i = 1; i < pendingWithMeta.length; i++) {
            const d = Math.abs(pendingWithMeta[i].val - current);
            if (d < minDist) { minDist = d; minIdx = i; }
        }

        const chosen = pendingWithMeta.splice(minIdx, 1)[0];
        totalMovement += minDist;

        // Mention the next closest for educational comparison
        const nextClosest = pendingWithMeta.length > 0
            ? pendingWithMeta.reduce((best, p) => {
                const d = Math.abs(p.val - chosen.val);
                return d < best.d ? { val: p.val, d } : best;
            }, { val: null, d: Infinity })
            : null;

        let skipNote = nextClosest && nextClosest.val !== null
            ? ` Next closest available: <strong>${nextClosest.val}</strong> (${nextClosest.d} away).`
            : '';

        movements.push({ from: current, to: chosen.val, distance: minDist });
        stepExplanations.push({
            from: current,
            to: chosen.val,
            distance: minDist,
            reason: `Cylinder <strong>${chosen.val}</strong> is the nearest unserved request — only <strong>${minDist}</strong> cylinder${minDist !== 1 ? 's' : ''} away.${skipNote}`,
            insight: `SSTF always picks the greedy closest choice. This is great for throughput but can leave distant requests waiting many steps.`,
            isLargeJump: false,
        });

        order.push(chosen.val);
        current = chosen.val;
        stepNum++;
    }

    // Build wait-time map: cylinder → steps waited
    const waitMap = {};
    requests.forEach((r, i) => {
        // find when it was served
        for (let s = 1; s < order.length; s++) {
            if (order[s] === r) {
                waitMap[r] = s - 1; // steps before it was served (approximate)
                break;
            }
        }
    });

    return {
        name: 'SSTF',
        sequence: order,
        totalMovement,
        avgSeekTime: requests.length ? (totalMovement / requests.length).toFixed(2) : 0,
        movements,
        stepExplanations,
        waitMap,
    };
}

function scan(requests, head, diskSize, direction) {
    const sorted = [...requests].sort((a, b) => a - b);
    const left = sorted.filter(r => r < head);
    const right = sorted.filter(r => r >= head);

    let order = [head];
    let totalMovement = 0;
    const movements = [];
    const stepExplanations = [];
    let current = head;

    function addStep(target, reason, insight) {
        const dist = Math.abs(target - current);
        totalMovement += dist;
        movements.push({ from: current, to: target, distance: dist });
        stepExplanations.push({
            from: current,
            to: target,
            distance: dist,
            reason,
            insight: insight || `SCAN sweeps directionally like an elevator — bounded wait time with solid throughput.`,
            isLargeJump: target === 0 || target === diskSize - 1,
        });
        order.push(target);
        current = target;
    }

    if (direction === 'right') {
        for (const r of right) {
            addStep(r, `Sweeping <strong>RIGHT →</strong> — cylinder <strong>${r}</strong> is the next request in our path.`);
        }
        if (current !== diskSize - 1) {
            addStep(diskSize - 1,
                `No more right-side requests. Travelling to disk boundary (<strong>${diskSize - 1}</strong>).`,
                `SCAN must reach the boundary before reversing. This guarantees bounded waiting — no request waits more than one full sweep.`
            );
        }
        for (let i = left.length - 1; i >= 0; i--) {
            addStep(left[i], `Reversing <strong>← LEFT</strong> — cylinder <strong>${left[i]}</strong> is the next request on the return sweep.`);
        }
    } else {
        for (let i = left.length - 1; i >= 0; i--) {
            addStep(left[i], `Sweeping <strong>← LEFT</strong> — cylinder <strong>${left[i]}</strong> is the next request in our path.`);
        }
        if (current !== 0) {
            addStep(0,
                `No more left-side requests. Travelling to disk boundary (<strong>0</strong>).`,
                `SCAN must reach the boundary before reversing. This guarantees bounded waiting — no request waits more than one full sweep.`
            );
        }
        for (const r of right) {
            addStep(r, `Reversing <strong>RIGHT →</strong> — cylinder <strong>${r}</strong> is the next request on the return sweep.`);
        }
    }

    return {
        name: 'SCAN',
        sequence: order,
        totalMovement,
        avgSeekTime: requests.length ? (totalMovement / requests.length).toFixed(2) : 0,
        movements,
        stepExplanations,
        waitMap: null,
    };
}

// ── Input Parsing ────────────────────────────────────────────

function parseInput() {
    const rawRequests = requestInput.value.trim();
    const headPos = parseInt(headInput.value, 10);
    const diskSize = parseInt(diskSizeInput.value, 10);
    const direction = directionSelect.value;

    if (!rawRequests) throw new Error('Please enter a disk request queue.');
    if (isNaN(headPos) || headPos < 0) throw new Error('Please enter a valid initial head position (≥ 0).');
    if (isNaN(diskSize) || diskSize < 1) throw new Error('Please enter a valid disk size (≥ 1).');

    const requests = rawRequests.split(',').map(s => {
        const n = parseInt(s.trim(), 10);
        if (isNaN(n)) throw new Error(`Invalid request value: "${s.trim()}"`);
        if (n < 0 || n >= diskSize) throw new Error(`Request ${n} is out of range [0, ${diskSize - 1}].`);
        return n;
    });

    if (headPos >= diskSize) throw new Error(`Head position ${headPos} must be less than disk size ${diskSize}.`);

    return { requests, headPos, diskSize, direction };
}

// ── Toast ────────────────────────────────────────────────────

let toastEl = null, toastTimeout = null;
function showToast(message) {
    if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.className = 'toast';
        document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toastEl.classList.remove('show'), 3500);
}

// ── Canvas Helpers ───────────────────────────────────────────

function setupCanvas(height = 400) {
    const dpr = window.devicePixelRatio || 1;
    const rect = vizCanvas.parentElement.getBoundingClientRect();
    const width = rect.width - 32;
    vizCanvas.width = width * dpr;
    vizCanvas.height = height * dpr;
    vizCanvas.style.width = width + 'px';
    vizCanvas.style.height = height + 'px';
    const ctx = vizCanvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx, width, height };
}

// ── Path View Drawing ────────────────────────────────────────

function drawPathView(results, diskSize, upToStep) {
    const { ctx, width, height } = setupCanvas(400);
    const pad = { left: 58, right: 30, top: 36, bottom: 48 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    // Background
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, width, height);

    const maxSteps = Math.max(...results.map(r => r.sequence.length));

    function xPos(cyl) { return pad.left + (cyl / (diskSize - 1)) * plotW; }
    function yPos(step) { return pad.top + (step / Math.max(maxSteps - 1, 1)) * plotH; }

    // Grid
    ctx.strokeStyle = 'rgba(148,163,184,0.06)';
    ctx.lineWidth = 1;
    const xTicks = Math.min(10, diskSize - 1);
    for (let i = 0; i <= xTicks; i++) {
        const cyl = Math.round((i / xTicks) * (diskSize - 1));
        const x = xPos(cyl);
        ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + plotH); ctx.stroke();
    }
    for (let i = 0; i < maxSteps; i++) {
        const y = yPos(i);
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + plotW, y); ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = '#4b5563';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i <= xTicks; i++) {
        const cyl = Math.round((i / xTicks) * (diskSize - 1));
        ctx.fillText(cyl, xPos(cyl), pad.top + plotH + 18);
    }
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px "Space Grotesk", sans-serif';
    ctx.fillText('Cylinder Number', pad.left + plotW / 2, height - 6);

    ctx.textAlign = 'right';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#4b5563';
    for (let i = 0; i < maxSteps; i++) {
        ctx.fillText(i, pad.left - 8, yPos(i) + 4);
    }

    ctx.save();
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px "Space Grotesk", sans-serif';
    ctx.translate(12, pad.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Step', 0, 0);
    ctx.restore();

    // Draw ghost path (dimmed full path)
    results.forEach((result, idx) => {
        const color = ALGO_COLORS[result.name];
        const seq = result.sequence;
        const offset = (idx - (results.length - 1) / 2) * 2.5;

        ctx.strokeStyle = color + '22';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        for (let i = 0; i < seq.length; i++) {
            const x = xPos(seq[i]) + offset;
            const y = yPos(i);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    });

    // Draw active path up to upToStep
    results.forEach((result, idx) => {
        const color = ALGO_COLORS[result.name];
        const seq = result.sequence;
        const offset = (idx - (results.length - 1) / 2) * 2.5;
        const stepsToShow = Math.min(upToStep + 1, seq.length);

        if (stepsToShow < 1) return;

        // Glow effect
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < stepsToShow; i++) {
            const x = xPos(seq[i]) + offset;
            const y = yPos(i);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Points
        for (let i = 0; i < stepsToShow; i++) {
            const x = xPos(seq[i]) + offset;
            const y = yPos(i);
            const isCurrent = i === stepsToShow - 1 && upToStep > 0;
            ctx.beginPath();
            ctx.arc(x, y, isCurrent ? 6 : 3.5, 0, Math.PI * 2);
            if (isCurrent) {
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = color;
                ctx.shadowBlur = 12;
            } else {
                ctx.fillStyle = color;
            }
            ctx.fill();
            ctx.shadowBlur = 0;
            if (isCurrent) {
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
    });

    // START label
    if (results.length > 0 && upToStep >= 0) {
        const startX = xPos(results[0].sequence[0]);
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 10px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('▶ START', startX, pad.top - 14);
    }
}

// ── Per-Step Seeks Bar Chart ─────────────────────────────────

function drawSeeksChart(results, upToStep) {
    const maxSeekSteps = Math.max(...results.map(r => r.movements.length));
    const showSteps = Math.min(upToStep, maxSeekSteps);
    const { ctx, width, height } = setupCanvas(380);

    const pad = { left: 62, right: 20, top: 36, bottom: 48 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, width, height);

    if (showSteps === 0) {
        ctx.fillStyle = '#4b5563';
        ctx.font = '13px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Press Play or step forward to see seek distances', width / 2, height / 2);
        return;
    }

    const allDists = results.flatMap(r => r.movements.map(m => m.distance));
    const maxDist = Math.max(...allDists, 1);

    const stepCount = showSteps;
    const groupW = plotW / Math.max(stepCount, 1);
    const barW = Math.max(2, Math.min(18, (groupW / results.length) - 2));
    const groupPad = (groupW - barW * results.length) / 2;

    // Grid lines
    ctx.strokeStyle = 'rgba(148,163,184,0.07)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = pad.top + (i / 4) * plotH;
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + plotW, y); ctx.stroke();
        const val = Math.round(maxDist * (1 - i / 4));
        ctx.fillStyle = '#4b5563';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(val, pad.left - 6, y + 4);
    }

    // Bars
    for (let s = 0; s < stepCount; s++) {
        const groupX = pad.left + s * groupW + groupPad;
        results.forEach((result, ri) => {
            if (s >= result.movements.length) return;
            const dist = result.movements[s].distance;
            const barH = (dist / maxDist) * plotH;
            const x = groupX + ri * (barW + 2);
            const y = pad.top + plotH - barH;
            const color = ALGO_COLORS[result.name];
            const isActive = s === stepCount - 1;

            ctx.fillStyle = isActive ? color : color + '88';
            if (isActive) {
                ctx.shadowColor = color;
                ctx.shadowBlur = 8;
            }
            // Rounded top
            const radius = Math.min(3, barH / 2);
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + barW - radius, y);
            ctx.quadraticCurveTo(x + barW, y, x + barW, y + radius);
            ctx.lineTo(x + barW, y + barH);
            ctx.lineTo(x, y + barH);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
        });

        // Step number
        if (stepCount <= 20 || s % 2 === 0) {
            ctx.fillStyle = '#4b5563';
            ctx.font = '9px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(s + 1, pad.left + s * groupW + groupW / 2, pad.top + plotH + 15);
        }
    }

    // Axes labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Step Number', pad.left + plotW / 2, height - 6);

    ctx.save();
    ctx.translate(12, pad.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Seek Distance (cylinders)', 0, 0);
    ctx.restore();

    // Chart title
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Seek distance per step — smaller bars = less head movement', pad.left + plotW / 2, pad.top - 14);
}

// ── Cumulative Seek Chart ────────────────────────────────────

function drawCumulativeChart(results, upToStep) {
    const { ctx, width, height } = setupCanvas(380);
    const pad = { left: 70, right: 30, top: 36, bottom: 48 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, width, height);

    const maxTotal = Math.max(...results.map(r => r.totalMovement), 1);
    const maxSteps = Math.max(...results.map(r => r.sequence.length));
    const showSteps = Math.min(upToStep + 1, maxSteps);

    function xPos(step) { return pad.left + (step / Math.max(maxSteps - 1, 1)) * plotW; }
    function yPos(cum) { return pad.top + (1 - cum / maxTotal) * plotH; }

    // Grid
    ctx.strokeStyle = 'rgba(148,163,184,0.07)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = pad.top + (i / 4) * plotH;
        const val = Math.round(maxTotal * (1 - i / 4));
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + plotW, y); ctx.stroke();
        ctx.fillStyle = '#4b5563';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(val, pad.left - 8, y + 4);
    }
    const xTicks = Math.min(8, maxSteps - 1);
    for (let i = 0; i <= xTicks; i++) {
        const step = Math.round((i / xTicks) * (maxSteps - 1));
        const x = xPos(step);
        ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + plotH); ctx.stroke();
        ctx.fillStyle = '#4b5563';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(step, x, pad.top + plotH + 16);
    }

    // Draw ghost lines (full path, dimmed)
    results.forEach(result => {
        const color = ALGO_COLORS[result.name];
        const seq = result.sequence;
        ctx.strokeStyle = color + '22';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        let cum = 0;
        ctx.moveTo(xPos(0), yPos(0));
        for (let i = 1; i < seq.length; i++) {
            cum += Math.abs(seq[i] - seq[i - 1]);
            ctx.lineTo(xPos(i), yPos(cum));
        }
        ctx.stroke();
        ctx.setLineDash([]);
    });

    // Draw active lines
    results.forEach(result => {
        const color = ALGO_COLORS[result.name];
        const seq = result.sequence;
        const stepsToShow = Math.min(showSteps, seq.length);
        if (stepsToShow < 1) return;

        // Area fill
        ctx.beginPath();
        let cum = 0;
        ctx.moveTo(xPos(0), pad.top + plotH);
        ctx.lineTo(xPos(0), yPos(0));
        for (let i = 1; i < stepsToShow; i++) {
            cum += Math.abs(seq[i] - seq[i - 1]);
            ctx.lineTo(xPos(i), yPos(cum));
        }
        ctx.lineTo(xPos(stepsToShow - 1), pad.top + plotH);
        ctx.closePath();
        ctx.fillStyle = color + '18';
        ctx.fill();

        // Line
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        cum = 0;
        ctx.moveTo(xPos(0), yPos(0));
        for (let i = 1; i < stepsToShow; i++) {
            cum += Math.abs(seq[i] - seq[i - 1]);
            ctx.lineTo(xPos(i), yPos(cum));
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // End dot
        const endX = xPos(stepsToShow - 1);
        const endY = yPos(cum);
        ctx.beginPath();
        ctx.arc(endX, endY, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Label at end
        if (stepsToShow > 3) {
            ctx.fillStyle = color;
            ctx.font = 'bold 10px "Space Grotesk", sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`${result.name}: ${cum}`, endX + 8, endY + 4);
        }
    });

    // Axes labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Step Number', pad.left + plotW / 2, height - 6);
    ctx.save();
    ctx.translate(14, pad.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Cumulative Head Movement', 0, 0);
    ctx.restore();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Slower rising = more efficient algorithm', pad.left + plotW / 2, pad.top - 14);
}

// ── Redraw Dispatcher ────────────────────────────────────────

function redrawCurrentView() {
    if (anim.results.length === 0) return;
    if (anim.viewMode === 'path') {
        drawPathView(anim.results, anim.diskSize, anim.currentStep);
    } else if (anim.viewMode === 'seeks') {
        drawSeeksChart(anim.results, anim.currentStep);
    } else if (anim.viewMode === 'cumulative') {
        drawCumulativeChart(anim.results, anim.currentStep);
    }
}

// ── Radar Chart ──────────────────────────────────────────────

function drawRadarChart(results) {
    if (!results || results.length === 0) return;
    const canvas = radarCanvas;
    const dpr = window.devicePixelRatio || 1;
    const size = 420;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const bg = getCanvasBg();
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    const cx = size / 2, cy = size / 2;
    const maxR = 155;
    const axes = ['Low Total Move', 'Low Avg Seek', 'Low Max Seek', 'Consistency'];
    const numAxes = axes.length;
    const angleStep = (2 * Math.PI) / numAxes;
    const startAngle = -Math.PI / 2;

    // Compute raw metrics
    const metrics = results.map(r => {
        const dists = r.movements.map(m => m.distance);
        const mean = dists.reduce((s, d) => s + d, 0) / (dists.length || 1);
        const variance = dists.reduce((s, d) => s + (d - mean) ** 2, 0) / (dists.length || 1);
        const maxSeek = Math.max(...dists, 0);
        return {
            totalMovement: r.totalMovement,
            avgSeek: parseFloat(r.avgSeekTime),
            maxSeek,
            variance,
        };
    });

    // Normalize each axis: invert so lower = better = larger radius
    const maxVals = {
        totalMovement: Math.max(...metrics.map(m => m.totalMovement), 1),
        avgSeek: Math.max(...metrics.map(m => m.avgSeek), 1),
        maxSeek: Math.max(...metrics.map(m => m.maxSeek), 1),
        variance: Math.max(...metrics.map(m => m.variance), 1),
    };

    const normalized = metrics.map(m => [
        1 - m.totalMovement / maxVals.totalMovement,
        1 - m.avgSeek / maxVals.avgSeek,
        1 - m.maxSeek / maxVals.maxSeek,
        1 - m.variance / maxVals.variance,
    ].map(v => Math.max(v, 0.08)));

    // Draw grid rings
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    for (let ring = 1; ring <= 4; ring++) {
        const r = (ring / 4) * maxR;
        ctx.beginPath();
        for (let i = 0; i <= numAxes; i++) {
            const angle = startAngle + i * angleStep;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = isLight ? 'rgba(30,50,100,0.08)' : 'rgba(148,163,184,0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Draw axis lines and labels
    const labelColor = isLight ? '#4a5068' : '#6b7280';
    for (let i = 0; i < numAxes; i++) {
        const angle = startAngle + i * angleStep;
        const x = cx + maxR * Math.cos(angle);
        const y = cy + maxR * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(x, y);
        ctx.strokeStyle = isLight ? 'rgba(30,50,100,0.12)' : 'rgba(148,163,184,0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();

        const lx = cx + (maxR + 24) * Math.cos(angle);
        const ly = cy + (maxR + 24) * Math.sin(angle);
        ctx.fillStyle = labelColor;
        ctx.font = '11px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(axes[i], lx, ly);
    }

    // Draw algorithm polygons
    results.forEach((result, ri) => {
        const color = ALGO_COLORS[result.name];
        const vals = normalized[ri];

        // Fill
        ctx.beginPath();
        for (let i = 0; i < numAxes; i++) {
            const angle = startAngle + i * angleStep;
            const r = vals[i] * maxR;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = color + '30';
        ctx.fill();

        // Stroke
        ctx.beginPath();
        for (let i = 0; i < numAxes; i++) {
            const angle = startAngle + i * angleStep;
            const r = vals[i] * maxR;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Points
        for (let i = 0; i < numAxes; i++) {
            const angle = startAngle + i * angleStep;
            const r = vals[i] * maxR;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
        }
    });

    // Legend
    const legendY = size - 18;
    let legendX = cx - (results.length * 60) / 2;
    results.forEach(r => {
        ctx.fillStyle = ALGO_COLORS[r.name];
        ctx.fillRect(legendX, legendY - 4, 14, 4);
        ctx.fillStyle = labelColor;
        ctx.font = '10px "Space Grotesk", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(r.name, legendX + 18, legendY);
        legendX += 65;
    });
}

// ── Disk Heatmap ─────────────────────────────────────────────

function renderDiskHeatmap(results, diskSize) {
    if (!results || results.length === 0) return;
    const numBuckets = Math.min(20, diskSize);
    const bucketSize = diskSize / numBuckets;

    heatmapGrid.innerHTML = results.map(result => {
        // Count visits per bucket
        const buckets = new Array(numBuckets).fill(0);
        result.sequence.forEach(cyl => {
            const bi = Math.min(Math.floor(cyl / bucketSize), numBuckets - 1);
            buckets[bi]++;
        });
        // Also count pass-through
        for (let i = 1; i < result.sequence.length; i++) {
            const from = result.sequence[i - 1];
            const to = result.sequence[i];
            const lo = Math.min(from, to);
            const hi = Math.max(from, to);
            for (let b = 0; b < numBuckets; b++) {
                const bStart = b * bucketSize;
                const bEnd = (b + 1) * bucketSize;
                if (bStart < hi && bEnd > lo) buckets[b]++;
            }
        }

        const maxBucket = Math.max(...buckets, 1);
        const color = ALGO_COLORS[result.name];

        const cellsHTML = buckets.map((count, bi) => {
            const intensity = count / maxBucket;
            const cylStart = Math.round(bi * bucketSize);
            const cylEnd = Math.round((bi + 1) * bucketSize - 1);
            // Interpolate from dim to bright
            const alpha = 0.1 + intensity * 0.9;
            return `<div class="heatmap-cell" style="background: ${color}; opacity: ${alpha.toFixed(2)}">
                        <div class="heatmap-tooltip">Cyl ${cylStart}–${cylEnd}: ${count} visits</div>
                    </div>`;
        }).join('');

        return `<div class="heatmap-algo">
            <div class="heatmap-algo-label">
                <span class="algo-tag ${result.name.toLowerCase()}-tag">${result.name}</span>
                ${result.name}
            </div>
            <div class="heatmap-bar">${cellsHTML}</div>
        </div>`;
    }).join('');
}

// ── Animated Disk Arm ────────────────────────────────────────

function drawDiskArm(results, diskSize, upToStep) {
    const selected = anim.diskArmAlgo;
    const result = results.find(r => r.name === selected);
    if (!result) return;

    const canvas = diskArmCanvas;
    const dpr = window.devicePixelRatio || 1;
    const size = 460;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const bg = getCanvasBg();
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    const cx = size / 2, cy = size / 2;
    const outerR = 195;
    const innerR = 40;
    const color = ALGO_COLORS[result.name];
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const trackColor = isLight ? 'rgba(30,50,100,0.05)' : 'rgba(148,163,184,0.04)';
    const trackBorderColor = isLight ? 'rgba(30,50,100,0.1)' : 'rgba(148,163,184,0.08)';

    // Draw platter (concentric rings)
    const numTracks = Math.min(15, diskSize);
    for (let i = 0; i <= numTracks; i++) {
        const r = innerR + ((outerR - innerR) * i) / numTracks;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = trackBorderColor;
        ctx.lineWidth = 1;
        ctx.stroke();
        if (i < numTracks) {
            ctx.fillStyle = trackColor;
            ctx.fill();
        }
    }

    // Draw spindle
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = isLight ? '#7c839a' : '#4b5563';
    ctx.fill();

    // Highlight request tracks
    const stepsToShow = Math.min(upToStep + 1, result.sequence.length);
    const visited = new Set();
    for (let i = 0; i < stepsToShow; i++) {
        visited.add(result.sequence[i]);
    }

    // Mark all request positions as dots on the platter
    const allRequests = new Set(anim.requests);
    allRequests.forEach(cyl => {
        const frac = cyl / Math.max(diskSize - 1, 1);
        const r = innerR + frac * (outerR - innerR);
        const angle = -Math.PI / 2 + (cyl / Math.max(diskSize - 1, 1)) * Math.PI * 1.6 - Math.PI * 0.3;
        const x = cx + r * Math.cos(angle) * 0.5 + (r * 0.5) * Math.cos(angle + 0.3);
        const y = cy + r * Math.sin(angle) * 0.5 + (r * 0.5) * Math.sin(angle + 0.3);
        // Simplified: just use the radius for position on a random-ish angle
        const dotAngle = (cyl / Math.max(diskSize - 1, 1)) * Math.PI * 2 - Math.PI / 2;
        const dx = cx + r * Math.cos(dotAngle);
        const dy = cy + r * Math.sin(dotAngle);

        ctx.beginPath();
        ctx.arc(dx, dy, visited.has(cyl) ? 5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = visited.has(cyl) ? color : (isLight ? '#a0a8c0' : '#374151');
        if (visited.has(cyl)) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 8;
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        // Cylinder label
        if (allRequests.size <= 12) {
            ctx.fillStyle = visited.has(cyl) ? color : (isLight ? '#7c839a' : '#4b5563');
            ctx.font = '9px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(cyl, dx, dy - 9);
        }
    });

    // Draw the arm
    if (stepsToShow > 0) {
        const currentCyl = result.sequence[stepsToShow - 1];
        const frac = currentCyl / Math.max(diskSize - 1, 1);
        const armR = innerR + frac * (outerR - innerR);
        const armAngle = -Math.PI / 2; // arm always points up, length varies

        // Arm base (pivot at bottom)
        const pivotX = cx;
        const pivotY = cy + outerR + 30;
        const tipX = cx;
        const tipY = cy - armR;

        // Arm shadow
        ctx.beginPath();
        ctx.moveTo(pivotX, pivotY);
        ctx.lineTo(tipX - 3, tipY);
        ctx.lineTo(tipX + 3, tipY);
        ctx.closePath();
        ctx.fillStyle = color + '20';
        ctx.fill();

        // Arm line
        ctx.beginPath();
        ctx.moveTo(pivotX, pivotY);
        ctx.lineTo(tipX, tipY);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Arm head
        ctx.beginPath();
        ctx.arc(tipX, tipY, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Pivot dot
        ctx.beginPath();
        ctx.arc(pivotX, pivotY, 5, 0, Math.PI * 2);
        ctx.fillStyle = isLight ? '#4a5068' : '#6b7280';
        ctx.fill();

        // Current cylinder label
        ctx.fillStyle = color;
        ctx.font = 'bold 13px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Cyl ${currentCyl}`, tipX, tipY - 16);

        // Step label
        ctx.fillStyle = isLight ? '#4a5068' : '#94a3b8';
        ctx.font = '11px "Space Grotesk", sans-serif';
        ctx.fillText(`Step ${Math.min(upToStep, result.sequence.length - 1)} / ${result.sequence.length - 1}`, cx, size - 12);
    }

    // Title
    ctx.fillStyle = isLight ? '#4a5068' : '#94a3b8';
    ctx.font = '11px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${result.name} — Disk Platter View`, cx, 18);
}

function renderDiskArmControls(results) {
    if (!anim.diskArmAlgo && results.length > 0) {
        anim.diskArmAlgo = results[0].name;
    }
    diskArmControls.innerHTML = results.map(r => {
        const isActive = r.name === anim.diskArmAlgo;
        return `<button class="disk-arm-algo-btn ${isActive ? 'active' : ''}" data-algo="${r.name}">
            <span class="algo-tag ${r.name.toLowerCase()}-tag">${r.name}</span>
        </button>`;
    }).join('');
}

diskArmControls.addEventListener('click', e => {
    const btn = e.target.closest('.disk-arm-algo-btn');
    if (!btn) return;
    anim.diskArmAlgo = btn.dataset.algo;
    diskArmControls.querySelectorAll('.disk-arm-algo-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    drawDiskArm(anim.results, anim.diskSize, anim.currentStep);
});

// ── Step Explanation Renderer ────────────────────────────────

function renderStepExplanation() {
    if (anim.currentStep === 0) {
        stepExplanation.innerHTML = `
            <div class="explanation-placeholder">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                Press <strong>Play</strong> or step through to see why each algorithm picks its next cylinder.
            </div>`;
        return;
    }

    const stepIdx = anim.currentStep - 1;
    const cardsHTML = anim.results.map(result => {
        const expl = result.stepExplanations[stepIdx];
        if (!expl) return '';
        const color = ALGO_COLORS[result.name];
        return `
            <div class="expl-card" style="--algo-color: ${color}; border-left-color: ${color}">
                <div class="expl-header">
                    <span class="algo-tag ${result.name.toLowerCase()}-tag">${result.name}</span>
                    <span class="expl-move">
                        <span class="expl-from">${expl.from}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                        <span class="expl-to">${expl.to}</span>
                        <span class="expl-dist ${expl.isLargeJump ? 'large-jump' : ''}">+${expl.distance}</span>
                    </span>
                </div>
                <p class="expl-reason">${expl.reason}</p>
                <p class="expl-insight">${expl.insight}</p>
            </div>`;
    }).join('');

    stepExplanation.innerHTML = `<div class="expl-cards-row">${cardsHTML}</div>`;
}

// ── Animation Controls ───────────────────────────────────────

function goToStep(step) {
    anim.currentStep = Math.max(0, Math.min(step, anim.maxSteps));
    stepSlider.value = anim.currentStep;
    stepCounter.textContent = `Step ${anim.currentStep} / ${anim.maxSteps}`;
    redrawCurrentView();
    renderStepExplanation();
    if (anim.diskArmAlgo) drawDiskArm(anim.results, anim.diskSize, anim.currentStep);
}

function playAnimation() {
    if (anim.currentStep >= anim.maxSteps) anim.currentStep = 0;
    anim.isPlaying = true;
    playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
    playIcon.setAttribute('fill', 'currentColor');
    playLabel.textContent = 'Pause';

    anim.timerId = setInterval(() => {
        if (anim.currentStep >= anim.maxSteps) {
            pauseAnimation();
            return;
        }
        goToStep(anim.currentStep + 1);
    }, anim.speed);
}

function pauseAnimation() {
    anim.isPlaying = false;
    clearInterval(anim.timerId);
    playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
    playLabel.textContent = 'Play';
}

// ── Metrics ──────────────────────────────────────────────────

function renderMetrics(results) {
    const bestMovement = Math.min(...results.map(r => r.totalMovement));
    const worstMovement = Math.max(...results.map(r => r.totalMovement));
    const fcfsResult = results.find(r => r.name === 'FCFS');

    metricsRow.innerHTML = results.map((r, i) => {
        const isBest = r.totalMovement === bestMovement;
        let effBadge = '';
        if (fcfsResult && r.name !== 'FCFS') {
            const pct = Math.round(((fcfsResult.totalMovement - r.totalMovement) / fcfsResult.totalMovement) * 100);
            const sign = pct >= 0 ? '↓' : '↑';
            const cls = pct >= 0 ? 'eff-better' : 'eff-worse';
            effBadge = `<div class="eff-badge ${cls}">${sign} ${Math.abs(pct)}% vs FCFS</div>`;
        }

        return `
            <div class="metric-card ${ALGO_CLASSES[r.name]}" style="animation-delay: ${i * 0.08}s">
                ${isBest ? '<span class="best-badge">🏆 Best</span>' : ''}
                <div class="metric-label">
                    <span class="algo-tag ${r.name.toLowerCase()}-tag">${r.name}</span>
                    Total Movement
                </div>
                <div class="metric-value">${r.totalMovement}</div>
                <div class="metric-sub">Avg seek: ${r.avgSeekTime} cylinders/req</div>
                ${effBadge}
            </div>`;
    }).join('');
}

function renderLegend(results) {
    legendEl.innerHTML = results.map(r => `
        <div class="legend-item">
            <span class="legend-swatch" style="background:${ALGO_COLORS[r.name]}"></span>
            ${r.name}
        </div>`).join('');
}

function renderComparisonTable(results) {
    const fcfsResult = results.find(r => r.name === 'FCFS');

    comparisonBody.innerHTML = results.map(r => {
        let vsFcfs = '—';
        if (fcfsResult && r.name !== 'FCFS') {
            const diff = fcfsResult.totalMovement - r.totalMovement;
            const pct = Math.round((diff / fcfsResult.totalMovement) * 100);
            const cls = diff >= 0 ? 'vs-better' : 'vs-worse';
            vsFcfs = `<span class="${cls}">${diff >= 0 ? '↓' : '↑'} ${Math.abs(pct)}%</span>`;
        }

        return `
            <tr>
                <td><span class="algo-tag ${r.name.toLowerCase()}-tag">${r.name}</span></td>
                <td><strong>${r.totalMovement}</strong> cylinders</td>
                <td>${r.avgSeekTime} cyl/req</td>
                <td>${vsFcfs}</td>
                <td><span class="order-sequence" title="${r.sequence.join(' → ')}">${r.sequence.join(' → ')}</span></td>
            </tr>`;
    }).join('');
}

function renderBreakdown(results) {
    const fcfsMovements = results.find(r => r.name === 'FCFS')?.movements;
    const avgFcfsDist = fcfsMovements ? fcfsMovements.reduce((s, m) => s + m.distance, 0) / fcfsMovements.length : null;

    breakdownGrid.innerHTML = results.map(r => {
        const stepsHTML = r.movements.map((m, i) => {
            const isLarge = avgFcfsDist && m.distance > avgFcfsDist * 1.4;
            return `
                <li class="${isLarge ? 'step-large' : ''}">
                    <span class="step-num">#${i + 1}</span>
                    <span class="step-path">${m.from} → ${m.to}</span>
                    <span class="step-move ${isLarge ? 'move-large' : ''}">+${m.distance}</span>
                </li>`;
        }).join('');

        const maxDist = Math.max(...r.movements.map(m => m.distance));
        return `
            <div class="breakdown-card">
                <h3>
                    <span class="algo-tag ${r.name.toLowerCase()}-tag">${r.name}</span>
                    <span class="breakdown-total">Total: ${r.totalMovement}</span>
                    <span class="breakdown-max">Max step: ${maxDist}</span>
                </h3>
                <ol class="step-list">${stepsHTML}</ol>
            </div>`;
    }).join('');
}

function renderStarvationAnalysis(results, requests) {
    const sstfResult = results.find(r => r.name === 'SSTF');
    if (!sstfResult || !sstfResult.waitMap) {
        starvationPanel.classList.add('hidden');
        return;
    }

    starvationPanel.classList.remove('hidden');

    // For each request, find how many steps it waited
    const maxWait = Math.max(...Object.values(sstfResult.waitMap), 1);

    const barsHTML = requests.map((r, i) => {
        const waitSteps = sstfResult.waitMap[r] ?? 0;
        const pct = Math.round((waitSteps / maxWait) * 100);
        const isHigh = waitSteps > (maxWait * 0.6);
        const isMed = waitSteps > (maxWait * 0.3) && !isHigh;

        return `
            <div class="starv-row">
                <div class="starv-label">Cyl <strong>${r}</strong></div>
                <div class="starv-bar-track">
                    <div class="starv-bar ${isHigh ? 'starv-high' : isMed ? 'starv-med' : 'starv-low'}"
                         style="width: ${Math.max(pct, 2)}%"></div>
                </div>
                <div class="starv-val">${waitSteps} step${waitSteps !== 1 ? 's' : ''} wait</div>
                ${isHigh ? '<span class="starv-warning">⚠ Starvation risk</span>' : ''}
            </div>`;
    }).join('');

    starvationChart.innerHTML = `
        <div class="starv-note">
            Under SSTF, requests near the center of disk activity are served quickly.
            Requests far away may wait many steps — a fairness problem called <strong>starvation</strong>.
        </div>
        <div class="starv-chart">${barsHTML}</div>`;
}

// ── Main Visualize Handler ───────────────────────────────────

function runVisualization() {
    let input;
    try { input = parseInput(); }
    catch (err) { showToast(err.message); return; }

    pauseAnimation();

    const { requests, headPos, diskSize, direction } = input;
    const selectedAlgos = [];
    if (algoFCFS.checked) selectedAlgos.push('FCFS');
    if (algoSSTF.checked) selectedAlgos.push('SSTF');
    if (algoSCAN.checked) selectedAlgos.push('SCAN');

    if (selectedAlgos.length === 0) { showToast('Please select at least one algorithm.'); return; }

    const results = [];
    if (selectedAlgos.includes('FCFS')) results.push(fcfs(requests, headPos));
    if (selectedAlgos.includes('SSTF')) results.push(sstf(requests, headPos));
    if (selectedAlgos.includes('SCAN')) results.push(scan(requests, headPos, diskSize, direction));

    // Store in animation state
    anim.results = results;
    anim.diskSize = diskSize;
    anim.requests = requests;
    anim.maxSteps = Math.max(...results.map(r => r.sequence.length)) - 1;
    anim.currentStep = 0;

    stepSlider.max = anim.maxSteps;
    stepSlider.value = 0;
    stepCounter.textContent = `Step 0 / ${anim.maxSteps}`;

    resultsSection.classList.remove('hidden');
    setTimeout(() => resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

    renderMetrics(results);
    renderLegend(results);
    redrawCurrentView();
    renderStepExplanation();
    renderComparisonTable(results);
    renderBreakdown(results);
    renderStarvationAnalysis(results, requests);
    drawRadarChart(results);
    renderDiskHeatmap(results, diskSize);
    renderDiskArmControls(results);
    drawDiskArm(results, diskSize, 0);
}

// ── Event Listeners ──────────────────────────────────────────

visualizeBtn.addEventListener('click', runVisualization);

btnPlayPause.addEventListener('click', () => {
    if (anim.isPlaying) pauseAnimation();
    else playAnimation();
});

btnPrevStep.addEventListener('click', () => {
    pauseAnimation();
    goToStep(anim.currentStep - 1);
});

btnNextStep.addEventListener('click', () => {
    pauseAnimation();
    goToStep(anim.currentStep + 1);
});

btnRestart.addEventListener('click', () => {
    pauseAnimation();
    goToStep(0);
});

stepSlider.addEventListener('input', () => {
    pauseAnimation();
    goToStep(parseInt(stepSlider.value, 10));
});

speedSelect.addEventListener('change', () => {
    anim.speed = parseInt(speedSelect.value, 10);
    if (anim.isPlaying) { pauseAnimation(); playAnimation(); }
});

viewTabs.addEventListener('click', e => {
    const tab = e.target.closest('.view-tab');
    if (!tab) return;
    viewTabs.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    anim.viewMode = tab.dataset.view;

    const descs = {
        path: 'Each line traces the disk head\'s path across cylinders over time.',
        seeks: 'Seek distance at each step — compare how far each algorithm jumps per request.',
        cumulative: 'Running total movement — a flatter line = more efficient algorithm.',
    };
    viewDesc.textContent = descs[anim.viewMode];
    redrawCurrentView();
});

sampleBtn.addEventListener('click', () => {
    requestInput.value = '98, 183, 37, 122, 14, 124, 65, 67';
    headInput.value = '53';
    diskSizeInput.value = '200';
    directionSelect.value = 'right';
    document.querySelectorAll('.config-grid input, .config-grid select').forEach(el => {
        el.style.transition = 'border-color 0.3s, box-shadow 0.3s';
        el.style.borderColor = 'var(--accent-teal)';
        el.style.boxShadow = '0 0 0 3px var(--accent-teal-dim)';
        setTimeout(() => { el.style.borderColor = ''; el.style.boxShadow = ''; }, 700);
    });
});

clearBtn.addEventListener('click', () => {
    pauseAnimation();
    requestInput.value = '';
    headInput.value = '';
    diskSizeInput.value = '200';
    directionSelect.value = 'right';
    resultsSection.classList.add('hidden');
});

[requestInput, headInput, diskSizeInput].forEach(el => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter') runVisualization(); });
});

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (!resultsSection.classList.contains('hidden')) {
            redrawCurrentView();
            drawRadarChart(anim.results);
            if (anim.diskArmAlgo) drawDiskArm(anim.results, anim.diskSize, anim.currentStep);
        }
    }, 200);
});
