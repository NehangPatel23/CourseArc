import type { Announcement } from "../utils/announcements";
import type { Assignment } from "../utils/assignments";
import type { DiscussionReply, DiscussionTopic } from "../utils/discussions";
import type { ModuleT } from "../utils/modules";
import type { Quiz, QuizQuestion } from "../utils/quizzes";
import { totalQuizQuestionPoints } from "../utils/quizzes";
import { cs570Pages as lecturePages } from "./cs570LecturePages";
import { enrichCs570QuizQuestions } from "./cs570QuizFeedback";
import { CS570_DIAGRAM, imgHtml } from "./cs570QuizDiagrams";
import { DEFAULT_QUIZ_UPLOAD_SPECS } from "../utils/quizFileAnswers";

export const CS570_ID = "1";
export const CS570_HW = "ag_cs570_hw";
export const CS570_QZ = "ag_cs570_quiz";
export const CS570_EX = "ag_cs570_exam";
export const CS570_PT = "ag_cs570_part";

const CID = CS570_ID;
const own = { ownerCourseId: CID };

export function cs570Day(daysFromNow: number, hour = 23, minute = 59) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

export function cs570Ago(days: number) {
  return Date.now() - days * 86400000;
}

function collabFooter() {
  return `
<h2>Collaboration and submission</h2>
<p>You may discuss high-level ideas. Write every proof and program yourself. List anyone you spoke with. Submit a single PDF (or ZIP for programming work) before the due date. Late work uses the course late-penalty preset unless the item disables late submissions.</p>
<p>Answers without justification earn at most half credit. Pseudocode must be clear enough to implement.</p>
`.trim();
}

function assignmentHtml(opts: {
  overview: string;
  reading: string;
  outcomes: string[];
  problems: { title: string; points: number; body: string }[];
  mistakes?: string[];
  deliverable?: string;
}): string {
  const total = opts.problems.reduce((s, p) => s + p.points, 0);
  const outcomes = opts.outcomes.map((o) => `<li>${o}</li>`).join("");
  const problems = opts.problems
    .map(
      (p, i) =>
        `<h3>Problem ${i + 1}: ${p.title} (${p.points} pts)</h3>\n${p.body}`,
    )
    .join("\n");
  const mistakes = (opts.mistakes ?? [
    "Stating a bound without a proof, or citing a theorem that does not apply.",
    "Skipping base cases, floors/ceilings, or the combine-step cost.",
    "Giving pseudocode that cannot be implemented (hidden data structures, unspecified loops).",
  ])
    .map((m) => `<li>${m}</li>`)
    .join("");
  const deliverable =
    opts.deliverable ??
    "Upload a single PDF named <code>Lastname-item.pdf</code> (or a ZIP with README for programming work) before the due date. Start each problem on a new page. Box final bounds and running times.";
  return `
<p>${opts.overview}</p>
<blockquote><p><strong>Assigned reading:</strong> ${opts.reading}</p></blockquote>
<h2>Learning outcomes</h2>
<ul>${outcomes}</ul>
<h2>What to submit</h2>
<p>${deliverable}</p>
<p>This assignment is scored out of <strong>${total} points</strong>. Partial credit is given for a correct approach with a small algebra bug; a correct-looking bound with no argument earns at most half credit.</p>
<h2>Problems</h2>
${problems}
<h2>Common mistakes</h2>
<ul>${mistakes}</ul>
${collabFooter()}
`.trim();
}

export function cs570Assignments(): Assignment[] {
  const rub = `rub_${CID}_algorithms`;
  return [
    {
      id: `cs570_ps1_${CID}`,
      title: "Problem Set 1: Asymptotics & Recurrences",
      dueAt: cs570Day(-56),
      points: 100,
      published: true,
      status: "published",
      groupId: CS570_HW,
      submissionType: "online_upload",
      allowLateSubmissions: true,
      allowResubmissions: true,
      rubricId: rub,
      createdAt: cs570Ago(70),
      description: assignmentHtml({
        overview:
          "This problem set builds the language we will use all term: O, Ω, Θ, and recurrences. You will prove bounds from first principles and apply the Master Theorem carefully, including edge cases.",
        reading: "CLRS Ch. 2–4 (or equivalent notes on growth rates and recurrences).",
        outcomes: [
          "Prove an algorithm is O(f(n)) and Ω(g(n)) from the definition.",
          "Solve recurrences by substitution, recursion trees, and the Master Theorem.",
          "Identify when a Master Theorem case does not apply.",
        ],
        mistakes: [
          "Writing “obviously Θ(n log n)” without naming a tool (tree, substitution, or a Master Theorem case with the comparison of f to n^{log_b a}).",
          "Applying the three-case Master Theorem to T(n)=T(n/2)+T(n/3)+n.",
          "An induction hypothesis that is too weak, so the algebra does not close.",
        ],
        problems: [
          {
            title: "Definitions",
            points: 20,
            body: `<p>Using the definitions (not limit tests), prove:</p>
<ol>
<li>2n² + 7n + 3 = Θ(n²). Exhibit witnesses c₁, c₂, n₀ for both O and Ω.</li>
<li>n log n is not O(n). A limit argument is acceptable here if you state the theorem you are using.</li>
<li>max(f, g) = Θ(f + g) for nonnegative f, g. The interesting direction is max ≤ f+g ≤ 2 max.</li>
</ol>
<p>Write the definition you are using at the top of the page. Hidden constants must be independent of n.</p>`,
          },
          {
            title: "Sorting recurrences",
            points: 35,
            body: `<p>Give tight Θ bounds and justify each:</p>
<ul>
<li><code>T(n) = 2T(n/2) + n</code> (merge sort)</li>
<li><code>T(n) = T(n − 1) + n</code> (insertion-sort style)</li>
<li><code>T(n) = 4T(n/2) + n²</code></li>
<li><code>T(n) = T(n/2) + T(n/3) + n</code> (recursion tree; Master Theorem does not apply directly)</li>
</ul>`,
          },
          {
            title: "Substitution proof",
            points: 25,
            body: `<p>Prove your bound for <code>T(n) = 2T(n/2) + n</code> by substitution. State the induction hypothesis precisely, handle the base case, and show where a floor/ceiling or lower-order term is absorbed.</p>`,
          },
          {
            title: "Best vs worst case",
            points: 20,
            body: `<p>Show that insertion sort is Θ(n²) in the worst case and Θ(n) in the best case. Give input families that realize each bound.</p>`,
          },
        ],
      }),
    },
    {
      id: `cs570_ps2_${CID}`,
      title: "Problem Set 2: Divide and Conquer",
      dueAt: cs570Day(-42),
      points: 100,
      published: true,
      status: "published",
      groupId: CS570_HW,
      submissionType: "online_text_upload",
      allowLateSubmissions: true,
      rubricId: rub,
      createdAt: cs570Ago(55),
      description: assignmentHtml({
        overview:
          "Design divide-and-conquer algorithms and argue both correctness and runtime. We care as much about the combine step as about the recurrence.",
        reading: "CLRS Ch. 4 (Strassen), Ch. 33.4 (closest pair); lecture notes on inversions.",
        outcomes: [
          "Write a clear divide / conquer / combine outline.",
          "Prove correctness of a combine step.",
          "Solve the resulting recurrence.",
        ],
        problems: [
          {
            title: "Counting inversions",
            points: 30,
            body: `<p>Give an O(n log n) algorithm to count inversions in an array. Prove that the merge step counts split inversions correctly. What goes wrong if you only count inversions inside each half?</p>`,
          },
          {
            title: "Closest pair",
            points: 40,
            body: `<p>State the closest-pair algorithm in the plane. Prove that a constant number of strip points suffice. What is the runtime if you re-sort the strip by y at every level versus merging like mergesort?</p>`,
          },
          {
            title: "Strassen",
            points: 30,
            body: `<p>Write the Strassen recurrence and solve it. How many multiplications does the naive algorithm use for n × n matrices vs. Strassen? For which n would you still prefer the naive method in practice (cache, constants)?</p>`,
          },
        ],
      }),
    },
    {
      id: `cs570_ps3_${CID}`,
      title: "Problem Set 3: Heaps, Hashing, and BSTs",
      dueAt: cs570Day(-28),
      points: 100,
      published: true,
      status: "published",
      groupId: CS570_HW,
      submissionType: "online_upload",
      allowLateSubmissions: true,
      rubricId: rub,
      createdAt: cs570Ago(40),
      description: assignmentHtml({
        overview:
          "Priority queues and dictionaries are the workhorses of graph algorithms later in the term. This set is about structure, not just Big-O slogans.",
        reading: "CLRS Ch. 6 (heaps), Ch. 11 (hashing), Ch. 12 (BSTs).",
        outcomes: [
          "Analyze heap operations including build-heap.",
          "Explain collision resolution and load factor.",
          "Relate BST height to search time.",
        ],
        problems: [
          {
            title: "Build-heap",
            points: 25,
            body: `<p>Prove that BUILD-HEAP is O(n), not O(n log n). Draw the heap for the array <code>[4, 1, 3, 2, 16, 9, 10, 14, 8, 7]</code> after BUILD-HEAP.</p>`,
          },
          {
            title: "Heap-select",
            points: 25,
            body: `<p>Give an algorithm to find the k smallest elements of an unordered array using a heap. State the runtime in terms of n and k. Is there a faster comparison-based approach?</p>`,
          },
          {
            title: "Hashing",
            points: 25,
            body: `<p>With chaining and simple uniform hashing, show that unsuccessful search is Θ(1 + α). What happens to insertion if you forbid duplicates? Contrast open addressing: why does load factor &gt; 0.7 hurt?</p>`,
          },
          {
            title: "BST vs heap",
            points: 25,
            body: `<p>Which structure supports decrease-key more naturally? Which supports ordered iteration? Give one graph algorithm that cares about each answer.</p>`,
          },
        ],
      }),
    },
    {
      id: `cs570_ps4_${CID}`,
      title: "Problem Set 4: Greedy Algorithms",
      dueAt: cs570Day(-14),
      points: 100,
      published: true,
      status: "published",
      groupId: CS570_HW,
      submissionType: "online_upload",
      allowLateSubmissions: true,
      rubricId: rub,
      createdAt: cs570Ago(25),
      description: assignmentHtml({
        overview:
          "Greedy algorithms are easy to code and easy to get wrong. Every problem requires an exchange or stay-ahead argument, or a counterexample if greedy fails.",
        reading: "CLRS Ch. 16; Huffman coding notes.",
        outcomes: [
          "Write a greedy choice and a proof that it is safe.",
          "Recognize when greedy is incorrect.",
          "Analyze Huffman coding.",
        ],
        mistakes: [
          "“Greedy just works” with no exchange, stay-ahead, or explicit counterexample.",
          "Huffman tree with the right codes but no expected-length calculation.",
          "A knapsack counterexample whose items do not actually beat density-greedy.",
        ],
        problems: [
          {
            title: "Interval scheduling",
            points: 30,
            body: `<p>Prove that earliest-finish-time is optimal for unweighted interval scheduling. Give a counterexample showing that earliest-start-time is not. What changes if jobs have weights?</p>`,
          },
          {
            title: "Huffman",
            points: 35,
            body: `<p>Build a Huffman tree for frequencies 5, 9, 12, 13, 16, 45. Compute the expected code length. Prove that Huffman is optimal among prefix codes (sketch of the exchange argument is enough).</p>`,
          },
          {
            title: "A failed greedy",
            points: 35,
            body: `<p>The 0/1 knapsack greedy-by-density algorithm is not optimal. Give a small counterexample (capacity and three items). Then give a correct DP recurrence we will use in Week 11.</p>`,
          },
        ],
      }),
    },
    {
      id: `cs570_ps5_${CID}`,
      title: "Problem Set 5: Graph Traversals",
      dueAt: cs570Day(3),
      points: 100,
      published: true,
      status: "published",
      groupId: CS570_HW,
      submissionType: "online_upload",
      allowLateSubmissions: true,
      rubricId: rub,
      createdAt: cs570Ago(10),
      description: assignmentHtml({
        overview:
          "BFS and DFS are not just search — they certify connectivity, shortest unweighted paths, cycles, topological order, and strongly connected components.",
        reading: "CLRS Ch. 22.",
        outcomes: [
          "Implement and analyze BFS and DFS on adjacency lists.",
          "Use DFS timestamps for topological sort and cycle detection.",
          "Explain Kosaraju or Tarjan at a high level.",
        ],
        problems: [
          {
            title: "Representation",
            points: 20,
            body: `<p>For a graph with n vertices and m edges, compare adjacency lists vs. matrices for: (a) checking if (u,v) is an edge, (b) enumerating neighbors, (c) BFS from a source. When is the matrix worth it?</p>`,
          },
          {
            title: "BFS applications",
            points: 30,
            body: `<p>Prove that BFS computes shortest paths in number of edges. Use BFS to test bipartiteness. What does a BFS tree fail to tell you that a DFS tree might?</p>`,
          },
          {
            title: "DFS timestamps",
            points: 30,
            body: `<p>Classify tree, forward, back, and cross edges using discovery/finish times. Give an algorithm to detect a directed cycle. Produce a topological order of a DAG, or explain why none exists.</p>`,
          },
          {
            title: "SCCs",
            points: 20,
            body: `<p>Sketch Kosaraju’s two-pass algorithm. Why does the transpose graph appear? Give a 6-vertex example with two SCCs and show the finishing-time order.</p>`,
          },
        ],
      }),
    },
    {
      id: `cs570_ps6_${CID}`,
      title: "Problem Set 6: Shortest Paths and MSTs",
      dueAt: cs570Day(17),
      points: 100,
      published: true,
      status: "published",
      groupId: CS570_HW,
      submissionType: "online_upload",
      allowLateSubmissions: true,
      rubricId: rub,
      createdAt: cs570Ago(2),
      description: assignmentHtml({
        overview:
          "You will compare Dijkstra, Bellman–Ford, and Floyd–Warshall, then prove an MST algorithm correct. The programming project uses the same ideas.",
        reading: "CLRS Ch. 23–25.",
        outcomes: [
          "State the conditions under which each shortest-path algorithm is correct.",
          "Prove a cut property for MSTs.",
          "Choose an algorithm given constraints (negatives, all-pairs, sparse vs dense).",
        ],
        problems: [
          {
            title: "Dijkstra vs Bellman–Ford",
            points: 35,
            body: `<p>Prove Dijkstra’s algorithm incorrect on a 3-vertex graph with a negative edge and no negative cycle. Run Bellman–Ford on the same graph. How do you detect a negative cycle?</p>`,
          },
          {
            title: "All-pairs",
            points: 25,
            body: `<p>Give the Floyd–Warshall recurrence. Runtime? Can you recover a path, not just a distance? When is n Dijkstra runs better?</p>`,
          },
          {
            title: "MST cut property",
            points: 40,
            body: `<p>State the cut property. Use it to prove Kruskal (or Prim) correct. Show that a graph can have two different MSTs. Is the MST unique if all weights are distinct?</p>`,
          },
        ],
      }),
    },
    {
      id: `cs570_ps7_${CID}`,
      title: "Problem Set 7: Dynamic Programming",
      dueAt: cs570Day(31),
      points: 100,
      published: true,
      status: "published",
      groupId: CS570_HW,
      submissionType: "online_upload",
      allowLateSubmissions: true,
      rubricId: rub,
      createdAt: cs570Ago(1),
      description: assignmentHtml({
        overview:
          "Every DP solution in this course must include: (1) subproblem definition, (2) recurrence with base cases, (3) evaluation order / table, (4) reconstruction, (5) runtime.",
        reading: "CLRS Ch. 14–15 (4th ed. numbering may differ); lecture notes on LCS and knapsack.",
        outcomes: [
          "Turn a recursive specification into a polynomial table.",
          "Reconstruct an optimal solution, not only its value.",
          "Spot overlapping subproblems vs. plain divide-and-conquer.",
        ],
        problems: [
          {
            title: "Rod cutting",
            points: 20,
            body: `<p>Give the rod-cutting recurrence and an O(n²) implementation. Why is the naive recursion exponential?</p>`,
          },
          {
            title: "LCS",
            points: 30,
            body: `<p>Compute an LCS of <code>ABCBDAB</code> and <code>BDCABA</code>. Show the DP table and reconstruct one LCS. How many distinct LCS strings exist?</p>`,
          },
          {
            title: "0/1 knapsack",
            points: 30,
            body: `<p>Items (w,v) = (2,3), (3,4), (4,5), (5,8); capacity 8. Fill the table. Reconstruct the set. Why does the greedy-by-density algorithm fail here?</p>`,
          },
          {
            title: "Your own DP",
            points: 20,
            body: `<p>State a new problem (interval, path, or string) and give a complete DP solution in the five-part format above. 15–25 lines of prose plus a recurrence is enough.</p>`,
          },
        ],
      }),
    },
    {
      id: `cs570_ps8_${CID}`,
      title: "Problem Set 8: NP-Completeness",
      dueAt: cs570Day(52),
      points: 100,
      published: true,
      status: "published",
      groupId: CS570_HW,
      submissionType: "online_upload",
      allowLateSubmissions: true,
      rubricId: rub,
      createdAt: cs570Ago(0.5),
      description: assignmentHtml({
        overview:
          "You will practice polynomial-time reductions. A reduction A ≤p B means “B is at least as hard as A.” Draw the gadgets; do not only name the target problem.",
        reading: "CLRS Ch. 34; lecture notes on 3-SAT and independent set.",
        outcomes: [
          "Explain P, NP, and NP-complete in operational terms.",
          "Write a correct Karp-style reduction with runtime.",
          "Avoid the common mistake of reducing the wrong direction.",
        ],
        mistakes: [
          "Reducing your problem TO 3-SAT and claiming that shows NP-hardness.",
          "Naming a gadget without drawing it or arguing both directions of the iff.",
          "Forgetting to check that the reduction itself runs in polynomial time.",
        ],
        problems: [
          {
            title: "Definitions",
            points: 20,
            body: `<p>In your own words: certificate, verifier, Karp reduction. Why does a poly-time algorithm for any NP-complete problem imply P = NP?</p>`,
          },
          {
            title: "Independent set",
            points: 40,
            body: `<p>Reduce 3-SAT to Independent Set. Draw the gadget for clause (x ∨ ¬y ∨ z). Prove that the formula is satisfiable iff the graph has an independent set of the claimed size.</p>`,
          },
          {
            title: "Vertex cover",
            points: 25,
            body: `<p>Reduce Independent Set to Vertex Cover (this one is short). What is the relationship between α(G) and β(G)?</p>`,
          },
          {
            title: "Which direction?",
            points: 15,
            body: `<p>A student “proves” Hamiltonian Cycle is NP-complete by reducing it to 3-SAT. What did they actually show? How would you fix the write-up?</p>`,
          },
        ],
      }),
    },
    {
      id: `cs570_proj1_${CID}`,
      title: "Programming Project 1: Sorting bake-off",
      dueAt: cs570Day(-21),
      points: 80,
      published: true,
      status: "published",
      groupId: CS570_HW,
      submissionType: "online_upload",
      allowLateSubmissions: true,
      allowResubmissions: true,
      createdAt: cs570Ago(45),
      description: assignmentHtml({
        overview:
          "Implement insertion sort, mergesort, and heapsort. Measure wall-clock time on random, sorted, and reverse-sorted integer arrays. The write-up matters as much as the code.",
        reading: "CLRS Ch. 2 and 6; your PS1 notes.",
        outcomes: [
          "Connect observed timing to asymptotic predictions.",
          "Document constants, language, and machine.",
          "Explain best/worst-case families.",
        ],
        problems: [
          {
            title: "Implementations",
            points: 30,
            body: `<p>Submit a repo or ZIP with a README: how to build and run. Use n ∈ {10³, 10⁴, 10⁵} (and 10⁶ if feasible). Time each algorithm × input family.</p>`,
          },
          {
            title: "Table and plots",
            points: 25,
            body: `<p>Include a table and a log-log plot. Does mergesort look like n log n? Where does insertion sort win?</p>`,
          },
          {
            title: "Write-up",
            points: 25,
            body: `<p>Two pages max: invariants, stability, extra memory, and one surprise in the data.</p>`,
          },
        ],
      }),
    },
    {
      id: `cs570_project_${CID}`,
      title: "Programming Project 2: Shortest Paths",
      dueAt: cs570Day(38),
      points: 150,
      published: true,
      status: "published",
      groupId: CS570_HW,
      submissionType: "online_upload",
      allowLateSubmissions: true,
      allowResubmissions: true,
      peerReviewEnabled: true,
      peerReviewCount: 1,
      peerReviewDueAt: cs570Day(45),
      groupSetId: `gset_${CID}_project`,
      rubricId: rub,
      createdAt: cs570Ago(8),
      description: assignmentHtml({
        overview:
          "Implement Dijkstra (binary heap) and Bellman–Ford on directed weighted graphs. Compare them on graphs with and without negative edges. Teams of 2–3 from the Project teams group set.",
        reading: "CLRS Ch. 24; Project kickoff notes on the group homepage.",
        outcomes: [
          "Implement decrease-key or the insert-duplicate Dijkstra variant and document which you chose.",
          "Detect negative cycles with Bellman–Ford.",
          "Produce reproducible timing for sparse vs dense graphs.",
        ],
        problems: [
          {
            title: "Correctness tests",
            points: 40,
            body: `<p>Include at least: a tiny hand-checkable graph, a negative-edge graph with no cycle, and a negative-cycle graph (Bellman–Ford must report it; Dijkstra may be wrong — show that).</p>`,
          },
          {
            title: "Implementation",
            points: 50,
            body: `<p>README with build, input format (n, m, then m lines u v w), and complexity of your heap. Cite any library heap you use.</p>`,
          },
          {
            title: "Experiments",
            points: 35,
            body: `<p>Runtime table for n ∈ {10³, 10⁴, 10⁵} on random sparse graphs (m ≈ 4n). One plot. Discuss cache and constants vs. the O(m + n log n) bound.</p>`,
          },
          {
            title: "Peer review",
            points: 25,
            body: `<p>Review one other team’s README and tests after the due date. Rubric: reproducibility, missing cases, and heap choice.</p>`,
          },
        ],
      }),
    },
    {
      id: `cs570_midterm_${CID}`,
      title: "Midterm exam",
      dueAt: cs570Day(-3, 15, 50),
      points: 150,
      published: true,
      status: "published",
      groupId: CS570_EX,
      submissionType: "none",
      allowLateSubmissions: false,
      createdAt: cs570Ago(20),
      description: `
<p>In-class midterm, 80 minutes, closed book except one handwritten sheet (both sides). No devices.</p>
<h3>Scope</h3>
<ul>
<li>Asymptotics and recurrences (including Master Theorem edge cases)</li>
<li>Divide and conquer (inversions, closest pair)</li>
<li>Heaps and hashing</li>
<li>Greedy (interval scheduling, Huffman) with a short proof</li>
<li>BFS/DFS applications (not yet Dijkstra-heavy)</li>
</ul>
<h3>Format</h3>
<p>Four problems, roughly 20 / 25 / 25 / 30. At least one “design + prove” and one “what is wrong with this greedy/recurrence.” A sample exam is in Files and in the Week 8 module.</p>
<p>Extended-time students: see People → Accommodations. The room list will be announced the week before.</p>
`.trim(),
    },
    {
      id: `cs570_final_${CID}`,
      title: "Final exam",
      dueAt: cs570Day(84, 16, 50),
      points: 200,
      published: true,
      status: "published",
      groupId: CS570_EX,
      submissionType: "none",
      allowLateSubmissions: false,
      createdAt: cs570Ago(1),
      description: `
<p>Cumulative final, 120 minutes, closed book, two handwritten sheets. Comprehensive: weeks 1–15 with extra weight on DP, shortest paths/MSTs, and NP-completeness.</p>
<h3>What to expect</h3>
<ul>
<li>One recurrence or Master Theorem problem</li>
<li>One greedy or D&amp;C design</li>
<li>One shortest-path / MST comparison</li>
<li>One full DP (table + reconstruction)</li>
<li>One reduction (gadget sketch)</li>
</ul>
<p>Office hours the last week of classes will work a published practice final (Files).</p>
`.trim(),
    },
    {
      id: `cs570_ec_${CID}`,
      title: "Extra credit: Algorithm visualization",
      dueAt: cs570Day(60),
      points: 20,
      published: true,
      status: "published",
      extraCredit: true,
      groupId: CS570_HW,
      submissionType: "online_text",
      createdAt: cs570Ago(1),
      description: `
<p>Record a 3–5 minute walkthrough of an algorithm we studied: heap operations, DFS timestamps, Dijkstra’s gold-plating of the cloud, or filling a DP table. Narrate the invariant, not only the code.</p>
<ul>
<li>Link to an unlisted video or attach a short HTML/JS demo</li>
<li>Include a ½-page note: what viewers should watch for</li>
<li>Do not use a graded problem’s official solution as the script</li>
</ul>
<p>Extra credit applies after group weights; it cannot replace a missing exam.</p>
`.trim(),
    },
  ];
}

function mc(
  id: string,
  prompt: string,
  choices: string[],
  correctChoiceIndex: number,
  points = 2,
): QuizQuestion {
  return { id, type: "multiple_choice", prompt, points, choices, correctChoiceIndex };
}

function tf(id: string, prompt: string, correctTrueFalse: boolean, points = 1): QuizQuestion {
  return { id, type: "true_false", prompt, points, correctTrueFalse };
}

function sa(
  id: string,
  prompt: string,
  correct: string,
  accepted: string[],
  points = 2,
): QuizQuestion {
  return {
    id,
    type: "short_answer",
    prompt,
    points,
    correctShortAnswer: correct,
    acceptedAnswers: accepted,
  };
}

function num(id: string, prompt: string, correctNumber: number, points = 2): QuizQuestion {
  return { id, type: "numerical", prompt, points, correctNumber, tolerance: 0 };
}

function fib(id: string, prompt: string, accepted: string[], points = 2): QuizQuestion {
  return { id, type: "fill_in_blank", prompt, points, acceptedAnswers: accepted };
}

function match(
  id: string,
  prompt: string,
  pairs: { id: string; left: string; right: string }[],
  points = 4,
): QuizQuestion {
  return { id, type: "matching", prompt, points, matchingPairs: pairs };
}

function order(id: string, prompt: string, items: string[], correctOrder: number[], points = 3): QuizQuestion {
  return { id, type: "ordering", prompt, points, orderingItems: items, correctOrder };
}

function essayQ(id: string, prompt: string, points = 5): QuizQuestion {
  return { id, type: "essay", prompt, points };
}

function fileUploadQ(id: string, prompt: string, points = 5): QuizQuestion {
  return {
    id,
    type: "file_upload",
    prompt,
    points,
    allowedMimeTypes: [...DEFAULT_QUIZ_UPLOAD_SPECS],
    maxUploadBytes: 8 * 1024 * 1024,
  };
}

function noteQ(id: string, prompt: string): QuizQuestion {
  return { id, type: "note", prompt, points: 0 };
}

function quiz(
  id: string,
  title: string,
  dueAt: number,
  createdAgo: number,
  description: string,
  questions: QuizQuestion[],
  extra?: Partial<Quiz>,
): Quiz {
  const scored = enrichCs570QuizQuestions(questions);
  return {
    id,
    title,
    dueAt,
    timeLimitMinutes: extra?.timeLimitMinutes ?? 30,
    published: true,
    status: "published",
    groupId: CS570_QZ,
    shuffleAnswers: true,
    description,
    createdAt: cs570Ago(createdAgo),
    ...extra,
    points: totalQuizQuestionPoints(scored),
    questionCount: scored.length,
    questions: scored,
  };
}

export function cs570Quizzes(): Quiz[] {
  const q1: QuizQuestion[] = [
    noteQ(
      "cs570_q1_note",
      "<p>Closed book. Write Θ bounds in standard form (e.g. Θ(n log n)). Two attempts; highest score counts.</p>",
    ),
    mc(
      "cs570_q1_bs",
      "Worst-case time of binary search on a sorted array of n comparable keys (comparisons)?",
      ["Θ(n)", "Θ(log n)", "Θ(n log n)", "Θ(1)"],
      1,
    ),
    tf("cs570_q1_merge", "Mergesort is a stable sorting algorithm (equal keys keep their input order).", true),
    mc(
      "cs570_q1_master",
      "By the Master Theorem, $T(n)=2T(n/2)+n$ (with $T(1)=Θ(1)$) is",
      ["Θ(n)", "Θ(n log n)", "Θ(n²)", "Θ(log n)"],
      1,
    ),
    sa(
      "cs570_q1_hash",
      "Average-case lookup in a hash table with chaining under simple uniform hashing, in Θ notation (constant load factor).",
      "Θ(1)",
      ["Θ(1)", "O(1)", "theta(1)", "Θ(1+α)"],
    ),
    num("cs570_q1_heap", "Height of a binary heap storing 31 elements if the root has height 0.", 4),
    mc("cs570_q1_insert", "Best-case runtime of insertion sort on n keys?", ["Θ(1)", "Θ(n)", "Θ(n log n)", "Θ(n²)"], 1),
    tf("cs570_q1_littleo", "If $f(n)=o(g(n))$, then $f(n)=O(g(n))$.", true),
    sa(
      "cs570_q1_case3",
      "Name the Master Theorem case that requires the regularity condition $a f(n/b) \\le c f(n)$ for some $c<1$.",
      "case 3",
      ["case 3", "case III", "3"],
    ),
    match(
      "cs570_q1_match",
      "Match each recurrence to its tight Θ bound (standard tools).",
      [
        { id: "cs570_q1_m1", left: "T(n)=2T(n/2)+n", right: "Θ(n log n)" },
        { id: "cs570_q1_m2", left: "T(n)=T(n−1)+n", right: "Θ(n²)" },
        { id: "cs570_q1_m3", left: "T(n)=T(n/2)+1", right: "Θ(log n)" },
        { id: "cs570_q1_m4", left: "T(n)=4T(n/2)+n²", right: "Θ(n² log n)" },
      ],
      4,
    ),
    essayQ(
      "cs570_q1_essay",
      "<p>In 4–6 sentences: why is “mergesort is $O(n^2)$” true but not the bound we want? What extra information does Θ give you that O does not?</p>",
      4,
    ),
  ];

  const q2: QuizQuestion[] = [
    mc("cs570_q2_inv", "Counting inversions with a modified mergesort is", ["Θ(n)", "Θ(n log n)", "Θ(n²)", "Θ(2^n)"], 1),
    tf(
      "cs570_q2_strip",
      "In the closest-pair algorithm, after splitting by x-median, each point in the 2δ-strip is compared to only a constant number of neighbors in y-order.",
      true,
    ),
    mc(
      "cs570_q2_strassen",
      "Strassen’s recurrence $T(n)=7T(n/2)+O(n^2)$ solves to",
      ["Θ(n²)", "Θ(n^{log₂ 7})", "Θ(n³)", "Θ(n² log n)"],
      1,
    ),
    sa(
      "cs570_q2_combine",
      "In divide-and-conquer, the step that stitches solutions of the two halves is called the ___ step.",
      "combine",
      ["combine", "merge", "conquer"],
    ),
    tf("cs570_q2_master_fail", "Every divide-and-conquer recurrence can be solved with the standard three-case Master Theorem.", false),
    mc(
      "cs570_q2_median",
      "A deterministic linear-time selection algorithm (median of medians) is",
      ["O(n)", "O(n log n) worst case only", "O(n²)", "O(log n)"],
      0,
    ),
    num("cs570_q2_mult", "Naive n×n matrix multiplication uses how many scalar multiplications, as a power of n? Enter the exponent.", 3),
    sa(
      "cs570_q2_karatsuba",
      "Karatsuba multiplication of two n-digit numbers uses how many recursive multiplies (enter a number)?",
      "3",
      ["3", "three"],
    ),
    fib(
      "cs570_q2_split",
      "Closest pair splits the point set by the ___ of the x-coordinates (one word).",
      ["median", "x-median", "midpoint"],
    ),
    essayQ(
      "cs570_q2_essay",
      "<p>Why does counting only inversions inside each half miss split inversions? In one short paragraph, explain what the merge step must do instead.</p>",
      4,
    ),
  ];

  const q3: QuizQuestion[] = [
    tf("cs570_q3_build", "BUILD-HEAP runs in O(n) time (not O(n log n)).", true),
    mc(
      "cs570_q3_extract",
      `<p>Extract-min on a binary min-heap of n elements is</p>${imgHtml(CS570_DIAGRAM.heap, "Binary min-heap with root 16")}`,
      ["Θ(1)", "Θ(log n)", "Θ(n)", "Θ(n log n)"],
      1,
    ),
    sa("cs570_q3_alpha", "In chaining, the load factor α is n divided by what?", "m", ["m", "table size", "number of slots"]),
    mc("cs570_q3_open", "Open addressing requires that the load factor be", ["Any α ≥ 0", "α < 1", "α > 1", "Exactly 1"], 1),
    tf("cs570_q3_bst", "An unbalanced BST on sorted insertions degrades to Θ(n) search.", true),
    num("cs570_q3_leaves", "A complete binary heap with 12 nodes has how many leaves?", 6),
    mc("cs570_q3_dec", "Decrease-key is more natural in a", ["Sorted array", "Binary heap", "Hash table with chaining", "Queue"], 1),
    sa("cs570_q3_avl", "Name one balanced BST that guarantees O(log n) search.", "AVL", ["AVL", "red-black", "red black", "AVL tree", "red-black tree"]),
    match(
      "cs570_q3_match",
      "Match the structure to the operation it supports well.",
      [
        { id: "cs570_q3_m1", left: "Binary heap", right: "Repeated extract-min" },
        { id: "cs570_q3_m2", left: "Hash table (chaining)", right: "Expected O(1) lookup" },
        { id: "cs570_q3_m3", left: "Balanced BST", right: "Ordered iteration" },
        { id: "cs570_q3_m4", left: "Unsorted array", right: "O(1) insert, O(n) search" },
      ],
    ),
  ];

  const q4: QuizQuestion[] = [
    mc("cs570_q4_int", "Optimal greedy for unweighted interval scheduling is", ["Earliest start", "Earliest finish", "Shortest interval", "Latest start"], 1),
    tf("cs570_q4_knap", "Greedy-by-density is optimal for 0/1 knapsack.", false),
    sa("cs570_q4_huff", "Huffman coding produces a ___ code (prefix-free property).", "prefix", ["prefix", "prefix-free", "prefix code"]),
    mc("cs570_q4_proof", "A typical greedy correctness proof is", ["Master Theorem", "Exchange or stay-ahead", "NP reduction", "FFT"], 1),
    tf("cs570_q4_frac", "Fractional knapsack is solved optimally by density greedy.", true),
    num(
      "cs570_q4_jobs",
      "Jobs finishing at 2, 4, 6, 9; all overlap pairwise except the job finishing at 2 with the job finishing at 9. Earliest-finish selects how many?",
      2,
    ),
    mc("cs570_q4_huff2", "Huffman’s tree is built by repeatedly merging", ["The two rarest symbols", "The two most frequent", "Random pairs", "Left spines only"], 0),
    sa("cs570_q4_safe", "The lemma that a greedy choice is contained in some optimum is often called the ___ choice property.", "greedy", ["greedy", "greedy-choice", "greedy choice"]),
    order(
      "cs570_q4_order",
      "Order the steps of Huffman coding.",
      [
        "Treat each symbol as a leaf weighted by frequency",
        "Extract the two lightest nodes",
        "Create a parent whose weight is the sum",
        "Repeat until one tree remains; read codes from the root",
      ],
      [0, 1, 2, 3],
    ),
    essayQ(
      "cs570_q4_essay",
      "<p>Give a 3-item 0/1 knapsack counterexample (weights, values, capacity) where density-greedy is not optimal. State both the greedy set and an optimal set.</p>",
      5,
    ),
  ];

  const q5: QuizQuestion[] = [
    mc(
      "cs570_q5_bfs",
      `<p>BFS on an unweighted graph computes</p>${imgHtml(CS570_DIAGRAM.graph, "Weighted graph with source s and sink t")}`,
      ["An MST", "Shortest paths in number of edges", "A topo order of every digraph", "All-pairs shortest paths"],
      1,
    ),
    tf("cs570_q5_dijneg", "Dijkstra is correct on graphs with negative edges but no negative cycles.", false),
    {
      id: "cs570_q5_mst",
      type: "multiple_answers",
      prompt: "Which algorithms compute an MST of a connected undirected graph?",
      points: 2,
      choices: ["Kruskal", "Prim", "Bellman–Ford", "Floyd–Warshall"],
      correctChoiceIndices: [0, 1],
    },
    sa("cs570_q5_topo", "DFS-based algorithm that orders a DAG.", "topological sort", ["topological sort", "topo sort", "topological ordering"]),
    tf("cs570_q5_cross", "DFS on an undirected graph produces cross edges.", false),
    mc("cs570_q5_bf", "Bellman–Ford’s main loop runs how many relaxation rounds in the standard algorithm?", ["n", "n − 1", "m", "log n"], 1),
    sa("cs570_q5_cut", "The MST theorem about a light edge leaving a set S is the ___ property.", "cut", ["cut", "cut property"]),
    num("cs570_q5_v", "A tree on 10 vertices has how many edges?", 9),
    match(
      "cs570_q5_alg",
      "Match the algorithm to the setting where you would choose it first.",
      [
        { id: "cs570_q5_a1", left: "Dijkstra", right: "Nonnegative weights, single source" },
        { id: "cs570_q5_a2", left: "Bellman–Ford", right: "Negative edges, detect negative cycles" },
        { id: "cs570_q5_a3", left: "Floyd–Warshall", right: "Dense all-pairs, simple Θ(n³) code" },
        { id: "cs570_q5_a4", left: "BFS", right: "Unweighted hop distance" },
      ],
    ),
    essayQ(
      "cs570_q5_essay",
      "<p>Draw (in words: list vertices and directed edges) a 4-vertex example where Dijkstra is wrong because of a negative edge, but there is no negative cycle. State the true shortest-path distances from s.</p>",
      5,
    ),
    fileUploadQ(
      "cs570_q5_upload",
      `<p>Upload a one-page PDF, PNG, or text file of a BFS tree for the graph below, rooted at <em>s</em>. Label tree edges and hop distances.</p>${imgHtml(CS570_DIAGRAM.graph, "Graph for the BFS-tree upload")}`,
      5,
    ),
  ];

  const q6: QuizQuestion[] = [
    mc("cs570_q6_dna", "DP is appropriate when subproblems", ["Never overlap", "Overlap and have optimal substructure", "Are NP-complete", "Require randomness"], 1),
    tf("cs570_q6_lcs", "The LCS DP table for strings of length n and m uses Θ(nm) time.", true),
    sa("cs570_q6_rod", "Rod cutting’s inner loop is over the first ___ of the rod (one word).", "cut", ["cut", "piece", "length"]),
    mc(
      "cs570_q6_knap",
      `<p>0/1 knapsack DP with n items and capacity W is</p>${imgHtml(CS570_DIAGRAM.knapsack, "Three knapsack items A B C and capacity W=8")}`,
      ["Θ(n + W)", "Θ(nW)", "Θ(2^n) only", "Θ(W log n)"],
      1,
    ),
    tf("cs570_q6_rec", "You can reconstruct an LCS from the DP table without storing all arrows if you recompute choices.", true),
    num(
      "cs570_q6_fib",
      "In the naive recursive tree for F(5), how many calls are made to F(1) or F(0) combined? (Leaves of the recursion.)",
      8,
    ),
    mc("cs570_q6_dag", "Shortest paths in a DAG are computed by relaxing edges in", ["Random order", "Topological order", "Dijkstra order only", "Reverse postorder of the transpose only"], 1),
    sa("cs570_q6_sub", "DP subproblems must exhibit optimal ___.", "substructure", ["substructure", "optimal substructure"]),
    order(
      "cs570_q6_order",
      "Order the five-part DP write-up we grade against.",
      [
        "Define the subproblems (what the indices mean)",
        "Write the recurrence and base cases",
        "State evaluation order / table dimensions",
        "Explain reconstruction of one optimal solution",
        "Give runtime and space",
      ],
      [0, 1, 2, 3, 4],
    ),
    essayQ(
      "cs570_q6_essay",
      "<p>Write the 0/1 knapsack recurrence K(i,w) including base cases. Do not invent a new problem — just the standard recurrence in one block.</p>",
      4,
    ),
  ];

  const q7: QuizQuestion[] = [
    mc("cs570_q7_np", "A problem is in NP if", ["It is unsolvable", "Yes-instances have short verifiable certificates", "It requires exponential time", "It is NP-complete"], 1),
    tf("cs570_q7_dir", "To show B is NP-hard, reduce a known NP-hard problem A to B (A ≤p B).", true),
    sa("cs570_q7_sat", "The canonical NP-complete problem used as a starting point in this course is ___-SAT (enter 3).", "3", ["3", "3SAT", "3-SAT"]),
    mc("cs570_q7_p", "If any NP-complete problem has a poly-time algorithm, then", ["P ≠ NP", "P = NP", "NP = EXP", "MSTs become NP-hard"], 1),
    tf("cs570_q7_vc", "Vertex cover is NP-complete (decision version).", true),
    mc("cs570_q7_approx", "A 2-approximation for vertex cover picks", ["A maximal matching’s endpoints", "A random vertex", "The MST", "Dijkstra’s tree"], 0),
    sa("cs570_q7_karp", "Polynomial-time many-one reductions are often called ___ reductions.", "Karp", ["Karp", "Karp reduction", "many-one"]),
    tf("cs570_q7_undir", "Hamiltonian cycle on undirected graphs is NP-complete.", true),
    essayQ(
      "cs570_q7_essay",
      "<p>A student “proves” Independent Set is NP-complete by reducing Independent Set to 3-SAT. What did they actually show? What reduction would you ask them to write instead? (6–8 sentences.)</p>",
      5,
    ),
  ];

  const practice: QuizQuestion[] = [
    noteQ(
      "cs570_pf_note",
      "<p>Ungraded comprehensive practice. Instant feedback is on. Treat it like a 45-minute slice of the final: mix of recurrences, graphs, DP, and reductions.</p>",
    ),
    mc("cs570_pf_master", "T(n)=8T(n/2)+n² is (Master Theorem)", ["Θ(n²)", "Θ(n² log n)", "Θ(n³)", "Θ(n log n)"], 2),
    tf("cs570_pf_stable", "Heapsort is stable.", false),
    mc("cs570_pf_dijk", "Dijkstra requires", ["A DAG", "Nonnegative edge weights", "An adjacency matrix", "Integer weights only"], 1),
    sa("cs570_pf_kos", "Name the two-pass SCC algorithm that DFS’s the transpose graph.", "Kosaraju", ["Kosaraju", "Kosaraju's", "Kosaraju algorithm"]),
    mc("cs570_pf_lcs", "LCS of ABCBDAB and BDCABA has length", ["2", "3", "4", "5"], 2),
    tf("cs570_pf_p", "If P = NP, then NP-complete problems have polynomial-time algorithms.", true),
    match(
      "cs570_pf_match",
      "Match the problem to the standard technique.",
      [
        { id: "cs570_pf_m1", left: "Interval scheduling (unweighted)", right: "Greedy earliest-finish" },
        { id: "cs570_pf_m2", left: "Edit distance", right: "DP on prefixes" },
        { id: "cs570_pf_m3", left: "MST", right: "Cut property / Kruskal or Prim" },
        { id: "cs570_pf_m4", left: "Independent set (decision)", right: "NP-complete; reduce from 3-SAT" },
      ],
    ),
    essayQ(
      "cs570_pf_essay",
      "<p>Pick Dijkstra or Bellman–Ford and, in one paragraph, state the invariant and the condition under which the algorithm is not correct.</p>",
      5,
    ),
  ];

  const quizBlurb = (body: string) =>
    `<p>${body}</p>
<h2>How to take it</h2>
<p>Show your work on scratch paper even when the LMS only records a click. Time limits and attempt counts are in the details above.</p>
<h2>After you submit</h2>
<p>Use the lecture notes in Modules — not a search bar — to review misses. Feedback on each question lists the answer, why it is right, a common mistake, and a takeaway.</p>`;

  return [
    quiz(
      `cs570_quiz_asym_${CID}`,
      "Quiz 1: Asymptotics",
      cs570Day(-49),
      62,
      quizBlurb(
        "Closed-book check on O/Ω/Θ, recurrences, and the Master Theorem. Covers Week 1–2 lecture notes and PS1. Two attempts; highest score counts. 25 minutes.",
      ),
      q1,
      { timeLimitMinutes: 25, allowMultipleAttempts: true, allowedAttempts: 2, scoringPolicy: "highest" },
    ),
    quiz(
      `cs570_quiz_dc_${CID}`,
      "Quiz 2: Divide and Conquer",
      cs570Day(-35),
      48,
      quizBlurb(
        "Inversions, closest pair (strip packing), Strassen, Karatsuba, and when the Master Theorem does not apply. 30 minutes, one attempt. Bring the combine-step intuition from Week 3.",
      ),
      q2,
    ),
    quiz(
      `cs570_quiz_heap_${CID}`,
      "Quiz 3: Heaps and hashing",
      cs570Day(-21),
      34,
      quizBlurb("BUILD-HEAP, extract-min, chaining vs open addressing, BST height, and which structure supports decrease-key. 30 minutes."),
      q3,
    ),
    quiz(
      `cs570_quiz_greedy_${CID}`,
      "Quiz 4: Greedy",
      cs570Day(-7),
      20,
      quizBlurb(
        "Interval scheduling, Huffman, fractional vs 0/1 knapsack, and exchange arguments. Includes a short written counterexample. 25 minutes.",
      ),
      q4,
      { timeLimitMinutes: 25 },
    ),
    quiz(
      `cs570_quiz_graphs_${CID}`,
      "Quiz 5: Graphs",
      cs570Day(10),
      6,
      quizBlurb("BFS/DFS, shortest paths, MSTs, and algorithm choice. Graph algorithms from Weeks 6–10. 30 minutes."),
      q5,
    ),
    quiz(
      `cs570_quiz_dp_${CID}`,
      "Quiz 6: Dynamic programming",
      cs570Day(28),
      2,
      quizBlurb("Rod cutting, LCS, knapsack, DAG shortest paths, and the five-part DP template. 30 minutes."),
      q6,
    ),
    quiz(
      `cs570_quiz_np_${CID}`,
      "Quiz 7: NP-completeness",
      cs570Day(56),
      1,
      quizBlurb("P vs NP, reduction direction, 3-SAT, vertex cover, and a short written diagnosis of a backwards reduction. 30 minutes."),
      q7,
    ),
    quiz(
      `cs570_quiz_finalprac_${CID}`,
      "Practice final (ungraded)",
      cs570Day(77),
      1,
      "<p>Optional comprehensive practice covering Weeks 1–15. Does not count toward the gradebook. Instant feedback is on; take it as many times as you want. Pair it with the practice-final outline in Files.</p>",
      practice,
      { quizType: "practice", practiceInstantFeedback: true, allowMultipleAttempts: true, groupId: undefined, timeLimitMinutes: 45 },
    ),
  ];
}

export function cs570Announcements(): Announcement[] {
  return [
    {
      id: "cs570_ann_welcome",
      title: "Welcome to CSCI 570 — start here",
      body: `<p>Welcome to Analysis of Algorithms. This is a proof-and-design course, not a coding camp (though two projects keep us honest).</p>
<ol>
<li>Read the <strong>Syllabus</strong> and <strong>Course policies</strong> page.</li>
<li>Work through the Week 1 module in order.</li>
<li>Introduce yourself in Discussions (pinned).</li>
<li>Problem Set 1 is already posted — start the recurrences early.</li>
</ol>
<p>Office hours and the appointment calendar are live. Bring a draft proof, not a blank page.</p>`,
      postedAt: cs570Ago(75),
      publishedAt: cs570Ago(75),
      status: "published",
      pinned: true,
    },
    {
      id: "cs570_ann_ps1",
      title: "Problem Set 1 posted — recurrences",
      body: `<p>PS1 covers definitions, four recurrences, a substitution proof, and insertion-sort cases. A common mistake is applying Master Theorem to <code>T(n)=T(n/2)+T(n/3)+n</code> without a tree.</p>
<p>Wednesday office hours will work Case 2 vs Case 3. Submit a single PDF.</p>`,
      postedAt: cs570Ago(68),
      publishedAt: cs570Ago(68),
      status: "published",
    },
    {
      id: "cs570_ann_quiz1",
      title: "Quiz 1 opens after lecture Wednesday",
      body: `<p>Quiz 1 (Asymptotics) is 25 minutes, two attempts, highest score. It is not a trick quiz: if you did PS1 you are prepared. Accommodations are already on Jordan’s and Casey’s records.</p>`,
      postedAt: cs570Ago(60),
      publishedAt: cs570Ago(60),
      status: "published",
    },
    {
      id: "cs570_ann_proj1",
      title: "Programming Project 1: sorting bake-off",
      body: `<p>Implement insertion sort, mergesort, and heapsort and time them. The write-up should explain why insertion sort wins on sorted data. ZIP + README. Pairing is optional; cite your partner.</p>`,
      postedAt: cs570Ago(50),
      publishedAt: cs570Ago(50),
      status: "published",
    },
    {
      id: "cs570_ann_greedy",
      title: "Greedy week — proofs, not vibes",
      body: `<p>If your PS4 write-up says “greedy just works,” it will not pass. Use exchange or stay-ahead. Recitation on Friday is Huffman only — come with frequencies already written down.</p>`,
      postedAt: cs570Ago(22),
      publishedAt: cs570Ago(22),
      status: "published",
    },
    {
      id: "cs570_ann_midterm",
      title: "Midterm logistics (Week 8)",
      body: `<p>The midterm is in SAL 101, 80 minutes, one handwritten sheet. Scope is Weeks 1–7 (through DFS). A sample exam is in Files. We will not ask Dijkstra on this midterm; that is PS6 / the second project.</p>
<p>Extended-time students will get a separate room email by Monday.</p>`,
      postedAt: cs570Ago(12),
      publishedAt: cs570Ago(12),
      status: "published",
    },
    {
      id: "cs570_ann_midterm_keys",
      title: "Midterm graded; keys in the module",
      body: `<p>Scores are posted. Mean 78%. Question 3 (greedy counterexample) was the discriminator. Regrade requests: Inbox, 7 days, written argument only — no “I deserve more.”</p>`,
      postedAt: cs570Ago(2),
      publishedAt: cs570Ago(2),
      status: "published",
    },
    {
      id: "cs570_ann_ps5",
      title: "PS5 (graph traversals) due this week",
      body: `<p>Timestamps, edge classification, and a short SCC sketch. Draw pictures. The discussion thread “DFS timestamps” is active if you are stuck on forward vs cross edges.</p>`,
      postedAt: cs570Ago(1),
      publishedAt: cs570Ago(1),
      status: "published",
    },
    {
      id: "cs570_ann_proj2",
      title: "Project 2 teams and Dijkstra",
      body: `<p>Use the People → Groups set <em>Project teams</em>. Document decrease-key vs. duplicate-insert. Negative-cycle tests are required for Bellman–Ford. Peer review is enabled after the deadline.</p>`,
      postedAt: cs570Ago(0.4),
      publishedAt: cs570Ago(0.4),
      status: "published",
    },
    {
      id: "cs570_ann_oh",
      title: "Office hours this week",
      body: `<p>Drop-in Wednesday 1–3pm plus booked slots on Calendar. This week’s queue is PS5 and Project 2 parsers. Bring a graph drawing, not a stack trace only.</p>`,
      postedAt: cs570Ago(0.2),
      publishedAt: cs570Ago(0.2),
      status: "published",
    },
  ];
}

export function cs570Topics(): DiscussionTopic[] {
  return [
    {
      id: "cs570_disc_welcome",
      title: "Introduce yourself",
      author: "Instructor",
      body: `<p>By Friday of Week 1, post a short introduction so the rest of us can put names to faces (and to office-hours handwriting).</p>
<ol>
<li>Your name, program (MSCS, PhD, undergrad, returning, …), and the last algorithms or data-structures course you took — including “it was years ago.”</li>
<li>A course you hope this one connects to: compilers, ML, systems, theory, computational biology, interviews, …</li>
<li>One algorithm you already like, and <em>why</em>: a runtime, a proof idea, or a time it saved you in the real world. “I like Dijkstra” is incomplete until you say what you like.</li>
</ol>
<p>Reply to at least one classmate with a follow-up question, not just “same.” This thread stays open as a roster icebreaker; it is not graded and will not be mined for participation points.</p>`,
      createdAt: cs570Ago(74),
      pinned: true,
      published: true,
      status: "published",
      lastActivityAt: cs570Ago(11),
    },
    {
      id: "cs570_disc_recurrences",
      title: "Recurrence relations Q&A",
      author: "Teaching Assistant",
      body: `<p>This thread is for <strong>substitution, recursion trees, and the Master Theorem</strong> only. Closest-pair packing belongs on the strip thread; hashing belongs in office hours.</p>
<p>Before you post, search the thread. Then include all three of:</p>
<ol>
<li>The recurrence and base case, copied carefully (floors matter).</li>
<li>Which tool you tried (tree / substitution / which Master Theorem case) and the algebra that stopped.</li>
<li>A one-line guess: Case 1/2/3, or “Master Theorem does not apply because …”</li>
</ol>
<p>“Is this Case 2?” with no work will get a request to draw a tree first. Endorsed replies are TA/instructor-confirmed — still write the proof in your own PDF; copying an endorsed paragraph is not a solution.</p>`,
      createdAt: cs570Ago(65),
      published: true,
      status: "published",
      lastActivityAt: cs570Ago(2),
    },
    {
      id: "cs570_disc_closest",
      title: "Closest pair: strip details",
      author: "Teaching Assistant",
      body: `<p>How many points in the 2δ-strip do you actually compare per point, and why is the number a constant? Write-ups say 5, 7, or 8 depending on the packing rectangle (δ×2δ vs 2δ×δ, closed vs open sides).</p>
<p>A useful post includes:</p>
<ul>
<li>Whether you re-sort the strip by y (O(n log² n) total) or merge the y-order like mergesort (O(n log n)).</li>
<li>A packing picture: why two points from opposite halves cannot both sit in a small box if they are ≥δ apart.</li>
<li>What goes wrong if you compare every pair in the strip (that is Θ(n²) in the worst case and kills the recurrence).</li>
</ul>
<p>This is the #1 office-hours question on PS2. ASCII art is fine.</p>`,
      createdAt: cs570Ago(50),
      published: true,
      status: "published",
      lastActivityAt: cs570Ago(44),
    },
    {
      id: "cs570_disc_greedy",
      title: "Greedy exchange arguments",
      author: "Instructor",
      body: `<p>Post a 5–8 sentence <strong>exchange or stay-ahead</strong> argument for a greedy algorithm of your choice. Do not paste CLRS. Allowed targets: interval scheduling, Huffman’s sibling property, or a greedy you invented (and we may break).</p>
<p>Classmates should try to break the argument with a counterexample, or point out a missing feasibility claim after the swap. Civil roasting encouraged; “this is copied” is a fair roast.</p>
<p>If your algorithm is not correct, post the counterexample instead — that is also a complete contribution.</p>`,
      createdAt: cs570Ago(24),
      published: true,
      status: "published",
      lastActivityAt: cs570Ago(18),
    },
    {
      id: "cs570_disc_dfs",
      title: "DFS timestamps: forward vs cross",
      author: "Teaching Assistant",
      body: `<p>Give a directed example on 5–7 vertices with:</p>
<ul>
<li>At least one <strong>forward</strong> edge (to a descendant that is already finished)</li>
<li>At least one <strong>cross</strong> edge (not a descendant)</li>
<li>Discovery and finish times labeled on every vertex</li>
</ul>
<p>State which edges are tree edges first, then classify the rest. If your figure is ASCII, put times as <code>d/f</code> next to the vertex name.</p>
<p>Reminder: undirected DFS does not produce cross edges in the usual classification — use a directed graph.</p>`,
      createdAt: cs570Ago(8),
      published: true,
      status: "published",
      lastActivityAt: cs570Ago(3),
    },
    {
      id: "cs570_disc_algo_week",
      title: "Algorithm of the week (graded)",
      author: "Instructor",
      body: `<p>Each eligible week, write <strong>180–280 words</strong> on one algorithm we have actually discussed (or a close cousin). Required shape:</p>
<ol>
<li>The problem in one sentence (input / output / feasibility).</li>
<li>The runtime in Θ or O, with the data structure that makes it true (e.g. heap vs array).</li>
<li>One invariant or proof idea — not “it is correct because CLRS says so.”</li>
<li>One limitation: weights, directed vs undirected, stability, extra memory, or a case that needs a different algorithm.</li>
</ol>
<p>Graded on substance, not length padding. Rubric (25 pts, Participation): problem statement 5, runtime 5, invariant 10, limitation 5. Require an initial post before you see others.</p>
<p>Late posts accepted until the following Monday with the course late policy. Do not write up a PS problem’s official solution as your algorithm of the week.</p>`,
      createdAt: cs570Ago(20),
      published: true,
      status: "published",
      graded: true,
      points: 25,
      dueAt: cs570Day(10),
      requireInitialPost: true,
      groupId: CS570_PT,
      lastActivityAt: cs570Ago(1),
    },
    {
      id: "cs570_disc_dp",
      title: "DP recipe workshop (graded)",
      author: "Instructor",
      body: `<p>Post a complete <strong>five-part DP</strong> for a problem that is <em>not</em> rod cutting, LCS, or 0/1 knapsack (those are on PS7). Good targets: matrix-chain multiplication, edit distance, weighted interval scheduling, longest increasing subsequence, or shortest/longest paths in a DAG.</p>
<p>The five parts, in order:</p>
<ol>
<li>Subproblem definition (what the indices mean)</li>
<li>Recurrence and bases</li>
<li>Evaluation order / table shape</li>
<li>Reconstruction of one optimal object</li>
<li>Runtime and space</li>
</ol>
<p>Then comment on one peer’s evaluation order — is their table filled in a legal order, or do they read a cell that is not ready?</p>
<p>Graded, 25 points, Participation group. Initial post required. Due with the Week 11–12 module window.</p>`,
      createdAt: cs570Ago(1),
      published: true,
      status: "published",
      graded: true,
      points: 25,
      dueAt: cs570Day(35),
      requireInitialPost: true,
      groupId: CS570_PT,
      lastActivityAt: cs570Ago(0.5),
    },
    {
      id: "cs570_disc_reductions",
      title: "Reduction direction clinic",
      author: "Teaching Assistant",
      body: `<p>Paste a <strong>one-sentence</strong> reduction you are considering for PS8. We will tell you if the arrow is backwards. Format:</p>
<p><code>I want to show PROBLEM is NP-hard by reducing KNOWN ≤p PROBLEM because …</code></p>
<p>Example of backwards: “I reduced Hamiltonian Cycle to 3-SAT to show HC is hard.” That shows 3-SAT is at least as hard as HC.</p>
<p>Do not post a full gadget dump here if it is your PS8 solution — this clinic is for direction and problem choice. Gadget details belong in your PDF.</p>`,
      createdAt: cs570Ago(0.8),
      published: true,
      status: "published",
      lastActivityAt: cs570Ago(0.3),
    },
    {
      id: "cs570_disc_project2",
      title: "Project 2: heap and parser FAQ",
      author: "Teaching Assistant",
      body: `<p>Tag your language in the first line (<code>[Python]</code>, <code>[C++]</code>, <code>[Java]</code>, …). Then ask about one of:</p>
<ul>
<li>Input format (n, m, then m lines u v w) and 0 vs 1 indexing</li>
<li>Disconnected graphs and vertices with no outgoing edges</li>
<li>Parallel edges: min-weight vs last-write-wins (pick one, document it)</li>
<li>Dijkstra: decrease-key vs duplicate heap entries plus a visited[] skip</li>
<li>Bellman–Ford: when the extra round must report a negative cycle vs “distances only”</li>
</ul>
<p>Do not paste 200 lines of code. A 10-line parser or a 6-vertex test graph is fair. Negative-edge tests are required even if your Dijkstra “usually matches.”</p>`,
      createdAt: cs570Ago(0.5),
      published: true,
      status: "published",
      lastActivityAt: cs570Ago(0.2),
    },
    {
      id: "cs570_disc_wrap",
      title: "What should we drill before the final?",
      author: "Instructor",
      body: `<p>Optional, ungraded. Name <strong>one</strong> topic you want on the last recitation, and say whether you want a worked example or a “what is wrong with this solution” drill.</p>
<p>Staff already expect votes for DP reconstruction and reduction gadgets. If those win, we will still leave 15 minutes for the next-highest vote (often Dijkstra vs Bellman–Ford on a tiny negative graph).</p>
<p>Reply to someone else’s request if you want a seconding vote rather than a new top-level post.</p>`,
      createdAt: cs570Ago(0.1),
      published: true,
      status: "published",
      lastActivityAt: cs570Ago(0.05),
    },
    {
      id: "cs570_disc_midterm",
      title: "Midterm postmortem (ungraded)",
      author: "Instructor",
      body: `<p>Now that scores are out: which problem ate the most time, and what would you put on the sheet next time? This is ungraded. Do not post verbatim solutions to the actual exam problems — talk about <em>types</em> of mistakes (induction hypothesis too weak, greedy without exchange, DFS edge misclassified).</p>
<p>Staff observation: Question 3 (greedy counterexample) was the discriminator. If you lost points there, rewrite one counterexample from PS4 in the same format we wanted on the exam: instance, greedy output, better output, one sentence why greedy’s rule failed.</p>`,
      createdAt: cs570Ago(1.5),
      published: true,
      status: "published",
      lastActivityAt: cs570Ago(0.9),
    },
    {
      id: "cs570_disc_oh",
      title: "Office hours / logistics",
      author: "Teaching Assistant",
      body: `<p>Use this thread for room changes, appointment calendar glitches, and “is lecture in SAL 101 today?” Questions about mathematics should go on the topic threads so search works.</p>
<p>Regular hours: instructor drop-in Wednesday 1–3pm; TA booked slots on Calendar. If you cannot make those, say so here with two windows that work — we will open an extra slot when several people collide.</p>`,
      createdAt: cs570Ago(70),
      published: true,
      status: "published",
      lastActivityAt: cs570Ago(0.15),
    },
  ];
}

export function cs570Replies(): DiscussionReply[] {
  return [
    {
      id: "cs570_rep_alex_hi",
      topicId: "cs570_disc_welcome",
      author: "Alex Chen",
      authorId: "demo_alex",
      body: `<p>Alex Chen, MSCS. Undergrad algorithms was mostly coding interviews. I want this to connect to compilers (register allocation as coloring / greedy). I still like Dijkstra because the cloud invariant is easy to draw on a whiteboard.</p>`,
      createdAt: cs570Ago(72),
    },
    {
      id: "cs570_rep_jordan_hi",
      topicId: "cs570_disc_welcome",
      author: "Jordan Lee",
      authorId: "demo_jordan",
      body: `<p>Jordan, returning student. Last algorithms course was years ago. Hoping to get recurrences back. I like binary search — not flashy, but the proof that the search space shrinks is honest.</p>`,
      createdAt: cs570Ago(71),
    },
    {
      id: "cs570_rep_priya_hi",
      topicId: "cs570_disc_welcome",
      author: "Priya Shah",
      authorId: "demo_priya",
      body: `<p>Priya, CS PhD track. Coming from a theory-leaning undergrad. I want NP-completeness to stop being a slogan. Favorite algorithm: Kruskal — sorting plus union-find feels like cheating in a good way.</p>`,
      createdAt: cs570Ago(70),
    },
    {
      id: "cs570_rep_casey_alex",
      topicId: "cs570_disc_welcome",
      author: "Casey Wong",
      authorId: "demo_casey",
      parentReplyId: "cs570_rep_alex_hi",
      body: `<p>Alex — also thinking about compilers. Are you taking the compilers elective this spring? Maybe we can share coloring notes later.</p>`,
      createdAt: cs570Ago(69),
    },
    {
      id: "cs570_rep_jordan_q",
      topicId: "cs570_disc_recurrences",
      author: "Jordan Lee",
      authorId: "demo_jordan",
      body: `<p>For T(n)=2T(n/2)+n log n, f(n) looks bigger than n^{log_b a}=n, but not polynomially bigger. Is that still Case 2 (extended) or Case 3?</p>`,
      createdAt: cs570Ago(58),
    },
    {
      id: "cs570_rep_ta_a",
      topicId: "cs570_disc_recurrences",
      parentReplyId: "cs570_rep_jordan_q",
      author: "Teaching Assistant",
      authorRole: "ta",
      authorId: "demo_ta",
      body: `<p>Extended Case 2: if f(n)=Θ(n^{log_b a} log^k n) with k≥0, the solution is Θ(n^{log_b a} log^{k+1} n). Here k=1, so Θ(n log² n). Regularity is a Case 3 thing — you do not need it here.</p>`,
      createdAt: cs570Ago(58) + 3600000,
      endorsed: true,
    },
    {
      id: "cs570_rep_sam_tree",
      topicId: "cs570_disc_recurrences",
      author: "Sam Rivera",
      authorId: "demo_sam",
      body: `<p>I drew a recursion tree for T(n)=T(n/2)+T(n/3)+n. Levels don’t have a geometric ratio that is obvious. Is the bound Θ(n) or Θ(n log n)?</p>`,
      createdAt: cs570Ago(57),
    },
    {
      id: "cs570_rep_ta_tree",
      topicId: "cs570_disc_recurrences",
      parentReplyId: "cs570_rep_sam_tree",
      author: "Teaching Assistant",
      authorRole: "ta",
      authorId: "demo_ta",
      body: `<p>The work per “level” decreases geometrically because 1/2+1/3&lt;1, so the root dominates: T(n)=Θ(n). Akra–Bazzi or a tree with a careful leaf-depth argument both work. Do not force Master Theorem.</p>`,
      createdAt: cs570Ago(56),
      endorsed: true,
    },
    {
      id: "cs570_rep_riley_strip",
      topicId: "cs570_disc_closest",
      author: "Riley Patel",
      authorId: "demo_riley",
      body: `<p>If I sort the strip by y each time, I get an extra log, right? CLRS merges the y-order. Is the constant 7 from packing 8 points into a δ×2δ rectangle?</p>`,
      createdAt: cs570Ago(46),
    },
    {
      id: "cs570_rep_ta_strip",
      topicId: "cs570_disc_closest",
      parentReplyId: "cs570_rep_riley_strip",
      author: "Teaching Assistant",
      authorRole: "ta",
      authorId: "demo_ta",
      body: `<p>Yes — if you re-sort, closest pair becomes O(n log² n), still fine to mention. The packing argument: points in the strip from different halves are ≥δ apart, so only a constant number sit in the 2δ×δ neighborhood. Some notes use 7 neighbors, some 5; either is OK if you justify packing.</p>`,
      createdAt: cs570Ago(45),
      endorsed: true,
    },
    {
      id: "cs570_rep_morgan_ex",
      topicId: "cs570_disc_greedy",
      author: "Morgan Blake",
      authorId: "demo_morgan",
      body: `<p>Interval scheduling: take an optimal solution that disagrees with earliest-finish as early as possible; swap in the greedy job. The finish time only gets smaller, so later jobs still fit. I think that is the whole exchange.</p>`,
      createdAt: cs570Ago(19),
    },
    {
      id: "cs570_rep_priya_ex",
      topicId: "cs570_disc_greedy",
      parentReplyId: "cs570_rep_morgan_ex",
      author: "Priya Shah",
      authorId: "demo_priya",
      body: `<p>You also need that greedy’s job overlaps at most that one optimal job (because it finishes first). After the swap, feasibility is obvious. Looks good.</p>`,
      createdAt: cs570Ago(18),
    },
    {
      id: "cs570_rep_alex_dfs",
      topicId: "cs570_disc_dfs",
      author: "Alex Chen",
      authorId: "demo_alex",
      body: `<p>Vertices 1–5, edges 1→2, 2→3, 1→3 (forward), 2→4, 5→4 (cross if 5 is in another tree). Times: 1: 1/10, 2: 2/7, 3: 3/4, 4: 5/6, 5: 8/9. If 1→3 is discovered while 3 is already finished as a descendant, that is forward.</p>`,
      createdAt: cs570Ago(4),
    },
    {
      id: "cs570_rep_ta_dfs",
      topicId: "cs570_disc_dfs",
      parentReplyId: "cs570_rep_alex_dfs",
      author: "Teaching Assistant",
      authorRole: "ta",
      authorId: "demo_ta",
      body: `<p>Forward vs. cross: descendant in the DFS forest vs. not. Your 1→3 story is the right test (finish[3] &lt; finish[1] and 3 was white when we started 1’s recursion… actually if 3 is a descendant it was gray/white inside 1). Draw the tree edges only, then classify the extra edges. Close enough for PS5.</p>`,
      createdAt: cs570Ago(3),
      endorsed: true,
    },
    {
      id: "cs570_rep_alex_week",
      topicId: "cs570_disc_algo_week",
      author: "Alex Chen",
      authorId: "demo_alex",
      body: `<p>Kruskal sorts edges and adds an edge when it does not form a cycle (union-find). Sorting is O(m log m); nearly-linear union-find makes the rest feel free. The cut property says a light edge leaving a forest component is safe. Limitation: undirected graphs only; directed “MSTs” are a different problem (arborescences). Also, Kruskal is not the right tool when you already have a dense adjacency matrix and n is tiny — Prim with a linear scan can win on constants.</p>`,
      createdAt: cs570Ago(2),
    },
    {
      id: "cs570_rep_sam_week",
      topicId: "cs570_disc_algo_week",
      author: "Sam Rivera",
      authorId: "demo_sam",
      body: `<p>Bellman–Ford relaxes every edge |V|−1 times, then once more to catch negative cycles. It handles negative weights; Dijkstra does not. Runtime O(nm) hurts on dense graphs. I still mix up whether the extra round is required if we only want distances and we already know the graph has no negative cycle — I think we can skip it if the input is promised conservative.</p>`,
      createdAt: cs570Ago(1),
    },
    {
      id: "cs570_rep_casey_week",
      topicId: "cs570_disc_algo_week",
      author: "Casey Wong",
      authorId: "demo_casey",
      body: `<p>Huffman: merge the two lightest weights, treat the parent as a new symbol, repeat. Prefix-free codes, optimal among prefix codes. Limitation: you need known frequencies; adaptive Huffman exists but we did not implement it. Also not for non-symbol data with context (that is arithmetic coding / ML compressors).</p>`,
      createdAt: cs570Ago(1.2),
    },
    {
      id: "cs570_rep_priya_dp",
      topicId: "cs570_disc_dp",
      author: "Priya Shah",
      authorId: "demo_priya",
      body: `<p><strong>Edit distance.</strong> Subproblem: E(i,j) = edit distance of prefixes a[1..i], b[1..j]. Recurrence: substitute, insert, or delete, min of three, +1, or copy if equal. Base: E(i,0)=i, E(0,j)=j. Fill by increasing i+j. Reconstruct by storing arrows. Time Θ(nm).</p>`,
      createdAt: cs570Ago(0.6),
    },
    {
      id: "cs570_rep_alex_dp",
      topicId: "cs570_disc_dp",
      parentReplyId: "cs570_rep_priya_dp",
      author: "Alex Chen",
      authorId: "demo_alex",
      body: `<p>Evaluation order checks out if you only read E(i−1,j), E(i,j−1), E(i−1,j−1). Nice. Are you storing the full table or two rows?</p>`,
      createdAt: cs570Ago(0.4),
    },
    {
      id: "cs570_rep_jordan_red",
      topicId: "cs570_disc_reductions",
      author: "Jordan Lee",
      authorId: "demo_jordan",
      body: `<p>I was going to reduce Independent Set to 3-SAT to show Independent Set is NP-complete. That feels backwards now that I write it.</p>`,
      createdAt: cs570Ago(0.35),
    },
    {
      id: "cs570_rep_ta_red",
      topicId: "cs570_disc_reductions",
      parentReplyId: "cs570_rep_jordan_red",
      author: "Teaching Assistant",
      authorRole: "ta",
      authorId: "demo_ta",
      body: `<p>Correct instinct. Known hard ≤p your problem. 3-SAT ≤p Independent Set is the usual direction. Independent Set ≤p 3-SAT would show 3-SAT is at least as hard as IS, which we already believe, and does not prove IS is hard.</p>`,
      createdAt: cs570Ago(0.3),
      endorsed: true,
    },
    {
      id: "cs570_rep_alex_p2",
      topicId: "cs570_disc_project2",
      author: "Alex Chen",
      authorId: "demo_alex",
      body: `<p>[C++] Duplicate-insert Dijkstra with a visited[] skip. Parser ignores extra spaces. How should we treat two edges u→v with different weights? I am keeping the minimum.</p>`,
      createdAt: cs570Ago(0.25),
    },
    {
      id: "cs570_rep_ta_p2",
      topicId: "cs570_disc_project2",
      parentReplyId: "cs570_rep_alex_p2",
      author: "Teaching Assistant",
      authorRole: "ta",
      authorId: "demo_ta",
      body: `<p>Min-weight parallel edges is a good default; document it. Visited[] skip is the standard lazy-heap Dijkstra. Still test a negative edge: your Dijkstra should disagree with Bellman–Ford.</p>`,
      createdAt: cs570Ago(0.2),
      endorsed: true,
    },
    {
      id: "cs570_rep_jordan_wrap",
      topicId: "cs570_disc_wrap",
      author: "Jordan Lee",
      authorId: "demo_jordan",
      body: `<p>Vote: DP reconstruction. I can fill an LCS table and still forget how to walk back to the string. A “what is wrong with this reconstruction” drill would help more than another full fill-from-scratch.</p>`,
      createdAt: cs570Ago(0.08),
    },
    {
      id: "cs570_rep_priya_wrap",
      topicId: "cs570_disc_wrap",
      author: "Priya Shah",
      authorId: "demo_priya",
      body: `<p>Seconding Jordan on reconstruction. Also 10 minutes on reduction arrows — I still almost wrote Independent Set ≤p 3-SAT on PS8’s scratch paper.</p>`,
      createdAt: cs570Ago(0.05),
    },
    {
      id: "cs570_rep_sam_mid",
      topicId: "cs570_disc_midterm",
      author: "Sam Rivera",
      authorId: "demo_sam",
      body: `<p>Question 3 got me. I wrote “earliest start usually works” instead of a counterexample. Next sheet: one picture of a long interval covering two short ones, labeled greedy vs OPT.</p>`,
      createdAt: cs570Ago(1.2),
    },
    {
      id: "cs570_rep_ta_mid",
      topicId: "cs570_disc_midterm",
      parentReplyId: "cs570_rep_sam_mid",
      author: "Teaching Assistant",
      authorRole: "ta",
      authorId: "demo_ta",
      body: `<p>That picture is exactly what we wanted. For the final, keep a second counterexample (density knapsack) in the same three-line format: instance / greedy / better.</p>`,
      createdAt: cs570Ago(0.9),
      endorsed: true,
    },
    {
      id: "cs570_rep_riley_oh",
      topicId: "cs570_disc_oh",
      author: "Riley Patel",
      authorId: "demo_riley",
      body: `<p>The appointment calendar showed 0 slots Tuesday — is that a closed day or a glitch?</p>`,
      createdAt: cs570Ago(0.18),
    },
    {
      id: "cs570_rep_ta_oh",
      topicId: "cs570_disc_oh",
      parentReplyId: "cs570_rep_riley_oh",
      author: "Teaching Assistant",
      authorRole: "ta",
      authorId: "demo_ta",
      body: `<p>Closed — conference travel. Extra Wednesday 4–5pm this week only; book on Calendar by noon.</p>`,
      createdAt: cs570Ago(0.15),
      endorsed: true,
    },
  ];
}

export function cs570Pages(): { id: string; title: string; content: string }[] {
  return lecturePages();
}

export function cs570Modules(): ModuleT[] {
  const ps = (label: string, id: string) =>
    ({ type: "assignment" as const, label, assignmentId: id, indent: 1, ...own });
  const qz = (label: string, id: string) =>
    ({ type: "quiz" as const, label, quizId: id, indent: 1, ...own });
  const pg = (label: string, pageId: string) =>
    ({ type: "page" as const, label, pageId, indent: 1, ...own, requirementType: "must_view" as const });
  const ds = (label: string, id: string) =>
    ({ type: "discussion" as const, label, discussionId: id, indent: 1, ...own });
  const fl = (label: string, fileId: string, fileName: string) =>
    ({ type: "file" as const, label, fileId, fileName, indent: 1, ...own });

  return [
    {
      title: "Week 1 – Introduction",
      requirementsMode: "all",
      accessRule: "default",
      items: [
        { type: "section", label: "Start here", indent: 0, collapsed: false },
        pg("Course Overview", "course-overview"),
        pg("Course policies", "course-policies"),
        pg("Week 1 lecture: models and sorting", "week1-intro"),
        fl("Syllabus.txt", "cs570_file_syllabus", "Syllabus.txt"),
        ds("Introduce yourself", "cs570_disc_welcome"),
        ds("Office hours / logistics", "cs570_disc_oh"),
        { type: "section", label: "This week’s work", indent: 0, collapsed: false },
        ps("Problem Set 1: Asymptotics & Recurrences", `cs570_ps1_${CID}`),
      ],
    },
    {
      title: "Week 2 – Algorithms and Complexity",
      requirementsMode: "all",
      accessRule: "default",
      items: [
        { type: "section", label: "Lecture", indent: 0, collapsed: false },
        pg("Week 2 lecture: asymptotics", "lecture-slides"),
        pg("Recurrences workshop", "recurrences"),
        fl("Master Theorem cheatsheet.txt", "cs570_file_master", "Master-Theorem-cheatsheet.txt"),
        ds("Recurrence relations Q&A", "cs570_disc_recurrences"),
        { type: "section", label: "Check", indent: 0, collapsed: false },
        qz("Quiz 1: Asymptotics", `cs570_quiz_asym_${CID}`),
        { type: "link", label: "CLRS companion (MIT Press)", url: "https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/", indent: 1 },
      ],
    },
    {
      title: "Week 3 – Divide and Conquer",
      requirementsMode: "none",
      accessRule: "default",
      items: [
        pg("Week 3 lecture: divide and conquer", "week3-dc"),
        ds("Closest pair: strip details", "cs570_disc_closest"),
        ps("Problem Set 2: Divide and Conquer", `cs570_ps2_${CID}`),
        qz("Quiz 2: Divide and Conquer", `cs570_quiz_dc_${CID}`),
        fl("Lecture 03 notes.txt", "cs570_file_lec3", "Lecture-03-heaps.txt"),
      ],
    },
    {
      title: "Week 4 – Heaps and hashing",
      requirementsMode: "none",
      accessRule: "default",
      items: [
        pg("Week 4 lecture: heaps and hashing", "week4-heaps"),
        ps("Problem Set 3: Heaps, Hashing, and BSTs", `cs570_ps3_${CID}`),
        ps("Programming Project 1: Sorting bake-off", `cs570_proj1_${CID}`),
        qz("Quiz 3: Heaps and hashing", `cs570_quiz_heap_${CID}`),
      ],
    },
    {
      title: "Week 5 – Greedy algorithms",
      requirementsMode: "none",
      accessRule: "default",
      items: [
        pg("Week 5 lecture: greedy algorithms", "week5-greedy"),
        ds("Greedy exchange arguments", "cs570_disc_greedy"),
        ps("Problem Set 4: Greedy Algorithms", `cs570_ps4_${CID}`),
        qz("Quiz 4: Greedy", `cs570_quiz_greedy_${CID}`),
        ds("Algorithm of the week (graded)", "cs570_disc_algo_week"),
      ],
    },
    {
      title: "Week 6 – Graph algorithms I (BFS)",
      requirementsMode: "none",
      accessRule: "default",
      items: [
        pg("Week 6 lecture: graphs and BFS", "week6-bfs"),
        pg("Week 6–7 combined notes (reference)", "graph-algorithms"),
        ps("Problem Set 5: Graph Traversals", `cs570_ps5_${CID}`),
      ],
    },
    {
      title: "Week 7 – Graph algorithms II (DFS)",
      requirementsMode: "none",
      accessRule: "default",
      items: [
        pg("Week 7 lecture: DFS, topo sort, SCCs", "week7-dfs"),
        ds("DFS timestamps: forward vs cross", "cs570_disc_dfs"),
        qz("Quiz 5: Graphs", `cs570_quiz_graphs_${CID}`),
      ],
    },
    {
      title: "Week 8 – Midterm",
      requirementsMode: "none",
      accessRule: "default",
      items: [
        pg("Week 8: midterm prep", "week8-midterm"),
        fl("Sample midterm.txt", "cs570_file_midterm", "Sample-midterm.txt"),
        ps("Midterm exam", `cs570_midterm_${CID}`),
        ds("Midterm postmortem (ungraded)", "cs570_disc_midterm"),
      ],
    },
    {
      title: "Week 9 – Shortest paths",
      requirementsMode: "none",
      accessRule: "default",
      items: [
        pg("Week 9 lecture: shortest paths", "week9-sp"),
        ps("Problem Set 6: Shortest Paths and MSTs", `cs570_ps6_${CID}`),
        ps("Programming Project 2: Shortest Paths", `cs570_project_${CID}`),
        ds("Project 2: heap and parser FAQ", "cs570_disc_project2"),
      ],
    },
    {
      title: "Week 10 – MSTs and flow preview",
      requirementsMode: "none",
      accessRule: "default",
      items: [
        pg("Week 10 lecture: MSTs and flow (preview)", "week10-mst"),
      ],
    },
    {
      title: "Week 11 – Dynamic programming I",
      requirementsMode: "none",
      accessRule: "default",
      items: [
        pg("Week 11 lecture: DP I", "dynamic-programming"),
        ds("DP recipe workshop (graded)", "cs570_disc_dp"),
        ps("Problem Set 7: Dynamic Programming", `cs570_ps7_${CID}`),
        qz("Quiz 6: Dynamic programming", `cs570_quiz_dp_${CID}`),
      ],
    },
    {
      title: "Week 12 – Dynamic programming II",
      requirementsMode: "none",
      accessRule: "default",
      items: [
        pg("Week 12 lecture: DP II", "week12-dp2"),
      ],
    },
    {
      title: "Week 13 – NP-completeness",
      requirementsMode: "none",
      accessRule: "default",
      items: [
        pg("Week 13 lecture: NP-completeness", "np-completeness"),
        ds("Reduction direction clinic", "cs570_disc_reductions"),
        ps("Problem Set 8: NP-Completeness", `cs570_ps8_${CID}`),
        qz("Quiz 7: NP-completeness", `cs570_quiz_np_${CID}`),
      ],
    },
    {
      title: "Week 14 – Approximation and randomness",
      requirementsMode: "none",
      accessRule: "default",
      items: [
        pg("Week 14 lecture: approximation and randomness", "week14-approx"),
        ps("Extra credit: Algorithm visualization", `cs570_ec_${CID}`),
      ],
    },
    {
      title: "Week 15 – Review and final",
      requirementsMode: "none",
      accessRule: "default",
      items: [
        pg("Week 15: review sheet", "week15-review"),
        ds("What should we drill before the final?", "cs570_disc_wrap"),
        qz("Practice final (ungraded)", `cs570_quiz_finalprac_${CID}`),
        fl("Practice final outline.txt", "cs570_file_final", "Practice-final-outline.txt"),
        ps("Final exam", `cs570_final_${CID}`),
      ],
    },
  ];
}

export function cs570SyllabusHtml() {
  return `
<h1>CSCI 570 — Analysis of Algorithms</h1>
<p>Graduate core course, 15 weeks. We design algorithms, prove correctness, and analyze running time. Lectures assume discrete math and undergraduate data structures.</p>
<h2>Required text</h2>
<p>Cormen, Leiserson, Rivest, Stein. <em>Introduction to Algorithms</em>, 4th ed. (3rd ed. acceptable). Lecture notes in Modules are assigned weekly; CLRS is the reference implementation of the proofs.</p>
<h2>Staff</h2>
<p>Instructor: Nehang Patel. TA: Taylor Kim. Office hours and appointment slots are on the Calendar. Inbox for private matters; Discussions for mathematics that helps the whole class.</p>
<h2>Graded work (weighted)</h2>
<ul>
<li><strong>Homework 35%</strong> — eight problem sets and two programming projects (Project 2 is larger)</li>
<li><strong>Quizzes 15%</strong> — seven short quizzes; practice final is ungraded</li>
<li><strong>Exams 40%</strong> — in-class midterm (Week 8) and cumulative final (Week 15)</li>
<li><strong>Participation 10%</strong> — graded discussions (algorithm of the week; DP workshop)</li>
</ul>
<p>Extra credit (visualization) is added after weights and cannot replace an exam.</p>
<h2>Weekly expectations</h2>
<p>Plan 10–12 hours outside class in a typical week: reading, a problem set or quiz, and (later) project milestones. Proofs are written in complete sentences. Pseudocode must be implementable.</p>
<h2>Integrity</h2>
<p>Discuss high-level ideas; write your own proofs and code. List collaborators. Unattributed copying — including from models — is an integrity violation. See the Course policies page.</p>
<h2>Accommodations</h2>
<p>Quiz extra time and attempts are configured under People → Accommodations. Speak with the instructor in Week 1 if you need a quieter exam room.</p>
<h2>Where to look</h2>
<ul>
<li><strong>Modules</strong> — the weekly spine. Open the lecture page before the problem set or quiz.</li>
<li><strong>Assignments / Quizzes / Discussions</strong> — graded work with due dates. Read the whole prompt; problems are numbered.</li>
<li><strong>Inbox</strong> — private questions and regrades. Do not email solution PDFs.</li>
<li><strong>Course policies</strong> — collaboration, late work, AI tools, and exam rules.</li>
</ul>
`.trim();
}

export function cs570FileSpecs(): { id: string; name: string; module: string; text: string }[] {
  return [
    {
      id: "cs570_file_syllabus",
      name: "Syllabus.txt",
      module: "Week 1 – Introduction",
      text: "CSCI 570 Analysis of Algorithms — 15-week graduate algorithms course.\nSee the Syllabus tool in Canvas for the full HTML version, weights, and integrity policy.\nWeekly spine is the Modules list (Weeks 1–15).\n",
    },
    {
      id: "cs570_file_master",
      name: "Master-Theorem-cheatsheet.txt",
      module: "Week 2 – Algorithms and Complexity",
      text: `Master Theorem (CLRS): T(n)=a T(n/b)+f(n), a≥1, b>1.
Case 1: f = O(n^{log_b a − ε}) → Θ(n^{log_b a})
Case 2: f = Θ(n^{log_b a} log^k n), k≥0 → Θ(n^{log_b a} log^{k+1} n)
Case 3: f = Ω(n^{log_b a + ε}) and regularity a f(n/b) ≤ c f(n), c<1 → Θ(f(n))
Do not apply to uneven splits (e.g. T(n/2)+T(n/3)+n). Use a recursion tree.
`,
    },
    {
      id: "cs570_file_lec3",
      name: "Lecture-03-heaps.txt",
      module: "Week 3 – Divide and Conquer",
      text: `Week 3 companion (D&C) plus a preview of heaps for Week 4:
Closest pair: 2δ strip, constant neighbors after y-order.
Inversions: count during merge.
Heaps preview: insert/extract O(log n), BUILD-HEAP O(n), heapsort Θ(n log n) worst case.
`,
    },
    {
      id: "cs570_file_midterm",
      name: "Sample-midterm.txt",
      module: "Week 8 – Midterm",
      text: `CSCI 570 sample midterm (80 min, one sheet)
1) Recurrences (20) — substitution + Master Theorem edge case
2) Divide and conquer design (25) — inversions or closest-pair strip
3) Greedy (25) — earliest-finish proof or Huffman; one counterexample
4) BFS/DFS (30) — timestamps, edge types, topo sort or bipartiteness
Not on this midterm: Dijkstra, DP tables, NP-completeness.
`,
    },
    {
      id: "cs570_file_final",
      name: "Practice-final-outline.txt",
      module: "Week 15 – Review and final",
      text: `CSCI 570 practice final outline (120 min, two sheets)
A) Recurrence or Master Theorem
B) Greedy or D&C design + proof
C) Dijkstra vs Bellman–Ford vs MST
D) Full DP (define, recure, fill, reconstruct)
E) Reduction gadget (3-SAT → IS or similar)
Work the ungraded Practice final quiz for auto-check items.
`,
    },
  ];
}
