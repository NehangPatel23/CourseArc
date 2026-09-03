function lectureHtml(opts: {
  kicker: string;
  reading: string;
  goals: string[];
  sections: { title: string; html: string }[];
  worked?: string;
  pitfalls?: string[];
  recitation?: string;
  next?: string;
}): string {
  const goals = opts.goals.map((g) => `<li>${g}</li>`).join("");
  const sections = opts.sections
    .map((s) => `<h2>${s.title}</h2>\n${s.html}`)
    .join("\n");
  const pitfalls = (opts.pitfalls ?? []).map((p) => `<li>${p}</li>`).join("");
  return `
<p>${opts.kicker}</p>
<blockquote><p><strong>Reading before lecture:</strong> ${opts.reading}</p></blockquote>
<h2>By the end of this lecture you should be able to</h2>
<ul>${goals}</ul>
${sections}
${opts.worked ? `<h2>Worked example (board notes)</h2>\n${opts.worked}` : ""}
${pitfalls ? `<h2>Pitfalls we will mark down</h2>\n<ul>${pitfalls}</ul>` : ""}
${opts.recitation ? `<h2>Recitation</h2>\n<p>${opts.recitation}</p>` : ""}
${opts.next ? `<h2>Before next class</h2>\n<p>${opts.next}</p>` : ""}
`.trim();
}

function notes(id: string, title: string, html: string) {
  return { id, title, content: html.trim() };
}

export function cs570Pages(): { id: string; title: string; content: string }[] {
  return [
    notes(
      "course-home",
      "CSCI 570 Home",
      `<p>Welcome to <strong>CSCI 570 — Analysis of Algorithms</strong>. This is the graduate core where you invent an algorithm, prove it is correct, and bound the time it takes. If you boarded hoping for a coding-interview bootcamp, stay anyway: we will make you faster at interviews <em>because</em> you can explain why Dijkstra dies on a negative edge, not because you memorized a template.</p>
<p>Code is a means, not the product — except on two programming projects that have to meet a wall clock. The write-up is what we grade. Unlabeled graphs are how points vanish. A bound without a proof is a rumor.</p>
<p>Primary text: CLRS (4th ed.; 3rd is fine). Lecture notes in <a href="/courses/1/modules">Modules</a> are the daily driver. Full contract: <a href="/courses/1/syllabus">Syllabus</a> · <a href="/courses/1/pages/course-overview/view">Course overview</a> · <a href="/courses/1/pages/course-policies/view">Policies</a>.</p>
<h2>What you will actually learn</h2>
<p>By the final you should be able to pick a technique the way a chef picks a pan: greedy when an exchange argument exists, divide-and-conquer when the combine step is honest, DP when subproblems overlap, a graph algorithm when the invariant is a cloud or a timestamp, a reduction when you want to prove something is hard. “I used a hash map” is not a running-time proof.</p>
<h2>The 15-week plot</h2>
<p>Four acts. Modules are the calendar — open the lecture page first, then the problem set or quiz.</p>
<ol>
<li><strong>Act I — The tools (Weeks 1–5).</strong> RAM model, asymptotics, Master Theorem, divide-and-conquer (inversions, closest pair, Strassen), heaps and hashing, greedy (intervals, Huffman). You learn to write a bound that would survive a referee.</li>
<li><strong>Act II — Graphs (Weeks 6–10).</strong> BFS, DFS timestamps, shortest paths, MSTs. Dijkstra is a theorem with a hypothesis (nonnegative weights), not a personality. Draw the forest.</li>
<li><strong>Act III — Tables (Weeks 11–12).</strong> Dynamic programming. Define the state or do not bother writing the recurrence. Reconstruction is part of the answer.</li>
<li><strong>Act IV — Hardness (Weeks 13–15).</strong> NP-completeness, the reduction arrow that points toward the problem you want to prove hard, a little approximation, then a cumulative final.</li>
</ol>
<h2>How the grade is built</h2>
<ul>
<li><strong>Homework 35%</strong> — eight problem sets and two programming projects (Project 2 is the larger one, with peer review).</li>
<li><strong>Quizzes 15%</strong> — seven short quizzes; the practice final is ungraded and has instant feedback.</li>
<li><strong>Exams 40%</strong> — in-class midterm (Week 8, one handwritten sheet) and a cumulative final (Week 15, two sheets).</li>
<li><strong>Participation 10%</strong> — graded discussions (algorithm of the week; DP workshop). Public math belongs in Discussions; private questions in Inbox. Do not email solution PDFs.</li>
</ul>
<p>Extra credit (a short algorithm visualization) is added after weights. It cannot replace an exam.</p>
<blockquote>
<p><strong>On the desk this week — shortest paths.</strong> The midterm (Weeks 1–7) is graded. Finish graph traversals, then switch to Dijkstra. Keys live in the Week 8 module; regrades are Inbox-only for seven days from the score post. Mean was 78%; greedy counterexamples were the discriminator.</p>
</blockquote>
<h2>Do this next</h2>
<table>
<thead>
<tr><th>Open</th><th>Why</th></tr>
</thead>
<tbody>
<tr>
<td><a href="/courses/1/assignments/cs570_ps5_1">PS5 · Graph Traversals</a></td>
<td>Due this week. DFS timestamps, edge types, a short SCC sketch. Pictures required.</td>
</tr>
<tr>
<td><a href="/courses/1/pages/week7-dfs/view">Week 7 lecture · DFS</a></td>
<td>Read before you write PS5. Stuck on forward vs. cross? The <a href="/courses/1/discussions/cs570_disc_dfs">help thread</a> is live.</td>
</tr>
<tr>
<td><a href="/courses/1/pages/week9-sp/view">Week 9 lecture · shortest paths</a></td>
<td>Relaxation, Dijkstra’s cloud, Bellman–Ford’s extra round. This is the rest of the term’s graph vocabulary.</td>
</tr>
<tr>
<td><a href="/courses/1/assignments/cs570_project_1">Project 2 · Shortest Paths</a></td>
<td>Teams in <a href="/courses/1/people/groups">People → Groups</a>. Document decrease-key vs. duplicate-insert. FAQ: <a href="/courses/1/discussions/cs570_disc_project2">heap and parser</a>.</td>
</tr>
<tr>
<td><a href="/courses/1/pages/week8-midterm/view">Midterm keys</a></td>
<td>Written regrade arguments only. Ungraded <a href="/courses/1/discussions/cs570_disc_midterm">postmortem</a>.</td>
</tr>
</tbody>
</table>
<h2>Coming up</h2>
<ul>
<li><a href="/courses/1/quizzes/cs570_quiz_graphs_1">Quiz 5 · Graphs</a> — BFS/DFS, algorithm choice, MST cut property, and a BFS-tree file upload from <em>s</em>.</li>
<li><a href="/courses/1/assignments/cs570_ps6_1">PS6 · Shortest Paths and MSTs</a> — Dijkstra vs. Bellman–Ford, then the cut property.</li>
<li>Then DP, NP-completeness, approximation, and the final.</li>
</ul>
<h2>Office hours</h2>
<p>Instructor drop-in <strong>Wednesday 1–3pm, SAL 322</strong>. TA slots are on the <a href="/courses/1/calendar">calendar</a> — book them; don’t crash. This week’s queue is PS5 drawings and Project 2 parsers. Bring a draft proof or a graph, not a blank editor.</p>
<p>Accommodations: <a href="/courses/1/people/accommodations">People → Accommodations</a>. Collaboration rules and late policy live on the <a href="/courses/1/pages/course-policies/view">policies</a> page.</p>`,
    ),
    notes(
      "course-overview",
      "Course Overview",
      lectureHtml({
        kicker:
          "CSCI 570 trains you to invent an algorithm, prove it, and bound it. Coding is a means, not the product, except on two programming projects that force the analysis to meet a wall clock.",
        reading: "Syllabus (full HTML in the Syllabus tool) and CLRS Ch. 1–2 for Week 1.",
        goals: [
          "State the 15-week map and where each graded item sits.",
          "Distinguish this course from a coding-interview bootcamp.",
          "Know which resource to open for proofs vs. logistics vs. code.",
        ],
        sections: [
          {
            title: "Fifteen-week map",
            html: `<ol>
<li>Foundations: RAM model, loop invariants, insertion vs merge</li>
<li>Asymptotics and the Master Theorem</li>
<li>Divide and conquer (inversions, closest pair, Strassen)</li>
<li>Heaps, hashing, BSTs</li>
<li>Greedy algorithms (scheduling, Huffman)</li>
<li>Graph representations and BFS</li>
<li>DFS, topological sort, strongly connected components</li>
<li>Midterm (Weeks 1–7)</li>
<li>Shortest paths (Dijkstra, Bellman–Ford, Floyd–Warshall)</li>
<li>MSTs and a max-flow preview</li>
<li>Dynamic programming I (tables and reconstruction)</li>
<li>Dynamic programming II (knapsack, DAG paths, weighted intervals)</li>
<li>NP-completeness and reductions</li>
<li>Approximation and randomized algorithms</li>
<li>Review and cumulative final</li>
</ol>`,
          },
          {
            title: "Learning outcomes",
            html: `<ul>
<li>Prove asymptotic bounds from definitions and recurrences (substitution, trees, Master Theorem).</li>
<li>Design divide-and-conquer, greedy, and DP algorithms with a correctness argument, not a slogan.</li>
<li>Apply BFS, DFS, shortest paths, and MSTs with explicit invariants.</li>
<li>Write a Karp-style NP-completeness reduction in the right direction, with gadgets.</li>
<li>Choose an algorithm given constraints: negative weights, density, certificates, approximation.</li>
</ul>`,
          },
          {
            title: "Texts and notes",
            html: `<p>CLRS 4th edition (3rd is fine). Lecture notes in this course are the daily driver; CLRS is the reference when a proof is compressed on the board. You will not be tested on CLRS section numbers, only on the ideas.</p>
<p>Optional: Erickson’s algorithms notes (free) for alternate write-ups of greedy and DP; Kleinberg–Tardos for exchange arguments.</p>`,
          },
          {
            title: "Graded work (weights)",
            html: `<ul>
<li><strong>Homework 35%</strong> — PS1–PS8 plus two programming projects (Project 2 is larger and peer-reviewed)</li>
<li><strong>Quizzes 15%</strong> — seven short quizzes; the practice final is ungraded</li>
<li><strong>Exams 40%</strong> — in-class midterm (Week 8) and cumulative final (Week 15)</li>
<li><strong>Participation 10%</strong> — graded discussions</li>
</ul>
<p>Extra credit (algorithm visualization) is added after weights and cannot replace an exam.</p>`,
          },
        ],
        next: "Introduce yourself in Discussions. Skim PS1 tonight even if you only write the definitions.",
      }),
    ),
    notes(
      "course-policies",
      "Course policies",
      `<h2>Collaboration</h2>
<p>High-level discussion is encouraged: “I used a recursion tree for the uneven split” is fine. The write-up, the pictures, and the code must be yours. List every person you spoke with on the first page of every PDF. Copying proofs, sharing git repos before the deadline, or pasting a problem into a model and submitting the output is an academic integrity case.</p>
<h2>Late work</h2>
<p>The course late-penalty preset applies unless an item turns late submissions off (exams). Accommodations may extend a due date for a named student — Jordan’s PS1 override in the gradebook is the demo of how that looks to staff.</p>
<h2>Regrades</h2>
<p>Inbox within 7 days of the grade being posted. Quote the rubric line and the page of your PDF. We will not hunt for extra points on other problems in the same packet unless we made a summing error.</p>
<h2>Exams</h2>
<p>Closed book. Midterm: one handwritten sheet, both sides. Final: two sheets. No phones, no tablets, no extra paper except what we provide. Seats may be assigned. Extended-time students receive a separate room email the week before.</p>
<h2>AI tools</h2>
<p>You may use them as a rubber duck (“why doesn’t this induction close?”). You may not paste the problem set into a model and submit the output. If a proof sounds like a textbook you have not read, we will ask you to reproduce it on the board.</p>
<h2>Attendance and participation</h2>
<p>Lecture is not recorded by default. Graded discussions have due dates; ungraded Q&amp;A threads stay open. Showing up to office hours with a blank page is allowed once; the second time we will start from last week’s notes together.</p>`,
    ),
    notes(
      "week1-intro",
      "Week 1 lecture: models and sorting",
      lectureHtml({
        kicker:
          "We need a model of computation before “running time” means anything. This week is the RAM model, loop invariants, and why insertion sort and mergesort teach different lessons.",
        reading: "CLRS Ch. 1–2 (insertion sort, mergesort, loop invariants).",
        goals: [
          "Describe the RAM model at the level we will use all term (word operations, no bit tricks unless we say so).",
          "State a loop invariant and use it to prove a short algorithm.",
          "Compare insertion sort and mergesort on best / worst / extra memory.",
        ],
        sections: [
          {
            title: "The RAM model (our contract)",
            html: `<p>Uniform-cost RAM: arithmetic, comparisons, and array indexing on word-sized integers cost Θ(1). We do not count bits unless a problem is about big integers (Karatsuba later). Recursion has a call-stack cost in space; we will mention it when it matters (naive recursive Fibonacci, DFS on a path).</p>
<p>Asymptotics hide machine constants. Project 1 exists so you feel those constants once, then return to proofs.</p>`,
          },
          {
            title: "Loop invariants",
            html: `<p>A loop invariant is a statement that is true before the loop, preserved by the body, and that implies correctness when the loop exits. For insertion sort: “the prefix A[1..j−1] is sorted.” Initialization is the single-element prefix. Maintenance is inserting A[j] into the sorted prefix. Termination is j = n+1.</p>
<p>If you cannot name the invariant, you do not yet have a proof — you have a trace of one input.</p>`,
          },
          {
            title: "Two sorts we will keep using",
            html: `<p><strong>Insertion sort.</strong> Θ(n) on already-sorted data (one comparison per index), Θ(n²) on reverse-sorted data. In-place, stable. The recurrence T(n)=T(n−1)+Θ(n) is the same shape as “unroll the sum.”</p>
<p><strong>Mergesort.</strong> Always Θ(n log n) comparisons in the standard analysis, stable, needs Θ(n) extra memory for the merge. Recurrence T(n)=2T(n/2)+Θ(n). This is the prototype for divide-and-conquer.</p>`,
          },
        ],
        worked: `<p>Prove insertion sort correct with the invariant above on the array [5, 2, 4, 6, 1, 3]. Write the prefix after each j. This is the same discipline we will demand on greedy exchange proofs: say what is true, say why the step preserves it.</p>`,
        pitfalls: [
          "Calling mergesort O(n²) and stopping — true, useless.",
          "An invariant that mentions the particular numbers in the example instead of a property of the prefix.",
        ],
        recitation: "We will write one invariant as a class (linear search vs binary search) and start PS1 Problem 1.",
        next: "Read the Week 2 asymptotics notes. Start PS1 definitions; do not wait until the Master Theorem lecture.",
      }),
    ),
    notes(
      "lecture-slides",
      "Week 2 lecture: asymptotics",
      lectureHtml({
        kicker:
          "Θ, not just O. Recurrences are how we turn a recursive algorithm into a bound. Three tools: substitution, recursion trees, Master Theorem.",
        reading: "CLRS Ch. 3–4 (growth, recurrences). Master Theorem cheatsheet in Files.",
        goals: [
          "Prove f = O(g) and f = Ω(g) from the definition with witnesses c, n₀.",
          "Solve a balanced divide-and-conquer recurrence with the Master Theorem, including extended Case 2.",
          "Refuse to force the Master Theorem on an uneven split; draw a tree instead.",
        ],
        sections: [
          {
            title: "Why Θ, not just O",
            html: `<p>O is an upper bound. “Mergesort is O(n²)” is true and tells a hiring committee nothing. We want matching Ω when we can. Little-o is a strictly slower growth: f = o(g) implies f = O(g) but not conversely. Limits are a shortcut (if the limit of f/g is a positive constant, then f=Θ(g)); definitions are what we use when the limit is 0 or ∞ or does not exist.</p>`,
          },
          {
            title: "Three tools for recurrences",
            html: `<ol>
<li><strong>Substitution</strong> — guess the form, prove by induction. Strengthen the hypothesis if a lower-order term does not absorb (classic: T(n) ≤ cn log n fails until you subtract a linear term).</li>
<li><strong>Recursion tree</strong> — cost per level, number of levels, leaf cost. Geometric series at the levels.</li>
<li><strong>Master Theorem</strong> — when T(n)=aT(n/b)+f(n) with a≥1, b>1.</li>
</ol>`,
          },
          {
            title: "Master Theorem (CLRS form)",
            html: `<ul>
<li><strong>Case 1:</strong> f is polynomially smaller than n^{log_b a} → Θ(n^{log_b a})</li>
<li><strong>Case 2:</strong> f = Θ(n^{log_b a} log^k n) for k≥0 → Θ(n^{log_b a} log^{k+1} n)</li>
<li><strong>Case 3:</strong> f polynomially larger, plus regularity a f(n/b) ≤ c f(n) for some c&lt;1 → Θ(f(n))</li>
</ul>
<p>If the split is uneven — T(n)=T(n/2)+T(n/3)+n — do <em>not</em> invent a b. Draw a tree. The branching work decreases because 1/2+1/3&lt;1, so the root dominates: T(n)=Θ(n).</p>`,
          },
        ],
        worked: `<p><strong>A.</strong> T(n)=2T(n/2)+n → tree: n per level, log n levels → Θ(n log n). Case 2 with k=0.</p>
<p><strong>B.</strong> T(n)=2T(n/2)+n log n → extended Case 2, k=1 → Θ(n log² n).</p>
<p><strong>C.</strong> T(n)=2T(n/2)+n² → Case 3, regularity 2·(n/2)² = n²/2 ≤ c n². Result Θ(n²).</p>`,
        pitfalls: [
          "Applying Case 3 without checking regularity.",
          "Writing log without a base and then treating log² n as (log n)² vs log log n — we mean (log n)² unless we write log log n.",
        ],
        recitation: "Recurrences workshop page: substitution for merge sort, including the floor/ceiling headache.",
        next: "PS1 is due next week. Quiz 1 is 25 minutes, two attempts.",
      }),
    ),
    notes(
      "recurrences",
      "Recurrences workshop",
      `<p>This page is a recitation packet. Work A–C on paper before you scroll to the sketches. Post on the Recurrence relations Q&amp;A thread if your tree does not sum.</p>
<h2>Example A — merge sort</h2>
<p>T(n)=2T(n/2)+n, T(1)=Θ(1). Tree: n per level, log₂ n levels → Θ(n log n).</p>
<p>Substitution: guess T(n) ≤ cn log n. The induction step produces T(n) ≤ cn log n − cn + n, which fails unless you either take c large and subtract a linear term (guess T(n) ≤ cn log n − dn) or restrict to n≥2 and absorb the base separately. Write the hypothesis for all m&lt;n, not only for n/2 on even n — floors are why we sometimes induct on intervals.</p>
<h2>Example B — linear unroll</h2>
<p>T(n)=T(n−1)+n, T(1)=Θ(1) → n+(n−1)+…+1 = Θ(n²). This is not a Master Theorem recurrence (the subproblem size is n−1, not n/b).</p>
<h2>Example C — Case 3 flavor</h2>
<p>T(n)=2T(n/2)+n². Compare f(n)=n² to n^{log₂ 2}=n. Polynomial gap of n^{1}. Regularity: 2 f(n/2)=2(n/2)²=n²/2 ≤ c n² for c=1/2. Result Θ(n²) — the leaves are cheap compared with the root.</p>
<h2>Example D — try before you look</h2>
<p>T(n)=T(n/2)+T(n/3)+n. Levels are not uniform depth. Bound the tree by a geometric series using 1/2+1/3=5/6&lt;1: the cost shrinks, root dominates, T(n)=Θ(n). Akra–Bazzi gives the same conclusion if you have seen it; you may cite it if you state the theorem.</p>
<h2>Example E — a failed guess</h2>
<p>Students often guess T(n)=O(n) for T(n)=2T(n/2)+n. The algebra will not close: you get T(n) ≤ cn + n, which is O(n) only if you already assumed a stronger bound. That is the hint to multiply by a log.</p>
<p>PS1 Problem 3 is a substitution write-up — bring a draft to office hours, not a blank page.</p>`,
    ),
    notes(
      "week3-dc",
      "Week 3 lecture: divide and conquer",
      lectureHtml({
        kicker:
          "Pattern: split, recurse, combine. The intellectually hard part is usually combine in o(n log n) extra work so the recurrence stays friendly.",
        reading: "CLRS Ch. 4 (Strassen), Ch. 33.4 (closest pair); inversion-counting notes.",
        goals: [
          "Count split inversions during a merge in linear time.",
          "Explain the closest-pair strip packing argument (constant neighbors).",
          "Write Strassen’s recurrence and say why 7 multiplies beat 8.",
        ],
        sections: [
          {
            title: "Inversions",
            html: `<p>A pair i&lt;j with A[i]&gt;A[j] is an inversion — a measure of unsortedness. Brute force is Θ(n²). During mergesort’s merge, the two halves are sorted. Whenever we output an element from the right half, every remaining element in the left half forms a split inversion with it. Add that count and continue. Total time still Θ(n log n).</p>
<p>If you only recurse on the halves and forget split inversions, you undercount (often badly).</p>`,
          },
          {
            title: "Closest pair in the plane",
            html: `<p>Split by the median x-coordinate. Recurse on left and right. Let δ be the min of the two halves. Only a pair with one point in each half can beat δ, and both points must lie in a 2δ-wide strip around the median line. Sort (or merge, like mergesort) the strip by y. For each point, only a constant number of following points can lie in a δ×2δ box — packing: points from opposite halves are ≥δ apart.</p>
<p>If you re-sort the strip at every level you get O(n log² n), which is acceptable to mention; CLRS merges the y-order to keep O(n log n).</p>`,
          },
          {
            title: "Strassen and Karatsuba",
            html: `<p>Naive n×n matrix multiply: n³ scalar multiplies. Strassen: 7 recursive n/2 multiplies plus O(n²) adds. T(n)=7T(n/2)+O(n²)=Θ(n^{log₂ 7}) ≈ Θ(n^{2.81}). Constants and numerical stability matter in real BLAS; the point here is the recurrence.</p>
<p>Karatsuba multiplies n-digit integers with 3 recursive n/2 multiplies instead of 4, beating Θ(n²).</p>`,
          },
        ],
        worked: `<p>Closest pair: argue that at most 6 (or 7, depending on the packing rectangle you draw) points of the opposite half sit in the 2δ×δ neighborhood of a point. The exact constant is less important than “O(1) neighbors ⇒ linear scan of the strip.”</p>`,
        pitfalls: [
          "Re-sorting the strip and then claiming O(n log n) without comment.",
          "Strassen: counting 8 multiplies “because 2×2 has 8 products” — that is the naive block algorithm.",
        ],
        recitation: "Strip details discussion is the #1 office-hours thread this week.",
        next: "PS2. Quiz 2 after the Strassen lecture.",
      }),
    ),
    notes(
      "week4-heaps",
      "Week 4 lecture: heaps and hashing",
      lectureHtml({
        kicker:
          "Priority queues and dictionaries are the workhorses of graph algorithms later. This week is structure, not slogans: BUILD-HEAP is O(n); hash tables do not iterate in sorted order.",
        reading: "CLRS Ch. 6 (heaps), Ch. 11 (hashing), Ch. 12 (BSTs).",
        goals: [
          "Prove BUILD-HEAP is O(n) by summing heapify costs over heights.",
          "State chaining vs open addressing and what α &lt; 1 means.",
          "Know which structure supports decrease-key vs ordered scans.",
        ],
        sections: [
          {
            title: "Binary heaps",
            html: `<p>Shape: complete binary tree, filled level by level. Heap property (min-heap): parent ≤ children. Array layout, 1-based: children of i at 2i and 2i+1. Insert and extract-min bubble O(height)=O(log n).</p>
<p>BUILD-HEAP: heapify from the last non-leaf down to the root. Most nodes have small height, so the sum is O(n), not O(n log n). Heapsort: BUILD-HEAP then n extract-max into the tail. Θ(n log n) worst case, in-place, not stable.</p>`,
          },
          {
            title: "Hashing",
            html: `<p>Simple uniform hashing is a model: each key independently hashes to a uniform slot. Chaining: expected search Θ(1+α) with load factor α=n/m. Open addressing: α&lt;1 is required (the table has finite slots); clustering makes α&gt;0.7 painful in practice.</p>
<p>Hash tables do not give you successor/predecessor or sorted iteration — that is a tree’s job. Dijkstra’s decrease-key is awkward in a hash table and natural in a heap (or Fibonacci heap, which we will only name).</p>`,
          },
          {
            title: "BSTs",
            html: `<p>Search, insert, min: O(h). Sorted insertions into an unbalanced BST produce a path, h=Θ(n). AVL / red-black trees restore h=Θ(log n). You do not need to implement rotations in this course; you do need to know that “BST” without “balanced” is not a log-time promise.</p>`,
          },
        ],
        worked: `<p>BUILD-HEAP on [4, 1, 3, 2, 16, 9, 10, 14, 8, 7] (CLRS figure). Heapify at indices 5 down to 1. Count how many swaps happen at height 1 vs height 3 — that is the O(n) intuition.</p>`,
        pitfalls: [
          "“Heaps are O(1) insert” — only if you mean amortized/find-min on a different structure.",
          "Using a hash table when the algorithm needs decrease-key of an arbitrary vertex (Dijkstra).",
        ],
        next: "PS3 and Programming Project 1 (sorting bake-off). Quiz 3 after the hashing lecture.",
      }),
    ),
    notes(
      "week5-greedy",
      "Week 5 lecture: greedy algorithms",
      lectureHtml({
        kicker:
          "A greedy algorithm commits to a locally attractive choice and never backtracks. Correctness is a theorem — exchange or stay-ahead — or a counterexample if greedy fails.",
        reading: "CLRS Ch. 16; Huffman coding notes.",
        goals: [
          "Prove earliest-finish-time optimal for unweighted interval scheduling.",
          "Build a Huffman tree and sketch why it is optimal among prefix codes.",
          "Give a small 0/1 knapsack instance where density-greedy fails.",
        ],
        sections: [
          {
            title: "Interval scheduling",
            html: `<p>Unweighted: pick a maximum-size subset of non-overlapping intervals. Earliest finish time is optimal. Exchange: take an optimum that disagrees with greedy as early as possible; the greedy job finishes no later, so you can swap it in. Earliest start is not optimal (one long job blocking two short ones). Shortest interval is not optimal either (a short job in the middle of two compatible long jobs).</p>
<p>Weighted interval scheduling needs DP (Week 12), not this greedy.</p>`,
          },
          {
            title: "Huffman coding",
            html: `<p>Given symbol frequencies, build a prefix-free binary code of minimum expected length. Repeatedly merge the two lightest weights into a parent. Proof sketch: there is an optimal tree in which the two rarest symbols are siblings (exchange); then induct on the alphabet size.</p>
<p>Huffman is not the right tool when frequencies are unknown ahead of time (adaptive methods) or when you have context (arithmetic coding).</p>`,
          },
          {
            title: "When greedy fails",
            html: `<p>0/1 knapsack by density: capacity 5; items (w,v) = (3,4), (3,4), (5,6). Density prefers the 5-weight item (6/5) over 4/3, but two small items score 8. Fractional knapsack <em>is</em> solved by density (fill the last item partially).</p>
<p>Coin change: US coins greedy works; some coin systems fail. Then we need DP.</p>`,
          },
        ],
        worked: `<p>Huffman frequencies 5, 9, 12, 13, 16, 45. Merge 5+9=14, then 12+13=25, then 14+16=30, then 25+30=55, then 45+55=100. Expected length is the weighted external path length divided by total frequency. Compute it; Quiz 4 will ask a smaller instance.</p>`,
        pitfalls: [
          "Writing “greedy just works” on PS4.",
          "Proving a greedy algorithm correct by showing it is correct on one example.",
        ],
        recitation: "Friday is Huffman only — come with frequencies already written down. Graded discussion “algorithm of the week” opens.",
        next: "PS4 and Quiz 4. Start thinking about a 180-word algorithm write-up.",
      }),
    ),
    notes(
      "week6-bfs",
      "Week 6 lecture: graphs and BFS",
      lectureHtml({
        kicker:
          "Graph algorithms start with representation. BFS is not “search” — it certifies hop-distance, bipartiteness, and a spanning tree of a connected undirected graph (not an MST).",
        reading: "CLRS Ch. 22.1–22.2.",
        goals: [
          "Compare adjacency lists vs matrices for the operations BFS actually does.",
          "Prove BFS computes shortest paths in number of edges.",
          "Test bipartiteness with BFS layers.",
        ],
        sections: [
          {
            title: "Representations",
            html: `<p>n vertices, m edges. Adjacency lists: Θ(n+m) space, enumerate neighbors in degree time, edge query O(degree) or worse. Matrix: Θ(n²) space, O(1) “is (u,v) an edge?”, enumerating neighbors is Θ(n). BFS/DFS from lists are O(n+m). Use a matrix when n is tiny or you need dense all-pairs later (Floyd–Warshall).</p>
<p>Directed vs undirected: undirected lists store both endpoints; a matrix is symmetric. Self-loops and parallel edges: document your convention on Project 2.</p>`,
          },
          {
            title: "BFS",
            html: `<p>Queue, start from s, mark discovered when enqueued. Layers L₀={s}, L_{i+1}=neighbors of L_i not yet seen. Claim: vertices in L_i are exactly those at hop-distance i from s. Proof: induction on i; an edge cannot skip a layer. Therefore BFS distances are shortest paths in unweighted graphs (or unit-weight graphs).</p>
<p>BFS tree: the edges used to discover vertices. It is a spanning tree of the connected component, not a minimum spanning tree — weights never entered the picture.</p>`,
          },
          {
            title: "Bipartiteness",
            html: `<p>Color layers alternately. The graph is bipartite iff there is no edge within a layer (equivalently: no odd cycle). One BFS per component.</p>
<p>What BFS will not give you: a topological order of a DAG (that is DFS / indegree queue, next week), or shortest paths with real weights (Dijkstra / Bellman–Ford, Week 9).</p>`,
          },
        ],
        worked: `<p>Run BFS from vertex A on an undirected graph with a cycle of length 5. Show that some edge is within a layer — odd cycle, not bipartite. Then add a vertex to make all cycles even and show the coloring succeeds.</p>`,
        pitfalls: [
          "Implementing BFS with a stack “because DFS used a stack in the slides.”",
          "Claiming BFS finds an MST.",
        ],
        next: "PS5 Problem 1–2. Read DFS timestamps before Wednesday.",
      }),
    ),
    notes(
      "graph-algorithms",
      "Week 6–7 lecture: BFS and DFS",
      `<p>This page remains as a combined reference. Prefer the split notes: <strong>Week 6 lecture: graphs and BFS</strong> and <strong>Week 7 lecture: DFS, topo sort, SCCs</strong>.</p>
<h2>Representations</h2>
<p>Adjacency lists: Θ(n+m) space, enumerate neighbors in degree time. Matrix: Θ(n²), O(1) edge queries. BFS/DFS from lists are O(n+m).</p>
<h2>BFS</h2>
<p>Layers by hop count. Shortest paths in unweighted graphs. Bipartiteness: no edge inside a layer. The BFS tree is not an MST.</p>
<h2>DFS</h2>
<p>Discovery and finish times. Parenthesis theorem. Edge types: tree, back, forward, cross. Directed cycles iff a back edge. Topological sort: decreasing finish times on a DAG. SCCs: Kosaraju or Tarjan.</p>
<p>PS5 asks you to classify edges on a small digraph — draw it.</p>`,
    ),
    notes(
      "week7-dfs",
      "Week 7 lecture: DFS, topo sort, SCCs",
      lectureHtml({
        kicker:
          "DFS timestamps are a coordinate system on the recursion. Once you can classify tree / back / forward / cross edges, cycle detection, topological sort, and Kosaraju are short corollaries.",
        reading: "CLRS Ch. 22.3–22.5.",
        goals: [
          "Assign discovery/finish times and classify directed edges.",
          "Detect a directed cycle and produce a topological order of a DAG.",
          "Sketch Kosaraju’s two-pass algorithm and say why the transpose appears.",
        ],
        sections: [
          {
            title: "Timestamps and the parenthesis theorem",
            html: `<p>Each vertex u gets d[u] when DFS first reaches it (gray) and f[u] when its adjacency list is exhausted (black). The intervals [d[u], f[u]] nest or are disjoint — they never partially overlap. That is the parenthesis theorem. Descendants in the DFS forest are exactly the vertices whose intervals sit inside u’s interval.</p>`,
          },
          {
            title: "Edge types (directed graphs)",
            html: `<ul>
<li><strong>Tree:</strong> used to discover a white vertex.</li>
<li><strong>Back:</strong> to an ancestor (gray). Equivalent to a directed cycle.</li>
<li><strong>Forward:</strong> to a descendant that is already finished.</li>
<li><strong>Cross:</strong> anything else (other tree, or a cousin already finished).</li>
</ul>
<p>Undirected graphs only have tree and back edges (a “cross” would have been a tree edge from the other side). Do not quote directed classification on an undirected figure.</p>`,
          },
          {
            title: "Topological sort and SCCs",
            html: `<p>If the digraph is a DAG, list vertices by decreasing finish time — that is a topological order. If there is a back edge, no topological order exists.</p>
<p>Kosaraju: DFS to compute finish times; reverse every edge (transpose); DFS again, seeding from vertices in decreasing finish time. Each tree in the second DFS is an SCC. Intuition: finish times push sinks of the condensation later; the transpose flips sinks to sources so the second DFS peels off one SCC at a time.</p>
<p>Tarjan’s algorithm is a single-pass alternative; we will not require the low-link implementation, only that you know it exists.</p>`,
          },
        ],
        worked: `<p>Five vertices, edges 1→2, 2→3, 1→3, 2→4, 5→4. Compute a DFS from 1 then 5. Classify 1→3 (forward vs tree depending on discovery order) and 5→4 (cross if 4 already finished). This is the discussion-thread example — redraw it with your own times.</p>`,
        pitfalls: [
          "Calling every non-tree edge a back edge.",
          "Reversing the reduction: “I DFS’d the transpose first.”",
        ],
        recitation: "DFS timestamps discussion. Midterm is next week — timestamps will be on it.",
        next: "Finish PS5. Sample midterm is in Files / Week 8 module.",
      }),
    ),
    notes(
      "week8-midterm",
      "Week 8: midterm prep",
      lectureHtml({
        kicker:
          "In-class midterm, 80 minutes, one handwritten sheet (both sides). Scope is Weeks 1–7. Dijkstra, DP tables, and NP-completeness are not on this exam.",
        reading: "Sample midterm in Files; your PS1–PS4 solutions; DFS notes.",
        goals: [
          "Know the four-problem shape of the exam and where partial credit lives.",
          "Practice one substitution proof and one greedy exchange under time pressure.",
          "Arrive with a sheet that has recurrences and edge-type definitions, not paragraphs of CLRS.",
        ],
        sections: [
          {
            title: "Format",
            html: `<p>Four problems, roughly 20 / 25 / 25 / 30.</p>
<ol>
<li>Recurrences — substitution and a Master Theorem edge case (extended Case 2 or “do not apply”).</li>
<li>Divide and conquer design — inversions or closest-pair strip.</li>
<li>Greedy — earliest-finish proof or Huffman; one counterexample (start-time or density knapsack).</li>
<li>BFS/DFS — timestamps, edge types, topo sort or bipartiteness.</li>
</ol>
<p>At least one problem is “what is wrong with this greedy / this recurrence.” Showing the bug is most of the credit.</p>`,
          },
          {
            title: "What to put on your sheet",
            html: `<ul>
<li>Master Theorem cases in one box, including extended Case 2.</li>
<li>Closest-pair packing picture (2δ strip, δ×2δ box).</li>
<li>Exchange template in three sentences.</li>
<li>DFS edge classification table (directed).</li>
</ul>
<p>Do not photocopy a chapter. If you cannot fit it on one sheet, you do not know it yet.</p>`,
          },
          {
            title: "Logistics",
            html: `<p>SAL 101 unless you received an accommodations room email. No devices. We provide scratch paper. Extended-time students: People → Accommodations already lists extra time on quizzes; the exam room is separate.</p>
<p>After the exam: scores post within a few days; mean last offering was 78%. Regrades via Inbox, 7 days, written argument only.</p>`,
          },
        ],
        recitation: "We work the sample midterm, timed 40 minutes for problems 1–2, then debrief.",
        next: "Sleep. After the exam, skim Week 9 shortest-path notes — Project 2 starts immediately.",
      }),
    ),
    notes(
      "week9-sp",
      "Week 9 lecture: shortest paths",
      lectureHtml({
        kicker:
          "Every algorithm in this chapter is disciplined relaxation. The differences are the order of relaxations and the assumptions on weights.",
        reading: "CLRS Ch. 24–25; Project 2 kickoff notes on the group homepage.",
        goals: [
          "State Dijkstra’s cloud invariant and why a negative edge breaks it.",
          "Run Bellman–Ford and detect a negative cycle with the extra round.",
          "Write the Floyd–Warshall recurrence and know when n Dijkstra runs win.",
        ],
        sections: [
          {
            title: "Relaxation",
            html: `<p>If d[u] + w(u,v) &lt; d[v], set d[v] ← that sum and π[v] ← u. Initialize d[s]=0, d[others]=∞. Shortest-path algorithms differ only in how they schedule relaxations. The triangle inequality for shortest-path distances is the reason relaxation is safe: you never make d[v] smaller than the true distance if d[u] was already a true distance from s (this is the subtle part for Dijkstra).</p>`,
          },
          {
            title: "Dijkstra",
            html: `<p>Nonnegative weights. Repeatedly settle the unsettled vertex with smallest d[], then relax its outgoing edges. Invariant: settled vertices have the correct shortest-path distance (the “cloud”). Binary heap: O(m + n log n) with decrease-key, or lazy insert-duplicate with a visited skip (document which on Project 2).</p>
<p><strong>Wrong</strong> if a negative edge exists, even without a negative cycle: a later, cheaper path can reach a vertex you already settled. Draw a 3-vertex example and keep it on your final sheet.</p>`,
          },
          {
            title: "Bellman–Ford and Floyd–Warshall",
            html: `<p>Bellman–Ford: |V|−1 rounds of relax-all-edges. After k rounds, d[v] is at most the shortest s-path using ≤k edges. One more round: if anything updates, a negative cycle is reachable from s. Runtime O(nm).</p>
<p>Floyd–Warshall: all-pairs. Let d(i,j,k) be the shortest i↝j path using intermediates in {1..k}. Recurrence: min of “still avoiding k” vs “i↝k↝j”. Θ(n³). Recover a path from a next-vertex or predecessor matrix. Prefer n Dijkstra runs on sparse nonnegative graphs.</p>`,
          },
        ],
        worked: `<p>Graph: s→a weight 4, s→b weight 5, a→b weight −3, no other edges. Dijkstra from s (depending on tie-breaking) may settle b at 5 and miss 4+(−3)=1. Bellman–Ford finds d[a]=4, d[b]=1. No negative cycle (extra round stable).</p>`,
        pitfalls: [
          "Reporting Dijkstra “works if there is no negative cycle.”",
          "Forgetting the extra Bellman–Ford round when the spec asks you to detect cycles.",
        ],
        recitation: "Project 2 parser FAQ. Negative-cycle tests are required for Bellman–Ford.",
        next: "PS6 and Project 2. Teams: People → Groups.",
      }),
    ),
    notes(
      "week10-mst",
      "Week 10 lecture: MSTs and flow (preview)",
      lectureHtml({
        kicker:
          "Minimum spanning trees are the cleanest cut-property algorithms in the course. Flow is a preview so that “min-cut” is not a magic word on NP slides later.",
        reading: "CLRS Ch. 23; skim 26.1–26.2 for residual graphs.",
        goals: [
          "State the cut property and use it to prove Kruskal or Prim.",
          "Implement Kruskal with union-find at the level of “sort, then skip cycles.”",
          "Define a residual graph and an augmenting path in one paragraph.",
        ],
        sections: [
          {
            title: "Cut property",
            html: `<p>For a cut (S, V−S) that no chosen edge yet crosses, a lightest edge across the cut is safe: it belongs to some MST. Proof: take an MST; if it does not use that light edge, swap across the unique path that jumps the cut (exchange). If all weights are distinct, the MST is unique.</p>`,
          },
          {
            title: "Kruskal and Prim",
            html: `<p><strong>Kruskal:</strong> sort edges by weight; add an edge if it joins two components (union-find). O(m log m) from the sort. <strong>Prim:</strong> grow a tree from a root, always adding a lightest edge out of the tree. Heap implementation resembles Dijkstra (decrease-key on vertices).</p>
<p>Neither algorithm needs the graph to be weighted with positives only in the same way Dijkstra does — MST algorithms typically assume undirected graphs and will happily eat negatives (adding a negative edge is even more attractive). They do assume undirected connectivity; directed “optimum branching” is a different problem.</p>`,
          },
          {
            title: "Max-flow min-cut (preview only)",
            html: `<p>A flow network has capacities on directed edges, source s, sink t. A residual graph records leftover capacity and backward edges for canceling flow. Ford–Fulkerson repeatedly adds an augmenting s–t path. When none remains, the vertices reachable from s in the residual graph define a min cut whose capacity equals the max flow (max-flow min-cut theorem).</p>
<p>We will not ask you to implement Dinic. We will ask you not to look confused if a reduction mentions cuts.</p>`,
          },
        ],
        worked: `<p>A 4-vertex cycle with weights 1, 3, 1, 4. Two different MSTs of weight 5 if the two 1-edges and the 3 are chosen vs the other combination — unless you perturb weights. Kruskal vs Prim traces should produce some MST, not necessarily the same tree.</p>`,
        next: "No new problem set this week — catch up Project 2 experiments. DP starts Monday.",
      }),
    ),
    notes(
      "dynamic-programming",
      "Week 11 lecture: DP I",
      lectureHtml({
        kicker:
          "DP = overlapping subproblems + optimal substructure. We grade a five-part template. If any part is missing, the solution is incomplete even if the table is filled.",
        reading: "CLRS Ch. 14–15 (edition numbering may differ); rod cutting and LCS.",
        goals: [
          "Turn a recursive specification into a polynomial table.",
          "Reconstruct one optimal solution, not only its value.",
          "Explain why naive rod-cutting recursion is exponential.",
        ],
        sections: [
          {
            title: "The five-part template",
            html: `<ol>
<li>Define subproblems (indices mean something: prefixes, capacities, vertices…)</li>
<li>Recurrence and base cases</li>
<li>Evaluation order / table dimensions (what is already filled when you compute a cell?)</li>
<li>Reconstruction (arrows, or recompute choices)</li>
<li>Runtime and space</li>
</ol>
<p>Overlapping subproblems are why memoization / tables beat plain divide-and-conquer. Optimal substructure is why a local choice plus an optimal suffix is globally optimal — same idea as greedy, but we try more than one choice.</p>`,
          },
          {
            title: "Rod cutting",
            html: `<p>r(n) = max_{1≤i≤n} (p_i + r(n−i)), r(0)=0. Naive recursion branches on i and recomputes r(k) exponentially often. Bottom-up: for length 1..n, try each first cut. Time Θ(n²). Store the first-cut argmax to reconstruct the cut list.</p>`,
          },
          {
            title: "LCS",
            html: `<p>c(i,j) = length of LCS of prefixes X[1..i], Y[1..j]. If X_i=Y_j, 1+c(i−1,j−1); else max(c(i−1,j), c(i,j−1)). Bases: c(0,·)=c(·,0)=0. Time and space Θ(nm). Reconstruction walks arrows (diagonal = take the character). Space can drop to two rows if you only need the length.</p>
<p>Worked strings on PS7: ABCBDAB and BDCABA. Fill the table by hand once in your life.</p>`,
          },
        ],
        worked: `<p>Rod prices [0, 1, 5, 8, 9] for lengths 0–4. Compute r(4) and the cut that achieves it. Compare to greedy “take the densest piece first.”</p>`,
        pitfalls: [
          "A recurrence without bases.",
          "Reporting the numeric optimum with no reconstruction when the problem asked for the object (the string, the cut, the subset).",
        ],
        recitation: "Graded DP workshop discussion: post a problem that is not rod / LCS / 0-1 knapsack.",
        next: "PS7. Quiz 6 after Week 12.",
      }),
    ),
    notes(
      "week12-dp2",
      "Week 12 lecture: DP II",
      lectureHtml({
        kicker:
          "The same template on knapsacks, DAGs, and weighted intervals. Once you can name the subproblem, the algorithm is usually “try the last decision.”",
        reading: "Knapsack notes; DAG shortest paths (CLRS on DAGs); weighted interval scheduling.",
        goals: [
          "Fill a 0/1 knapsack table and reconstruct the set.",
          "Relax DAG edges in topological order.",
          "Write OPT(j) for weighted interval scheduling using p(j).",
        ],
        sections: [
          {
            title: "0/1 knapsack",
            html: `<p>K(i,w): best value using a subset of the first i items with capacity exactly (or at most) w. Recurrence: skip item i → K(i−1,w); take it → v_i + K(i−1, w−w_i) if it fits. Θ(nW) time — pseudo-polynomial: polynomial in n and W, not in the bit length of W. Greedy density fails; we already saw a counterexample on PS4.</p>
<p>PS7 instance: (w,v)=(2,3),(3,4),(4,5),(5,8), capacity 8. Reconstruct the set, do not only box 12.</p>`,
          },
          {
            title: "DAG shortest (and longest) paths",
            html: `<p>Topological order, then relax outgoing edges. O(n+m). This is DP on a graph: subproblem = best path to v, which needs only earlier vertices. Longest paths in a DAG use the same skeleton with max instead of min — a rare place where longest paths are easy. Longest paths in general graphs are NP-hard (related to Hamiltonian paths).</p>`,
          },
          {
            title: "Weighted interval scheduling",
            html: `<p>Sort jobs by finish time. p(j) = the latest job that finishes before j starts (binary search). OPT(j)=max(v_j + OPT(p(j)), OPT(j−1)). Reconstruction: if the first branch wins, take j and jump to p(j). Time O(n log n) after the sort.</p>
<p>This is the “greedy failed, DP succeeded” story for intervals with values.</p>`,
          },
        ],
        worked: `<p>Three weighted intervals: [0,3] value 2, [1,4] value 4, [3,6] value 4. Compute p(j) and OPT. Density / earliest-finish greedys pick different sets; DP gets 6.</p>`,
        next: "Finish PS7 and Quiz 6. NP-completeness next — reduction direction clinic is open early.",
      }),
    ),
    notes(
      "np-completeness",
      "Week 13 lecture: NP-completeness",
      lectureHtml({
        kicker:
          "NP is about short certificates, not “hard.” NP-complete is the club of hardest problems in NP. A reduction A ≤p B means B is at least as hard as A — arrow direction is the whole course.",
        reading: "CLRS Ch. 34; lecture notes on 3-SAT and independent set.",
        goals: [
          "Define P, NP, and NP-complete in operational terms (algorithms and verifiers).",
          "Write 3-SAT ≤p Independent Set with a gadget picture.",
          "Diagnose a backwards reduction in one paragraph.",
        ],
        sections: [
          {
            title: "Classes",
            html: `<p><strong>P:</strong> decision problems solvable in polynomial time. <strong>NP:</strong> yes-instances have a polynomial-size certificate checkable in polynomial time (a verifier). Sorting is in P; “is there a subset of items with value ≥ k and weight ≤ W?” is in NP (the subset is the certificate) and also in P via DP when W is small — wait, knapsack decision is weakly NP-complete in the usual sense; we will treat vertex cover / SAT as the clean examples.</p>
<p><strong>NP-complete:</strong> in NP, and every problem in NP reduces to it (NP-hard + in NP). If any NP-complete problem is in P, then P=NP.</p>`,
          },
          {
            title: "Reductions",
            html: `<p>A ≤p B: a poly-time function f such that x∈A iff f(x)∈B. To show B is NP-hard, reduce FROM a known hard A TO B. Reducing B to A would show A is at least as hard as B — the wrong direction for “B is hard.”</p>
<p>Classic student bug: “I reduced Hamiltonian Cycle to 3-SAT, so HC is NP-complete.” That shows 3-SAT is at least as hard as HC, which we already believe.</p>`,
          },
          {
            title: "3-SAT → Independent Set",
            html: `<p>One triangle per clause (three vertices, one per literal). Add edges between every x and ¬x across the graph so you cannot pick both. Set k = number of clauses. Satisfying assignment ↔ independent set of size k: pick one true literal per clause triangle; the x/¬x edges block contradictions.</p>
<p>PS8 Problem 2 is this gadget. Draw the clause (x ∨ ¬y ∨ z). Prove both directions of the iff. State that the construction is polynomial (triangles and O(n²) contradiction edges).</p>`,
          },
        ],
        worked: `<p>Independent Set ≤p Vertex Cover is the short one: α(G)+β(G)=n for undirected graphs without isolated-vertex footnotes we will ignore. A set S is independent iff V−S is a vertex cover. So (G,k) has an independent set of size k iff (G, n−k) has a vertex cover of size n−k.</p>`,
        pitfalls: [
          "Arrow backwards.",
          "Naming Independent Set without drawing the triangle gadget.",
        ],
        recitation: "Reduction direction clinic — paste one sentence, we tell you if the arrow is backwards.",
        next: "PS8 and Quiz 7. Approximation next week: NP-hard does not mean give up.",
      }),
    ),
    notes(
      "week14-approx",
      "Week 14 lecture: approximation and randomness",
      lectureHtml({
        kicker:
          "NP-hard means exact poly-time is unlikely, not that the problem is useless. Approximation algorithms give provable guarantees. Randomized algorithms give expected bounds we already used (quicksort, hashing).",
        reading: "CLRS Ch. 35 (approx); Ch. 5 / 7 for randomized quicksort as review.",
        goals: [
          "Define a ρ-approximation for minimization and maximization.",
          "Explain the 2-approx for vertex cover via a maximal matching.",
          "Distinguish Monte Carlo vs Las Vegas at the slogan level.",
        ],
        sections: [
          {
            title: "Approximation",
            html: `<p>A ρ-approximation for a minimization problem returns a solution of cost ≤ ρ·OPT. For maximization, ≥ OPT/ρ (conventions vary; we will say “within factor ρ” and specify min vs max).</p>
<p><strong>Vertex cover 2-approx:</strong> compute a maximal matching (greedy: pick an edge, delete endpoints, repeat). Output both endpoints of every matched edge. Size ≤ 2·OPT because OPT must cover each matched edge with at least one vertex, and the matched edges are disjoint.</p>
<p><strong>Metric TSP:</strong> MST, then shortcut a tour of the doubled MST. 2-approx if the triangle inequality holds. Christofides (1.5) is a name we mention, not an algorithm we implement.</p>`,
          },
          {
            title: "Randomized algorithms",
            html: `<p>Quicksort with random pivots: expected O(n log n) comparisons, worst-case still Θ(n²). Las Vegas: always correct, runtime random. Monte Carlo: may err with small probability, often bounded runtime. Hashing’s simple uniform assumption is a randomized-algorithm cousin — expected O(1) lookups.</p>
<p>Max-3-SAT: a random assignment satisfies 7/8 of the clauses in expectation (each clause fails with probability 1/8). Derandomization exists; we will not require it.</p>`,
          },
        ],
        worked: `<p>Vertex cover: a triangle. Maximal matching has one edge; the 2-approx outputs two vertices. OPT is 2. Ratio 1 on this instance. A star: matching takes one spoke; 2-approx outputs two vertices; OPT is 1 (the center) — ratio 2, tight.</p>`,
        recitation: "Extra credit visualization is due soon — narrate an invariant, not a screen recording of code scrolling.",
        next: "Week 15 review sheet. Practice final quiz is ungraded; take it once cold.",
      }),
    ),
    notes(
      "week15-review",
      "Week 15: review sheet",
      lectureHtml({
        kicker:
          "The final is 120 minutes, two handwritten sheets, cumulative, with extra weight on DP, shortest paths/MSTs, and NP-completeness. This page is a drill list, not a substitute for redoing old problem sets.",
        reading: "Your graded PS1–PS8; midterm key; practice-final outline in Files.",
        goals: [
          "Redo six representative arguments by hand without notes.",
          "Know the exam shape so you can budget 20–25 minutes per problem.",
          "Bring two sheets: recurrences + greedy/DP templates on one; graphs + gadgets on the other.",
        ],
        sections: [
          {
            title: "What to redo by hand (minimum)",
            html: `<ol>
<li>One substitution proof and one Master Theorem edge case (including “do not apply”).</li>
<li>Closest-pair strip packing in one paragraph.</li>
<li>Earliest-finish exchange for interval scheduling.</li>
<li>Dijkstra vs Bellman–Ford on a 4-vertex negative-edge graph (no negative cycle).</li>
<li>A full DP table (LCS or knapsack) plus reconstruction of the object.</li>
<li>3-SAT → Independent Set gadget, both directions of the iff.</li>
</ol>`,
          },
          {
            title: "Final format (expected)",
            html: `<ul>
<li>One recurrence or Master Theorem problem</li>
<li>One greedy or D&amp;C design + proof</li>
<li>One shortest-path / MST comparison</li>
<li>One full DP (define, recure, fill, reconstruct)</li>
<li>One reduction (gadget sketch)</li>
</ul>
<p>Office hours the last week of classes work the published practice final. Last recitation is student-voted (Discussions: “What should we drill before the final?”).</p>`,
          },
          {
            title: "Logistics",
            html: `<p>Two handwritten sheets, both sides. Cumulative. Closed book. Same integrity rules as the midterm. Extra-time room email goes out early in Week 15.</p>`,
          },
        ],
        next: "Take the ungraded Practice final quiz cold, then redo misses from lecture notes — not from a solution dump.",
      }),
    ),
  ];
}
