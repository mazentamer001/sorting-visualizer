# Sort.EXE — Algorithm Visualizer

A production-quality sorting algorithm visualizer built with vanilla HTML, CSS, and JavaScript. No frameworks, no dependencies (except Google Fonts via CDN).

## How to Run

Simply open `index.html` in any modern browser. No build step, no server needed.

```
sorting-visualizer/
├── index.html   ← Open this
├── style.css
├── script.js
└── README.md
```

## Algorithms

| Algorithm      | Best       | Average    | Worst      | Space    |
|----------------|------------|------------|------------|----------|
| Bubble Sort    | O(n)       | O(n²)      | O(n²)      | O(1)     |
| Selection Sort | O(n²)      | O(n²)      | O(n²)      | O(1)     |
| Insertion Sort | O(n)       | O(n²)      | O(n²)      | O(1)     |
| Merge Sort     | O(n log n) | O(n log n) | O(n log n) | O(n)     |
| Quick Sort     | O(n log n) | O(n log n) | O(n²)      | O(log n) |

## Keyboard Shortcuts

| Key       | Action                    |
|-----------|---------------------------|
| `Space`   | Start / Pause / Resume    |
| `N`       | Generate new array        |
| `Escape`  | Stop sorting              |
| `1`       | Select Bubble Sort        |
| `2`       | Select Selection Sort     |
| `3`       | Select Insertion Sort     |
| `4`       | Select Merge Sort         |
| `5`       | Select Quick Sort         |
