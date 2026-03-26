/**
 * ═══════════════════════════════════════════════════════════════
 *  SORTLAB — Algorithm Visualizer
 *  script.js
 *
 *  Sections:
 *    1. STATE & CONFIG
 *    2. ALGORITHM METADATA
 *    3. SORTING ALGORITHMS (generators)
 *    4. ANIMATION ENGINE
 *    5. RENDER ENGINE
 *    6. AUDIO ENGINE
 *    7. UI CONTROLLER
 *    8. EVENT HANDLERS
 *    9. INIT
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   1. STATE & CONFIG
   ═══════════════════════════════════════════════════════════════ */

const State = {
  array:        [],       // Current array values
  arraySize:    60,       // Number of bars
  speedLevel:   3,        // 1-5
  algorithm:    'bubble', // Selected algorithm key
  sorting:      false,    // Is a sort running?
  paused:       false,    // Is it paused?
  stopRequested:false,    // Stop signal
  comparisons:  0,
  swaps:        0,
  startTime:    null,
  timerHandle:  null,
  soundEnabled: false,
  // AudioContext created lazily on first sound
  audioCtx:     null,
};

/** Delay in ms per speed level (1=slow, 5=fast) */
const SPEED_MAP = { 1: 400, 2: 150, 3: 50, 4: 15, 5: 2 };

const SPEED_LABELS = { 1: 'Very Slow', 2: 'Slow', 3: 'Medium', 4: 'Fast', 5: 'Blazing' };

/* ═══════════════════════════════════════════════════════════════
   2. ALGORITHM METADATA
   ═══════════════════════════════════════════════════════════════ */

const ALGORITHMS = {
  bubble: {
    name:        'Bubble Sort',
    best:        'O(n)',
    average:     'O(n²)',
    worst:       'O(n²)',
    space:       'O(1)',
    description: 'Repeatedly steps through the list, compares adjacent elements and swaps them if they\'re in the wrong order. Simple but inefficient for large datasets.',
    fn:          bubbleSort,
  },
  selection: {
    name:        'Selection Sort',
    best:        'O(n²)',
    average:     'O(n²)',
    worst:       'O(n²)',
    space:       'O(1)',
    description: 'Finds the minimum element in the unsorted portion and places it at the beginning. Makes at most n-1 swaps — memory writes are minimized.',
    fn:          selectionSort,
  },
  insertion: {
    name:        'Insertion Sort',
    best:        'O(n)',
    average:     'O(n²)',
    worst:       'O(n²)',
    space:       'O(1)',
    description: 'Builds a sorted array one element at a time by inserting each new element into its correct position. Efficient for small or nearly-sorted datasets.',
    fn:          insertionSort,
  },
  merge: {
    name:        'Merge Sort',
    best:        'O(n log n)',
    average:     'O(n log n)',
    worst:       'O(n log n)',
    space:       'O(n)',
    description: 'A divide-and-conquer algorithm that splits the array in half, recursively sorts each half, then merges the sorted halves. Stable and consistently O(n log n).',
    fn:          mergeSort,
  },
  quick: {
    name:        'Quick Sort',
    best:        'O(n log n)',
    average:     'O(n log n)',
    worst:       'O(n²)',
    space:       'O(log n)',
    description: 'Selects a pivot element and partitions the array around it. One of the fastest in practice due to excellent cache performance and low constant factors.',
    fn:          quickSort,
  },
};

/* ═══════════════════════════════════════════════════════════════
   3. SORTING ALGORITHMS (generator-based)
   Each yield produces a "frame" object describing the current
   visual state for the renderer.
   ═══════════════════════════════════════════════════════════════ */

/**
 * Frame descriptor:
 * {
 *   array:      number[]  — current values
 *   comparing:  number[]  — indices being compared (yellow)
 *   swapping:   number[]  — indices being swapped  (red)
 *   pivot:      number    — pivot index            (purple)
 *   sorted:     Set<number> — fully sorted indices (green)
 *   comparisons: number
 *   swaps:       number
 * }
 */

// ── Bubble Sort ──────────────────────────────────────────────
function* bubbleSort(arr) {
  const a = [...arr];
  const n = a.length;
  const sorted = new Set();
  let comps = 0, swps = 0;

  for (let i = 0; i < n - 1; i++) {
    let swapped = false;
    for (let j = 0; j < n - i - 1; j++) {
      comps++;
      yield { array: a, comparing: [j, j + 1], swapping: [], sorted, comparisons: comps, swaps: swps };

      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        swps++;
        swapped = true;
        yield { array: a, comparing: [], swapping: [j, j + 1], sorted, comparisons: comps, swaps: swps };
      }
    }
    sorted.add(n - i - 1);
    yield { array: a, comparing: [], swapping: [], sorted, comparisons: comps, swaps: swps };
    if (!swapped) break;
  }

  // Mark all sorted
  for (let i = 0; i < n; i++) sorted.add(i);
  yield { array: a, comparing: [], swapping: [], sorted, comparisons: comps, swaps: swps, done: true };
}

// ── Selection Sort ───────────────────────────────────────────
function* selectionSort(arr) {
  const a = [...arr];
  const n = a.length;
  const sorted = new Set();
  let comps = 0, swps = 0;

  for (let i = 0; i < n - 1; i++) {
    let minIdx = i;

    for (let j = i + 1; j < n; j++) {
      comps++;
      yield { array: a, comparing: [minIdx, j], swapping: [], sorted, comparisons: comps, swaps: swps };

      if (a[j] < a[minIdx]) {
        minIdx = j;
      }
    }

    if (minIdx !== i) {
      [a[i], a[minIdx]] = [a[minIdx], a[i]];
      swps++;
      yield { array: a, comparing: [], swapping: [i, minIdx], sorted, comparisons: comps, swaps: swps };
    }

    sorted.add(i);
    yield { array: a, comparing: [], swapping: [], sorted, comparisons: comps, swaps: swps };
  }

  for (let i = 0; i < n; i++) sorted.add(i);
  yield { array: a, comparing: [], swapping: [], sorted, comparisons: comps, swaps: swps, done: true };
}

// ── Insertion Sort ───────────────────────────────────────────
function* insertionSort(arr) {
  const a = [...arr];
  const n = a.length;
  const sorted = new Set([0]);
  let comps = 0, swps = 0;

  for (let i = 1; i < n; i++) {
    let j = i;

    while (j > 0) {
      comps++;
      yield { array: a, comparing: [j, j - 1], swapping: [], sorted, comparisons: comps, swaps: swps };

      if (a[j] < a[j - 1]) {
        [a[j], a[j - 1]] = [a[j - 1], a[j]];
        swps++;
        yield { array: a, comparing: [], swapping: [j, j - 1], sorted, comparisons: comps, swaps: swps };
        j--;
      } else {
        break;
      }
    }

    sorted.add(i);
    yield { array: a, comparing: [], swapping: [], sorted, comparisons: comps, swaps: swps };
  }

  for (let i = 0; i < n; i++) sorted.add(i);
  yield { array: a, comparing: [], swapping: [], sorted, comparisons: comps, swaps: swps, done: true };
}

// ── Merge Sort ───────────────────────────────────────────────
function* mergeSort(arr) {
  const a = [...arr];
  const n = a.length;
  const sorted = new Set();
  let comps = 0, swps = 0;

  // Iterative (bottom-up) merge sort for visualization
  function* merge(left, mid, right) {
    const leftArr  = a.slice(left, mid + 1);
    const rightArr = a.slice(mid + 1, right + 1);
    let i = 0, j = 0, k = left;

    while (i < leftArr.length && j < rightArr.length) {
      comps++;
      yield { array: a, comparing: [left + i, mid + 1 + j], swapping: [], sorted, comparisons: comps, swaps: swps };

      if (leftArr[i] <= rightArr[j]) {
        a[k] = leftArr[i++];
      } else {
        a[k] = rightArr[j++];
        swps++;
        yield { array: a, comparing: [], swapping: [k], sorted, comparisons: comps, swaps: swps };
      }
      k++;
    }

    while (i < leftArr.length) { a[k++] = leftArr[i++]; }
    while (j < rightArr.length) { a[k++] = rightArr[j++]; }

    yield { array: a, comparing: [], swapping: [], sorted, comparisons: comps, swaps: swps };
  }

  for (let size = 1; size < n; size *= 2) {
    for (let left = 0; left < n; left += 2 * size) {
      const mid   = Math.min(left + size - 1, n - 1);
      const right = Math.min(left + 2 * size - 1, n - 1);
      if (mid < right) {
        yield* merge(left, mid, right);
      }
    }
  }

  for (let i = 0; i < n; i++) sorted.add(i);
  yield { array: a, comparing: [], swapping: [], sorted, comparisons: comps, swaps: swps, done: true };
}

// ── Quick Sort ───────────────────────────────────────────────
function* quickSort(arr) {
  const a = [...arr];
  const n = a.length;
  const sorted = new Set();
  let comps = 0, swps = 0;

  function* partition(low, high) {
    const pivotVal = a[high];
    let i = low - 1;

    for (let j = low; j < high; j++) {
      comps++;
      yield { array: a, comparing: [j, high], swapping: [], pivot: high, sorted, comparisons: comps, swaps: swps };

      if (a[j] <= pivotVal) {
        i++;
        if (i !== j) {
          [a[i], a[j]] = [a[j], a[i]];
          swps++;
          yield { array: a, comparing: [], swapping: [i, j], pivot: high, sorted, comparisons: comps, swaps: swps };
        }
      }
    }

    // Place pivot
    if (i + 1 !== high) {
      [a[i + 1], a[high]] = [a[high], a[i + 1]];
      swps++;
      yield { array: a, comparing: [], swapping: [i + 1, high], pivot: i + 1, sorted, comparisons: comps, swaps: swps };
    }

    sorted.add(i + 1);
    yield { array: a, comparing: [], swapping: [], pivot: -1, sorted, comparisons: comps, swaps: swps };

    return i + 1;
  }

  function* qsort(low, high) {
    if (low < high) {
      let pi;
      // Use the generator's returned value via a workaround
      const gen = partition(low, high);
      let result;
      while (true) {
        const next = gen.next(result);
        if (next.done) { pi = next.value; break; }
        yield next.value;
      }
      yield* qsort(low, pi - 1);
      yield* qsort(pi + 1, high);
    } else if (low === high) {
      sorted.add(low);
      yield { array: a, comparing: [], swapping: [], sorted, comparisons: comps, swaps: swps };
    }
  }

  yield* qsort(0, n - 1);

  for (let i = 0; i < n; i++) sorted.add(i);
  yield { array: a, comparing: [], swapping: [], sorted, comparisons: comps, swaps: swps, done: true };
}

/* ═══════════════════════════════════════════════════════════════
   4. ANIMATION ENGINE
   ═══════════════════════════════════════════════════════════════ */

const AnimEngine = (() => {
  let generator = null;

  /**
   * Run the sort step by step, yielding control back to the
   * browser between frames to avoid blocking the UI thread.
   */
  async function run(algoKey, array) {
    const meta  = ALGORITHMS[algoKey];
    generator   = meta.fn(array);

    State.sorting       = true;
    State.paused        = false;
    State.stopRequested = false;
    State.comparisons   = 0;
    State.swaps         = 0;
    State.startTime     = performance.now();

    UIController.onSortStart();
    TimerController.start();

    for (const frame of generator) {
      // Check for stop signal
      if (State.stopRequested) {
        TimerController.stop();
        UIController.onSortStop();
        return;
      }

      // Wait while paused
      while (State.paused && !State.stopRequested) {
        await sleep(100);
      }

      if (State.stopRequested) {
        TimerController.stop();
        UIController.onSortStop();
        return;
      }

      // Apply frame
      State.comparisons = frame.comparisons;
      State.swaps       = frame.swaps;
      Renderer.applyFrame(frame);
      UIController.updateStats();
      AudioEngine.playFrame(frame);

      // Delay between frames
      const delay = SPEED_MAP[State.speedLevel];
      if (delay > 0) await sleep(delay);
    }

    // Completion
    TimerController.stop();
    State.sorting = false;
    UIController.onSortComplete();
  }

  function stop() {
    State.stopRequested = true;
    State.paused        = false;
  }

  function togglePause() {
    State.paused = !State.paused;
    UIController.onPauseToggle();
  }

  return { run, stop, togglePause };
})();

/* ═══════════════════════════════════════════════════════════════
   5. RENDER ENGINE
   ═══════════════════════════════════════════════════════════════ */

const Renderer = (() => {
  const container = () => document.getElementById('vizContainer');
  let barEls = [];

  /** Generate a random array and render it */
  function generateArray(size) {
    State.array = Array.from({ length: size }, () => Math.floor(Math.random() * 90) + 10);
    buildBars(State.array);
  }

  /** Build bar DOM elements */
  function buildBars(arr) {
    const el = container();
    el.innerHTML = '';
    barEls = [];

    const showLabels = arr.length <= 30;

    arr.forEach((val, i) => {
      const bar = document.createElement('div');
      bar.className = 'bar' + (showLabels ? ' show-label' : '');
      bar.style.height = `${val}%`;

      if (showLabels) {
        const label = document.createElement('span');
        label.className = 'bar-label';
        label.textContent = val;
        bar.appendChild(label);
      }

      el.appendChild(bar);
      barEls.push(bar);
    });
  }

  /** Apply a frame from the algorithm generator */
  function applyFrame(frame) {
    const { array, comparing, swapping, pivot = -1, sorted } = frame;
    const comparingSet = new Set(comparing);
    const swappingSet  = new Set(swapping);

    barEls.forEach((bar, i) => {
      // Update height
      bar.style.height = `${array[i]}%`;

      // Update label if present
      const label = bar.querySelector('.bar-label');
      if (label) label.textContent = array[i];

      // Apply color class
      bar.className = 'bar' + (barEls.length <= 30 ? ' show-label' : '');
      if (sorted.has(i))         bar.classList.add('sorted');
      else if (swappingSet.has(i)) bar.classList.add('swapping');
      else if (i === pivot)        bar.classList.add('pivot');
      else if (comparingSet.has(i)) bar.classList.add('comparing');
    });
  }

  /** Mark all bars as sorted (final state) */
  function markAllSorted() {
    barEls.forEach(bar => {
      bar.className = 'bar' + (barEls.length <= 30 ? ' show-label' : '');
      bar.classList.add('sorted');
    });
  }

  /** Reset bars to default color */
  function resetColors() {
    barEls.forEach(bar => {
      bar.className = 'bar' + (barEls.length <= 30 ? ' show-label' : '');
    });
  }

  return { generateArray, buildBars, applyFrame, markAllSorted, resetColors };
})();

/* ═══════════════════════════════════════════════════════════════
   6. AUDIO ENGINE
   ═══════════════════════════════════════════════════════════════ */

const AudioEngine = (() => {
  function getCtx() {
    if (!State.audioCtx) {
      try {
        State.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn('Web Audio not supported');
        return null;
      }
    }
    return State.audioCtx;
  }

  function playTone(freq, type = 'sine', duration = 0.08, vol = 0.15) {
    const ctx = getCtx();
    if (!ctx || !State.soundEnabled) return;

    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type      = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  function playFrame(frame) {
    if (!State.soundEnabled) return;

    const n = frame.array.length;

    if (frame.swapping && frame.swapping.length > 0) {
      // Map array value to frequency (200 Hz – 900 Hz)
      const val  = frame.array[frame.swapping[0]] || 50;
      const freq = 200 + (val / 100) * 700;
      playTone(freq, 'sawtooth', 0.06, 0.1);

    } else if (frame.comparing && frame.comparing.length > 0) {
      const val  = frame.array[frame.comparing[0]] || 50;
      const freq = 300 + (val / 100) * 500;
      playTone(freq, 'sine', 0.04, 0.05);
    }
  }

  function playComplete() {
    if (!State.soundEnabled) return;
    // Play a short ascending arpeggio
    [523, 659, 784, 1047].forEach((freq, i) => {
      setTimeout(() => playTone(freq, 'triangle', 0.2, 0.15), i * 80);
    });
  }

  return { playFrame, playComplete };
})();

/* ═══════════════════════════════════════════════════════════════
   7. UI CONTROLLER
   ═══════════════════════════════════════════════════════════════ */

const UIController = (() => {
  // DOM refs
  const $ = id => document.getElementById(id);

  function updateStats() {
    $('comparisonsCount').textContent = State.comparisons.toLocaleString();
    $('swapsCount').textContent       = State.swaps.toLocaleString();
  }

  function updateAlgoInfo(key) {
    const meta = ALGORITHMS[key];
    if (!meta) return;
    $('bestCase').textContent    = meta.best;
    $('avgCase').textContent     = meta.average;
    $('worstCase').textContent   = meta.worst;
    $('spaceCase').textContent   = meta.space;
    $('algoDescription').textContent = meta.description;
  }

  function setStatus(type, text) {
    const dot  = $('statusDot');
    const msg  = $('statusText');
    dot.className  = `status-indicator ${type}`;
    msg.textContent = text;
  }

  function onSortStart() {
    $('startBtn').classList.add('hidden');
    $('pauseBtn').classList.remove('hidden');
    $('stopBtn').classList.remove('hidden');
    $('generateBtn').disabled = true;
    $('sizeSlider').disabled  = true;
    $('vizOverlay').classList.add('hidden');
    setDisabledAlgoBtns(true);
    setStatus('running', `Running ${ALGORITHMS[State.algorithm].name}…`);
  }

  function onSortComplete() {
    State.sorting = false;
    $('startBtn').classList.remove('hidden');
    $('pauseBtn').classList.add('hidden');
    $('stopBtn').classList.add('hidden');
    $('generateBtn').disabled = false;
    $('sizeSlider').disabled  = false;
    setDisabledAlgoBtns(false);

    Renderer.markAllSorted();
    setStatus('done', `${ALGORITHMS[State.algorithm].name} completed — ${State.comparisons.toLocaleString()} comparisons, ${State.swaps.toLocaleString()} swaps`);

    // Show overlay
    const elapsed   = ((performance.now() - State.startTime) / 1000).toFixed(3);
    $('overlayStats').innerHTML =
      `Comparisons: <span>${State.comparisons.toLocaleString()}</span>   ·   ` +
      `Swaps: <span>${State.swaps.toLocaleString()}</span>   ·   ` +
      `Time: <span>${elapsed}s</span>`;
    $('vizOverlay').classList.remove('hidden');

    AudioEngine.playComplete();
  }

  function onSortStop() {
    State.sorting = false;
    State.paused  = false;
    $('startBtn').classList.remove('hidden');
    $('pauseBtn').classList.add('hidden');
    $('stopBtn').classList.add('hidden');
    $('generateBtn').disabled = false;
    $('sizeSlider').disabled  = false;
    $('pauseBtn').textContent = '⏸ Pause';
    setDisabledAlgoBtns(false);
    Renderer.resetColors();
    setStatus('stopped', 'Sort stopped — generate a new array or press Sort again');
  }

  function onPauseToggle() {
    const btn = $('pauseBtn');
    if (State.paused) {
      btn.textContent = '▶ Resume';
      setStatus('paused', 'Paused — press Resume to continue');
    } else {
      btn.textContent = '⏸ Pause';
      setStatus('running', `Running ${ALGORITHMS[State.algorithm].name}…`);
    }
  }

  function setDisabledAlgoBtns(disabled) {
    document.querySelectorAll('.algo-btn').forEach(b => b.disabled = disabled);
  }

  function resetForNewArray() {
    State.comparisons = 0;
    State.swaps       = 0;
    updateStats();
    $('elapsedTime').textContent = '0.000s';
    $('vizOverlay').classList.add('hidden');
    setStatus('ready', 'Ready — select an algorithm and press Sort');
  }

  return {
    updateStats, updateAlgoInfo,
    onSortStart, onSortComplete, onSortStop, onPauseToggle,
    resetForNewArray, setStatus,
  };
})();

/* ═══════════════════════════════════════════════════════════════
   Timer Controller
   ═══════════════════════════════════════════════════════════════ */

const TimerController = (() => {
  let handle = null;

  function start() {
    stop();
    handle = setInterval(() => {
      if (!State.paused && State.startTime !== null) {
        const elapsed = ((performance.now() - State.startTime) / 1000).toFixed(3);
        document.getElementById('elapsedTime').textContent = `${elapsed}s`;
      }
    }, 100);
  }

  function stop() {
    if (handle) { clearInterval(handle); handle = null; }
  }

  return { start, stop };
})();

/* ═══════════════════════════════════════════════════════════════
   8. EVENT HANDLERS
   ═══════════════════════════════════════════════════════════════ */

function initEventHandlers() {
  const $ = id => document.getElementById(id);

  // ── Generate new array ────────────────────────────────────
  $('generateBtn').addEventListener('click', () => {
    if (State.sorting) return;
    Renderer.generateArray(State.arraySize);
    UIController.resetForNewArray();
  });

  // ── Start sort ────────────────────────────────────────────
  $('startBtn').addEventListener('click', () => {
    if (State.sorting) return;
    // Re-generate if array has been sorted (all green)
    AnimEngine.run(State.algorithm, State.array);
  });

  // ── Pause/Resume ──────────────────────────────────────────
  $('pauseBtn').addEventListener('click', () => {
    if (!State.sorting) return;
    AnimEngine.togglePause();
  });

  // ── Stop ──────────────────────────────────────────────────
  $('stopBtn').addEventListener('click', () => {
    if (!State.sorting) return;
    AnimEngine.stop();
  });

  // ── Algorithm selector ────────────────────────────────────
  $('algoList').addEventListener('click', e => {
    const btn = e.target.closest('.algo-btn');
    if (!btn || State.sorting) return;

    document.querySelectorAll('.algo-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    State.algorithm = btn.dataset.algo;
    UIController.updateAlgoInfo(State.algorithm);
  });

  // ── Array size slider ─────────────────────────────────────
  $('sizeSlider').addEventListener('input', e => {
    const size = parseInt(e.target.value);
    State.arraySize = size;
    $('sizeVal').textContent = size;
    if (!State.sorting) {
      Renderer.generateArray(size);
      UIController.resetForNewArray();
    }
  });

  // ── Speed slider ──────────────────────────────────────────
  $('speedSlider').addEventListener('input', e => {
    const level = parseInt(e.target.value);
    State.speedLevel = level;
    $('speedVal').textContent = SPEED_LABELS[level];
  });

  // ── Sound toggle ──────────────────────────────────────────
  $('soundToggle').addEventListener('click', () => {
    State.soundEnabled = !State.soundEnabled;
    const icon = $('soundToggle');
    icon.style.color = State.soundEnabled ? 'var(--accent-cyan)' : '';
    icon.title = State.soundEnabled ? 'Sound ON (click to mute)' : 'Sound OFF (click to enable)';
    // Resume AudioContext if suspended
    if (State.soundEnabled && State.audioCtx && State.audioCtx.state === 'suspended') {
      State.audioCtx.resume();
    }
  });

  // ── Theme toggle ──────────────────────────────────────────
  $('themeToggle').addEventListener('click', () => {
    const html = document.documentElement;
    const isLight = html.dataset.theme === 'light';
    html.dataset.theme = isLight ? 'dark' : 'light';
    $('themeToggle').title = isLight ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  });

  // ── Keyboard shortcuts ────────────────────────────────────
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;

    switch (e.key) {
      case ' ':
        e.preventDefault();
        if (State.sorting) AnimEngine.togglePause();
        else if (!State.sorting) $('startBtn').click();
        break;
      case 'n': case 'N':
        if (!State.sorting) $('generateBtn').click();
        break;
      case 'Escape':
        if (State.sorting) AnimEngine.stop();
        break;
      case '1': selectAlgo('bubble');    break;
      case '2': selectAlgo('selection'); break;
      case '3': selectAlgo('insertion'); break;
      case '4': selectAlgo('merge');     break;
      case '5': selectAlgo('quick');     break;
    }
  });
}

function selectAlgo(key) {
  if (State.sorting) return;
  State.algorithm = key;
  document.querySelectorAll('.algo-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.algo === key);
  });
  UIController.updateAlgoInfo(key);
}

/* ═══════════════════════════════════════════════════════════════
   Utility
   ═══════════════════════════════════════════════════════════════ */

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ═══════════════════════════════════════════════════════════════
   9. INIT
   ═══════════════════════════════════════════════════════════════ */

(function init() {
  // Set initial algo info
  UIController.updateAlgoInfo(State.algorithm);

  // Set slider display values
  document.getElementById('sizeVal').textContent  = State.arraySize;
  document.getElementById('speedVal').textContent = SPEED_LABELS[State.speedLevel];
  document.getElementById('sizeSlider').value     = State.arraySize;
  document.getElementById('speedSlider').value    = State.speedLevel;

  // Generate initial array
  Renderer.generateArray(State.arraySize);

  // Wire up all events
  initEventHandlers();

  // Status
  UIController.setStatus('ready', 'Ready — press [Space] to sort, [N] for new array, [1-5] to switch algorithms');
})();
