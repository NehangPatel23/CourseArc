import type { QuizQuestion } from "../utils/quizzes";
import {
  formatIncorrectQuestionFeedback,
  formatQuestionFeedback,
  type FeedbackParts,
} from "./demoQuestionFeedback";

/** Pedagogical extras; omit `answer` when it can be read from the key. */
type Extra = Omit<FeedbackParts, "answer"> & { answer?: string };

function keyAnswer(q: QuizQuestion): string {
  switch (q.type) {
    case "multiple_choice":
      return q.choices?.[q.correctChoiceIndex ?? 0] ?? "";
    case "multiple_answers":
      return (q.correctChoiceIndices ?? [])
        .map((i) => q.choices?.[i])
        .filter(Boolean)
        .join("; ");
    case "true_false":
      return q.correctTrueFalse ? "True" : "False";
    case "short_answer":
      return q.correctShortAnswer ?? "";
    case "fill_in_blank":
      return (q.acceptedAnswers ?? []).filter((a) => a.trim()).join(" / ");
    case "numerical":
      return typeof q.correctNumber === "number" ? String(q.correctNumber) : "";
    case "matching":
      return (q.matchingPairs ?? []).map((p) => `${p.left} → ${p.right}`).join("; ");
    case "ordering":
      return (q.correctOrder ?? [])
        .map((i) => q.orderingItems?.[i])
        .filter(Boolean)
        .join(" → ");
    default:
      return "";
  }
}

/**
 * Per-question why / common mistake / takeaway (and model answers for essays
 * and file uploads). Auto-graded keys are filled from the question object.
 */
const CS570_QUESTION_FEEDBACK: Record<string, Extra> = {
  cs570_q1_bs: {
    why: "Binary search halves the remaining interval each comparison, so the worst-case comparison count is Θ(log n) on a sorted array.",
    mistake: "Θ(n) is linear scan, not binary search. Θ(1) would mean a constant number of comparisons independent of n.",
    takeaway: "Logarithmic search needs random access plus a sorted (or otherwise ordered) array.",
  },
  cs570_q1_merge: {
    why: "Mergesort copies equal keys in their original relative order when the merge prefers the left run, so it is stable.",
    mistake: "Confusing stability with adaptivity (how already-sorted input behaves) or with in-place memory use.",
    takeaway: "Stability matters when you sort by a secondary key after a primary key.",
  },
  cs570_q1_master: {
    why: "Here a = 2, b = 2, f(n) = n, so n^{log_b a} = n. Case 2 of the Master Theorem gives Θ(n log n).",
    mistake: "Calling this Θ(n) (case 1) or Θ(n²) (a different recurrence such as T(n)=2T(n/2)+n²).",
    takeaway: "Match f(n) against n^{log_b a} before you pick the case.",
  },
  cs570_q1_hash: {
    why: "Under simple uniform hashing with a constant load factor α, expected chain length is Θ(1), so expected lookup is Θ(1).",
    mistake: "Citing Θ(n) as the typical case — that is the all-keys-collide worst case, not the average under SUH.",
    takeaway: "Hashing’s Θ(1) is expected time under assumptions, not a worst-case guarantee.",
  },
  cs570_q1_heap: {
    why: "A binary heap with 31 nodes is a perfect tree: 2^{h+1} − 1 = 31 ⇒ h = 4 when the root has height 0.",
    mistake: "Off-by-one from counting levels as 1…5 or using floor(log₂ n) with the wrong height convention.",
    takeaway: "Heap height is ⌊log₂ n⌋; a full level of 16 leaves sits under a height-4 root.",
  },
  cs570_q1_insert: {
    why: "On already-sorted input each insert does Θ(1) work, so n insertions cost Θ(n).",
    mistake: "Quoting the Θ(n²) worst case (reverse-sorted) as if it were the best case.",
    takeaway: "Best / average / worst can differ; always name which one you mean.",
  },
  cs570_q1_littleo: {
    why: "Little-o is a strict subset of big-O: f = o(g) means f/g → 0, which implies f = O(g).",
    mistake: "Thinking little-o and big-O are incomparable, or that o implies Ω.",
    takeaway: "o ⊂ O ⊂ O∪Ω; Θ is O and Ω together.",
  },
  cs570_q1_case3: {
    why: "Master Theorem case 3 needs both f(n) = Ω(n^{log_b a + ε}) and the regularity condition a f(n/b) ≤ c f(n) for some c < 1.",
    mistake: "Naming case 2 (the n^{log_b a} log n case) or forgetting that regularity is extra, not automatic.",
    takeaway: "If regularity fails, the Master Theorem simply does not apply — use a recursion tree or Akra–Bazzi.",
  },
  cs570_q1_match: {
    why: "Unfold or apply the Master Theorem: balanced n-work combine is n log n; T(n)=T(n−1)+n is triangular n²; T(n)=T(n/2)+1 is log n; T(n)=4T(n/2)+n² is case 2 with n² log n.",
    mistake: "Swapping case 2 of T(n)=4T(n/2)+n² (Θ(n² log n)) with case 1 of T(n)=4T(n/2)+n (Θ(n²)).",
    takeaway: "Write a, b, and f(n) before you guess the bound.",
  },
  cs570_q1_essay: {
    answer:
      "O(n²) is a valid upper bound for mergesort because n log n = O(n²), but it is loose: it also “upper-bounds” insertion sort’s worst case and does not capture the true growth rate. Θ(n log n) is both O and Ω, so it is tight — the running time is at least and at most a constant times n log n for large n. We want Θ (or a matching O and Ω pair) when we claim the complexity of an algorithm.",
    why: "Big-O only forbids growing faster than the bound; it allows arbitrarily slow functions. Course convention is to report a tight bound unless a one-sided bound is the point of the question.",
    mistake: "Saying O(n²) is false for mergesort, or claiming Θ and O are synonyms.",
    takeaway: "True but slack O-bounds are usually the wrong answer on a 570 quiz.",
  },

  cs570_q2_inv: {
    why: "The modified merge counts split inversions in linear time per level; the recurrence is the same as mergesort, so Θ(n log n).",
    mistake: "Thinking you must compare every pair (Θ(n²)) or that the divide step alone is enough (Θ(n)).",
    takeaway: "Count inversions while you merge — don’t add a nested loop.",
  },
  cs570_q2_strip: {
    why: "In a 2δ-wide strip, each point’s y-neighbors that could still beat δ sit in a O(1)-size 2δ × δ box, so only a constant number of comparisons per point.",
    mistake: "Comparing every pair in the strip (that would ruin the O(n log n) bound).",
    takeaway: "The geometric packing argument is why closest-pair is O(n log n), not O(n²).",
  },
  cs570_q2_strassen: {
    why: "Master Theorem case 1: a = 7, b = 2, f(n) = O(n²), n^{log₂ 7} ≈ n^{2.807} dominates, so T(n) = Θ(n^{log₂ 7}).",
    mistake: "Leaving it as Θ(n³) (naive multiply) or Θ(n² log n) (wrong case).",
    takeaway: "Seven recursive multiplies beat eight; the exponent is log₂ 7, not 3.",
  },
  cs570_q2_combine: {
    why: "Divide-and-conquer is divide, recurse (conquer), then combine/merge the two solutions into one.",
    mistake: "Calling the whole algorithm “divide” or using “conquer” for the stitch step.",
    takeaway: "The combine step is often where the interesting work (and the recurrence’s f(n)) lives.",
  },
  cs570_q2_master_fail: {
    why: "The three-case Master Theorem needs a fixed a ≥ 1, b > 1, and a polynomial-like f. Uneven splits, T(n)=T(n−1)+T(n/2)+n, or floors/ceils that break regularity need other tools.",
    mistake: "Treating every D&C recurrence as a Master Theorem instance.",
    takeaway: "If a, b, or f don’t fit, draw a recursion tree or use substitution / Akra–Bazzi.",
  },
  cs570_q2_median: {
    why: "Median-of-medians guarantees a constant-fraction pivot, so the worst-case recurrence solves to O(n).",
    mistake: "Confusing it with randomized Quickselect (expected linear, worst-case quadratic) or with heapsort’s n log n.",
    takeaway: "Deterministic linear selection exists; the constants are large, but the bound is O(n).",
  },
  cs570_q2_mult: {
    why: "Each of n² output entries is a dot product of n multiplies, so n³ scalar multiplications; the exponent is 3.",
    mistake: "Entering 2 (additions-only thinking) or log₂ 7 (Strassen).",
    takeaway: "Naive multiply is cubic; Strassen only changes the exponent slightly.",
  },
  cs570_q2_karatsuba: {
    why: "Karatsuba replaces four n/2 multiplies with three (high, low, and one mixed product), yielding T(n)=3T(n/2)+O(n).",
    mistake: "Answering 4 (schoolbook) or 2.",
    takeaway: "One extra add/subtract buys a recursive multiply you no longer need.",
  },
  cs570_q2_split: {
    why: "The algorithm partitions by the median x-coordinate so the two halves have size n/2 and the strip is well-defined.",
    mistake: "Splitting by a mean or an arbitrary vertical line, which can unbalance the recurrence.",
    takeaway: "Median split keeps the divide balanced; the strip argument needs that balance.",
  },
  cs570_q2_essay: {
    answer:
      "An inversion (i, j) with i in the left half and j in the right half is never seen by the two recursive calls, which only look inside their own arrays. During merge, whenever you take an element from the right run while left elements remain, each remaining left element forms a split inversion with that right element — count them in O(1) per merge step, totaling O(n) per level.",
    why: "The point of the exercise is that the interesting inversions cross the cut; the merge is the only linear-time place to count them.",
    mistake: "Claiming recursive calls already see all pairs, or recounting inversions with a nested loop in merge.",
    takeaway: "If a quantity splits across a cut, the combine step has to account for the cut.",
  },

  cs570_q3_build: {
    why: "BUILD-HEAP calls HEAPIFY from the last internal node up. The cost sums to n(1/2 + 1/4·2 + 1/8·3 + ⋯) = O(n), not n log n.",
    mistake: "n × HEAPIFY = n log n — that bound is correct but not tight.",
    takeaway: "Most heapify calls run on tiny subtrees; the sum is linear.",
  },
  cs570_q3_extract: {
    why: "Extract-min swaps the last leaf into the root and HEAPIFY’s down the height, which is Θ(log n).",
    mistake: "Θ(1) (that is peek, not extract) or Θ(n) (that is building or scanning an unsorted array).",
    takeaway: "Heap height is logarithmic, so bubble-down is logarithmic.",
  },
  cs570_q3_alpha: {
    why: "Load factor α = n/m, the number of keys over the number of slots (table size).",
    mistake: "Dividing by chain length or by n.",
    takeaway: "Keep α = Θ(1) if you want expected O(1) chaining operations.",
  },
  cs570_q3_open: {
    why: "Open addressing stores keys in the table itself, so you need at least one empty slot to terminate a probe sequence: α < 1.",
    mistake: "Allowing α ≥ 1 the way chaining can.",
    takeaway: "Chaining tolerates α > 1; open addressing does not.",
  },
  cs570_q3_bst: {
    why: "Inserting already-sorted keys into an unbalanced BST produces a right spine of height n, so search is Θ(n).",
    mistake: "Assuming every BST is balanced.",
    takeaway: "Without rotations (AVL/red-black) or randomization, a BST is only as good as its insertion order.",
  },
  cs570_q3_leaves: {
    why: "In a complete binary tree the number of leaves is ⌈n/2⌉. For n = 12 that is 6.",
    mistake: "Counting only the last level of a perfect tree (8) or using n − 1.",
    takeaway: "Complete ≠ perfect; draw the 12-node shape before you count.",
  },
  cs570_q3_dec: {
    why: "Decrease-key bubbles a node up toward the root in a binary heap in O(log n); arrays and hash tables do not maintain heap order.",
    mistake: "Picking a hash table (no order) or a sorted array (decrease-key is O(n) to re-sort).",
    takeaway: "Dijkstra’s efficient implementation needs decrease-key; that’s a heap (or Fibonacci heap) operation.",
  },
  cs570_q3_avl: {
    why: "AVL and red-black trees rebalance so height is O(log n) after every update.",
    mistake: "Naming an ordinary BST or a heap (heaps are not ordered search trees).",
    takeaway: "“Balanced BST” is the search-tree answer; heaps answer priority-queue questions.",
  },
  cs570_q3_match: {
    why: "Heaps excel at repeated extract-min; chaining hashes give expected O(1) lookup; balanced BSTs iterate in key order; an unsorted array inserts in O(1) and searches in O(n).",
    mistake: "Assigning ordered iteration to a hash table (buckets are unordered).",
    takeaway: "Pick the structure that matches the operation you will run most.",
  },

  cs570_q4_int: {
    why: "Earliest-finish is optimal for unweighted interval scheduling: the first job that frees the resource as soon as possible leaves the most room for later jobs.",
    mistake: "Earliest start or shortest interval — both have simple counterexamples.",
    takeaway: "Greedy choice must match the theorem; “sounds greedy” is not a proof.",
  },
  cs570_q4_knap: {
    why: "Density-greedy can skip a slightly less dense item that fills the knapsack better; 0/1 knapsack needs DP (or exponential search).",
    mistake: "Confusing 0/1 knapsack with fractional knapsack, where density greedy is optimal.",
    takeaway: "The 0/1 constraint is why greedy fails; fractions restore greedy.",
  },
  cs570_q4_huff: {
    why: "Huffman’s construction yields a prefix-free (prefix) code: no codeword is a prefix of another, so decoding is unique.",
    mistake: "Calling it a “block code” or “Hamming code.”",
    takeaway: "Prefix-free ⇔ instantaneous decoding with the tree.",
  },
  cs570_q4_proof: {
    why: "Classic greedy proofs are exchange (swap a greedy job into an optimum) or stay-ahead (greedy is always at least as far along).",
    mistake: "Invoking the Master Theorem or NP reductions — those are different lectures.",
    takeaway: "If you cannot write an exchange or stay-ahead argument, the greedy algorithm may be wrong.",
  },
  cs570_q4_frac: {
    why: "With fractions allowed, filling by value/weight density is optimal (exchange: replacing a less-dense slice improves the objective).",
    mistake: "Applying the same claim to 0/1 knapsack.",
    takeaway: "Same objective, different feasible set → different algorithm.",
  },
  cs570_q4_jobs: {
    why: "Earliest-finish takes the job that ends at 2, then the only remaining compatible job is the one that ends at 9, for two jobs. The others all pairwise overlap.",
    mistake: "Selecting three jobs that cannot all be compatible under the overlap statement.",
    takeaway: "Simulate the greedy: sort by finish time, take a job iff it does not overlap the last taken.",
  },
  cs570_q4_huff2: {
    why: "Each step extracts the two lightest (rarest) nodes and makes them siblings under a new parent.",
    mistake: "Merging the two most frequent symbols — that would build a badly unbalanced, non-optimal tree.",
    takeaway: "Huffman always merges the current two smallest weights.",
  },
  cs570_q4_safe: {
    why: "The greedy-choice property says some optimum contains the greedy first move, so you can commit to it and recurse.",
    mistake: "Calling it optimal substructure only — you need both properties.",
    takeaway: "Greedy-choice + optimal substructure = greedy algorithm; overlapping subproblems = DP.",
  },
  cs570_q4_order: {
    why: "Huffman is: leaves from frequencies, repeatedly extract two lightest, parent weight = sum, stop at one tree and read bits from the root.",
    mistake: "Reading codes before the tree is finished, or merging heaviest nodes first.",
    takeaway: "The tree is the algorithm; codes are a walk from the finished root.",
  },
  cs570_q4_essay: {
    answer:
      "Example: items (w,v) = (5,5), (4,4), (4,4), capacity 8. Densities are all 1, so greedy-by-density might take (5,5) and then stop (remaining 3 cannot fit a 4), value 5. Optimal is the two weight-4 items, value 8. Any similar instance where a high-density item blocks two slightly worse items also works.",
    why: "A counterexample must show greedy’s set and a strictly better feasible set; numbers should be small enough to check by hand.",
    mistake: "Using fractional knapsack (greedy is optimal there) or giving weights that still make greedy optimal.",
    takeaway: "One solid numeric counterexample beats a vague “greedy can fail.”",
  },

  cs570_q5_bfs: {
    why: "On an unweighted graph, BFS layers are hop distances, so the BFS tree encodes shortest paths in number of edges.",
    mistake: "Saying BFS computes an MST or all-pairs distances (Floyd–Warshall) or a topo order of every digraph (need a DAG).",
    takeaway: "Unweighted shortest paths → BFS; nonnegative weights → Dijkstra; negatives → Bellman–Ford.",
  },
  cs570_q5_dijneg: {
    why: "Dijkstra’s proof needs nonnegative weights so that the first time a vertex is extracted it is finalized. A negative edge can improve a path after that.",
    mistake: "Thinking “no negative cycle” is enough (that’s Bellman–Ford’s hypothesis, not Dijkstra’s).",
    takeaway: "Nonnegative ≠ no negative cycle. Dijkstra forbids negative edges entirely.",
  },
  cs570_q5_mst: {
    why: "Kruskal and Prim both compute an MST of a connected undirected graph. Bellman–Ford and Floyd–Warshall are shortest-path algorithms, not MST algorithms.",
    mistake: "Selecting Floyd–Warshall because it “looks at all pairs of edges.”",
    takeaway: "MST = cut property; shortest paths = relaxation.",
  },
  cs570_q5_topo: {
    why: "DFS finishing times (or a source-queue Kahn pass) produce a topological order of a DAG.",
    mistake: "Naming BFS or Dijkstra.",
    takeaway: "Topo order exists iff the digraph is acyclic.",
  },
  cs570_q5_cross: {
    why: "In undirected graphs, every non-tree edge in DFS is a back edge to an ancestor; cross edges appear in directed DFS.",
    mistake: "Importing the directed classification (tree/back/forward/cross) unchanged into the undirected case.",
    takeaway: "Undirected DFS: tree + back. Directed DFS: add forward and cross.",
  },
  cs570_q5_bf: {
    why: "A shortest path has at most n − 1 edges, so n − 1 rounds of relaxing every edge suffice; a last round detects negative cycles.",
    mistake: "n rounds as the main loop, or m rounds.",
    takeaway: "n − 1 relax-all-edges passes, then one more to test for a negative cycle.",
  },
  cs570_q5_cut: {
    why: "The cut property: a lightest edge with exactly one end in S is in some MST, which justifies both Prim and Kruskal.",
    mistake: "Calling it the “cycle property” (that’s the dual: the heaviest edge on a cycle is not needed).",
    takeaway: "Cut property grows a forest; cycle property prunes a graph.",
  },
  cs570_q5_v: {
    why: "Any tree on n vertices has exactly n − 1 edges. For n = 10 that is 9.",
    mistake: "n or n − 2 (path vs. forest).",
    takeaway: "Connected + n − 1 edges ⇔ tree (on finite undirected graphs).",
  },
  cs570_q5_alg: {
    why: "Dijkstra: nonnegative single-source. Bellman–Ford: negatives and cycle detection. Floyd–Warshall: simple Θ(n³) all-pairs. BFS: hop distance.",
    mistake: "Running Dijkstra on a graph you were told has a negative edge.",
    takeaway: "State the weight hypothesis before you name the algorithm.",
  },
  cs570_q5_essay: {
    answer:
      "Vertices s, a, t. Edges s→t weight 2, s→a weight 0, a→t weight −1 (no cycle). Dijkstra from s may finalize t at distance 2 via s→t before it uses a, and never repairs it. True distances: δ(s)=0, δ(a)=0, δ(t)=−1. Any similar “negative shortcut after a zero-weight prefix” works; include the distances.",
    why: "The example must have a negative edge, no negative cycle, and Dijkstra’s extract-min order finishing a vertex too early.",
    mistake: "Introducing a negative cycle (then no shortest paths exist) or using only nonnegative weights (Dijkstra is correct).",
    takeaway: "Dijkstra’s invariant is “finalized vertices have true δ”; a later negative edge can violate it.",
  },
  cs570_q5_upload: {
    answer:
      "Model BFS tree rooted at s (ignore edge weights; BFS uses hop count). One valid tree: tree edges s—a (distance 1), s—b (distance 1), a—c (distance 2), b—d (distance 2), c—t (distance 3). Distances: s:0, a:1, b:1, c:2, d:2, t:3. An equally correct tree may use d—t instead of c—t (still distance 3). Label every tree edge and every hop distance. Non-tree edges (a—b, c—d, and the unused s–t path edges) must not be drawn as tree edges.",
    why: "BFS grows layers by unweighted adjacency. From s the first layer is {a,b}, the second is {c,d}, and t is first reached at hop 3. Weights on the figure are for later shortest-path questions, not for this BFS tree.",
    mistake: "Drawing a shortest-path tree for the labeled weights (Dijkstra/Prim style) instead of an unweighted BFS tree, or omitting hop distances, or including cross edges as tree edges.",
    takeaway: "BFS tree = hop layers from the source. If two vertices first reach t at the same layer, either parent is acceptable.",
  },

  cs570_q6_dna: {
    why: "DP pays off when subproblems overlap and an optimum is assembled from optima of smaller subproblems (optimal substructure).",
    mistake: "Using DP when subproblems are independent (plain D&C) or when the problem is NP-complete with no helpful structure.",
    takeaway: "Overlap + optimal substructure → DP; overlap alone is memoized recursion, not a new algorithm family.",
  },
  cs570_q6_lcs: {
    why: "The standard LCS table is (n+1)×(m+1) and each cell is O(1) work, so Θ(nm) time and space (space can be reduced).",
    mistake: "Claiming Θ(n+m) (that would be a linear scan, not LCS).",
    takeaway: "Two string indices ⇒ a 2-D table of size Θ(nm).",
  },
  cs570_q6_rod: {
    why: "The usual recurrence tries a first cut (or first piece length) i and then uses the optimum of the remaining n−i.",
    mistake: "Looping over “price” or “number of cuts” instead of the cut position/length.",
    takeaway: "Name the first decision; the rest is already solved.",
  },
  cs570_q6_knap: {
    why: "DP state is (item i, remaining capacity w); there are Θ(nW) states and O(1) work each, so Θ(nW).",
    mistake: "Θ(n+W) (too small) or Θ(2^n) as the DP time (that is the subset enumeration).",
    takeaway: "0/1 knapsack DP is pseudo-polynomial: polynomial in n and W, not in the bit length of W.",
  },
  cs570_q6_rec: {
    why: "You can walk backward from K(n,m) by recomputing which predecessor produced each cell, so you need not store arrows.",
    mistake: "Thinking reconstruction requires an extra O(nm) pointer matrix (convenient, not required).",
    takeaway: "Storing choices is optional; recomputing a cell’s argmax is O(1) per step along one solution.",
  },
  cs570_q6_fib: {
    why: "Naive F(n) has L(n)=L(n−1)+L(n−2) leaves with L(0)=L(1)=1, so L(5)=8 calls to F(0) or F(1).",
    mistake: "Counting all nodes in the tree, or using F(5)=5.",
    takeaway: "The exponential blow-up is exactly these overlapping leaf calls — memoize them.",
  },
  cs570_q6_dag: {
    why: "In a DAG, relaxing edges in topological order processes every predecessor before a vertex, so one pass computes single-source shortest (or longest) paths.",
    mistake: "Using Dijkstra’s extract-min order when negatives are allowed, or a random order.",
    takeaway: "DAG shortest paths = topo + one relaxation per edge.",
  },
  cs570_q6_sub: {
    why: "Optimal substructure: an optimum contains optima of subproblems. Without it, combining subproblem answers is not valid.",
    mistake: "Writing “overlapping subproblems” (necessary for DP to be faster than D&C, but not the blank).",
    takeaway: "Both properties: substructure to be correct, overlap to be worth tabulating.",
  },
  cs570_q6_order: {
    why: "The write-up we grade is: define the state, recurrence + bases, evaluation order / table shape, reconstruct one solution, then time and space.",
    mistake: "Jumping to code or runtime before the state is defined.",
    takeaway: "If the state is wrong, every later part is wrong — start there.",
  },
  cs570_q6_essay: {
    answer:
      "Let K(i,w) be the best value using a subset of items 1..i with capacity w. Bases: K(0,w)=0 for all w≥0, and K(i,w)=−∞ or 0 as you prefer for w<0 (usually skip those states). Recurrence: if w_i > w then K(i,w)=K(i−1,w); else K(i,w)=max(K(i−1,w), v_i + K(i−1, w−w_i)).",
    why: "The standard 0/1 recurrence either skips item i or takes it and cannot take it again.",
    mistake: "Writing the unbounded/knapsack-with-repeats recurrence K(w)=max_i v_i+K(w−w_i), or omitting bases.",
    takeaway: "0/1 steps down i; unbounded loops on the same i.",
  },

  cs570_q7_np: {
    why: "NP is the class of decision problems with short certificates that a deterministic poly-time verifier can check. It is not “exponential time” or “unsolvable.”",
    mistake: "Equating NP with NP-complete, or with “hard.” P ⊆ NP; many problems in NP are easy.",
    takeaway: "NP = poly-time verifiable yes-instances, not “non-polynomial.”",
  },
  cs570_q7_dir: {
    why: "To show B is NP-hard you reduce a known NP-hard A to B (A ≤p B): a poly-time solver for B would yield one for A.",
    mistake: "Reducing B to A (that shows A is at least as hard as B — the wrong direction for proving B hard).",
    takeaway: "Known-hard ≤p unknown. Arrow points toward the problem you want to prove hard.",
  },
  cs570_q7_sat: {
    why: "3-SAT is the usual starting NP-complete problem (Cook–Levin gives SAT/CIRCUIT-SAT; Garey–Johnson style proofs go 3-SAT → Independent Set → …).",
    mistake: "2-SAT (that is in P) or “SAT” without the 3.",
    takeaway: "Start from 3-SAT unless the problem is already a known Karp descendant.",
  },
  cs570_q7_p: {
    why: "If any NP-complete problem is in P, then every problem in NP is in P, so P = NP.",
    mistake: "Concluding P ≠ NP, or saying only that one problem becomes easy.",
    takeaway: "NP-complete problems are all poly-time equivalent.",
  },
  cs570_q7_vc: {
    why: "Vertex-cover (decision: exists a cover of size ≤ k) is NP-complete; it is in NP and 3-SAT (or Independent Set) reduces to it.",
    mistake: "Confusing the decision version with the optimization version’s approximation status.",
    takeaway: "Decision VC is NP-complete; the 2-approx is for the optimization problem.",
  },
  cs570_q7_approx: {
    why: "Take a maximal matching; put both endpoints of every matched edge in the cover. Size is at most twice OPT because OPT must hit every matched edge.",
    mistake: "Picking a random vertex or the MST.",
    takeaway: "Maximal matching → 2-approx vertex cover; the proof is one line of charging.",
  },
  cs570_q7_karp: {
    why: "Karp (many-one, mapping) reductions map instances of A to instances of B in poly time; Cook reductions are more general Turing reductions.",
    mistake: "Calling them Cook reductions or “Turing reductions.”",
    takeaway: "Course NP-completeness proofs are Karp reductions unless stated otherwise.",
  },
  cs570_q7_undir: {
    why: "Undirected Hamiltonian cycle is NP-complete (reduction from the directed version or from vertex cover / 3-SAT via standard gadgets).",
    mistake: "Thinking undirected Hamiltonicity is in P because Eulerian cycles are.",
    takeaway: "Euler: degrees. Hamilton: NP-complete. Do not mix them.",
  },
  cs570_q7_essay: {
    answer:
      "Reducing Independent Set to 3-SAT (IS ≤p 3-SAT) shows that 3-SAT is at least as hard as IS. Since 3-SAT is already NP-complete, that does not prove IS is NP-hard — it would follow if we already knew IS were NP-hard, which is circular. To prove IS NP-complete you must (1) put IS in NP (a k-vertex set is a short certificate) and (2) reduce a known NP-complete problem to IS, e.g. 3-SAT ≤p IS. The student reversed the arrow.",
    why: "Reduction direction is the most common 570 NP-completeness bug; the write-up should name both “in NP” and the correct arrow.",
    mistake: "Saying the student proved IS is in P, or that the reduction is merely “not polynomial.”",
    takeaway: "To prove B hard: A ≤p B for known-hard A. Never B ≤p A.",
  },

  cs570_pf_master: {
    why: "a=8, b=2, f(n)=n², n^{log_b a}=n³. Case 1: f = O(n^{3−ε}) with ε=1, so T(n)=Θ(n³).",
    mistake: "Θ(n² log n) (that would be case 2 if f were n³) or Θ(n²).",
    takeaway: "Compare f(n) to n^{log_b a}, not to n² blindly.",
  },
  cs570_pf_stable: {
    why: "Heapsort swaps the root with a later leaf and heapifies; equal keys can change order, so it is not stable.",
    mistake: "Confusing heapsort with mergesort (stable) or thinking in-place implies stable.",
    takeaway: "Stable textbook sorts: mergesort and insertion sort. Not heapsort or quicksort.",
  },
  cs570_pf_dijk: {
    why: "Dijkstra requires nonnegative edge weights (and a source). It does not need a DAG, an adjacency matrix, or integer weights.",
    mistake: "Requiring a DAG (that’s the topo shortest-path algorithm).",
    takeaway: "Nonnegative → Dijkstra; DAG → topo relax; negatives → Bellman–Ford.",
  },
  cs570_pf_kos: {
    why: "Kosaraju: DFS to get a finish-time order, reverse all edges, DFS in that order; each tree is an SCC.",
    mistake: "Tarjan (one DFS + low-link) or Kahn (topo of a DAG).",
    takeaway: "Two DFS passes, second on the transpose, is Kosaraju.",
  },
  cs570_pf_lcs: {
    why: "ABCBDAB vs BDCABA has LCS length 4 (e.g. BCBA or BDAB). The DP table’s bottom-right entry is 4.",
    mistake: "Length 3 (a common subsequence that is not longest) or 5 (not feasible).",
    takeaway: "Fill the LCS table; don’t just hunt for a subsequence by eye on exam day.",
  },
  cs570_pf_p: {
    why: "NP-complete problems are in NP. If P = NP then every problem in NP, including the NP-complete ones, is in P.",
    mistake: "Thinking NP-complete problems would stay hard even if P = NP.",
    takeaway: "P = NP collapses the distinction; P ≠ NP is the conjecture, not a theorem.",
  },
  cs570_pf_match: {
    why: "Unweighted intervals → earliest-finish greedy. Edit distance → DP on prefixes. MST → cut property / Kruskal or Prim. Independent set (decision) → NP-complete via 3-SAT.",
    mistake: "Putting MST with DP or edit distance with greedy.",
    takeaway: "Technique first: greedy, DP, graph, or reduction.",
  },
  cs570_pf_essay: {
    answer:
      "Dijkstra: invariant is that every vertex extracted from the priority queue has its true shortest-path distance; it requires nonnegative weights — a negative edge can improve a path after a vertex is finalized. Bellman–Ford: after k relaxation rounds, every vertex whose shortest path uses at most k edges has the correct distance; it is incorrect (distances undefined) in the presence of a negative cycle reachable from the source, detected by a successful relaxation on round n.",
    why: "A full-credit paragraph names the algorithm, the invariant, and the exact hypothesis that makes the invariant fail.",
    mistake: "Stating only “Dijkstra is faster” without the nonnegative-weight invariant, or blaming Bellman–Ford on DAG-ness.",
    takeaway: "Algorithms are theorems with hypotheses; quote the hypothesis.",
  },
};

function attachFeedback(q: QuizQuestion, parts: FeedbackParts): QuizQuestion {
  return {
    ...q,
    correctFeedback: formatQuestionFeedback(parts),
    incorrectFeedback: formatIncorrectQuestionFeedback(parts),
    feedback: formatQuestionFeedback(parts),
  };
}

/** Attach Answer / Why / Common mistake / Takeaway to every scored CSCI 570 question. */
export function enrichCs570QuizQuestions(questions: QuizQuestion[]): QuizQuestion[] {
  return questions.map((q) => {
    if (q.type === "note" || q.type === "group") return q;
    const extra = CS570_QUESTION_FEEDBACK[q.id];
    const answer = extra?.answer?.trim() || keyAnswer(q);
    const parts: FeedbackParts = extra
      ? {
          answer: answer || extra.answer || "See the lecture notes for a model solution.",
          why: extra.why,
          mistake: extra.mistake,
          takeaway: extra.takeaway,
        }
      : {
          answer: answer || "See the lecture notes for a model solution.",
          why: "This is the answer key for the question.",
          takeaway: "Review the matching CSCI 570 lecture before the next quiz.",
        };
    return attachFeedback(q, parts);
  });
}
