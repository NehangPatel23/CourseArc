/**
 * Detailed, structured post-grade feedback for seeded CS question banks.
 * Keys match suffixes in demoQuestionBanks.ts (e.g. "dsa1", "a18").
 *
 * Format (rendered with section headings in the quiz UI):
 *   Answer: …
 *   Why: …
 *   Common mistake: …
 *   Takeaway: …
 */

export type FeedbackParts = {
  answer: string;
  why: string;
  mistake?: string;
  takeaway?: string;
};

/** Build multi-line feedback the review UI can sectionize. */
export function formatQuestionFeedback(parts: FeedbackParts): string {
  const blocks = [
    `Answer: ${parts.answer.trim()}`,
    ``,
    `Why:`,
    parts.why.trim(),
  ];
  if (parts.mistake?.trim()) {
    blocks.push(``, `Common mistake:`, parts.mistake.trim());
  }
  if (parts.takeaway?.trim()) {
    blocks.push(``, `Takeaway:`, parts.takeaway.trim());
  }
  return blocks.join("\n");
}

/** Mistake-first framing for incorrect / partial answers. */
export function formatIncorrectQuestionFeedback(parts: FeedbackParts): string {
  const blocks = [
    `Answer: ${parts.answer.trim()}`,
  ];
  if (parts.mistake?.trim()) {
    blocks.push(``, `Common mistake:`, parts.mistake.trim());
  }
  blocks.push(``, `Why:`, parts.why.trim());
  if (parts.takeaway?.trim()) {
    blocks.push(``, `Takeaway:`, parts.takeaway.trim());
  }
  return blocks.join("\n");
}

export const DEMO_QUESTION_FEEDBACK_PARTS: Record<string, FeedbackParts> = {
  // —— Data Structures ——
  dsa1: {
    answer: "Array list / dynamic array",
    why: "Dynamic arrays over-allocate capacity and occasionally double when full. Spreading the cost of rare O(n) copies across many inserts makes append amortized O(1).",
    mistake: "Choosing a singly linked list: appending without a stored tail pointer requires walking the whole list (O(n)).",
    takeaway: "Amortized cost ≠ worst-case cost of every single operation—think about sequences of operations.",
  },
  dsa2: {
    answer: "O(log n)",
    why: "A balanced BST keeps height Θ(log n). Each comparison moves to the left or right child and roughly halves the remaining search space.",
    mistake: "Assuming O(1) like a hash table, or O(n) which is the worst case for an unbalanced (degenerate) tree.",
    takeaway: "Balance is what buys logarithmic search; without it, a BST can become a linked list.",
  },
  dsa3: {
    answer: "FIFO (first-in, first-out)",
    why: "A queue enqueues at the back and dequeues from the front, so the earliest arrival leaves first—exactly FIFO order.",
    mistake: "Confusing queues with stacks (LIFO) or heaps (priority order).",
    takeaway: "Match the ADT to the ordering you need: FIFO → queue, LIFO → stack, priority → heap.",
  },
  dsa4: {
    answer: "Stack",
    why: "Undo must reverse the most recent action first. Push each action; pop to undo—classic LIFO.",
    mistake: "Using a queue would undo the oldest action first, which is the opposite of undo semantics.",
    takeaway: "Whenever “last action first” appears (undo, matching brackets, DFS recursion), reach for a stack.",
  },
  dsa5: {
    answer: "O(1) expected",
    why: "With a good hash function and bounded load factor, each key lands in a small bucket, so average lookup work is constant.",
    mistake: "Citing O(n) as the typical case—that’s the pathological all-collide worst case, not the expected case under standard assumptions.",
    takeaway: "Hash tables give expected O(1); always mention “expected” and the load-factor assumption.",
  },
  dsa6: {
    answer: "The root",
    why: "Min-heap order requires every parent ≤ its children, so the global minimum can only sit at the root.",
    mistake: "Thinking the minimum is at a leaf—that’s where large values tend to go, not the minimum.",
    takeaway: "Heap shape (complete tree) + heap order (parent vs children) are separate invariants.",
  },
  dsa7: {
    answer: "Sparse graphs",
    why: "Adjacency lists use Θ(V + E) space. Matrices always use Θ(V²). When E ≪ V², lists save memory and make neighbor iteration proportional to degree.",
    mistake: "Preferring lists for dense/complete graphs—there matrices can be simpler and cache-friendly.",
    takeaway: "Choose representation based on density: sparse → lists, dense → matrix (often).",
  },
  dsa8: {
    answer: "Shortest path in number of edges (unweighted)",
    why: "BFS explores layer by layer. The first time you reach a vertex, you used the fewest hops from the source.",
    mistake: "Claiming BFS finds MSTs or works unchanged for arbitrary weighted shortest paths (that’s Dijkstra/Bellman-Ford).",
    takeaway: "Unweighted / equal-weight edges → BFS; non-negative weights → Dijkstra; negatives → Bellman-Ford.",
  },
  dsa9: {
    answer: "Inorder",
    why: "Inorder on a BST visits left subtree, then node, then right—producing keys in sorted order by the BST property.",
    mistake: "Using preorder/postorder/level-order when you need sorted output—they serve different purposes (serialize, delete, BFS listing).",
    takeaway: "BST + inorder = sorted enumeration.",
  },
  dsa10: {
    answer: "False",
    why: "To reach index i you follow i next pointers. That’s Θ(i) = O(n) in the worst case—not constant time.",
    mistake: "Assuming linked lists behave like arrays for random access.",
    takeaway: "Arrays: O(1) index, costly insert in middle. Linked lists: O(1) insert/delete given a pointer, slow indexing.",
  },
  dsa11: {
    answer: "True",
    why: "AVL trees rebalance so sibling subtree heights differ by at most 1, keeping overall height Θ(log n). Search then follows O(log n) edges.",
    mistake: "Thinking any BST guarantees O(log n)—only balanced variants do.",
    takeaway: "AVL/red-black/B-trees exist specifically to protect the logarithmic height invariant.",
  },
  dsa12: {
    answer: "True",
    why: "A ring buffer stores head/tail indices into a fixed array and wraps with modular arithmetic, giving O(1) enqueue/dequeue without shifting elements.",
    mistake: "Thinking you must shift the entire array on every dequeue (that’s a naïve array queue).",
    takeaway: "Circular buffers are the standard fixed-capacity queue implementation in systems code.",
  },
  dsa13: {
    answer: "Stack",
    why: "Push and pop both act on the same end (the top), which defines LIFO behavior.",
    mistake: "Answering “queue,” which uses opposite ends for insert vs remove.",
    takeaway: "Name the ADT by its interface: one-end push/pop → stack.",
  },
  dsa14: {
    answer: "Chaining (separate chaining)",
    why: "Each table slot holds a list (or other secondary structure) of all keys that hashed there. Lookup scans that bucket’s chain.",
    mistake: "Confusing chaining with open addressing (linear/quadratic probing, double hashing), which stores collisions in other primary slots.",
    takeaway: "Two families of collision resolution: chaining vs open addressing—know trade-offs (clustering, memory, deletes).",
  },
  dsa15: {
    answer: "Θ(log n)  (also accept lg n / log₂(n))",
    why: "A complete binary tree fills levels left-to-right. About half the nodes sit near the bottom, so height grows like log₂(n).",
    mistake: "Writing Θ(n)—that would be a skewed path-like tree, not a complete one.",
    takeaway: "Shape drives height: complete/balanced → logarithmic; skewed → linear.",
  },
  dsa16: {
    answer: "11",
    why: "Any tree on n vertices is connected and acyclic, so it has exactly n − 1 edges. For n = 12 → 11 edges.",
    mistake: "Using n or n + 1 (those would create a disconnected graph or a cycle).",
    takeaway: "Memorize: tree ⇒ |E| = |V| − 1.",
  },
  dsa17: {
    answer: "AVL, red-black, and B-tree",
    why: "All three maintain balance so height stays logarithmic. Linked lists are sequential structures, not balanced search trees.",
    mistake: "Including linked list because it “stores ordered data”—order alone doesn’t give balanced search.",
    takeaway: "Self-balancing search trees keep operations efficient under adversarial inserts.",
  },
  dsa18: {
    answer: "O(α(n)) amortized",
    why: "Path compression flattens find paths; union-by-rank keeps trees shallow. Together the amortized cost per op is inverse-Ackermann α(n)—effectively constant for any realistic n.",
    mistake: "Saying O(n) per operation or claiming strict O(1) worst-case for every call.",
    takeaway: "Union-Find is “almost O(1)” in practice—α(n) ≤ 4 for astronomical n.",
  },
  dsa19: {
    answer: "Advance while node.next exists, then return node",
    why: "The last node is the only one with next == None. Loop: while node and node.next: node = node.next; return node.",
    mistake: "Returning node.next (that’s None) or failing to handle an empty list (node is None).",
    takeaway: "Always decide empty-list behavior before walking pointers.",
  },
  dsa20: {
    answer: "Normalize spaces, then compare to reverse",
    why: "t = s.replace(' ', ''); return t == t[::-1] checks the palindrome property after ignoring spaces, keeping case as specified.",
    mistake: "Forgetting to strip spaces, or lowercasing when the prompt said case-sensitive.",
    takeaway: "Separate cleaning (spaces) from the core predicate (equals its reverse).",
  },

  // —— Algorithms ——
  a1: {
    answer: "T(n) = a T(n/b) + f(n)",
    why: "The Master Theorem applies to divide-and-conquer recurrences that spawn a subproblems of size n/b plus combine work f(n).",
    mistake: "Applying it to T(n)=T(n−1)+1 or irregular forms without transforming them first.",
    takeaway: "Identify a, b, and f(n), then compare f(n) to n^{log_b a}.",
  },
  a2: {
    answer: "Non-negative edge weights",
    why: "Dijkstra permanently finalizes a vertex’s distance when it’s popped. A later negative edge could create a shorter path, violating that invariant.",
    mistake: "Believing Dijkstra works for arbitrary weights—that’s Bellman-Ford / Johnson territory.",
    takeaway: "Algorithm ↔ assumption: Dijkstra needs w ≥ 0.",
  },
  a3: {
    answer: "Union-Find",
    why: "Kruskal sorts edges by weight and adds an edge iff its endpoints lie in different components—Union-Find tests/merges those components in nearly O(1).",
    mistake: "Saying DFS or Bellman-Ford; those solve different problems.",
    takeaway: "MST via sorted edges + cycle check = Kruskal + Union-Find.",
  },
  a4: {
    answer: "NP-hard",
    why: "NP-complete = in NP + NP-hard. Being NP-hard means every NP problem poly-time reduces to it.",
    mistake: "Saying “P-complete” or “undecidable”—different complexity classes.",
    takeaway: "NP-complete sits at the hardest problems inside NP.",
  },
  a5: {
    answer: "NP-complete",
    why: "Decision TSP (“exists a tour of cost ≤ K?”) is a classic NP-complete problem. The optimization version is NP-hard.",
    mistake: "Claiming it’s in P—no poly-time algorithm is known (and it’s NP-complete).",
    takeaway: "Decision vs optimization: decision TSP ∈ NPC; optimization is NP-hard.",
  },
  a6: {
    answer: "Top-down dynamic programming (memoization)",
    why: "Memoization caches recursive results so overlapping subproblems are solved once—defining top-down DP.",
    mistake: "Calling memoization “greedy”—greedy never revisits subproblems with a table.",
    takeaway: "Top-down = recursion + cache; bottom-up = iterative table fill.",
  },
  a7: {
    answer: "Ω(n log n)",
    why: "Any comparison sort’s decision tree must have at least n! leaves. Height is ≥ log₂(n!) = Ω(n log n).",
    mistake: "Citing Ω(n)—that’s only an information-theoretic lower bound if you ignore permutation counting.",
    takeaway: "Mergesort/heapsort match the Ω(n log n) bound; counting/radix sort escape by not being comparison-based.",
  },
  a8: {
    answer: "Negative cycles reachable from the source",
    why: "After |V|−1 successful relaxation rounds, distances are final if no negative cycle is reachable. One more improvement ⇒ such a cycle exists.",
    mistake: "Thinking Bellman-Ford only finds shortest paths and cannot detect cycles.",
    takeaway: "Extra relaxation pass = negative-cycle detector.",
  },
  a9: {
    answer: "False",
    why: "Greedy picks locally best choices. Global optimality needs a proof (exchange argument, matroid, etc.). Many problems have greedy counterexamples.",
    mistake: "Assuming “greedy always works” because it worked for activity selection or MST.",
    takeaway: "Greedy is a technique, not a guarantee—prove it or don’t claim optimality.",
  },
  a10: {
    answer: "True",
    why: "DP needs (1) optimal substructure and (2) overlapping subproblems so caching helps. Missing either → DP isn’t the right tool.",
    mistake: "Thinking DP only needs a recursive formula without overlap (that’s just divide-and-conquer).",
    takeaway: "Overlap → memoize; optimal substructure → combine subanswers safely.",
  },
  a11: {
    answer: "True",
    why: "Any deterministic poly-time TM is also a nondeterministic one (ignore choices). So P ⊆ NP. Equality is the open question.",
    mistake: "Claiming P ⊆ NP is unknown—the ⊆ direction is known; = is unknown.",
    takeaway: "Remember: P ⊆ NP is proven; P = NP is not.",
  },
  a12: {
    answer: "Dynamic programming (after topological sort)",
    why: "In a DAG, process vertices in topo order and relax outgoing edges once each → O(V+E) single-source shortest paths.",
    mistake: "Running Dijkstra unnecessarily, or forgetting you need a topo order first.",
    takeaway: "DAGs unlock linear-time shortest paths via DP + topo sort.",
  },
  a13: {
    answer: "Kahn’s algorithm",
    why: "Kahn repeatedly removes indegree-0 vertices and decrements neighbors—O(V+E) topological sort.",
    mistake: "Naming only DFS topo sort; both are valid, but the indegree method is specifically Kahn.",
    takeaway: "Two standard topo sorts: Kahn (BFS/indegrees) and DFS finishing times.",
  },
  a14: {
    answer: "Θ(n log n)",
    why: "log n split levels × Θ(n) merge work per level ⇒ Θ(n log n).",
    mistake: "Writing O(n²) (that’s naïve nested merges without the divide structure).",
    takeaway: "Divide-and-conquer sorting’s sweet spot is n log n.",
  },
  a15: {
    answer: "16",
    why: "At the root, non-recursive work is f(n)=n. For n=16 that’s exactly 16 before recursing into the two halves.",
    mistake: "Summing the whole recurrence instead of only the top-level f(n).",
    takeaway: "Recursion trees: read the question—top level vs total work are different.",
  },
  a16: {
    answer: "Kruskal, Prim, and Borůvka",
    why: "All three compute MSTs. Dijkstra computes shortest paths, not spanning trees (though Prim resembles Dijkstra’s selection pattern).",
    mistake: "Including Dijkstra because it “picks light edges.”",
    takeaway: "MST ≠ shortest-path tree in general graphs.",
  },
  a17: {
    answer: "Dynamic programming",
    why: "Exact 0/1 knapsack uses a DP table over items × capacity (pseudo-polynomial). Greedy-by-density is for fractional knapsack.",
    mistake: "Using value-density greedy for 0/1—counterexamples exist.",
    takeaway: "Fractional → greedy; 0/1 exact → DP (or ILP/approx).",
  },
  a18: {
    answer: "Settled distances can be wrong when negatives exist",
    why: "Dijkstra never reopens a finalized vertex. Example: s→a (5), s→b (0), b→a (−10). After popping a at distance 5, the true distance via b is −10, which the algorithm won’t fix.",
    mistake: "Giving a vague answer without a concrete tiny graph, or only saying “negatives are bad” without the invariant.",
    takeaway: "Name the invariant, break it with a 3-node example, mention Bellman-Ford as the fix.",
  },
  a19: {
    answer: "Splay trees / dynamic tables",
    why: "Amortized analysis bounds average cost over a sequence (aggregate, accounting, potential). Dynamic arrays and splay trees are textbook examples.",
    mistake: "Associating amortized analysis with selection sort or bogosort.",
    takeaway: "When a rare expensive op pays for many cheap ones, think amortized.",
  },
  a20: {
    answer: "return set(a).issubset(b)  (or set(a) <= b)",
    why: "Converting a to a set and testing ⊆ checks membership of every element in b in expected linear time in |a|.",
    mistake: "Nested loops without sets (slow) or using list membership repeatedly.",
    takeaway: "Set operations express subset checks cleanly and efficiently.",
  },

  // —— Programming ——
  p1: {
    answer: "{}",
    why: "In Python literals, {} creates an empty dict. Empty set requires set(); [] is list; () is tuple.",
    mistake: "Writing set() when you wanted a dict, or assuming {} is a set (it isn’t when empty).",
    takeaway: "Remember the empty-set gotcha: use set(), not {}.",
  },
  p2: {
    answer: "Value and type (strict equality)",
    why: "=== compares without coercion. 1 === '1' is false; 1 == '1' may be true under ==.",
    mistake: "Thinking === only checks references (that’s closer to Object.is / same reference for objects, but === still compares primitives by value).",
    takeaway: "Prefer === in JS unless you intentionally want coercion.",
  },
  p3: {
    answer: "O(1) amortized",
    why: "Most appends write into free capacity. Occasional geometric resize is O(n) but rare; averaged cost stays constant.",
    mistake: "Saying every append is worst-case O(n).",
    takeaway: "Dynamic arrays: amortized analysis is the right lens for append.",
  },
  p4: {
    answer: "tuple",
    why: "Tuples are immutable sequences. Lists, dicts, and sets allow in-place mutation.",
    mistake: "Picking list because it’s “common”—common ≠ immutable.",
    takeaway: "Immutability enables hashing (tuple of hashables can be a dict key).",
  },
  p5: {
    answer: "Stack overflow / infinite recursion",
    why: "Each call pushes a frame. Without a base case, frames accumulate until the interpreter hits RecursionError or crashes.",
    mistake: "Saying it “deadlocks”—deadlock is about locks/waits, not unbounded recursion.",
    takeaway: "Every recursive function needs a reachable base case.",
  },
  p6: {
    answer: "True",
    why: "Python sequences index from 0: s[0] is the first element.",
    mistake: "Coming from 1-based languages (MATLAB, Lua) and off-by-one errors.",
    takeaway: "0-based indexing is the Python (and C/Java/JS) default.",
  },
  p7: {
    answer: "True",
    why: "Under ==, null and undefined are coerced and compare equal. Under === they differ.",
    mistake: "Assuming all equality operators behave like ===.",
    takeaway: "Know == coercion tables—or avoid ==.",
  },
  p8: {
    answer: "False",
    why: "PRIMARY KEY enforces uniqueness (and NOT NULL in standard SQL). Duplicates are rejected.",
    mistake: "Confusing PRIMARY KEY with a normal index that might allow duplicates.",
    takeaway: "PK ⇒ unique identifier for a row.",
  },
  p9: {
    answer: "def",
    why: "Python syntax: def name(params): body",
    mistake: "Using function/fn from other languages.",
    takeaway: "def for functions; class for classes; lambda for small anonymous expressions.",
  },
  p10: {
    answer: "git add -u",
    why: "-u (update) stages modifications and deletions to already-tracked paths.",
    mistake: "Using plain git add without paths (behavior depends on version/config) or forgetting -u won’t pick up brand-new untracked files.",
    takeaway: "Tracked updates → git add -u; new files → git add <path>.",
  },
  p11: {
    answer: "POST",
    why: "REST commonly creates resources with POST to a collection. PUT often means replace/create at a known URI (idempotent).",
    mistake: "Answering GET (read) or PATCH (partial update) for creation.",
    takeaway: "Map verbs: GET read, POST create, PUT replace, PATCH partial, DELETE remove.",
  },
  p12: {
    answer: "9",
    why: "In Python, ** is exponentiation: 2**3 = 8, then +1 → 9.",
    mistake: "Treating ** as XOR (that’s ^ in Python) or as string concat.",
    takeaway: "Python: ** power, ^ bitwise XOR, * multiply.",
  },
  p13: {
    answer: "True and False",
    why: "Python’s boolean literals are capitalized. true is a NameError; None is a separate singleton.",
    mistake: "Selecting true/None from JS/Java habits.",
    takeaway: "Python booleans: True/False only.",
  },
  p14: {
    answer: "return sum(xs)  (or sum(xs))",
    why: "sum iterates the iterable and adds elements—clear and idiomatic.",
    mistake: "Manual loops that forget an initializer or mishandle empty lists.",
    takeaway: "Prefer built-ins (sum, min, max) when they express intent.",
  },
  p15: {
    answer: "return Math.max(a, b)",
    why: "Math.max returns the larger of its numeric arguments.",
    mistake: "Using Math.min, or forgetting return so the function yields undefined.",
    takeaway: "Always return the value you compute in a non-void function.",
  },
  p16: {
    answer: "Base case n < 2 → 1; else n * factorial(n-1) (or iterative product)",
    why: "Factorial’s recurrence needs a clear base. Recursive and iterative solutions are both fine if correct for n ≥ 0.",
    mistake: "Missing base case, or returning 0 for n=0 (0! = 1).",
    takeaway: "0! = 1 is a common edge case—test it.",
  },
  p17: {
    answer: "One-pass hash map: value → index; probe target − x",
    why: "For each x, if need = target−x was seen, return indices; else store x. Expected O(n) time and O(n) space.",
    mistake: "O(n²) double loop without explaining trade-offs, or returning values instead of indices.",
    takeaway: "When you need “have I seen complement?”, reach for a hash set/map.",
  },
  p18: {
    answer: "Most (significant byte first)",
    why: "Big-endian stores the most significant byte at the lowest address; little-endian stores the least significant byte first.",
    mistake: "Swapping most/least—very common mix-up.",
    takeaway: "Mnemonic: big-endian = big end (MSB) first in memory.",
  },
  p19: {
    answer: "Python passes object references by value",
    why: "Pass-by-value copies the argument; pass-by-reference aliases the caller’s binding. Python copies the reference: mutating a mutable object is visible to the caller; rebinding the parameter name is not.",
    mistake: "Saying “Python is pass-by-reference” without the rebinding nuance.",
    takeaway: "Mutate shared object ≠ reassign local name. Illustrate with a list append vs lst = [] example.",
  },
  p20: {
    answer: "HAVING",
    why: "WHERE filters rows before grouping; HAVING filters groups after aggregation (e.g., COUNT(*) > 5).",
    mistake: "Using WHERE with aggregate conditions—SQL rejects that; HAVING is required.",
    takeaway: "Row filters → WHERE; group filters → HAVING.",
  },

  // —— Systems ——
  s1: {
    answer: "Illusion of a large contiguous address space",
    why: "Virtual memory maps virtual pages to physical frames, enabling isolation, swapping, and sparse mappings—not extra CPU cores by itself.",
    mistake: "Thinking VM primarily “makes disks faster.”",
    takeaway: "VM = translation + protection (+ paging), not magic speed.",
  },
  s2: {
    answer: "Process/thread register (CPU) state",
    why: "A context switch saves PC, stack pointer, general registers, etc., so the thread can resume later.",
    mistake: "Saying “only the heap” is saved—heap stays in memory; registers must be swapped.",
    takeaway: "Context = CPU-visible state needed to continue execution.",
  },
  s3: {
    answer: "Connection-oriented, reliable byte stream",
    why: "TCP handshakes, sequences, ACKs, retransmits, and delivers an ordered byte stream.",
    mistake: "Describing TCP like UDP (connectionless/unreliable).",
    takeaway: "TCP = reliable stream; UDP = datagram, best-effort.",
  },
  s4: {
    answer: "Low overhead / loss-tolerant, latency-sensitive apps",
    why: "UDP skips connection setup and reliability machinery—good for VoIP, games, DNS when rare loss is OK.",
    mistake: "Using UDP for file transfer without an application reliability layer.",
    takeaway: "Pick transport based on loss vs latency needs.",
  },
  s5: {
    answer: "Mutual exclusion, hold-and-wait, no preemption, circular wait",
    why: "These four Coffman conditions are necessary for deadlock. Preventing any one prevents deadlock.",
    mistake: "Listing only “circular wait” or confusing deadlock with starvation.",
    takeaway: "Deadlock ≠ starvation; know Coffman’s four by name.",
  },
  s6: {
    answer: "Temporal locality",
    why: "Temporal = reuse the same data/lines soon. Spatial = touch nearby addresses (same cache line).",
    mistake: "Swapping temporal and spatial definitions.",
    takeaway: "Caches exploit both; loops over arrays hit spatial; loop counters hit temporal.",
  },
  s7: {
    answer: "True",
    why: "IPv4 addresses are 32-bit values, usually written in dotted decimal.",
    mistake: "Confusing with IPv6 (128-bit).",
    takeaway: "IPv4 = 32 bits; IPv6 = 128 bits.",
  },
  s8: {
    answer: "False",
    why: "A mutex provides exclusive ownership: at most one locker at a time. That’s the point of mutual exclusion.",
    mistake: "Confusing mutexes with shared/reader locks or semaphores allowing counts > 1.",
    takeaway: "Mutex ⇒ exclusive; know RW-locks if you need concurrent readers.",
  },
  s9: {
    answer: "True",
    why: "TLS (as in HTTPS) typically runs over TCP. DTLS is the datagram-oriented variant for UDP.",
    mistake: "Thinking TLS replaces TCP rather than layering on it.",
    takeaway: "HTTPS ≈ HTTP + TLS on TCP.",
  },
  s10: {
    answer: "Domain Name System",
    why: "DNS is the distributed directory mapping names to records (A/AAAA, MX, CNAME, …).",
    mistake: "Expanding to unrelated networking acronyms.",
    takeaway: "DNS translates human names ↔ machine-usable records.",
  },
  s11: {
    answer: "SJF (shortest job first) / shortest next CPU burst",
    why: "SJF minimizes average waiting time if burst lengths are known. Practice often approximates with SRTF or exponential averaging.",
    mistake: "Naming round-robin—that optimizes fairness/latency differently.",
    takeaway: "Optimal average wait (known bursts) → SJF; reality → estimate bursts.",
  },
  s12: {
    answer: "Network layer",
    why: "IP is the OSI Network (Layer 3) protocol—routing between networks.",
    mistake: "Saying Transport (that’s TCP/UDP) or Data Link (frames).",
    takeaway: "L3 = IP routing; L4 = end-to-end transport.",
  },
  s13: {
    answer: "254 usable hosts (common textbook convention)",
    why: "A /24 has 256 addresses; typically 2 are reserved (network + broadcast), leaving 254 usable host addresses.",
    mistake: "Answering 256 or 255 without noting the usable-hosts convention asked here.",
    takeaway: "Usable hosts ≈ 2^(32−prefix) − 2 for classical Ethernet-style subnets.",
  },
  s14: {
    answer: "Round-robin, CFS, and priority scheduling",
    why: "These are CPU scheduling disciplines. Kruskal is a graph MST algorithm, not a scheduler.",
    mistake: "Including Kruskal because it “schedules edges.”",
    takeaway: "Keep OS scheduling vocabulary separate from graph algorithms.",
  },
  s15: {
    answer: "Mirroring",
    why: "RAID 1 duplicates writes across disks for redundancy. RAID 0 stripes without redundancy; RAID 5/6 add parity.",
    mistake: "Calling RAID 1 striping.",
    takeaway: "RAID 1 = mirror; RAID 0 = stripe; parity RAIDS trade capacity for redundancy.",
  },
  s16: {
    answer: "Thrashing = excessive paging; reduce multiprogramming / protect working sets",
    why: "When active working sets exceed RAM, the system pages constantly and makes little progress. Mitigations: admit fewer processes, local replacement, working-set policies, add memory.",
    mistake: "Describing thrashing as a CPU scheduling bug only, without the memory pressure angle.",
    takeaway: "Thrashing is a memory-load-control problem as much as a page-replacement problem.",
  },
  s17: {
    answer: "Referenced page is not in RAM (not resident)",
    why: "A page fault traps to the OS to load/allocate the page and update page tables. A TLB hit means translation was cached—not a fault.",
    mistake: "Equating TLB miss with page fault—TLB miss can still hit a present page table entry.",
    takeaway: "TLB miss ≠ page fault; page fault ⇒ not resident (or permission fault).",
  },
  s18: {
    answer: "return port < 1024  (optionally also port >= 0)",
    why: "Well-known TCP/UDP ports are 0–1023 and traditionally require privilege to bind.",
    mistake: "Using ≤ 1024 or confusing with registered ports (1024–49151).",
    takeaway: "0–1023 well-known; 1024–49151 registered; 49152–65535 dynamic/private.",
  },

  // —— NLP ——
  n1: {
    answer: "Terms that appear in many documents",
    why: "IDF downweights corpus-wide frequent terms so TF-IDF emphasizes words that discriminate documents.",
    mistake: "Thinking IDF downweights rare terms—the opposite is true.",
    takeaway: "TF = importance in doc; IDF = rarity across corpus.",
  },
  n2: {
    answer: "Context words from a center word (skip-gram)",
    why: "Skip-gram predicts surrounding tokens given the center embedding. CBOW predicts the center from context.",
    mistake: "Swapping skip-gram and CBOW definitions.",
    takeaway: "Skip-gram: center → context; CBOW: context → center.",
  },
  n3: {
    answer: "Weighted combination of values via query–key scores",
    why: "Attention computes compatibility (e.g. scaled dot-product) between queries and keys, softmaxes, and mixes values—content-based routing of information.",
    mistake: "Describing attention as only pooling or convolution.",
    takeaway: "Q, K, V are the core attention abstraction.",
  },
  n4: {
    answer: "When the model assigns higher probability to the true sequence",
    why: "Perplexity is exp(average NLL). Higher likelihood on held-out data ⇒ lower perplexity.",
    mistake: "Thinking lower probability is better, or confusing perplexity with accuracy alone.",
    takeaway: "Lower perplexity ≈ better probabilistic fit (with caveats).",
  },
  n5: {
    answer: "Sequence labeling / token classification",
    why: "NER tags tokens or spans with entity types (PER, ORG, LOC, …)—a structured prediction / sequence labeling task.",
    mistake: "Calling it regression or document clustering.",
    takeaway: "Token-level labels ⇒ sequence labeling family (NER, POS, chunking).",
  },
  n6: {
    answer: "True",
    why: "Stemming chops affixes aggressively (often non-words). Lemmatization maps to dictionary lemmas using linguistics/POS.",
    mistake: "Thinking lemmatization is “harsher.”",
    takeaway: "Stem ≈ crude; lemma ≈ linguistically principled.",
  },
  n7: {
    answer: "True",
    why: "Bag-of-words uses counts/weights of tokens and discards order and syntax.",
    mistake: "Assuming BoW keeps n-gram order—it doesn’t unless you explicitly add n-gram features.",
    takeaway: "BoW = multiset of tokens; order needs n-grams or sequences models.",
  },
  n8: {
    answer: "True",
    why: "BLEU measures n-gram overlap of MT hypotheses against references and remains a standard automatic metric despite limitations.",
    mistake: "Thinking BLEU is only for speech or summarization (it’s used more broadly but classic for MT).",
    takeaway: "Know BLEU’s idea (precision + brevity) and its blind spots (semantics, recall).",
  },
  n9: {
    answer: "Named Entity Recognition",
    why: "NER finds and types proper names and related entities in text.",
    mistake: "Expanding to unrelated IR acronyms.",
    takeaway: "NER is a core information-extraction task.",
  },
  n10: {
    answer: "BPE (Byte-Pair Encoding)",
    why: "BPE iteratively merges frequent symbol pairs to build a subword vocabulary—widely used in GPT-style tokenizers.",
    mistake: "Naming only WordPiece/Unigram without BPE when the question asked for BPE specifically.",
    takeaway: "Subwords handle rare words better than word-level vocabularies.",
  },
  n11: {
    answer: "Self-attention (often multi-head self-attention)",
    why: "Transformers let each position attend over the sequence (self-attention), usually with multiple heads.",
    mistake: "Saying only “convolution” or “recurrence.”",
    takeaway: "Self-attention is the defining transformer block ingredient.",
  },
  n12: {
    answer: "1",
    why: "A bigram model uses P(w_i | w_{i−1})—exactly one previous token of context.",
    mistake: "Answering 2 because “bi- means two tokens total”—the condition is on one prior token.",
    takeaway: "n-gram conditions on n−1 previous tokens.",
  },
  n13: {
    answer: "Tokenization, lowercasing, stopword removal",
    why: "These are standard text-normalization steps before many classical NLP pipelines. Dijkstra is unrelated.",
    mistake: "Including Dijkstra as “graph NLP.”",
    takeaway: "Preprocessing choices change vocabulary size and model behavior—document them.",
  },
  n14: {
    answer: "Angle-based similarity (normalized dot product)",
    why: "Cosine similarity measures orientation of vectors, reducing sensitivity to document-length scaling of TF-IDF.",
    mistake: "Calling cosine an edit distance.",
    takeaway: "Cosine ∈ [−1,1] for real vectors; for TF-IDF usually [0,1].",
  },
  n15: {
    answer: "RNNs: sequential & harder long-range; Transformers: parallel + direct attention",
    why: "RNNs/LSTMs process tokens step-by-step (limited training parallelism) and can still struggle with very long dependencies. Transformers use self-attention for pairwise interactions and parallelize over sequence length, usually modeling long range better at quadratic attention cost.",
    mistake: "Claiming RNNs are trivially parallel across time, or that Transformers have no cost trade-offs.",
    takeaway: "Contrast parallelism and path length for long-range deps in your essay.",
  },
  n16: {
    answer: "return text.split()",
    why: "str.split() without args splits on whitespace and discards empty pieces—idiomatic whitespace tokenization.",
    mistake: "Using split(' ') which keeps odd empties around repeated spaces.",
    takeaway: "Prefer split() with no args for whitespace tokenization.",
  },
  n17: {
    answer: "Lowercase, then strip . , ! ?",
    why: "Normalize by t = text.lower() and removing each punctuation character via replace/translate, then return t.",
    mistake: "Only lowercasing, or removing letters accidentally with an overly broad regex.",
    takeaway: "Be explicit about which characters you strip—preprocessing is part of the contract.",
  },
  n18: {
    answer: "Part-of-speech labels for tokens",
    why: "POS tagging assigns categories like NN/VB/JJ to each token—fundamental syntactic preprocessing.",
    mistake: "Confusing POS with sentiment analysis or NER.",
    takeaway: "POS = syntax tags; NER = entity types; sentiment = opinion polarity.",
  },
};

export function demoFeedbackForSuffix(suffix: string): string | undefined {
  const parts = DEMO_QUESTION_FEEDBACK_PARTS[suffix];
  return parts ? formatQuestionFeedback(parts) : undefined;
}

export function demoIncorrectFeedbackForSuffix(suffix: string): string | undefined {
  const parts = DEMO_QUESTION_FEEDBACK_PARTS[suffix];
  return parts ? formatIncorrectQuestionFeedback(parts) : undefined;
}

/** @deprecated Prefer demoFeedbackForSuffix — kept for any direct map lookups. */
export const DEMO_QUESTION_FEEDBACK: Record<string, string> = Object.fromEntries(
  Object.entries(DEMO_QUESTION_FEEDBACK_PARTS).map(([k, parts]) => [
    k,
    formatQuestionFeedback(parts),
  ]),
);
