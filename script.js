/**
 * ═══════════════════════════════════════════════════════════════
 *  SORT.EXE — Algorithm Visualizer
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

'use strict';  //helps in fewer bugs

/* ═══════════════════════════════════════════════════════════════
   1. STATE & CONFIG
   ═══════════════════════════════════════════════════════════════ */

//the State object is the single object that stores all the current data and settings for the sorting visualizer
const State = {
  array:        [],       // current array of numbers being sorted (visualized as bars)
  arraySize:    60,       // Number of bars
  speedLevel:   3,        // 1-5
  algorithm: 'bubble',    // selected algo in single mode
  raceMode: false,        // are we currently in race mode?
  selectedAlgos: [],      // array of algo keys chosen for the race
  panels: {},             // map: algoKey { comparisons, swaps, startTime, finished }
  winner: null,           // algoKey of first to finish, or null
  sorting:      false,    // is a sort running?
  paused:       false,    // is it paused?
  stopRequested:false,    // stop signal
  comparisons:  0,        // counter for number of comparisons made (for stats)
  swaps:        0,        // counter for number of swaps made (for stats)
  startTime:    null,     // the time after i pressed start
  timerHandle:  null,     // reference to the running stopwatch
  soundEnabled: false,    //is sound on or no
  audioCtx:     null,     // AudioContext created lazily on first sound (only created when you need to play sounds)
};

/** Delay in ms per speed level (1=slow, 5=fast) */
const SPEED_MAP = { 1: 400, 2: 150, 3: 50, 4: 15, 5: 2 };

const SPEED_LABELS = { 1: 'Very Slow', 2: 'Slow', 3: 'Medium', 4: 'Fast', 5: 'Blazing' };

/* ═══════════════════════════════════════════════════════════════
   2. ALGORITHM METADATA
   ═══════════════════════════════════════════════════════════════ */

//this is an object that stores info about the algorithms so that it for display & relating the function to the algorithm
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
  radix: {
  name:        'Radix Sort',
  best:        'O(nk)',
  average:     'O(nk)',
  worst:       'O(nk)',
  space:       'O(n+k)',
  description: 'A non-comparison sort that processes digits from least to most significant. Beats O(n log n) when k (digit count) is small relative to n.',
  fn:          radixSort,
  },
  heap: {
  name:        'Heap Sort',
  best:        'O(n log n)',
  average:     'O(n log n)',
  worst:       'O(n log n)',
  space:       'O(1)',
  description: 'Builds a max-heap from the array, then repeatedly extracts the maximum element. Guaranteed O(n log n) with no extra space — but poor cache performance in practice.',
  fn:          heapSort,
  },
};

/* ═══════════════════════════════════════════════════════════════
   3. SORTING ALGORITHMS (generator-based) > generator functions "function*" allow the the fn to pause and resume at each yeild,
   which is perfect for visualization as we update our UI one frame at a time.

   Each yield produces a "frame" object describing the current
   visual state for the renderer.
   ═══════════════════════════════════════════════════════════════ */

/**
 * Frame descriptor:
 * {
 *   array:      number[]    — current values of the array
 *   comparing:  number[]    — indices being compared (yellow)
 *   swapping:   number[]    — indices being swapped  (red)
 *   pivot:      number      — Pivot index for quicksort (purple)
 *   sorted:     Set<number> — fully sorted indices (green)
 *   comparisons: number     — Number of comparisons so far
 *   swaps:       number     — Number of swaps so far
 * }
 */

/**
 * 
 * UI reads this object (frame) and updates:
 * Bar heights (array)
 * Colors (comparing, swapping, pivot, sorted)
 * Stats (comparisons, swaps)
 * Then waits a short delay (from SPEED_MAP) before calling next() again. 
 */

// ── Bubble Sort ──────────────────────────────────────────────
function* bubbleSort(arr) {
  const a = [...arr];           //creates a copy of array
  const n = a.length;           //size of array
  const sorted = new Set();     //tracks indices that are fully sorted
  let comps = 0, swps = 0;      //tracks comparisons and swaps

  for (let i = 0; i < n - 1; i++) {   //bubble sort logic
    let swapped = false;              //swap is set to false before each iteration
    for (let j = 0; j < n - i - 1; j++) {
      comps++;                        //a comparison happens in each inner loop so its incremented
      yield { array: a, comparing: [j, j + 1], swapping: [], sorted, comparisons: comps, swaps: swps }; //a screenshot is sent to the UI showing: the compared indices in yellow, NO swaps, current array state 

      if (a[j] > a[j + 1]) {                 
        [a[j], a[j + 1]] = [a[j + 1], a[j]]; //swap them
        swps++;                              //increment number of swaps
        swapped = true;                      //mark that a swap happened
        yield { array: a, comparing: [], swapping: [j, j + 1], sorted, comparisons: comps, swaps: swps };  //a screenshot is sent to the UI showing swapping in red
      }
    }
    sorted.add(n - i - 1);  //after each inner loop the largest element is sorted at the end, so we add its index
    yield { array: a, comparing: [], swapping: [], sorted, comparisons: comps, swaps: swps };  //we send a screenshot of the sorted element to the UI
    if (!swapped) break;  //this is purely for optimization, it checks if no swaps happened, then the array is already sorted and safely breaks
  }

  // Mark all sorted
  for (let i = 0; i < n; i++) sorted.add(i);
  yield { array: a, comparing: [], swapping: [], sorted, comparisons: comps, swaps: swps, done: true };  //sends that everything is sorted and "done"
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

// ── Merge Sort ─────────────────────────────────────────────── [split -> merge in a sorted way]
function* mergeSort(arr) {
  const a = [...arr];
  const n = a.length;
  const sorted = new Set();
  let comps = 0, swps = 0;

  // Iterative (bottom-up) merge sort instead of recursion for visualization
  function* merge(left, mid, right) {
    const leftArr  = a.slice(left, mid + 1);               //split array into 2 halves (which are already sorted)
    const rightArr = a.slice(mid + 1, right + 1);       
    let i = 0, j = 0, k = left;                            //i > index in left arr, j > index in right arr, k position in original array a

    while (i < leftArr.length && j < rightArr.length) {    //compare elements from both halves till one runs out
      comps++;                                             //we increment comps as this is a comparison
      yield { array: a, comparing: [left + i, mid + 1 + j], swapping: [], sorted, comparisons: comps, swaps: swps };  //send a screenshot of this comparison

      if (leftArr[i] <= rightArr[j]) {  //take from the left side if smaller
        a[k] = leftArr[i++];
      } else {
        a[k] = rightArr[j++];           //take from right side if smaller
        swps++;                         //a swap happened so we increment
        yield { array: a, comparing: [], swapping: [k], sorted, comparisons: comps, swaps: swps };  //send an ss of this swap
      }
      k++;                             //move pointer k forward
    }

    //if one sides finishes first, copy the rest of the elements in the other array in a
    while (i < leftArr.length) { a[k++] = leftArr[i++]; }
    while (j < rightArr.length) { a[k++] = rightArr[j++]; }

    yield { array: a, comparing: [], swapping: [], sorted, comparisons: comps, swaps: swps }; //send an ss of the sorted array after full merge
  }

  //outer loop: start with subarrays of size 1, then merge into size 2, then 4,8,16...
  for (let size = 1; size < n; size *= 2) {
    for (let left = 0; left < n; left += 2 * size) {       //start of left half (moves in blocks of 2*size)
      const mid   = Math.min(left + size - 1, n - 1);      //[position] end of left half (left + size - 1 is the end of the left chunk and n-1 ensures it doesnt go past the array)
      const right = Math.min(left + 2 * size - 1, n - 1);  //[position] end of right half (left + 2 * size - 1 is the end of the left chunk and n-1 ensures it doesnt go past the array)
      if (mid < right) {                                   // check if there is a right chunk to merge first
        yield* merge(left, mid, right);                    // yeild* means forward all frames to UI
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

// ── Radix Sort ───────────────────────────────────────────────
function* radixSort(arr) {
  const a = [...arr];
  const n = a.length;
  const sorted = new Set();
  let comps = 0, swps = 0;

  const max = Math.max(...a);
  const digitCount = Math.floor(Math.log10(max)) + 1;

  for (let digit = 0; digit < digitCount; digit++) {
    const divisor = Math.pow(10, digit);
    const buckets = Array.from({ length: 10 }, () => []);

    // Place into buckets
    for (let i = 0; i < n; i++) {
      const d = Math.floor(a[i] / divisor) % 10;
      buckets[d].push(a[i]);
      comps++;
      yield { array: a, comparing: [i], swapping: [], sorted, comparisons: comps, swaps: swps };
    }

    // Read back from buckets
    let idx = 0;
    for (let b = 0; b < 10; b++) {
      for (const val of buckets[b]) {
        a[idx] = val;
        swps++;
        yield { array: a, comparing: [], swapping: [idx], sorted, comparisons: comps, swaps: swps };
        idx++;
      }
    }
  }

  for (let i = 0; i < n; i++) sorted.add(i);
  yield { array: a, comparing: [], swapping: [], sorted, comparisons: comps, swaps: swps, done: true };
}

// ── Heap Sort ────────────────────────────────────────────────
function* heapSort(arr) {
  const a = [...arr];
  const n = a.length;
  const sorted = new Set();
  let comps = 0, swps = 0;

  function* heapify(size, root) {
    let largest = root;
    const left  = 2 * root + 1;
    const right = 2 * root + 2;

    if (left < size) {
      comps++;
      yield { array: a, comparing: [largest, left], swapping: [], sorted, comparisons: comps, swaps: swps };
      if (a[left] > a[largest]) largest = left;
    }

    if (right < size) {
      comps++;
      yield { array: a, comparing: [largest, right], swapping: [], sorted, comparisons: comps, swaps: swps };
      if (a[right] > a[largest]) largest = right;
    }

    if (largest !== root) {
      [a[root], a[largest]] = [a[largest], a[root]];
      swps++;
      yield { array: a, comparing: [], swapping: [root, largest], sorted, comparisons: comps, swaps: swps };
      yield* heapify(size, largest);
    }
  }

  // Build max heap
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    yield* heapify(n, i);
  }

  // Extract elements one by one
  for (let i = n - 1; i > 0; i--) {
    [a[0], a[i]] = [a[i], a[0]];
    swps++;
    sorted.add(i);
    yield { array: a, comparing: [], swapping: [0, i], sorted, comparisons: comps, swaps: swps };
    yield* heapify(i, 0);
  }

  for (let i = 0; i < n; i++) sorted.add(i);
  yield { array: a, comparing: [], swapping: [], sorted, comparisons: comps, swaps: swps, done: true };
}

/* ═══════════════════════════════════════════════════════════════
   4. ANIMATION ENGINE
   ═══════════════════════════════════════════════════════════════ */

// an IIFE function which runs as soon as it is defined in order to create a private scope so internal variables (generator) are hidden from the global scope
// Returns an object { run, stop, togglePause } at the end
const AnimEngine = (() => { 

  const generators = {};  //Holds the current generator instances from the sorting algorithm, this generator produces frames for animation, one step at a time (array just in case of a race)

  /**
   * async → allows use of await so the browser doesn’t freeze
   * Run the sort step by step, yielding control back to the
   * browser between frames to avoid blocking the UI thread.
   */

  //main function that animates the sort; parameters : algoKey → e.g., "bubble", array → the array to sort
  async function run(algoKey, array, panelRef) { 
    const meta  = ALGORITHMS[algoKey];       //gets the object for the chosen algorithm and assign it to meta object
    generators[algoKey] = meta.fn(array);    //the generator function for the sorting algorithm is assigned to the generator which produces frames step by step via yield

    if (!State.raceMode) {
      State.comparisons = 0;
      State.swaps       = 0;
      State.startTime   = performance.now();
      UIController.onSortStart();
      TimerController.start();
    } else {
      State.panels[algoKey].comparisons = 0;
      State.panels[algoKey].swaps       = 0;
      State.panels[algoKey].startTime   = performance.now();
      State.panels[algoKey].timerHandle = setInterval(() => {
      if (!State.paused) {
        const el = document.querySelector(`[data-algo-panel="${algoKey}"] .panel-timer`);
        if (el) {
          const elapsed = ((performance.now() - State.panels[algoKey].startTime) / 1000).toFixed(3);
          el.textContent = `${elapsed}s`;
        }
      }
    }, 100);
    }

    State.sorting       = true;
    State.paused        = false;
    State.stopRequested = false;

    for (const frame of generators[algoKey]) {         //looping through all frames
    
      if (State.stopRequested) {             // Check for stop signal immedietly as stopping feels smoother when its the first check
        TimerController.stop();
        UIController.onSortStop();
        return;
      }

      while (State.paused && !State.stopRequested) {   // isPaused?
        await sleep(100);                              // wait 100ms before checking the condition again
      }

      if (State.stopRequested) {            // check for stop again if user stopped while paused
        TimerController.stop();
        UIController.onSortStop();
        return;
      }

      // Apply frame
     if (State.raceMode) {
        State.panels[algoKey].comparisons = frame.comparisons;
        State.panels[algoKey].swaps       = frame.swaps;
        Renderer.applyFrame(frame, algoKey);
        UIController.updatePanelStats(algoKey);
      } else {
        State.comparisons = frame.comparisons;
        State.swaps       = frame.swaps;
        Renderer.applyFrame(frame, 'single');
        UIController.updateStats();
      }
      AudioEngine.playFrame(frame);               //play sound if enabled

      // Delay between frames
      const delay = SPEED_MAP[State.speedLevel]; //speed is set by the user and is what defines our delay
      if (delay > 0) await sleep(delay);         //just in case delay is zero or -ve in the future
    }

    // After loop ends -> Completion
    if (State.raceMode) {
      State.panels[algoKey].finished = true;
      UIController.onPanelComplete(algoKey);
      // only flip State.sorting when ALL panels are done
      const allDone = Object.values(State.panels).every(p => p.finished);
      if (allDone) State.sorting = false;
    } else {
      TimerController.stop();
      State.sorting = false;
      UIController.onSortComplete();
    }
  }

 async function runRace(algoKeys, array) {
    State.winner  = null;
    State.sorting = true;
    State.paused  = false;
    State.stopRequested = false;

    algoKeys.forEach(key => {
      State.panels[key] = { comparisons: 0, swaps: 0, startTime: null, finished: false, timerHandle: null };
    });

    State.startTime = performance.now();

    TimerController.start();

    // panels and bars already exist from checkbox selection — just grab the containers
    const panelRefs = {};
    algoKeys.forEach(key => {
      panelRefs[key] = document.querySelector(`[data-algo-panel="${key}"] .race-viz-container`);
    });

    UIController.onRaceStart();  // ← new function to handle UI state (buttons etc.)

    await Promise.all(algoKeys.map(key => run(key, array, panelRefs[key])));

    TimerController.stop();
  }

  //stop function
  function stop() {
    State.stopRequested = true;
    State.paused        = false;
  }

  //pause function
  function togglePause() {
    State.paused = !State.paused;
    UIController.onPauseToggle();
  }

  return { run, runRace, stop, togglePause };  //API -> Other code can now only run, stop, or pause the sorter through the animator object while the internal stuff is private
})();

/* ═══════════════════════════════════════════════════════════════
   5. RENDER ENGINE
   ═══════════════════════════════════════════════════════════════ */

const Renderer = (() => {  //another IIFE which returns an object with methods for rendering the bars

  const barEls = {};  // map: algoKey → array of bar elements

  /* Generate a random array and render it */
  function generateArray(size, containerEl) {
    State.array = Array.from({ length: size }, () => Math.floor(Math.random() * 90) + 10);  //generates an array of size size and fills in each element with a value from 10 > 99
    buildBars(State.array, containerEl, 'single');           //renders bars on the web
  }

  /** Build bar DOM elements */
  function buildBars(arr, containerEl, algoKey) {
    containerEl.innerHTML = '';
    barEls[algoKey] = [];               //resets bars

    const showLabels = arr.length <= 30;      //shows labels (value of each index) if length is less than 30

    arr.forEach((val, i) => {                                       //loops through the array
      const bar = document.createElement('div');                    //creates a div for each element in array [stored in memory]
      bar.className = 'bar' + (showLabels ? ' show-label' : '');    //class name is bar and if showLables is true then the id is bar show-label for css
      bar.style.height = `${val}%`;                                 //Sets the height based on the value (why the array has values from 10 - 99 -for now-)

      if (showLabels) {                                             //if showLabels is on
        const label = document.createElement('span');               //creates in html <span></span> [stored in memory]
        label.className = 'bar-label';                              //assigned a class name for css
        label.textContent = val;                                    //the text equals the value of array
        bar.appendChild(label);                                     //attach label to bar giving : (<div class="bar"><span>val</span></div>)
      }

      containerEl.appendChild(bar);                                          //add bar to container which puts the bar on the webpage
      barEls[algoKey].push(bar);                                    //saves the bar in an array (barEls)
    });
  }

  /** Apply a frame from the algorithm generator */
  function applyFrame(frame, algoKey) {
    const { array, comparing, swapping, pivot = -1, sorted } = frame;     //extracts data from frame (destructing)
    const comparingSet = new Set(comparing);                              //convert to sets for faster and more efficient checks
    const swappingSet  = new Set(swapping);
    const bars         = barEls[algoKey];                                 //get the bars for this specific panel

    bars.forEach((bar, i) => {                                            //loop through all bars
      
      bar.style.height = `${array[i]}%`;                                  //update height (the bars dont switch place their values just change)

      const label = bar.querySelector('.bar-label');                      //update label if present
      if (label) label.textContent = array[i];

      bar.className = 'bar' + (bars.length <= 30 ? ' show-label' : '');  //clears previous colors (sorted, swapping, etc.)
      /**adds color depending on the state of the bar if none remains neutral */
      if (sorted.has(i))              bar.classList.add('sorted');
      else if (swappingSet.has(i))    bar.classList.add('swapping');
      else if (i === pivot)           bar.classList.add('pivot');
      else if (comparingSet.has(i))   bar.classList.add('comparing');
    });
  }

  /** Mark all bars as sorted as we want them to turn green after we're done sorting */
  function markAllSorted(algoKey) {
    const bars = barEls[algoKey];
    bars.forEach(bar => {
      bar.className = 'bar' + (bars.length <= 30 ? ' show-label' : '');
      bar.classList.add('sorted');
    });
  }

  /** Reset bars to default color [Resets its class name to default] by removing color tag */
  function resetColors(algoKey) {
    const bars = barEls[algoKey];
    bars.forEach(bar => {
      bar.className = 'bar' + (bars.length <= 30 ? ' show-label' : '');
    });
  }

  //Returning the Renderer API, these are the functions used outside of this module
  return { generateArray, buildBars, applyFrame, markAllSorted, resetColors };
})();

/* ═══════════════════════════════════════════════════════════════
   6. AUDIO ENGINE
   ═══════════════════════════════════════════════════════════════ */

const AudioEngine = (() => {          //iffe function called on decleration
  function getCtx() {                 //lazy initialization of Audio Engine that was mentioned above
    if (!State.audioCtx) {            //if it is null [only during first call]
      try {
        State.audioCtx = new (window.AudioContext || window.webkitAudioContext)();  //we set the audiocontext (sound system)
      } catch (e) {
        console.warn('Web Audio not supported');                                    //if error occurs set a warning
        return null;                                                                //and return nothing
      }
    }
    return State.audioCtx;                                                          //otherwise return soundsystem
  }

  function playTone(freq, type = 'sine', duration = 0.08, vol = 0.15) {           //what plays the audio
    const ctx = getCtx();                       //gets web audio from from getCtx
    if (!ctx || !State.soundEnabled) return;    //returns early if sound is not enabled or web audio does not exist/encountered an error

    const osc  = ctx.createOscillator();        //creates an oscillator the source of the sound (tone generator)
    const gain = ctx.createGain();              //creates a volume controller

    osc.connect(gain);                          //the oscilattor sends the signal to the volume controller
    gain.connect(ctx.destination);              //takes an input audio signal and multiplies it by a gain value (gain.gain), then connectes to ctx.destination,where everything will be heard.

    osc.type      = type;                       //sets the waveform type to sine
    osc.frequency.setValueAtTime(freq, ctx.currentTime);    //sets the pitch
    gain.gain.setValueAtTime(vol, ctx.currentTime);         //sets the volume
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);    //expenentially decreases vol to very low to give a fade out effect at a time = duration

    osc.start(ctx.currentTime);           //starts the tone immediately.      
    osc.stop(ctx.currentTime + duration); //stops it after duration seconds.    
  }

  function playFrame(frame) {
    if (!State.soundEnabled) return;      //if sound is disabled do not do anything

    const n = frame.array.length;         //set n = size array

    if (frame.swapping && frame.swapping.length > 0) {            //checks if frame.swapping exists and is not null/undefined & contains at least one element
      //map array value to frequency (200 Hz – 900 Hz)
      const val  = frame.array[frame.swapping[0]] || 50;          //gets the value of the first index in the swapped array, if for some reason its null, default to 50
      const freq = 200 + (val / 100) * 700;                       //get freq based on value
      playTone(freq, 'sawtooth', 0.06, 0.1);                      //call playtone

    } else if (frame.comparing && frame.comparing.length > 0) {
      const val  = frame.array[frame.comparing[0]] || 50;
      const freq = 300 + (val / 100) * 500;
      playTone(freq, 'sine', 0.04, 0.05);
    }
  }

  function playComplete() {           //plays a short success sound when sort is done
    if (!State.soundEnabled) return;
    [523, 659, 784, 1047].forEach((freq, i) => {
      setTimeout(() => playTone(freq, 'triangle', 0.2, 0.15), i * 80);
    });
  }
  
  //Exposes two functions from the AudioEngine:
  return { playFrame, playComplete };
})();

/* ═══════════════════════════════════════════════════════════════
   7. UI CONTROLLER
   ═══════════════════════════════════════════════════════════════ */

const UIController = (() => {        //iffe
  const $ = id => document.getElementById(id);  //shortcut function $ to grab html elements by id.

  function updateStats() {  //updates the comparison and swap counters on the UI (single mode only)
    $('comparisonsCount').textContent = State.comparisons.toLocaleString();
    $('swapsCount').textContent       = State.swaps.toLocaleString();
  }

  function updatePanelStats(algoKey) {  //updates the comparison and swap counters for a specific panel (race mode only)
    const panel = State.panels[algoKey];
    const el    = document.querySelector(`[data-algo-panel="${algoKey}"]`);
    if (!el) return;
    el.querySelector('.panel-comparisons').textContent = panel.comparisons.toLocaleString();
    el.querySelector('.panel-swaps').textContent       = panel.swaps.toLocaleString();
  }

  function updateAlgoInfo(key) {  //updates algorithm information when the user selects an algorithm from ALGORITHMS
    const meta = ALGORITHMS[key];
    if (!meta) return;
    $('bestCase').textContent        = meta.best;
    $('avgCase').textContent         = meta.average;
    $('worstCase').textContent       = meta.worst;
    $('spaceCase').textContent       = meta.space;
    $('algoDescription').textContent = meta.description;
  }

  function setStatus(type, text) {  //updates the status indicator [dot = colored dot, msg = status message text]
    const dot = $('statusDot');
    const msg = $('statusText');
    dot.className   = `status-indicator ${type}`;
    msg.textContent = text;
  }

  function onSortStart() {    //called when sorting starts (single mode only)
    $('startBtn').classList.add('hidden');
    $('pauseBtn').classList.remove('hidden');
    $('stopBtn').classList.remove('hidden');
    $('generateBtn').disabled = true;
    $('sizeSlider').disabled  = true;
    $('vizOverlay').classList.add('hidden');
    setDisabledAlgoBtns(true);
    setDisabledRaceToggle(true);
    setStatus('running', `Running ${ALGORITHMS[State.algorithm].name}…`);
  }
  function onRaceStart() {
    $('startBtn').classList.add('hidden');
    $('pauseBtn').classList.remove('hidden');
    $('stopBtn').classList.remove('hidden');
    $('generateBtn').disabled = true;
    $('sizeSlider').disabled  = true;
    setDisabledAlgoCheckboxes(true);
    setDisabledRaceToggle(true);
    setStatus('running', 'Race in progress…');
  }

  function onSortComplete() {     //called when sorting is done (single mode only)
    State.sorting = false;
    $('startBtn').classList.remove('hidden');
    $('pauseBtn').classList.add('hidden');
    $('stopBtn').classList.add('hidden');
    $('generateBtn').disabled = false;
    $('sizeSlider').disabled  = false;
    setDisabledAlgoBtns(false);
    setDisabledRaceToggle(false);

    Renderer.markAllSorted('single');
    setStatus('done', `${ALGORITHMS[State.algorithm].name} completed — ${State.comparisons.toLocaleString()} comparisons, ${State.swaps.toLocaleString()} swaps`);

    // show overlay after sort is done
    const elapsed = ((performance.now() - State.startTime) / 1000).toFixed(3);
    $('overlayStats').innerHTML =
      `Comparisons: <span>${State.comparisons.toLocaleString()}</span>   ·   ` +
      `Swaps: <span>${State.swaps.toLocaleString()}</span>   ·   ` +
      `Time: <span>${elapsed}s</span>`;
    $('vizOverlay').classList.remove('hidden');

    AudioEngine.playComplete();
  }

  function onSortStop() {   //called when user stops sorting manually
    State.sorting = false;
    State.paused  = false;
    if (State.raceMode) setDisabledAlgoCheckboxes(false);
    $('startBtn').classList.remove('hidden');
    $('pauseBtn').classList.add('hidden');
    $('stopBtn').classList.add('hidden');
    $('generateBtn').disabled = false;
    $('sizeSlider').disabled  = false;
    $('pauseBtn').textContent = '⏸ Pause';
    setDisabledAlgoBtns(false);
    setDisabledRaceToggle(false);

    if (State.raceMode) {
      // reset colors on all active panels
      Object.keys(State.panels).forEach(key => Renderer.resetColors(key));
       Object.keys(State.panels).forEach(key => clearInterval(State.panels[key].timerHandle));  //stops timers
    } else {
      Renderer.resetColors('single');
    }

    setStatus('stopped', 'Sort stopped — generate a new array or press Sort again');
  }

  function onPauseToggle() {    //called when user pauses
    const btn = $('pauseBtn');
    if (State.paused) {
      btn.textContent = '▶ Resume';
      setStatus('paused', 'Paused — press Resume to continue');
    } else {
      btn.textContent = '⏸ Pause';
      const label = State.raceMode ? 'Race' : ALGORITHMS[State.algorithm].name;
      setStatus('running', `Running ${label}…`);
    }
  }

  function onPanelComplete(algoKey) {  //called when a single panel finishes in race mode

    const panelEndTime = performance.now(); //timer stuff
    clearInterval(State.panels[algoKey].timerHandle);
    const timerEl = document.querySelector(`[data-algo-panel="${algoKey}"] .panel-timer`); // ← renamed to timerEl
    if (timerEl) {
      timerEl.textContent = `${((panelEndTime - State.panels[algoKey].startTime) / 1000).toFixed(3)}s`;
    }

    Renderer.markAllSorted(algoKey);

    const panel   = State.panels[algoKey];
    const elapsed = ((performance.now() - panel.startTime) / 1000).toFixed(3);
    const el      = document.querySelector(`[data-algo-panel="${algoKey}"]`);
    if (!el) return;

    // if this is the first to finish, declare it the winner
    if (State.winner === null) {
      State.winner = algoKey;
      el.classList.add('panel-winner');
      el.querySelector('.panel-finish-banner').textContent = `Winner — ${elapsed}s`;

      // dim all other panels
      Object.keys(State.panels).forEach(key => {
        if (key !== algoKey) {
          document.querySelector(`[data-algo-panel="${key}"]`)?.classList.add('panel-loser');
        }
      });

      AudioEngine.playComplete();
    } else {
      // not the winner, just show finish time
      el.querySelector('.panel-finish-banner').textContent = `Finished — ${elapsed}s`;
    }

    el.querySelector('.panel-finish-banner').classList.remove('hidden');

    // check if ALL panels are done — if so, wrap up the race
    const allDone = Object.values(State.panels).every(p => p.finished);
    if (allDone){
      State.endTime = performance.now();  //capture time
      onRaceComplete();
    } 
  }

  function onRaceComplete() {  //called when every panel has finished
    State.sorting = false;
    $('startBtn').classList.remove('hidden');
    $('pauseBtn').classList.add('hidden');
    $('stopBtn').classList.add('hidden');
    $('generateBtn').disabled = false;
    $('sizeSlider').disabled  = false;
    setDisabledRaceToggle(false);
    setDisabledAlgoCheckboxes(false);

    const finalElapsed = ((State.endTime - State.startTime) / 1000).toFixed(3);
    document.getElementById('raceTimerDisplay').textContent = `${finalElapsed}s`;

    setStatus('done', `Race complete — ${ALGORITHMS[State.winner].name} won!`);
  }

  function buildRacePanels(algoKeys) {  //builds the race panel DOM elements and returns a map of algoKey → bar container element
    const raceGrid = $('raceGrid');
    raceGrid.innerHTML = '';                  // clear previous race
    const panelRefs = {};

    algoKeys.forEach(key => {
      const meta = ALGORITHMS[key];

      // outer panel wrapper
      const panel = document.createElement('div');
      panel.className = 'race-panel';
      panel.dataset.algoPanel = key;          // lets us querySelector by key later

      // panel header: algorithm name
      const header = document.createElement('div');
      header.className = 'race-panel-header';
      header.textContent = meta.name;

      // bar container (this is what Renderer writes bars into)
      const vizContainer = document.createElement('div');
      vizContainer.className = 'race-viz-container';

      // stats row: comparisons + swaps
      const statsRow = document.createElement('div');
      statsRow.className = 'race-panel-stats';
      statsRow.innerHTML =
        `<span>Comp: <b class="panel-comparisons">0</b></span>` +
        `<span>Swaps: <b class="panel-swaps">0</b></span>`;
      statsRow.innerHTML =
        `<span>Comp: <b class="panel-comparisons">0</b></span>` +
        `<span>Swaps: <b class="panel-swaps">0</b></span>` +
        `<span>Time: <b class="panel-timer">0.000s</b></span>`;

      // finish banner (hidden until panel completes)
      const banner = document.createElement('div');
      banner.className = 'panel-finish-banner hidden';

      panel.appendChild(header);
      panel.appendChild(vizContainer);
      panel.appendChild(statsRow);
      panel.appendChild(banner);
      raceGrid.appendChild(panel);

      panelRefs[key] = vizContainer;          // this is what AnimEngine passes to Renderer
    });

    return panelRefs;
  }

  function setDisabledAlgoBtns(disabled) {  //enables or disables all algorithm selection buttons (.algo-btn) at once (single mode)
    document.querySelectorAll('.algo-btn').forEach(b => b.disabled = disabled);
  }

  function setDisabledAlgoCheckboxes(disabled) {  //enables or disables algorithm checkboxes (race mode)
    document.querySelectorAll('.algo-checkbox').forEach(b => b.disabled = disabled);
  }

  function setDisabledRaceToggle(disabled) {  //prevents switching modes mid-sort
    $('raceModeToggle').disabled = disabled;
  }

  function resetForNewArray() {  //resets the UI and state when a new array is generated
    State.comparisons = 0;
    State.swaps       = 0;
    updateStats();
    $('elapsedTime').textContent = '0.000s';
    $('vizOverlay').classList.add('hidden');
    setStatus('ready', 'Ready — select an algorithm and press Sort');
  }

  function switchToRaceMode() {   //swaps the single viz panel for the race grid
    $('singleModeView').classList.add('hidden');
    $('raceModeView').classList.remove('hidden');
    $('algoInfoPanel').classList.add('hidden');   // complexity panel not relevant in race mode
    $('singleModeAlgoPanel').classList.add('hidden');
    $('raceModeAlgoPanel').classList.remove('hidden');
    $('statsPanel').classList.add('hidden');
    State.array = Array.from({ length: State.arraySize }, () => Math.floor(Math.random() * 90) + 10);
    resetForNewArray();
    setStatus('ready', 'Race mode — select 2 or more algorithms and press Sort');
  }

  function switchToSingleMode() {  //swaps the race grid back for the single viz panel
    $('raceModeView').classList.add('hidden');
    $('singleModeView').classList.remove('hidden');
    $('algoInfoPanel').classList.remove('hidden');
    $('raceModeAlgoPanel').classList.add('hidden');      
    $('singleModeAlgoPanel').classList.remove('hidden');
    $('statsPanel').classList.remove('hidden');   
    State.panels  = {};
    State.winner  = null;
    State.raceMode = false;
    resetForNewArray();
    setStatus('ready', 'Ready — select an algorithm and press Sort');
    document.querySelectorAll('.algo-checkbox').forEach(cb => {
      cb.checked = false;
    });
    State.selectedAlgos = [];
    document.getElementById('raceGrid').innerHTML = ''; // ← ADD THIS
  }

  //exposes all the functions above so other parts of the program can call them.
  return {
    updateStats, updatePanelStats, updateAlgoInfo,
    onSortStart, onRaceStart, onSortComplete, onSortStop, onPauseToggle,
    onPanelComplete, onRaceComplete, buildRacePanels,
    resetForNewArray, setStatus,
    switchToRaceMode, switchToSingleMode,
    setDisabledAlgoBtns, setDisabledAlgoCheckboxes, setDisabledRaceToggle,
  };
})();

/* ═══════════════════════════════════════════════════════════════
   Timer Controller
   ═══════════════════════════════════════════════════════════════ */

const TimerController = (() => {    //iffe
  let handle = null;    //stores the ID of the interval created by setInterval

  function start() {
    stop();            //calls stop() to clear any previous timer if one is already running, avoiding duplicate intervals.
    handle = setInterval(() => {                          //setInterval repeatedly runs the function every 100ms & the handle stores the interval ID so we can stop it later.
      if (!State.paused && State.startTime !== null) {    //checks if pause & if sorting started
        const elapsed = ((performance.now() - State.startTime) / 1000).toFixed(3);    //subtract current time for the starttime and divide by 1000 to convert to sec
        document.getElementById('elapsedTime').textContent = `${elapsed}s`;           //set html element of ID elapsedTime and updates it to store time
      }
    }, 100);
  }

  function stop() {
    if (handle) { clearInterval(handle); handle = null; }   //stops the repeated execution and sets handle to null
  }

  return { start, stop };
})();

/* ═══════════════════════════════════════════════════════════════
   8. EVENT HANDLERS
   ═══════════════════════════════════════════════════════════════ */

function initEventHandlers() {
  const $ = id => document.getElementById(id);                    //same shortcut function

  // ── Generate new array ────────────────────────────────────
  $('generateBtn').addEventListener('click', () => {
    if (State.sorting) return;
    if (State.raceMode) {
      // generate one array and sync it to all selected panels so the race is fair
      State.array = Array.from({ length: State.arraySize }, () => Math.floor(Math.random() * 90) + 10);
      const panelRefs = UIController.buildRacePanels(State.selectedAlgos);
      State.selectedAlgos.forEach(key => {
        Renderer.buildBars(State.array, panelRefs[key], key);
      });
    } else {
      Renderer.generateArray(State.arraySize, $('vizContainer'));
    }
    UIController.resetForNewArray();
  });

  // ── Start sort ────────────────────────────────────────────
  $('startBtn').addEventListener('click', () => {
    if (State.sorting) return;
    if (State.raceMode) {
      if (State.selectedAlgos.length < 2) {
        UIController.setStatus('ready', 'Select at least 2 algorithms to race');
        return;
      }
      AnimEngine.runRace(State.selectedAlgos, State.array);
    } else {
      AnimEngine.run(State.algorithm, State.array, $('vizContainer'));
    }
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

  // ── Algorithm selector (single mode) ─────────────────────
  $('algoList').addEventListener('click', e => {
    const btn = e.target.closest('.algo-btn');
    if (!btn || State.sorting || State.raceMode) return;          //ignore clicks in race mode

    document.querySelectorAll('.algo-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    State.algorithm = btn.dataset.algo;
    UIController.updateAlgoInfo(State.algorithm);
  });

  // ── Algorithm checkboxes (race mode) ─────────────────────
  $('algoCheckboxList').addEventListener('change', e => {
    const checkbox = e.target.closest('.algo-checkbox');
    if (!checkbox || State.sorting) return;

    const key = checkbox.dataset.algo;
    if (checkbox.checked) {
      if (!State.selectedAlgos.includes(key)) State.selectedAlgos.push(key);
    } else {
      State.selectedAlgos = State.selectedAlgos.filter(k => k !== key);
    }
    if (State.selectedAlgos.length > 0) {
      const panelRefs = UIController.buildRacePanels(State.selectedAlgos);
      State.selectedAlgos.forEach(k => {
        Renderer.buildBars(State.array, panelRefs[k], k);
      });
    } else {
      $('raceGrid').innerHTML = '';
    }
  });

  // ── Race mode toggle ──────────────────────────────────────
  $('raceModeToggle').addEventListener('click', () => {
    if (State.sorting) return;
    State.raceMode = !State.raceMode;
    $('raceModeToggle').classList.toggle('active', State.raceMode);
    if (State.raceMode) {
      State.selectedAlgos = [];
      UIController.switchToRaceMode();
    } else {
      UIController.switchToSingleMode();
      Renderer.generateArray(State.arraySize, $('vizContainer'));
    }
  });

  // ── Array size slider ─────────────────────────────────────
  $('sizeSlider').addEventListener('input', e => {
    const size = parseInt(e.target.value);
    State.arraySize = size;
    $('sizeVal').textContent = size;
    if (!State.sorting) {
      if (State.raceMode) {
        // regenerate and sync to all panels if any are selected
        if (State.selectedAlgos.length > 0) {
          State.array = Array.from({ length: size }, () => Math.floor(Math.random() * 90) + 10);
          const panelRefs = UIController.buildRacePanels(State.selectedAlgos);
          State.selectedAlgos.forEach(key => {
            Renderer.buildBars(State.array, panelRefs[key], key);
          });
        }
      } else {
        Renderer.generateArray(size, $('vizContainer'));
        UIController.resetForNewArray();
      }
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
        else $('startBtn').click();
        break;
      case 'n': case 'N':
        if (!State.sorting) $('generateBtn').click();
        break;
      case 'Escape':
        if (State.sorting) AnimEngine.stop();
        break;
      // number keys only work in single mode
      case '1': if (!State.raceMode) selectAlgo('bubble');    break;
      case '2': if (!State.raceMode) selectAlgo('selection'); break;
      case '3': if (!State.raceMode) selectAlgo('insertion'); break;
      case '4': if (!State.raceMode) selectAlgo('merge');     break;
      case '5': if (!State.raceMode) selectAlgo('quick');     break;
      case '6': if (!State.raceMode) selectAlgo('heap');      break;
      case '7': if (!State.raceMode) selectAlgo('radix');     break;
    }
  });
}

function selectAlgo(key) {
  if (State.sorting || State.raceMode) return;
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
  Renderer.generateArray(State.arraySize, document.getElementById('vizContainer'));

  // Wire up all events
  initEventHandlers();

  // Status
  UIController.setStatus('ready', 'Ready — press [Space] to sort, [N] for new array, [1-5] to switch algorithms');
})();
