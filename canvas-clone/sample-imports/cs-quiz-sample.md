## What is the time complexity of binary search on a sorted array?
type: short_answer
points: 1
answer: O(log n)
correct_feedback:
Answer: O(log n)

Why:
Binary search discards half of the remaining sorted range each comparison, so steps grow logarithmically with n.

Common mistake:
Choosing O(n) (linear scan) or O(1) (hash-table style access).

Takeaway:
Sorted array + halving search space ⇒ logarithmic time.

incorrect_feedback:
Answer: O(log n)

Common mistake:
Choosing O(n) (linear scan) or O(1) (hash-table style access).

Why:
Binary search discards half of the remaining sorted range each comparison, so steps grow logarithmically with n.

Takeaway:
Sorted array + halving search space ⇒ logarithmic time.

## Which HTTP status code means Not Found?
type: short_answer
points: 1
answer: 404
correct_feedback:
Answer: 404 Not Found

Why:
The server understood the request but could not locate a matching resource.

Common mistake:
Confusing 404 with 500 (server error) or 301 (redirect).

Takeaway:
2xx success, 3xx redirect, 4xx client error, 5xx server error.

incorrect_feedback:
Answer: 404 Not Found

Common mistake:
Confusing 404 with 500 (server error) or 301 (redirect).

Why:
The server understood the request but could not locate a matching resource.

Takeaway:
2xx success, 3xx redirect, 4xx client error, 5xx server error.

## In Python which keyword defines a function?
type: short_answer
points: 1
answer: def
correct_feedback:
Answer: def

Why:
Python function definitions use def name(params): …

Common mistake:
Using function/fn from other languages.

Takeaway:
def for functions; lambda for tiny anonymous expressions.

incorrect_feedback:
Answer: def

Common mistake:
Using function/fn from other languages.

Why:
Python function definitions use def name(params): …

Takeaway:
def for functions; lambda for tiny anonymous expressions.

## TCP provides reliable ordered delivery of a byte stream.
type: true_false
points: 1
answer: true
correct_feedback:
Answer: Merge sort and Quicksort

Why:
Both rearrange elements into order. Dijkstra and BFS solve graph path/exploration problems.

Common mistake:
Selecting Dijkstra/BFS because they “order nodes by discovery.”

Takeaway:
Sorting ≠ graph search—different problem families.

incorrect_feedback:
Answer: Merge sort and Quicksort

Common mistake:
Selecting Dijkstra/BFS because they “order nodes by discovery.”

Why:
Both rearrange elements into order. Dijkstra and BFS solve graph path/exploration problems.

Takeaway:
Sorting ≠ graph search—different problem families.

## A singly linked list supports O(1) random access by index.
type: true_false
points: 1
answer: false
correct_feedback:
Answer: Stack, queue, and deque

Why:
Each supports O(1) amortized push/pop at an endpoint (deque at both ends).

Common mistake:
Including a balanced BST—great for ordered search, not endpoint queues/stacks.

Takeaway:
Match ADT to access pattern: ends vs ordered keys.

incorrect_feedback:
Answer: Stack, queue, and deque

Common mistake:
Including a balanced BST—great for ordered search, not endpoint queues/stacks.

Why:
Each supports O(1) amortized push/pop at an endpoint (deque at both ends).

Takeaway:
Match ADT to access pattern: ends vs ordered keys.

## P is a subset of NP.
type: true_false
points: 1
answer: true
correct_feedback:
Answer: True

Why:
TCP provides a connection-oriented, reliable, ordered byte stream with ACKs and retransmission.

Common mistake:
Describing TCP like UDP.

Takeaway:
TCP = reliable stream; UDP = best-effort datagrams.

incorrect_feedback:
Answer: True

Common mistake:
Describing TCP like UDP.

Why:
TCP provides a connection-oriented, reliable, ordered byte stream with ACKs and retransmission.

Takeaway:
TCP = reliable stream; UDP = best-effort datagrams.

## IPv4 addresses are 32 bits long.
type: true_false
points: 1
answer: true
correct_feedback:
Answer: False

Why:
Reaching index i requires following i next pointers—Θ(i) time.

Common mistake:
Assuming linked lists index like arrays.

Takeaway:
Arrays: fast index. Lists: fast splice given a pointer.

incorrect_feedback:
Answer: False

Common mistake:
Assuming linked lists index like arrays.

Why:
Reaching index i requires following i next pointers—Θ(i) time.

Takeaway:
Arrays: fast index. Lists: fast splice given a pointer.

## What does API stand for?
type: short_answer
points: 1
answer: Application Programming Interface
correct_feedback:
Answer: True

Why:
Any deterministic poly-time machine is also a nondeterministic one, so P ⊆ NP. Whether equality holds is open.

Common mistake:
Claiming P ⊆ NP is unknown—the ⊆ direction is known.

Takeaway:
P ⊆ NP is proven; P = NP is not.

incorrect_feedback:
Answer: True

Common mistake:
Claiming P ⊆ NP is unknown—the ⊆ direction is known.

Why:
Any deterministic poly-time machine is also a nondeterministic one, so P ⊆ NP. Whether equality holds is open.

Takeaway:
P ⊆ NP is proven; P = NP is not.

## Name the Git command that stages all modified tracked files.
type: short_answer
points: 1
answer: git add -u
correct_feedback:
Answer: Application Programming Interface

Why:
An API is the contract of operations one component exposes for others to call.

Common mistake:
Vague expansions that miss “Interface.”

Takeaway:
APIs separate implementation from consumers.

incorrect_feedback:
Answer: Application Programming Interface

Common mistake:
Vague expansions that miss “Interface.”

Why:
An API is the contract of operations one component exposes for others to call.

Takeaway:
APIs separate implementation from consumers.

## What ADT supports LIFO push and pop?
type: short_answer
points: 1
answer: stack
correct_feedback:
Answer: git add -u

Why:
-u stages modifications/deletions to already-tracked files.

Common mistake:
Expecting -u to pick up brand-new untracked files (it does not).

Takeaway:
Tracked updates → git add -u; new files → git add <path>.

incorrect_feedback:
Answer: git add -u

Common mistake:
Expecting -u to pick up brand-new untracked files (it does not).

Why:
-u stages modifications/deletions to already-tracked files.

Takeaway:
Tracked updates → git add -u; new files → git add <path>.

## What does DNS stand for?
type: short_answer
points: 1
answer: Domain Name System
correct_feedback:
Answer: stack

Why:
LIFO: last pushed item is first popped—ideal for undo and call frames.

Common mistake:
Answering queue (FIFO).

Takeaway:
LIFO → stack; FIFO → queue.

incorrect_feedback:
Answer: stack

Common mistake:
Answering queue (FIFO).

Why:
LIFO: last pushed item is first popped—ideal for undo and call frames.

Takeaway:
LIFO → stack; FIFO → queue.

## The HTTP method commonly used to create a resource is ____.
type: fill_in_blank
points: 1
answer: POST
correct_feedback:
Answer: POST

Why:
REST commonly creates resources with POST to a collection URL.

Common mistake:
Using GET for creation or forgetting PUT’s replace semantics.

Takeaway:
POST create, GET read, PUT replace, PATCH partial, DELETE remove.

incorrect_feedback:
Answer: POST

Common mistake:
Using GET for creation or forgetting PUT’s replace semantics.

Why:
REST commonly creates resources with POST to a collection URL.

Takeaway:
POST create, GET read, PUT replace, PATCH partial, DELETE remove.

## Big-O of merge sort is Θ(____).
type: fill_in_blank
points: 1
answer: n log n
correct_feedback:
Answer: n log n

Why:
About log n merge levels × linear work per level ⇒ Θ(n log n).

Common mistake:
Writing O(n²) from nested loops intuition.

Takeaway:
Classic comparison sorts land at n log n.

incorrect_feedback:
Answer: n log n

Common mistake:
Writing O(n²) from nested loops intuition.

Why:
About log n merge levels × linear work per level ⇒ Θ(n log n).

Takeaway:
Classic comparison sorts land at n log n.

## Evaluate (2 ** 3) + 1
type: numerical
points: 1
answer: 9
correct_feedback:
Answer: 9

Why:
In Python, ** is exponentiation: 2**3 = 8, then +1 → 9.

Common mistake:
Treating ** as XOR (^) or multiplication.

Takeaway:
Python: ** power, ^ bitwise XOR.

incorrect_feedback:
Answer: 9

Common mistake:
Treating ** as XOR (^) or multiplication.

Why:
In Python, ** is exponentiation: 2**3 = 8, then +1 → 9.

Takeaway:
Python: ** power, ^ bitwise XOR.

## How many edges does a tree with 10 vertices have?
type: numerical
points: 1
answer: 9
correct_feedback:
Answer: 9

Why:
Any tree with n vertices has n−1 edges (10−1 = 9).

Common mistake:
Using n or n+1 edges.

Takeaway:
Tree ⇒ |E| = |V| − 1.

incorrect_feedback:
Answer: 9

Common mistake:
Using n or n+1 edges.

Why:
Any tree with n vertices has n−1 edges (10−1 = 9).

Takeaway:
Tree ⇒ |E| = |V| − 1.

## Decimal value of binary 1010?
type: numerical
points: 1
answer: 10
correct_feedback:
Answer: 10

Why:
Binary 1010 = 8 + 0 + 2 + 0 = 10 decimal.

Common mistake:
Off-by-powers-of-two when reading bit places.

Takeaway:
Label bit weights right-to-left: 1,2,4,8,…

incorrect_feedback:
Answer: 10

Common mistake:
Off-by-powers-of-two when reading bit places.

Why:
Binary 1010 = 8 + 0 + 2 + 0 = 10 decimal.

Takeaway:
Label bit weights right-to-left: 1,2,4,8,…

## Explain the difference between a process and a thread. Give one example of when you would use multiple threads.
type: essay
points: 5
correct_feedback:
Answer: Stack↔undo; Queue↔BFS/scheduling; Hash table↔fast lookup

Why:
Each ADT’s primary operations match those use cases (LIFO, FIFO, expected O(1) key access).

Common mistake:
Crossing stack/queue roles.

Takeaway:
Learn ADTs by the operation patterns they make cheap.

incorrect_feedback:
Answer: Stack↔undo; Queue↔BFS/scheduling; Hash table↔fast lookup

Common mistake:
Crossing stack/queue roles.

Why:
Each ADT’s primary operations match those use cases (LIFO, FIFO, expected O(1) key access).

Takeaway:
Learn ADTs by the operation patterns they make cheap.

## Why can Dijkstra fail with negative edge weights? Sketch a tiny counterexample.
type: essay
points: 5
correct_feedback:
Answer: Dijkstra↔shortest paths; Kruskal↔MST; Binary search↔sorted find

Why:
Each algorithm targets a different problem with different assumptions (e.g. Dijkstra needs non-negative weights).

Common mistake:
Assigning Dijkstra to MST.

Takeaway:
Name the problem first, then the algorithm.

incorrect_feedback:
Answer: Dijkstra↔shortest paths; Kruskal↔MST; Binary search↔sorted find

Common mistake:
Assigning Dijkstra to MST.

Why:
Each algorithm targets a different problem with different assumptions (e.g. Dijkstra needs non-negative weights).

Takeaway:
Name the problem first, then the algorithm.

## Complete: return the sum of list xs (one expression).
type: inline_code
language: python
points: 2
answer: return sum(xs)
correct_feedback:
Answer: Process = isolated address space; thread = shared space, cheaper switch

Why:
A strong answer contrasts isolation vs shared memory and gives a concrete multi-thread scenario (UI + worker, concurrent I/O).

Common mistake:
Only defining terms without an example or trade-off.

Takeaway:
Structure: definitions → comparison table in prose → example → when you’d choose each.

incorrect_feedback:
Answer: Process = isolated address space; thread = shared space, cheaper switch

Common mistake:
Only defining terms without an example or trade-off.

Why:
A strong answer contrasts isolation vs shared memory and gives a concrete multi-thread scenario (UI + worker, concurrent I/O).

Takeaway:
Structure: definitions → comparison table in prose → example → when you’d choose each.

## Return Math.max of a and b.
type: inline_code
language: javascript
points: 2
answer: return Math.max(a, b)
correct_feedback:
Answer: Dijkstra’s finalize-once invariant fails with negatives

Why:
Show a tiny graph (e.g. s→a:5, s→b:0, b→a:−10) where a shorter path appears after a node would already be settled. Mention Bellman-Ford as a remedy.

Common mistake:
Saying only “negatives are bad” without a counterexample or invariant.

Takeaway:
Invariant + counterexample + alternative algorithm = complete explanation.

incorrect_feedback:
Answer: Dijkstra’s finalize-once invariant fails with negatives

Common mistake:
Saying only “negatives are bad” without a counterexample or invariant.

Why:
Show a tiny graph (e.g. s→a:5, s→b:0, b→a:−10) where a shorter path appears after a node would already be settled. Mention Bellman-Ford as a remedy.

Takeaway:
Invariant + counterexample + alternative algorithm = complete explanation.

## Implement is_palindrome(s) — True if palindrome ignoring spaces.
type: coding
language: python
points: 5
answer: def is_palindrome(s): t = s.replace(' ', ''); return t == t[::-1]
correct_feedback:
Answer: return sum(xs)

Why:
sum iterates and adds—idiomatic Python for totaling a list.

Common mistake:
Manual loops that mishandle empty lists.

Takeaway:
Prefer clear built-ins when they match intent.

incorrect_feedback:
Answer: return sum(xs)

Common mistake:
Manual loops that mishandle empty lists.

Why:
sum iterates and adds—idiomatic Python for totaling a list.

Takeaway:
Prefer clear built-ins when they match intent.

## Implement factorial(n) for n >= 0.
type: coding
language: python
points: 5
answer: def factorial(n): return 1 if n < 2 else n * factorial(n - 1)
correct_feedback:
Answer: return Math.max(a, b)

Why:
Math.max returns the larger numeric argument; remember to return it.

Common mistake:
Forgetting return (function yields undefined).

Takeaway:
Compute and return—don’t rely on side effects here.

incorrect_feedback:
Answer: return Math.max(a, b)

Common mistake:
Forgetting return (function yields undefined).

Why:
Math.max returns the larger numeric argument; remember to return it.

Takeaway:
Compute and return—don’t rely on side effects here.

## Which OSI layer includes IP?
type: short_answer
points: 1
answer: Network
correct_feedback:
Answer: Strip spaces, then compare to reverse

Why:
t = s.replace(' ', ''); return t == t[::-1] checks the palindrome property while keeping case as specified.

Common mistake:
Lowercasing when the prompt said case-sensitive, or forgetting spaces.

Takeaway:
Separate cleaning from the core predicate.

incorrect_feedback:
Answer: Strip spaces, then compare to reverse

Common mistake:
Lowercasing when the prompt said case-sensitive, or forgetting spaces.

Why:
t = s.replace(' ', ''); return t == t[::-1] checks the palindrome property while keeping case as specified.

Takeaway:
Separate cleaning from the core predicate.

## Name a self-balancing BST (e.g. AVL or red-black).
type: short_answer
points: 1
answer: AVL
correct_feedback:
Answer: Base n < 2 → 1; else n * factorial(n-1) (or iterative)

Why:
Factorial needs a clear base case; 0! = 1.

Common mistake:
Returning 0 for n=0, or infinite recursion without a base.

Takeaway:
Always test n=0 and n=1 for factorial.

incorrect_feedback:
Answer: Base n < 2 → 1; else n * factorial(n-1) (or iterative)

Common mistake:
Returning 0 for n=0, or infinite recursion without a base.

Why:
Factorial needs a clear base case; 0! = 1.

Takeaway:
Always test n=0 and n=1 for factorial.

## UDP is connectionless. True or false?
type: true_false
points: 1
answer: true
correct_feedback:
Answer: Hash map of value→index; probe target − x

Why:
One pass yields expected O(n) time / O(n) space versus nested loops.

Common mistake:
Returning values instead of indices, or O(n²) without discussion.

Takeaway:
“Have I seen the complement?” → hash set/map.

incorrect_feedback:
Answer: Hash map of value→index; probe target − x

Common mistake:
Returning values instead of indices, or O(n²) without discussion.

Why:
One pass yields expected O(n) time / O(n) space versus nested loops.

Takeaway:
“Have I seen the complement?” → hash set/map.
