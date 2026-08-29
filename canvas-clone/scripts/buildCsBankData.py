#!/usr/bin/env python3
"""Build csBankData.json used by generateCsDemoBanks.mjs."""
from __future__ import annotations

import json
from pathlib import Path

# Concept tuples: (term, definition, distractor1, distractor2, distractor3)
C: dict[str, list[tuple[str, str, str, str, str]]] = {}

C["python"] = [
    ("List", "Ordered mutable sequence supporting indexing and slicing", "Immutable key-value map", "Unordered unique set only", "OS process handle"),
    ("Tuple", "Ordered immutable sequence often used for fixed records", "Mutable dynamic array", "Hash map with string keys", "Thread lock object"),
    ("Dictionary", "Mutable mapping of hashable keys to values", "Ordered immutable sequence", "Fixed-size buffer", "Priority queue heap"),
    ("Set", "Unordered collection of unique hashable elements", "Ordered list allowing duplicates", "Stack with LIFO only", "Binary tree node"),
    ("List comprehension", "Expression that builds a list from an iterable with optional filter", "Recursive descent rule", "Decorator that caches", "Context manager protocol"),
    ("Generator", "Iterator that yields values lazily via yield", "Eager list materializer", "Mutex critical section", "Metaclass factory"),
    ("Decorator", "Callable that wraps another function to extend behavior", "GC generation counter", "Virtualenv pin file", "Type comment only"),
    ("Context manager", "Object supporting with-statement enter/exit for resources", "Async event-loop scheduler", "Import hook finder", "Peephole optimizer"),
    ("Duck typing", "Compatibility based on behavior rather than declared type", "Strict nominal inheritance only", "Template expansion", "Manual refcounting"),
    ("GIL", "CPython lock allowing one thread to run bytecode at a time", "GPU shader lock", "Consensus quorum", "SQL isolation level"),
    ("*args", "Collects extra positional arguments into a tuple", "Keyword-only dict merger", "Instance attribute cache", "Exception chain marker"),
    ("**kwargs", "Collects extra keyword arguments into a dict", "Positional-only pack", "Metaclass prepare hook", "Awaitable wrapper"),
    ("f-string", "String literal with embedded expressions prefixed by f", "Raw bytes hex dump", "Regex compile flag", "Pickle protocol"),
    ("None", "Singleton representing absence of a value", "Boolean false alias", "Empty list singleton", "NaN float sentinel"),
    ("is vs ==", "is tests identity; == tests value equality", "Both always identical", "is compares hashes only", "== compares addresses only"),
    ("EAFP", "Style preferring try/except over preemptive checks", "LBYL-only analysis", "Mandatory null checks", "Borrow checker"),
    ("venv", "Isolated environment with its own installed packages", "System site-packages only", "Docker layer cache", "CMake build dir"),
    ("pip", "Installer for packages from PyPI and other indexes", "Java bytecode linker", "npm auditor", "apt mirror"),
    ("__init__", "Constructor called after instance allocation", "Module finalizer", "Metaclass interceptor", "Weakref callback"),
    ("__str__", "Human-readable string representation method", "Hash for dict keys", "Pickle reducer", "Async aclose"),
    ("lambda", "Anonymous expression-bodied function", "Named classmethod", "Generator send target", "TypeVar bound"),
    ("map", "Applies a function across items of iterables", "In-place sort key", "Dict merge operator", "Set update"),
    ("filter", "Yields items for which a predicate is true", "List reverse helper", "String partition", "Enum factory"),
    ("zip", "Pairs items from multiple iterables until one ends", "Dict keys view", "Heap push-pop", "Glob expander"),
    ("dataclass", "Decorator generating init/repr/eq boilerplate", "ABC metaclass", "Task group", "ctypes pack"),
    ("type hint", "Annotation describing expected types for checkers", "Runtime mandatory cast", "Bytecode cache", "Finder stub"),
    ("asyncio", "Library for concurrent code using async/await", "Threading GIL bypass", "Shared ctypes only", "Futures executor only"),
    ("pathlib", "Object-oriented filesystem path API", "os.system wrapper", "mkstemp only", "which locator"),
    ("Exception", "Base for most catchable error types", "SystemExit only", "KeyboardInterrupt base", "Warning alone"),
    ("MRO", "Method resolution order for multiple inheritance", "GC threshold", "Import cycle breaker", "Frame eval API"),
]

C["java"] = [
    ("JVM", "Virtual machine executing Java bytecode portably", "AOT-only native linker", "Browser DOM runtime", "SQL planner"),
    ("JDK", "Kit with compiler, tools, and libraries for development", "JRE without javac", "Maven mirror", "JIT profile"),
    ("JRE", "Runtime needed to execute compiled Java applications", "Source debugger only", "Annotation path", "module-info gen"),
    ("bytecode", "Platform-neutral instructions produced by javac", "Native x86 opcodes", "LLVM bitcode only", "Python marshal"),
    ("class", "Blueprint defining fields and methods for objects", "Package-private interface", "Enum constant pool", "Record ctor"),
    ("interface", "Type declaring method contracts for implementors", "Concrete fields-only class", "Static nested enum", "Synced block"),
    ("abstract class", "Non-instantiable class that may declare abstract methods", "Final utility class", "Retention policy", "VarHandle fence"),
    ("inheritance", "Subclass acquiring members from a superclass", "Delegation-only composition", "Package sealing", "ServiceLoader SPI"),
    ("polymorphism", "Using objects via a common supertype", "Static overloading only", "Primitive widening", "Generic erasure"),
    ("encapsulation", "Hiding state behind controlled accessors", "Public field exposure", "package-info docs", "opens directive"),
    ("override", "Subclass method replacing a superclass method", "Overload different arity", "Synthetic bridge", "Default conflict"),
    ("overload", "Same method name with different parameter lists", "Covariant override", "Varargs packing", "MethodHandle bind"),
    ("ArrayList", "Resizable array-backed List implementation", "LinkedHashSet only", "ConcurrentSkipList", "PriorityBlockingQueue"),
    ("HashMap", "Hash-table Map allowing one null key", "TreeMap only", "IdentityHashMap", "WeakHashMap"),
    ("HashSet", "Set backed by a HashMap of unique elements", "CopyOnWriteArrayList", "ArrayDeque", "BitSet"),
    ("String", "Immutable character sequence with pool interning", "Mutable StringBuilder", "Shared char[] always", "UTF-16 buffer only"),
    ("StringBuilder", "Mutable character sequence for concatenation", "Interned String", "Unsynced StringBuffer", "NIO CharBuffer"),
    ("checked exception", "Exception that must be declared or handled", "Error subclass only", "Unchecked RuntimeException", "Suppressed list"),
    ("RuntimeException", "Unchecked exception for programming errors", "Checked IOException", "JVM Error only", "APT fault"),
    ("synchronized", "Mutual exclusion via an object's monitor", "volatile visibility only", "CAS loop", "LockSupport park"),
    ("volatile", "Ensures cross-thread visibility of field writes", "Exclusion lock", "final freeze only", "transient skip"),
    ("garbage collection", "Automatic reclaim of unreachable objects", "Manual free", "ReferenceQueue only", "Phantom only"),
    ("package", "Namespace grouping classes and access control", "Module layer only", "JAR manifest", "Classpath glob"),
    ("import", "Makes another type usable by simple name", "Static field import only", "requires module", "opens reflect"),
    ("static", "Member belonging to the class, not instances", "Instance-only field", "Default interface method", "Record component"),
    ("final", "Prevents reassignment, override, or subclassing", "volatile barrier", "JNI native", "strictfp FP"),
    ("generics", "Compile-time type parameters erased at runtime", "Reified arguments", "C++ templates", "Wildcard only"),
    ("Optional", "Container that may hold a non-null value", "Nullable annotation", "Stream terminal", "CompletableFuture"),
    ("Stream API", "Fluent pipelines for bulk sequence operations", "Iterator.remove only", "toArray only", "Spliterator"),
    ("record", "Immutable data carrier with generated members", "JavaBean mutable", "Enum with methods", "Sealed permit"),
]

C["cprog"] = [
    ("pointer", "Variable holding the address of another object", "Java reference only", "Python descriptor", "Go itable"),
    ("array", "Contiguous sequence of same-type elements", "Linked node list", "Hash buckets", "String rope"),
    ("struct", "Aggregate grouping named members", "Overlapping union only", "Enum tags", "Bit-field flags"),
    ("union", "Type whose members share storage", "Padded struct", "Flexible array", "Anonymous struct"),
    ("malloc", "Allocates uninitialized heap bytes returning void*", "stack alloca", "calloc zeroing", "realloc shrink"),
    ("free", "Releases heap memory from malloc-family", "Stack unwind", "GC finalize", "munmap mapping"),
    ("sizeof", "Yields size in bytes of a type or expression", "alignof ABI", "offsetof distance", "typeof GNU"),
    ("null pointer", "Pointer value referring to no valid object", "Dangling freed addr", "Wild uninitialized", "Function thunk"),
    ("undefined behavior", "Action with no constraints in the C standard", "Impl-defined I/O", "Unspecified order only", "Locale printf"),
    ("header file", "Included file declaring interfaces across units", "Object file input", "Shared .so", "PCH only"),
    ("preprocessor", "Phase for includes, macros, and conditionals", "Linker resolution", "Loader relocate", "JIT codegen"),
    ("#define", "Directive creating a macro substitution", "typedef alias", "inline hint", "enum constant"),
    ("typedef", "Alias name for an existing type", "Function-like macro", "Struct tag alone", "restrict qualifier"),
    ("const", "Qualifier promising no modification via that lvalue", "volatile MMIO", "restrict alias", "static duration"),
    ("volatile", "Value may change outside program control", "const correctness", "_Atomic only", "register hint"),
    ("static function", "Function with internal linkage to one TU", "extern visibility", "inline across TUs", "noreturn attr"),
    ("extern", "Declares a symbol defined elsewhere", "static file scope", "Tentative def", "Common BSS"),
    ("stack", "Region for automatic variables and frames", "Heap arena", "Data globals", "Anonymous mmap"),
    ("heap", "Region for dynamically allocated memory", "Stack locals", "rodata literals", "TLS locals"),
    ("segmentation fault", "Fault from invalid memory access (SIGSEGV)", "Bus alignment error", "FE_INVALID float", "Illegal insn"),
    ("buffer overflow", "Writing past the end of an allocated buffer", "Use-after-free only", "Double free alone", "Integer wrap"),
    ("C string", "char array terminated by a null byte", "Length-prefixed string", "UTF-16 Java String", "Rope tree"),
    ("strcpy", "Copies a string including the terminator", "strncpy always pads", "Overlapping memcpy", "strdup wrapper"),
    ("printf", "Formatted output to stdout", "scanf input", "puts only", "write syscall"),
    ("FILE*", "Opaque stdio stream handle", "int file descriptor", "DIR* stream", "va_list args"),
    ("errno", "Thread-local code set by failing library calls", "Win32 GetLastError", "COM HRESULT", "Checked exceptions"),
    ("bitwise AND", "Operator & true where both bits are 1", "Logical && short-circuit", "XOR exclusive", "Left shift"),
    ("left shift", "Operator << moving bits to higher significance", "Arithmetic right shift", "Rotate intrinsic", "AND mask"),
    ("function pointer", "Pointer used to call a function by address", "void* data only", "C++ vtable slot", "Closure env"),
    ("restrict", "Hint that a pointer uniquely accesses an object", "const immutability", "volatile observe", "memory_order"),
]

C["cpp"] = [
    ("RAII", "Binding resource lifetime to object lifetime via ctor/dtor", "Manual free everywhere", "Garbage collection only", "Go defer only"),
    ("constructor", "Special member initializing a new object", "Destructor cleanup only", "Assignment operator", "Friend declaration"),
    ("destructor", "Special member releasing resources at end of lifetime", "Copy constructor", "Move assignment", "Conversion operator"),
    ("reference", "Alias to an existing object that cannot be reseated", "Nullable raw pointer", "shared_ptr control block", "optional wrapper"),
    ("lvalue reference", "Reference bound to a named persistent object", "rvalue ref to temporary", "Forwarding ref", "Pointer arithmetic"),
    ("rvalue reference", "Reference designed to bind to temporaries for moves", "const lvalue ref only", "Raw T* pointer", "span view"),
    ("move semantics", "Transferring resources from one object to another", "Deep copy always", "Reference counting only", "Garbage collection"),
    ("std::vector", "Dynamic contiguous array container", "std::list nodes", "std::map tree", "std::unordered_set"),
    ("std::string", "Ownable contiguous character sequence", "string_view non-owning", "const char* only", "rope node"),
    ("template", "Compile-time parameterized code generation", "Java runtime generics", "Macro textual only", "virtual dispatch"),
    ("overload resolution", "Choosing the best matching function candidate", "Name mangling only", "ADL Koenig only", "SFINAE failure"),
    ("namespace", "Named scope preventing symbol collisions", "C translation unit", "Java package import", "Python module path"),
    ("class vs struct", "Default private vs public members; both are class types", "struct cannot have methods", "class cannot be POD", "union equivalence"),
    ("virtual function", "Dynamically dispatched method via vtable", "static binding only", "inline always", "constexpr only"),
    ("pure virtual", "Abstract method declared with = 0", "final override", "defaulted special member", "deleted function"),
    ("inheritance", "Derived class extending a base class", "Composition only", "Friend injection", "CRTP only"),
    ("polymorphism", "Calling derived behavior through base interfaces", "Template monomorphization only", "Macro expansion", "Function pointers only"),
    ("smart pointer", "Owning pointer type managing lifetime automatically", "Raw new without delete", "C malloc", "observer_ptr only"),
    ("unique_ptr", "Exclusive-ownership smart pointer", "shared_ptr shared ownership", "weak_ptr cache", "auto_ptr deprecated twin"),
    ("shared_ptr", "Reference-counted shared ownership pointer", "unique_ptr exclusive", "raw observing pointer", "intrusive_ptr only"),
    ("const correctness", "Using const to express non-mutation guarantees", "mutable everything", "volatile MMIO only", "constexpr freeze"),
    ("STL algorithm", "Generic operation like sort/find on iterator ranges", "Container member only", "OpenMP pragma", "SIMD intrinsic"),
    ("iterator", "Object abstracting position in a sequence", "Raw index only", "Generator coroutine only", "span size"),
    ("exception", "Control transfer via throw/catch for error handling", "errno return codes only", "setjmp/longjmp only", "optional error"),
    ("constexpr", "Expression/function usable in constant evaluation", "runtime-only inline", "volatile compute", "asm block"),
    ("lambda", "Anonymous function object with optional captures", "Function pointer only", "std::function type erasure only", "macro callable"),
    ("rule of five", "If you define one special member, consider all five", "Rule of zero only", "Copy-only types", "Aggregate init only"),
    ("undefined behavior", "Program with no defined meaning under the standard", "Unspecified order only", "Implementation-defined size", "Locale facet"),
    ("header", "Interface declarations typically included by users", "Translation unit .cpp only", "Module partition only", "PCH binary"),
    ("linkage", "How names are shared across translation units", "Calling convention only", "Name mangling alone", "ABI padding"),
]

# Continue in next section of file via exec append pattern - write remaining inline
assert len(C["python"]) >= 28
assert len(C["java"]) >= 28
assert len(C["cprog"]) >= 28
assert len(C["cpp"]) >= 28

# --- remaining subjects ---
C["discrete"] = [
    ("proposition", "Declarative sentence that is true or false", "Open predicate only", "Imperative command", "Rhetorical question"),
    ("conjunction", "Logical AND of two propositions", "Exclusive OR", "Material implication", "Logical NOR"),
    ("disjunction", "Logical OR of two propositions", "NAND gate only", "Biconditional", "Exclusive conjunction"),
    ("implication", "If-then conditional proposition", "Biconditional only", "Negation flip", "XOR parity"),
    ("biconditional", "True when both sides share truth value", "One-way implication", "Exclusive or", "Nand expression"),
    ("predicate", "Statement with variables becoming proposition when bound", "Closed tautology only", "Propositional atom", "Modal operator"),
    ("quantifier", "Symbol expressing forall or exists over a domain", "Boolean connective", "Set comprehension", "Relation symbol"),
    ("set", "Collection of distinct objects called elements", "Ordered tuple", "Multiset with counts", "Fuzzy membership only"),
    ("subset", "Every element of A is also in B", "Proper superset", "Disjoint union", "Power set twin"),
    ("power set", "Set of all subsets of a given set", "Cartesian product", "Symmetric difference", "Partition blocks"),
    ("Cartesian product", "Set of ordered pairs from two sets", "Union of sets", "Intersection only", "Disjoint sum"),
    ("relation", "Subset of a Cartesian product between sets", "Function total map only", "Equivalence class alone", "Partial order cover"),
    ("function", "Relation assigning each domain element one codomain value", "Multi-valued relation", "Partial order", "Graph adjacency"),
    ("injection", "One-to-one function; distinct inputs map distinct", "Surjective onto only", "Bijection inverse", "Constant function"),
    ("surjection", "Onto function; every codomain element is hit", "Injective one-to-one", "Partial function", "Embedding"),
    ("bijection", "Both injective and surjective; invertible", "Injection only", "Surjection only", "Homomorphism"),
    ("equivalence relation", "Reflexive, symmetric, and transitive relation", "Strict order", "Partial function", "Tournament digraph"),
    ("partial order", "Reflexive, antisymmetric, transitive relation", "Total equivalence", "Symmetric closure", "Matching"),
    ("graph", "Vertices connected by edges", "Tree only", "Hypergraph edges", "Finite automaton"),
    ("degree", "Number of edges incident to a vertex", "Path length", "Chromatic number", "Girth"),
    ("tree", "Connected acyclic undirected graph", "Cyclic connected graph", "DAG with multiple roots", "Complete bipartite"),
    ("DFS", "Depth-first traversal exploring deep before wide", "BFS layer order", "Dijkstra priority", "Prim MST"),
    ("BFS", "Breadth-first traversal by distance layers", "DFS recursion stack", "Topological Kahn", "Kruskal union"),
    ("combinatorics", "Counting arrangements and selections", "Measure theory", "Linear algebra spectra", "Topology continuity"),
    ("permutation", "Ordered arrangement of distinct objects", "Combination unordered", "Partition set", "Derangement only"),
    ("combination", "Unordered selection of objects", "Permutation ordered", "Cartesian pair", "Injection count"),
    ("pigeonhole principle", "If more items than containers, some container shares", "Inclusion-exclusion", "Generating functions", "Burnside lemma"),
    ("proof by induction", "Base case plus inductive step for naturals", "Proof by contradiction only", "Direct expansion only", "Model checking"),
    ("modular arithmetic", "Arithmetic of remainders modulo n", "Real interval arithmetic", "Floating IEEE", "p-adic valuation only"),
    ("recurrence", "Sequence defined in terms of earlier terms", "Closed form only", "Generating ODE", "Markov chain only"),
]

C["probstat"] = [
    ("sample space", "Set of all possible outcomes of an experiment", "Event sigma-algebra only", "Random variable range", "Prior distribution"),
    ("event", "Subset of the sample space", "Outcome atom only", "Density function", "Likelihood ratio"),
    ("probability", "Measure of likelihood assigned to events", "Raw frequency count only", "Utility payoff", "Entropy bits"),
    ("conditional probability", "Probability of A given B has occurred", "Joint probability only", "Marginal sum", "Bayes posterior alone"),
    ("independence", "Events whose joint equals product of marginals", "Mutually exclusive", "Correlation zero only", "Conditional dependence"),
    ("random variable", "Measurable function from outcomes to numbers", "Deterministic constant", "Sample mean only", "Hypothesis test"),
    ("PMF", "Probability mass function for discrete RVs", "PDF continuous density", "CDF cumulative only", "Hazard rate"),
    ("PDF", "Probability density for continuous RVs", "PMF discrete masses", "Quantile function", "Survival function"),
    ("CDF", "Probability that RV is at most a value", "PDF derivative only", "PMF table", "MGF transform"),
    ("expectation", "Probability-weighted average of an RV", "Mode peak only", "Median middle", "Variance spread"),
    ("variance", "Expected squared deviation from the mean", "Mean absolute deviation only", "Skewness asymmetry", "Kurtosis tails"),
    ("Bernoulli", "Binary trial with success probability p", "Poisson counts", "Gaussian continuous", "Uniform discrete"),
    ("Binomial", "Count of successes in n independent Bernoulli trials", "Geometric waiting", "Hypergeometric depleting", "NegBin failures"),
    ("Poisson", "Count of rare events in fixed interval/rate", "Binomial fixed n", "Exponential waiting", "Gamma shape"),
    ("Normal distribution", "Bell-shaped continuous distribution (Gaussian)", "Uniform flat", "Exponential memoryless", "Cauchy heavy tails"),
    ("CLT", "Sample means approach normality for large n", "LLN almost-sure average", "Slutsky theorem", "Delta method"),
    ("Law of Large Numbers", "Sample average converges to expectation", "CLT normality", "Borel-Cantelli", "Glivenko-Cantelli"),
    ("Bayes theorem", "Updates prior to posterior given likelihood", "Frequentist p-value", "MLE point only", "MAP without prior"),
    ("likelihood", "Probability of data viewed as function of parameters", "Prior belief", "Posterior odds", "Evidence marginal"),
    ("hypothesis test", "Procedure deciding to reject a null hypothesis", "Point estimation only", "Interval estimation only", "Descriptive plot"),
    ("p-value", "Probability of data as extreme assuming null true", "Posterior probability", "Effect size", "Power of test"),
    ("confidence interval", "Interval procedure covering parameter with stated rate", "Credible Bayesian interval", "Prediction interval only", "Tolerance interval"),
    ("correlation", "Linear association measure between variables", "Causation proof", "Mutual information only", "Rank concordance only"),
    ("covariance", "Expected product of centered variables", "Correlation scaled", "Variance of sum only", "Precision matrix"),
    ("MLE", "Parameter maximizing likelihood of observed data", "MAP with prior", "Method of moments only", "Bayesian posterior mean"),
    ("bias", "Difference between estimator expectation and truth", "Variance of estimator", "MSE combined", "Consistency limit"),
    ("sampling", "Selecting observations from a population", "Census entire population", "Bootstrap resample only", "Cross-validation fold"),
    ("A/B test", "Experiment comparing variants via statistics", "Observational study only", "Simulation Monte Carlo", "Bandit regret"),
    ("entropy", "Uncertainty measure of a distribution in bits/nats", "Variance second moment", "KL divergence alone", "Cross-entropy loss only"),
    ("standard deviation", "Square root of variance; spread scale", "IQR robust range", "MAD median abs", "Range max-min"),
]

C["linalg"] = [
    ("vector", "Element of a vector space; often an ordered tuple", "Scalar field element", "Matrix only", "Tensor rank-3 only"),
    ("matrix", "Rectangular array representing a linear map", "Vector column only", "Scalar determinant", "Permutation cycle"),
    ("scalar", "Field element scaling vectors", "Vector magnitude only", "Matrix trace", "Eigenvector"),
    ("dot product", "Sum of pairwise products; measures alignment", "Cross product 3D", "Outer product matrix", "Hadamard entrywise"),
    ("cross product", "3D vector orthogonal to two inputs", "Dot scalar", "Wedge in 2D only", "Kronecker product"),
    ("linear independence", "No vector is a linear combination of others", "Spanning set only", "Orthogonal set", "Orthonormal basis"),
    ("basis", "Linearly independent spanning set", "Generating set with deps", "Row echelon only", "Nullspace basis alone"),
    ("dimension", "Number of vectors in any basis", "Determinant value", "Rank deficiency", "Condition number"),
    ("span", "All linear combinations of a set of vectors", "Convex hull", "Affine hull only", "Orthogonal complement alone"),
    ("linear transformation", "Map preserving addition and scalar multiplication", "Affine translate", "Nonlinear activation", "Quadratic form"),
    ("matrix multiplication", "Composition of linear maps via row-column products", "Entrywise Hadamard", "Kronecker only", "Element sum"),
    ("transpose", "Matrix with rows and columns swapped", "Inverse matrix", "Adjugate cofactor", "Hermitian conjugate only"),
    ("inverse", "Matrix A^{-1} such that AA^{-1}=I", "Pseudoinverse rectangular", "Transpose only", "Diagonal scaling"),
    ("determinant", "Scalar volume scaling factor of a linear map", "Trace sum diagonal", "Rank count", "Norm length"),
    ("eigenvalue", "Scalar λ with Av=λv for nonzero v", "Singular value only", "Trace average", "Condition κ"),
    ("eigenvector", "Nonzero v satisfying Av=λv", "Singular vector only", "Nullspace arbitrary", "Row space vector"),
    ("diagonalization", "Writing A=PDP^{-1} with diagonal D", "SVD always", "QR factorization", "LU decomposition"),
    ("orthogonal", "Vectors with zero dot product", "Parallel vectors", "Linearly dependent", "Normalized only"),
    ("orthonormal", "Orthogonal set of unit vectors", "Orthogonal unnormalized", "Basis any", "Frame redundant"),
    ("norm", "Length measure satisfying vector norm axioms", "Inner product alone", "Metric distance only", "Seminorm degenerate"),
    ("projection", "Closest point in a subspace to a vector", "Reflection Householder", "Rotation Givens", "Shear map"),
    ("rank", "Dimension of column (or row) space", "Nullity only", "Determinant zero test alone", "Condition number"),
    ("nullspace", "Solutions to Ax=0", "Column space", "Row space", "Left nullspace twin alone"),
    ("SVD", "Factorization A=UΣV^T with orthogonal U,V", "Eigen EVD square only", "LU pivoting", "Cholesky SPD"),
    ("positive definite", "x^TAx>0 for all nonzero x", "Indefinite saddle", "Singular PSD boundary", "Orthogonal matrix"),
    ("condition number", "Sensitivity of solution to input perturbations", "Determinant magnitude", "Rank reveal", "Pivot growth"),
    ("Gaussian elimination", "Row operations to solve linear systems", "Jacobi iteration", "Conjugate gradient", "FFT multiply"),
    ("identity matrix", "Square matrix acting as multiplicative identity", "Zero matrix", "Exchange permutation", "Hilbert matrix"),
    ("affine transformation", "Linear map plus translation", "Pure linear origin-fixing", "Projective homogenize only", "Isometry rigid"),
    ("least squares", "Minimizing ||Ax-b|| for overdetermined systems", "Exact inverse solve", "Underdetermined null", "Eigenproblem"),
]


C["arch"] = [
    ("CPU", "Central processor executing instructions", "GPU shader only", "DMA controller alone", "Southbridge chipset"),
    ("ALU", "Arithmetic logic unit performing integer ops", "FPU floating only", "Control unit decode", "Register file"),
    ("register", "Small fast storage inside the CPU", "Main DRAM", "Disk sector", "Cache line only"),
    ("clock cycle", "Basic timing quantum of synchronous logic", "Pipeline stall only", "Interrupt latency", "Bus transaction"),
    ("instruction set", "Machine operations a CPU can execute", "Microcode ROM only", "ABI calling convention", "Linker script"),
    ("RISC", "Reduced instruction set with simple ops", "CISC complex ops", "VLIW bundle only", "Stack machine"),
    ("CISC", "Complex instruction set with rich operations", "RISC load/store", "DSP MAC only", "GPU SIMT"),
    ("pipeline", "Overlapping instruction stages for throughput", "Single-cycle multi-cycle", "Out-of-order only", "Scoreboard"),
    ("hazard", "Condition preventing correct pipelined execution", "Cache miss only", "TLB shootdown", "Bus lock"),
    ("cache", "Fast memory holding recently used data", "Main memory DRAM", "Register renaming", "Write buffer only"),
    ("cache hit", "Requested data found in cache", "Compulsory miss", "Capacity miss", "Conflict miss"),
    ("virtual memory", "Abstraction mapping virtual to physical addresses", "Physical-only addressing", "Segment registers only", "DMA bounce"),
    ("TLB", "Cache of virtual-to-physical translations", "Page table walk only", "L1 data cache", "Branch predictor"),
    ("page fault", "Exception when translation or permission fails", "Segmentation fault userspace only", "Bus error", "NMI"),
    ("endianness", "Byte order for multi-byte values in memory", "Bit endian within byte only", "Alignment packing", "ABI padding"),
    ("bus", "Shared interconnect for components", "Point-to-point PCIe only", "NoC mesh only", "Crossbar alone"),
    ("interrupt", "Signal causing CPU to handle an event", "Polling loop only", "DMA completion alone", "Syscall trap only"),
    ("DMA", "Direct memory access by peripherals without CPU copy", "Programmed I/O", "Memory-mapped I/O only", "Interrupt coalesce"),
    ("flip-flop", "Edge-triggered bit storage element", "Combinational gate only", "Latch level-sensitive twin", "SRAM cell only"),
    ("combinational logic", "Outputs depend only on current inputs", "Sequential stateful", "Async FSM", "Clocked register"),
    ("sequential logic", "Outputs depend on inputs and state", "Pure combinational", "ROM lookup only", "PLA sum-of-products"),
    ("MUX", "Selects one of several inputs via select lines", "Decoder one-hot", "Encoder priority", "Adder carry"),
    ("decoder", "Converts binary input to one-hot outputs", "MUX select", "Priority encoder", "Demux route"),
    ("FSM", "Finite-state machine with states and transitions", "Turing machine infinite tape", "Petri net", "Dataflow graph"),
    ("boolean algebra", "Algebra of true/false with AND/OR/NOT", "Linear algebra", "Modular arithmetic", "Tropical semiring"),
    ("Karnaugh map", "Visual minimization of boolean functions", "Quine-McCluskey tabular", "Espresso heuristic", "BDD diagram"),
    ("two's complement", "Binary representation for signed integers", "Sign-magnitude", "Ones' complement", "Excess-n bias"),
    ("IEEE 754", "Standard for floating-point representation", "Fixed-point only", "BCD decimal", "Posit format only"),
    ("Harvard architecture", "Separate instruction and data memories", "Von Neumann unified", "Modified Harvard cache", "Stack machine"),
    ("von Neumann", "Shared memory for instructions and data", "Harvard split", "Dataflow token", "Systolic array"),
]

C["os"] = [
    ("process", "Instance of a program in execution with its own address space", "Thread sharing AS", "Coroutine user", "Fiber lightweight"),
    ("thread", "Schedulable unit of execution within a process", "Process isolation", "Interrupt handler only", "Kernel module"),
    ("context switch", "Saving/restoring CPU state to change tasks", "Syscall transition only", "Page fault handle", "Signal delivery"),
    ("scheduling", "Selecting which ready task runs next", "Memory allocation", "I/O buffering", "IPC pipe"),
    ("mutex", "Lock ensuring mutual exclusion on a critical section", "Condition variable wait", "Semaphore counting only", "Spin barrier"),
    ("semaphore", "Counter for signaling and limiting concurrency", "Mutex binary only", "RWLock readers", "Futex wait"),
    ("deadlock", "Cycle of waits preventing progress", "Livelock spinning", "Starvation unfair", "Race benign"),
    ("race condition", "Outcome depends on uncontrolled timing", "Deterministic lockstep", "Deadlock cycle", "Priority inversion"),
    ("virtual memory OS", "Per-process address spaces backed by RAM/disk", "Physical contiguous only", "Segmentation alone", "Arena malloc"),
    ("page", "Fixed-size unit of virtual memory mapping", "Segment variable", "Cache line", "Disk block alone"),
    ("swap", "Moving pages between RAM and secondary storage", "Cache eviction only", "Compress zram only", "NUMA migrate"),
    ("file system", "Organization of files and directories on storage", "Block device raw", "Volume manager", "Object store API"),
    ("inode", "Metadata structure describing a file", "Directory entry name", "Superblock FS", "Journal txn"),
    ("system call", "Controlled entry from user to kernel services", "Library wrapper only", "Interrupt IRQ", "Hypercall VM"),
    ("kernel", "Privileged core managing hardware and abstractions", "Userland daemon", "Hypervisor L0", "Firmware BIOS"),
    ("user mode", "Restricted CPU privilege for applications", "Kernel ring 0", "Hypervisor root", "SMM mode"),
    ("interrupt handler", "Kernel routine responding to a hardware interrupt", "Syscall path", "Softirq bottom half only", "NMI watchdog"),
    ("IPC", "Mechanisms for processes to communicate", "Shared cache lines only", "DMA peer", "RPC remote only"),
    ("pipe", "Unidirectional byte stream between processes", "Socket network", "Shared memory map", "Message queue"),
    ("signal", "Async notification delivered to a process", "Exception CPU fault", "Eventfd Linux only", "Futex wake"),
    ("priority inversion", "Low-priority lock holder blocks higher priority", "Priority inheritance fix", "Deadlock cycle", "Convoy lock"),
    ("thrashing", "Excessive paging destroying useful progress", "Cache thrash only", "Scheduler convoy", "Lock contention"),
    ("copy-on-write", "Defer copying pages until a write occurs", "Eager deep copy", "Shared readonly only", "Relocate PIC"),
    ("daemon", "Background service process typically without TTY", "Interactive shell", "Kernel thread only", "Init script"),
    ("bootloader", "Program loading the OS kernel at startup", "Init system", "Firmware UEFI only", "kexec jump"),
    ("driver", "Software controlling a hardware device", "User library", "Syscall table", "cgroup controller"),
    ("cgroup", "Linux mechanism limiting resource usage of process groups", "namespace isolation only", "seccomp filter", "capabilities"),
    ("namespace", "Isolation of system resource views (pid, net, mnt)", "cgroup limits", "chroot alone", "container runtime"),
    ("preemption", "Forcibly interrupting a running task to schedule another", "Cooperative yield only", "Interrupt disable", "Soft affinity"),
    ("critical section", "Code accessing shared state needing synchronization", "Lock-free algorithm", "Read-only path", "RCU grace"),
]

C["networks"] = [
    ("OSI model", "Seven-layer conceptual network stack", "TCP/IP four-layer", "SOAP envelope", "RPC stub"),
    ("TCP/IP model", "Internet layering: link, internet, transport, application", "OSI seven exact", "SS7 telephony", "InfiniBand verbs"),
    ("IP", "Internet Protocol for addressing and routing packets", "TCP reliability", "UDP datagrams", "ICMP control only"),
    ("TCP", "Reliable ordered byte-stream transport", "UDP unreliable", "QUIC always", "SCTP multi-homing"),
    ("UDP", "Unreliable connectionless datagram transport", "TCP handshake", "TLS record", "HTTP/2 streams"),
    ("HTTP", "Application protocol for web request/response", "FTP file transfer", "SMTP mail", "DNS query"),
    ("DNS", "Resolves domain names to IP addresses", "DHCP address lease", "ARP MAC resolve", "NTP time"),
    ("DHCP", "Dynamically assigns IP configuration to hosts", "DNS lookup", "NAT translation", "BGP route"),
    ("NAT", "Rewrites addresses to share public IPs", "Firewall ACL only", "VPN tunnel", "Proxy forward"),
    ("routing", "Selecting paths for packets across networks", "Switching L2 only", "Bridging flood", "Load balance L7"),
    ("switching", "Forwarding frames within a Layer-2 domain", "IP routing", "NAT rewrite", "MPLS label"),
    ("MAC address", "Link-layer hardware address", "IPv4 host", "Port number", "ASN BGP"),
    ("subnet mask", "Bits distinguishing network and host portions", "Default gateway", "DNS suffix", "MTU size"),
    ("CIDR", "Prefix-length notation for IP networks", "Classful A/B/C only", "NAT pool", "VLAN tag"),
    ("port number", "Transport demux identifier for applications", "IP protocol number", "Ethertype", "VLAN ID"),
    ("three-way handshake", "TCP SYN/SYN-ACK/ACK connection setup", "UDP connect", "TLS 1-RTT", "QUIC 0-RTT"),
    ("congestion control", "Adjusting send rate to avoid network overload", "Flow control window only", "QoS marking", "Traffic shape"),
    ("flow control", "Preventing sender from overwhelming receiver", "Congestion AIMD", "Priority queue", "ECN bit"),
    ("packet", "Network-layer unit of data", "Frame L2", "Segment TCP", "Message app"),
    ("latency", "Time delay for data to traverse a path", "Bandwidth capacity", "Jitter variance", "Loss rate"),
    ("bandwidth", "Data capacity of a link over time", "Latency delay", "Goodput app", "RTT measure"),
    ("RTT", "Round-trip time for a packet and its ack", "One-way delay", "Jitter buffer", "Timeout RTO"),
    ("TLS", "Cryptographic protocol securing application streams", "IPsec network", "SSH shell", "WPA wireless"),
    ("firewall", "Policy filter for permitted traffic", "IDS detect only", "WAF app only", "Proxy cache"),
    ("CDN", "Distributed caches delivering content near users", "Origin server only", "Anycast DNS alone", "Load balancer L4"),
    ("BGP", "Inter-domain routing protocol of the Internet", "OSPF intra-domain", "RIP distance", "IS-IS link"),
    ("ARP", "Maps IPv4 addresses to MAC on a LAN", "NDP IPv6", "DNS A record", "DHCP offer"),
    ("MTU", "Maximum transmission unit size of a link", "MSS TCP", "Window scale", "Jumbo frame only"),
    ("socket", "Endpoint abstraction for network communication", "File inode", "Pipe FIFO", "Shared memory"),
    ("REST", "HTTP-centric architectural style for APIs", "SOAP RPC XML", "gRPC streams only", "GraphQL query only"),
]

C["cyber"] = [
    ("CIA triad", "Confidentiality, integrity, and availability goals", "AAA accounting only", "STRIDE threats", "OWASP top"),
    ("authentication", "Verifying claimed identity", "Authorization rights", "Accounting audit", "Encryption secrecy"),
    ("authorization", "Granting permissions to authenticated principals", "Authentication identity", "Auditing logs", "Non-repudiation"),
    ("encryption", "Transforming plaintext to ciphertext with a key", "Hashing one-way", "Encoding Base64", "Obfuscation trivial"),
    ("hashing", "One-way digest for integrity and commitments", "Encryption reversible", "MAC keyed", "Signature asymmetric"),
    ("malware", "Malicious software harming systems or data", "Benign bug", "Phishing social only", "Misconfig drift"),
    ("phishing", "Social engineering via deceptive messages", "SQL injection", "Buffer overflow", "XSS stored"),
    ("XSS", "Injecting scripts into web pages viewed by others", "CSRF request forge", "SQLi query", "SSRF server"),
    ("SQL injection", "Inserting attacker SQL via unsanitized input", "XSS script", "Command injection twin", "LDAP inject"),
    ("CSRF", "Forcing authenticated users to submit unwanted requests", "XSS steal cookie", "Clickjacking UI", "CORS misconfig"),
    ("privilege escalation", "Gaining higher rights than intended", "Lateral movement", "Persistence implant", "Exfil channel"),
    ("firewall cyber", "Network filter enforcing allow/deny policies", "IDS signature", "EDR endpoint", "SIEM correlate"),
    ("IDS", "Intrusion detection monitoring for attacks", "IPS blocking twin", "Firewall stateful", "Honeypot decoy"),
    ("IPS", "Intrusion prevention that can block traffic", "IDS alert only", "WAF rules", "NAC admit"),
    ("VPN", "Encrypted tunnel for remote network access", "TLS website only", "SSH port forward alone", "Tor onion"),
    ("zero trust", "Never trust, always verify access model", "Castle-and-moat perimeter", "VPN-only trust", "Air gap alone"),
    ("MFA", "Multi-factor authentication combining factors", "Password only", "SSO federation alone", "Certificate pin"),
    ("vulnerability", "Weakness that can be exploited", "Threat actor", "Exploit payload", "Risk residual"),
    ("exploit", "Technique/code taking advantage of a vulnerability", "Patch fix", "CVE catalog entry", "PoC writeup only"),
    ("CVE", "Common Vulnerabilities and Exposures identifier", "CWE weakness class", "CVSS score", "NVD feed"),
    ("penetration test", "Authorized simulated attack to find weaknesses", "Vulnerability scan only", "Red team full", "Bug bounty"),
    ("social engineering", "Manipulating people to divulge access or info", "Cryptanalysis math", "Fuzzing inputs", "Side channel"),
    ("ransomware", "Malware encrypting data for extortion", "Spyware observe", "Worm self-replicate", "Rootkit hide"),
    ("least privilege", "Granting only necessary permissions", "Need-to-know data", "Defense in depth", "Separation of duties"),
    ("defense in depth", "Layered overlapping controls", "Single strong control", "Security through obscurity", "Perimeter only"),
    ("certificate", "Signed binding of identity to a public key", "Raw public key", "Password hash", "OTP seed"),
    ("PKI", "Infrastructure for issuing and validating certificates", "Symmetric KMS only", "Web of trust PGP", "SSH known_hosts"),
    ("secure SDLC", "Integrating security throughout development", "Pen-test at end only", "Ops firewall only", "Compliance checkbox"),
    ("logging", "Recording security-relevant events for analysis", "Metrics gauges", "Tracing spans", "Alerting pages"),
    ("incident response", "Process to detect, contain, and recover from breaches", "Threat modeling design", "Tabletop exercise only", "Forensics disk only"),
]

print('mid', len(C))

C["crypto"] = [
    ("symmetric encryption", "Same key used to encrypt and decrypt", "Public-key pair", "One-way hash", "Digital signature"),
    ("asymmetric encryption", "Public encrypt / private decrypt key pair", "Shared secret only", "MAC integrity", "Stream cipher"),
    ("AES", "Widely used symmetric block cipher standard", "RSA public-key", "SHA-256 hash", "ChaCha20 stream twin"),
    ("RSA", "Public-key system based on factoring hardness", "ECC curves", "Diffie-Hellman KE", "AES-GCM"),
    ("ECC", "Public-key crypto using elliptic curve discrete log", "RSA moduli", "DSA finite field", "Lattice Kyber"),
    ("hash function", "Deterministic one-way fixed-length digest", "PRP cipher", "PRF keyed", "KDF stretch"),
    ("SHA-256", "256-bit cryptographic hash in SHA-2 family", "MD5 broken", "SHA-1 weak", "Blake3 fast"),
    ("MAC", "Keyed integrity tag authenticating a message", "Unkeyed hash", "Digital signature asymmetric", "CRC checksum"),
    ("HMAC", "MAC construction using a hash function and key", "CMAC block", "Poly1305 AEAD", "GCM tag"),
    ("digital signature", "Asymmetric proof of origin and integrity", "MAC shared key", "Encryption secrecy", "Commitment hide"),
    ("Diffie-Hellman", "Key agreement over public channel", "RSA encrypt message", "AES session", "PAKE password"),
    ("nonce", "Number used once to prevent replay", "Salt password", "IV cipher mode", "Counter block"),
    ("IV", "Initialization vector for cipher modes", "Key material", "Salt KDF", "Nonce AEAD"),
    ("salt", "Random value mixed into password hashing", "Pepper secret", "IV CBC", "Nonce GCM"),
    ("KDF", "Derives keys from passwords or key material", "RNG entropy", "PRNG stream", "Hash compress"),
    ("PBKDF2", "Password-based KDF with iterated HMAC", "bcrypt adaptive", "scrypt memory", "Argon2 winner"),
    ("perfect forward secrecy", "Past sessions safe if long-term key leaks", "Static RSA key exchange", "Session ticket immortal", "PSK only"),
    ("certificate crypto", "Signed statement binding identity to public key", "Self-signed trust anchor alone", "Raw key pin", "TOFU SSH"),
    ("CA", "Certificate authority issuing trusted certs", "RA registration", "OCSP status", "CRL list"),
    ("TLS handshake", "Negotiates keys and authenticates endpoints", "TCP handshake", "IPsec IKE twin", "SSH kex"),
    ("side-channel attack", "Exploits timing/power/cache leakage", "Cryptanalysis math only", "Brute force keyspace", "Social engineer"),
    ("chosen plaintext", "Attacker can encrypt chosen messages", "Ciphertext only", "Known plaintext", "Chosen ciphertext"),
    ("IND-CPA", "Indistinguishability under chosen-plaintext attack", "INT-CTXT integrity", "EUF-CMA signatures", "CCA2 decryption"),
    ("stream cipher", "Encrypts by XORing a keystream", "Block ECB", "Feistel network", "SPN AES"),
    ("block cipher", "Encrypts fixed-size blocks under a key", "Stream OTP", "Hash sponge", "Public trapdoor"),
    ("mode of operation", "How a block cipher secures arbitrary-length data", "Key schedule", "S-box design", "Feistel round"),
    ("GCM", "Authenticated encryption mode with GHASH tag", "CBC+HMAC compose", "CTR unauth", "ECB insecure"),
    ("zero-knowledge proof", "Prove statement without revealing witness", "Commitment hide-open", "Blind signature", "MPC share"),
    ("post-quantum", "Crypto intended to resist quantum attacks", "Classical RSA forever", "Symmetric only double", "Hash-based only"),
    ("entropy", "Unpredictability of a secret or RNG source", "Key length bits alone", "Confusion diffusion", "Avalanche hash"),
]

C["db"] = [
    ("relation", "Table of tuples under a schema", "Document collection", "Graph nodes", "Key-value pair"),
    ("primary key", "Unique identifier for rows in a table", "Foreign key ref", "Secondary index", "Surrogate UUID alone"),
    ("foreign key", "Column referencing another table's key", "Primary uniqueness", "Check constraint", "Unique index"),
    ("SQL", "Declarative language for relational data", "Procedural PL only", "Graph QL only", "Mongo MQL"),
    ("SELECT", "Query clause retrieving rows/columns", "INSERT write", "UPDATE modify", "DELETE remove"),
    ("JOIN", "Combines rows from tables on a condition", "UNION set", "GROUP BY agg", "WINDOW frame"),
    ("INNER JOIN", "Returns matching rows from both sides", "LEFT OUTER keep left", "CROSS product", "FULL OUTER"),
    ("LEFT JOIN", "Keeps all left rows; nulls when no match", "INNER matches only", "RIGHT twin", "SEMI exists"),
    ("WHERE", "Filters rows before grouping", "HAVING after group", "ON join cond", "QUALIFY window"),
    ("GROUP BY", "Aggregates rows sharing key values", "ORDER BY sort", "DISTINCT dedupe", "PARTITION BY"),
    ("HAVING", "Filters groups after aggregation", "WHERE pre-agg", "LIMIT count", "OFFSET skip"),
    ("index", "Auxiliary structure speeding lookups", "Full table scan", "Materialized view", "Sequence object"),
    ("B-tree index", "Balanced tree index for range and equality", "Hash equality only", "Bitmap flags", "GIN inverted"),
    ("transaction", "Atomic unit of reads/writes", "Autocommit statement", "Savepoint nest", "2PC prepare"),
    ("ACID", "Atomicity, consistency, isolation, durability", "BASE eventual", "CAP theorem", "PACELC latency"),
    ("isolation level", "Controls visibility of concurrent transactions", "Lock timeout", "Deadlock victim", "MVCC snapshot"),
    ("normalization", "Reducing redundancy via schema design", "Denormalize speed", "Star schema BI", "Wide column"),
    ("1NF", "Atomic attribute values; no repeating groups", "2NF partial deps", "3NF transitive", "BCNF determinants"),
    ("2NF", "1NF plus no partial dependency on composite key", "3NF transitive", "DKNF domain", "4NF MVD"),
    ("3NF", "No transitive dependency of non-keys on key", "BCNF stricter", "EKNF", "5NF join"),
    ("view", "Stored query presented as a virtual table", "Materialized cached", "Temp table", "CTE with"),
    ("stored procedure", "Server-side procedural routine", "Trigger event", "UDF scalar", "Prepared statement"),
    ("trigger", "Automatic action fired by table events", "Check constraint", "Rule rewrite", "Event notify"),
    ("ORM", "Maps objects to relational tables", "Raw SQL only", "Query builder", "Data mapper twin"),
    ("NoSQL", "Non-relational stores (doc/kv/col/graph)", "Only SQL engines", "NewSQL hybrid", "CSV files"),
    ("document store", "Database of JSON-like documents", "Wide-column", "Graph edges", "Time-series"),
    ("CAP theorem", "Tradeoffs among consistency, availability, partition tolerance", "ACID local", "BASE soft", "PACELC"),
    ("replication", "Copying data across nodes for HA/scale", "Sharding partition", "Backup dump", "Failover VIP"),
    ("sharding", "Partitioning data across multiple servers", "Replica copy", "Vertical scale", "Federation"),
    ("EXPLAIN", "Shows the query planner's chosen plan", "ANALYZE stats", "VACUUM clean", "REINDEX rebuild"),
]

C["parallel"] = [
    ("parallelism", "Doing multiple operations simultaneously", "Concurrency interleaving", "Async callbacks", "Pipelining stages"),
    ("concurrency", "Structuring overlapping task progress", "Parallel multicore only", "SIMD vector", "GPU SIMT"),
    ("speedup", "Ratio of sequential time to parallel time", "Efficiency utilization", "Amdahl serial", "Gustafson scale"),
    ("Amdahl's law", "Limits speedup given a serial fraction", "Gustafson scaled", "Little's law", "Universal scalability"),
    ("shared memory", "Threads communicate via common address space", "Message passing", "DSM distributed", "RDMA remote"),
    ("message passing", "Processes communicate by sending messages", "Shared heap", "Lock-free queue only", "RPC stub alone"),
    ("MPI", "Standard API for distributed message passing", "OpenMP shared", "CUDA kernels", "Spark RDD"),
    ("OpenMP", "Pragma-based shared-memory parallelism", "MPI ranks", "TBB tasks", "Cilk spawn"),
    ("race condition parallel", "Bug from unsynchronized concurrent access", "Deterministic reduce", "Barrier sync", "Atomic RMW"),
    ("barrier", "Synchronization where all must arrive before proceed", "Mutex lock", "Condition wait", "Latch count"),
    ("lock-free", "Algorithm guaranteeing system-wide progress without locks", "Blocking mutex", "Wait-free stronger", "Obstruction-free"),
    ("atomic operation", "Indivisible read-modify-write at hardware/API", "Volatile load", "Mutex critical", "Memory fence only"),
    ("false sharing", "Performance hit when cores bounce same cache line", "True data race", "NUMA remote", "TLB shootdown"),
    ("NUMA", "Memory access cost depends on locality to CPU", "UMA uniform", "COMA cache-only", "GPU HBM"),
    ("load balancing", "Distributing work to avoid idle workers", "Work stealing", "Static partition", "Central queue"),
    ("work stealing", "Idle workers take tasks from busy workers' queues", "Central dispatcher", "Static chunks", "Actor mailbox"),
    ("MapReduce", "Parallel map then shuffle-reduce paradigm", "MPI collective only", "BSP superstep", "Stream process"),
    ("distributed system", "Multiple networked computers coordinating", "SMP shared", "Single host threads", "Embedded RTOS"),
    ("consensus", "Agreeing on a value despite faults", "Gossip eventual", "Leader election alone", "Quorum read"),
    ("Paxos", "Classic consensus protocol family", "Raft simpler", "2PC commit", "Zab ZK"),
    ("Raft", "Consensus protocol with leader election and log", "Paxos multi", "PBFT Byzantine", "Viewstamped"),
    ("CAP parallel", "Consistency/availability/partition tradeoffs", "ACID single node", "BASE soft state", "FLP impossibility"),
    ("eventual consistency", "Replicas converge if updates stop", "Strong linearizability", "Causal order", "Sequential consistency"),
    ("RPC", "Calling a procedure on a remote machine", "Local function", "Message queue async", "gRPC HTTP/2"),
    ("actor model", "Isolated actors communicate via messages", "Shared-memory threads", "CSP channels twin", "Dataflow tokens"),
    ("SIMD", "Single instruction operates on multiple data lanes", "MIMD multicore", "MISD rare", "SISD scalar"),
    ("GPU computing", "Massively parallel throughput on accelerators", "CPU latency cores", "FPGA fabric", "TPU systolic"),
    ("deadlock parallel", "Circular wait among concurrent tasks", "Livelock retry", "Starvation unfair", "Priority invert"),
    ("scalability", "Ability to handle growth by adding resources", "Latency absolute", "Throughput peak only", "Efficiency ratio"),
    ("straggler", "Slow task delaying overall completion", "Speculative retry fix", "Skew key", "Hot partition"),
]

C["compilers"] = [
    ("lexer", "Tokenizer converting source text to tokens", "Parser AST", "Semantic analyzer", "Codegen emitter"),
    ("parser", "Builds syntactic structure from tokens", "Lexer scan", "Type checker", "Optimizer pass"),
    ("AST", "Abstract syntax tree representing program structure", "CST concrete", "CFG control-flow", "SSA form"),
    ("CFG grammar", "Context-free grammar describing syntax", "Regular lexer", "Attribute grammar", "PEG parser"),
    ("LL parser", "Top-down leftmost derivation parser", "LR bottom-up", "LALR table", "GLR ambiguous"),
    ("LR parser", "Bottom-up shift-reduce parser", "Recursive descent LL", "Pratt precedence", "Earley general"),
    ("semantic analysis", "Checks types and meaning beyond syntax", "Lexing tokens", "Parsing CFG", "Register alloc"),
    ("type checking", "Ensuring expressions obey type rules", "Name resolution", "Control-flow", "Dataflow liveness"),
    ("IR", "Intermediate representation between front and back ends", "Source text", "Machine code", "Object file"),
    ("SSA", "Static single assignment form of IR", "Three-address naive", "CPS continuation", "ANF admin"),
    ("optimization", "Transforms improving performance/size preserving semantics", "Pretty print", "Desugar only", "Link edit"),
    ("constant folding", "Evaluating constant expressions at compile time", "CSE eliminate", "DCE dead", "Inlining"),
    ("dead code elimination", "Removing unreachable or unused computations", "Loop unrolling", "Strength reduce", "Peephole"),
    ("inlining", "Replacing a call with the callee body", "Tail call opt", "Outlining", "Specialization"),
    ("register allocation", "Assigning temporaries to machine registers", "Instruction select", "Scheduling issue", "Spill store"),
    ("instruction selection", "Mapping IR ops to target instructions", "Regalloc coloring", "Peephole local", "ABI lower"),
    ("linking", "Combining object files and resolving symbols", "Assembling mnemonics", "Loading runtime", "Relocating"),
    ("symbol table", "Maps identifiers to attributes/bindings", "Relocation table", "String pool", "VTable layout"),
    ("scope", "Region where a name binding is visible", "Lifetime storage", "Linkage extern", "Namespace C++"),
    ("binding", "Association of a name with a language entity", "Assignment store", "Capture closure", "Import module"),
    ("closure", "Function plus its captured environment", "Function pointer bare", "Object method", "Coroutine frame"),
    ("runtime system", "Support services for executed programs", "Compiler frontend", "OS kernel", "Assembler"),
    ("JIT", "Compile to native code at runtime", "AOT ahead-of-time", "Interpreter loop", "Transpile source"),
    ("interpreter", "Executes source/IR by direct evaluation", "Native binary", "Bytecode VM twin", "Macro expander"),
    ("bytecode compilers", "Portable instruction set for a VM", "Native ISA", "SSA IR only", "WASM module twin"),
    ("type inference", "Deducing types without full annotations", "Dynamic typing", "Gradual checks", "Dependent proof"),
    ("overloading", "Multiple entities sharing a name distinguished by types", "Overriding dynamic", "Shadowing nest", "Aliasing typedef"),
    ("name mangling", "Encoding symbol names with type info for linkers", "Demangling tools", "Decorated Windows", "Export ordinal"),
    ("frontend", "Lex/parse/semantic phases of a compiler", "Backend codegen", "Middle-end opt", "Driver CLI"),
    ("backend", "Code generation and machine-specific passes", "Frontend parse", "Typecheck", "Macro hygiene"),
]

print('mid2', len(C))

C["embedded"] = [
    ("microcontroller", "SoC with CPU, memory, and peripherals for control", "Application CPU only", "FPGA fabric", "DSP board"),
    ("GPIO", "General-purpose digital input/output pins", "ADC analog", "UART serial", "I2C bus"),
    ("ADC", "Converts analog voltage to digital values", "DAC reverse", "PWM duty", "Comparator"),
    ("DAC", "Converts digital values to analog signals", "ADC sample", "Op-amp gain", "Filter RC"),
    ("PWM", "Pulse-width modulation encoding via duty cycle", "PCM audio", "PDM mic", "Sigma-delta"),
    ("UART", "Asynchronous serial byte communication", "SPI sync", "I2C multi", "CAN auto"),
    ("SPI", "Synchronous serial with clock and chip-select", "I2C address", "UART async", "USB host"),
    ("I2C", "Two-wire multi-device serial bus with addresses", "SPI full-duplex", "1-Wire single", "SMBus twin"),
    ("ISR", "Interrupt service routine handling an IRQ", "Main loop poll", "DMA callback", "Soft timer"),
    ("RTOS", "Real-time OS with deterministic scheduling", "GPOS Linux desktop", "Bare-metal loop", "Hypervisor"),
    ("watchdog timer", "Resets system if not periodically kicked", "SysTick tick", "RTC clock", "WDT disable risk"),
    ("flash memory", "Non-volatile program/data storage", "SRAM volatile", "DRAM refresh", "EEPROM small"),
    ("SRAM", "Fast volatile static RAM on-chip or external", "Flash NV", "EEPROM", "FRAM"),
    ("DMA embedded", "Peripheral moves data without CPU copy loops", "PIO bitbang", "ISR byte copy", "Cache DMA"),
    ("bare metal", "Firmware without a full OS", "RTOS tasks", "Linux embedded", "Android Things"),
    ("bootloader embedded", "First-stage code loading application firmware", "App main", "OTA updater", "JTAG probe"),
    ("JTAG", "Debug/test access port for chips", "SWD ARM twin", "UART console", "SWO trace"),
    ("debounce", "Filtering mechanical switch bounce", "Schmitt trigger", "Pull-up resistor", "RC snubber"),
    ("power domain", "Independently powered section of a chip/board", "Clock domain", "Reset domain", "Voltage rail"),
    ("brown-out", "Reset/protection when supply voltage drops", "Watchdog timeout", "Thermal throttle", "UVLO"),
    ("sensor", "Device measuring physical quantities", "Actuator output", "Transducer twin", "ADC frontend"),
    ("actuator", "Device producing physical action from signals", "Sensor input", "Motor driver", "Relay switch"),
    ("IoT", "Networked embedded devices sensing/actuating world", "Desktop cloud", "Mainframe", "Batch HPC"),
    ("MQTT", "Lightweight pub/sub messaging for IoT", "HTTP REST", "CoAP constrained", "AMQP heavy"),
    ("CoAP", "Constrained application protocol over UDP", "MQTT broker", "HTTP/2", "WebSocket"),
    ("OTA update", "Over-the-air firmware update mechanism", "USB flash only", "JTAG reprogram", "Factory ISP"),
    ("low power mode", "CPU/peripheral sleep states reducing energy", "Busy wait", "Max turbo", "Brown-out"),
    ("memory-mapped I/O", "Device registers accessed as memory addresses", "Port-mapped x86", "DMA descriptor", "PIO"),
    ("endianness embedded", "Byte order affecting multi-byte peripheral regs", "Bit order SPI", "Alignment fault", "Pack pragma"),
    ("CRC", "Checksum detecting accidental data corruption", "Cryptographic hash", "ECC correct", "Parity bit"),
]

C["htmlcss"] = [
    ("HTML element", "Document node with a tag name and content/attrs", "CSS rule", "DOM event", "HTTP header"),
    ("DOCTYPE", "Declaration identifying HTML document type", "xml prolog", "meta charset", "lang attr"),
    ("semantic HTML", "Elements conveying meaning (header,nav,article)", "div soup only", "span styling", "table layout"),
    ("attribute", "Key/value metadata on an HTML element", "CSS property", "JS variable", "ARIA role twin"),
    ("DOM", "Tree representation of the document in the browser", "CSSOM styles", "Render tree", "Accessibility tree"),
    ("CSS selector", "Pattern matching elements to style", "XPath query", "JS querySelector twin", "media query"),
    ("specificity", "Algorithm deciding which CSS rule wins", "Cascade order only", "Importance !important alone", "Inheritance"),
    ("cascade", "Rules for combining styles from multiple sources", "Specificity calc", "Inheritance defaults", "Containment"),
    ("box model", "Content, padding, border, and margin of a box", "Flex formatting", "Grid tracks", "Positioning"),
    ("margin", "Outer space outside the border", "Padding inner", "Border edge", "Gap flex"),
    ("padding", "Inner space between content and border", "Margin outer", "Outline", "Scroll gutter"),
    ("display", "Controls outer/inner layout modes of an element", "position scheme", "float legacy", "z-index stack"),
    ("flexbox", "One-dimensional layout for alignment and distribution", "Grid two-dim", "float clear", "table-cell"),
    ("CSS Grid", "Two-dimensional layout with rows and columns", "Flex one-dim", "multicol columns", "position abs"),
    ("position absolute", "Positioned relative to nearest positioned ancestor", "relative offset", "fixed viewport", "sticky scroll"),
    ("position relative", "Offsets from normal position without leaving flow", "absolute remove", "static default", "fixed"),
    ("media query", "Conditional CSS based on viewport/device features", "container query", "supports feature", "@import"),
    ("responsive design", "Layouts adapting across screen sizes", "fixed pixel only", "user-agent sniff", "zoom disable"),
    ("viewport", "Visible area used for layout on the device", "document scrollHeight", "iframe window", "visualViewport"),
    ("pseudo-class", "Selects elements in a particular state", "pseudo-element ::", "attribute selector", "id selector"),
    ("pseudo-element", "Styles a portion of an element like ::before", "pseudo-class :hover", "shadow DOM", "slot"),
    ("class selector", "Matches elements with a given class attribute", "id uniqueness", "tag type", "universal *"),
    ("id selector", "Matches the unique id attribute", "class reusable", "specificity note", "name attr"),
    ("inheritance CSS", "Some properties pass to descendants by default", "all: initial", "revert layer", "unset"),
    ("z-index", "Stacking order of positioned elements", "paint order non-pos", "isolation", "mix-blend"),
    ("opacity", "Transparency of an element and its descendants", "rgba alpha color only", "visibility hide", "display none"),
    ("transition", "Interpolates property changes over time", "animation keyframes", "transform GPU", "will-change"),
    ("animation", "Keyframed motion defined in CSS", "transition simple", "WAAPI JS", "SMIL SVG"),
    ("accessibility HTML", "Markup/practices enabling assistive tech use", "ARIA only without HTML", "color contrast alone", "SEO meta"),
    ("ARIA", "Attributes enhancing accessibility semantics", "role conflict native", "tabindex focus", "alt text"),
]

C["webtech"] = [
    ("HTTP method", "Verb indicating desired action (GET/POST/...)", "Status code", "Header field", "Cookie jar"),
    ("status code", "Numeric result of an HTTP request", "Method verb", "MIME type", "Cache directive"),
    ("REST API", "Resource-oriented HTTP API design style", "SOAP XML RPC", "GraphQL flexible", "gRPC binary"),
    ("JSON", "Text data format of objects and arrays", "XML tags", "YAML indent", "Protobuf binary"),
    ("CORS", "Browser mechanism controlling cross-origin HTTP", "CSP script policy", "SameSite cookie", "CSRF token"),
    ("cookie", "Small data stored by browser per site", "localStorage", "sessionStorage", "IndexedDB"),
    ("session", "Server-side or token-based authenticated state", "Stateless JWT alone", "Cookie session id", "OAuth grant"),
    ("JWT", "Signed token carrying claims for authz/authn", "Opaque session id", "Paseto twin", "SAML assertion"),
    ("OAuth", "Delegated authorization framework", "OpenID Connect identity", "SAML enterprise", "API key static"),
    ("OpenID Connect", "Identity layer on top of OAuth 2", "OAuth scopes only", "SAML IdP", "mTLS client"),
    ("WebSocket", "Full-duplex persistent browser connection", "HTTP polling", "SSE one-way", "long poll"),
    ("SSE", "Server-sent events over HTTP stream", "WebSocket bi", "gRPC stream", "MQTT"),
    ("CDN web", "Edge caches accelerating static/dynamic content", "Origin only", "Reverse proxy alone", "DNS anycast"),
    ("reverse proxy", "Server forwarding client requests to backends", "Forward proxy client", "Load balancer L4", "API gateway"),
    ("load balancer", "Distributes traffic across multiple instances", "Single origin", "DNS round-robin alone", "CDN PoP"),
    ("SSR", "Server-side rendering of HTML for clients", "CSR SPA only", "SSG static", "ISR revalidate"),
    ("CSR", "Client-side rendering via JavaScript in browser", "SSR HTML", "MPA multi-page", "HTMX enhance"),
    ("SPA", "Single-page app updating UI without full reloads", "MPA full navigations", "MPA islands", "PWA install"),
    ("PWA", "Installable web app with offline/service worker", "Native store only", "Browser extension", "Electron desktop"),
    ("service worker", "Background script proxying network for PWAs", "Web worker CPU", "SharedWorker", "Worklet"),
    ("GraphQL", "Query language letting clients specify fields", "REST endpoints", "SOAP WSDL", "gRPC proto"),
    ("gRPC", "HTTP/2 RPC with Protocol Buffers", "JSON REST", "XML-RPC", "Thrift"),
    ("middleware web", "Pipeline handlers wrapping request processing", "Controller action", "ORM model", "Template view"),
    ("rate limiting", "Restricting request frequency per client", "Caching ETag", "Compression gzip", "Retry backoff"),
    ("caching web", "Storing responses to avoid recomputation", "CDN edge", "Browser Cache-Control", "Redis session"),
    ("HTTPS", "HTTP over TLS encryption", "HTTP cleartext", "HTTP/3 QUIC", "WSS websocket"),
    ("DNS web", "Resolves hostnames for web origins", "TLS SNI", "HTTP Host header", "Anycast IP"),
    ("Same-Origin Policy", "Browser isolation of origins' scripting access", "CORS relaxation", "iframe sandbox", "COOP/COEP"),
    ("CSP", "Content Security Policy limiting resource loads", "CORS network", "Trusted Types", "SRI integrity"),
    ("API gateway", "Entry managing auth, routing, and quotas for APIs", "Service mesh sidecar", "Ingress k8s", "BFF pattern"),
]

C["jsts"] = [
    ("closure JS", "Function retaining access to its lexical scope", "Block scope let", "Module ESM", "Prototype chain"),
    ("hoisting", "Declarations treated as present in their scope", "TDZ let/const", "Import live", "Temporal dead"),
    ("event loop", "Queue-driven model scheduling JS callbacks", "OS thread preemption", "GPU pipeline", "WASM trap"),
    ("promise", "Object representing a future completion value", "callback hell only", "observable stream", "generator"),
    ("async/await", "Syntax for writing promise-based async code", "Promise.then chains only", "Fibers", "Green threads"),
    ("prototype", "Object used for property inheritance in JS", "Class static only", "__proto__ deprecated note", "Object.create"),
    ("this binding", "Receiver object for a function call", "Lexical arrow this", "call/apply/bind", "new target"),
    ("arrow function", "Concise function with lexical this", "Function declaration", "Method shorthand", "Generator *"),
    ("module ESM", "ECMAScript import/export module system", "CommonJS require", "AMD define", "UMD bundle"),
    ("CommonJS", "Node module system using require/module.exports", "ESM import", "JSON modules", "CJS interop"),
    ("TypeScript", "Typed superset compiling to JavaScript", "Flow checker", "JSDoc types only", "Dart VM"),
    ("type annotation", "Explicit type written on a TS binding", "Type inference", "Assertion as", "Satisfies op"),
    ("interface TS", "Structural contract for object shapes", "type alias union", "class implements", "abstract class"),
    ("type alias", "Name for a type expression", "interface merge", "enum numeric", "namespace"),
    ("union type", "Value that may be one of several types", "intersection &", "tuple fixed", "never bottom"),
    ("generics TS", "Parameterized types/functions", "any escape", "unknown safe", "conditional types"),
    ("narrowing", "Refining types via control-flow checks", "Type assertion force", "Cast angle", "Satisfies"),
    ("unknown", "Top type requiring narrowing before use", "any unchecked", "never empty", "object non-prim"),
    ("any", "Opt-out of type checking for a value", "unknown safer", "object", "Record string"),
    ("enum", "Named set of related constants", "union literals", "const object", "as const"),
    ("DOM API", "Browser interfaces for document manipulation", "Node fs", "Canvas 2D", "WebGL"),
    ("fetch", "Promise-based HTTP API in modern runtimes", "XMLHttpRequest", "axios library", "node http"),
    ("localStorage", "Persistent string key-value in the browser", "sessionStorage tab", "cookie small", "IndexedDB"),
    ("JSON.stringify", "Serializes a value to a JSON string", "JSON.parse", "structuredClone", "MessagePack"),
    ("strict mode", "Restricted JS semantics via 'use strict'", "sloppy mode", "module always strict", "asm.js"),
    ("Map", "Keyed collection preserving insertion order", "Object string keys", "WeakMap GC", "Set unique"),
    ("Set", "Collection of unique values", "Map entries", "WeakSet", "Array dedupe"),
    ("optional chaining", "?. safely accessing nested properties", "nullish ??", "&& guard", "try/catch"),
    ("nullish coalescing", "?? providing default for null/undefined", "|| falsy default", "ternary", "if null"),
    ("decorator TS", "Experimental/metaprogramming annotations on declarations", "attribute C#", "annotation Java", "proxy trap"),
]

print('mid3', len(C))

C["se"] = [
    ("requirements", "Statements of what a system must achieve", "Implementation details", "Test cases only", "Deploy scripts"),
    ("user story", "Short requirement from a user perspective", "Use case UML heavy", "Epic theme", "Spike research"),
    ("Agile", "Iterative adaptive software development approach", "Waterfall sequential", "Spiral risk", "V-model verify"),
    ("Scrum", "Agile framework with sprints, roles, and ceremonies", "Kanban flow", "XP practices", "SAFe scaled"),
    ("sprint", "Time-boxed iteration delivering increments", "Kanban continuous", "Release train", "Milestone waterfall"),
    ("CI", "Continuously integrating and testing changes", "CD deploy", "Code review only", "Nightly batch"),
    ("CD", "Automating delivery/deployment of builds", "CI compile test", "Feature flag", "Canary release"),
    ("unit test", "Test of a small isolated unit of code", "Integration multi", "E2E UI", "Mutation test"),
    ("integration test", "Test of interacting components together", "Unit mock heavy", "Contract consumer", "Chaos"),
    ("TDD", "Write failing tests before production code", "BDD scenarios", "DDD model", "ATDD accept"),
    ("code review", "Peer examination of changes before merge", "Pair programming live", "Static analysis only", "QA manual"),
    ("design pattern", "Reusable solution to a recurring design problem", "Algorithm puzzle", "Anti-pattern smell", "Idiom language"),
    ("SOLID", "Five OOP design principles for maintainability", "GRASP responsibilities", "DRY/KISS", "YAGNI"),
    ("DRY", "Don't Repeat Yourself; avoid duplication", "WET duplicate", "Copy-paste", "Abstraction overuse"),
    ("tech debt", "Deferred quality work increasing future cost", "Feature backlog", "Bug severity", "Ops toil"),
    ("version control", "Tracking and collaborating on code history", "Backup zip", "FTP deploy", "Wiki docs"),
    ("Git branching", "Isolating work on lines of development", "Trunk only", "Tag release", "Cherry-pick"),
    ("pull request", "Proposed change set for review and merge", "Direct push main", "Patch email", "RFC design"),
    ("UML", "Standardized diagrams for software structure/behavior", "ERD data only", "BPMN business", "C4 architecture"),
    ("API design", "Crafting interfaces for clients to consume", "UI wireframe", "DB schema only", "CLI flags"),
    ("refactoring", "Improving structure without changing behavior", "Rewrite greenfield", "Optimization only", "Feature add"),
    ("MVP", "Minimum viable product to learn from users", "Full launch", "Prototype throwaway", "PoC spike"),
    ("stakeholder", "Person/group with interest in project outcomes", "End user only", "Developer team", "Sponsor alone"),
    ("non-functional requirement", "Quality attribute like performance or security", "Functional feature", "User story", "Acceptance criteria"),
    ("acceptance criteria", "Conditions defining done for a requirement", "Definition of Done team", "Test plan", "SLA ops"),
    ("SDLC", "Lifecycle from idea through retirement", "Sprint only", "Incident response", "OKR planning"),
    ("waterfall", "Sequential phase-gated delivery model", "Agile iterate", "Lean startup", "DevOps continuous"),
    ("observability SE", "Ability to understand system state from outputs", "Monitoring thresholds", "Logging alone", "Tracing spans"),
    ("feature flag", "Runtime toggle enabling gradual rollout", "Branch deploy", "Config rebuild", "A/B assign"),
    ("postmortem", "Blameless review after an incident", "Root cause only blame", "Runbook update", "Retro sprint"),
]

C["devops"] = [
    ("CI/CD pipeline", "Automated build, test, and deploy workflow", "Manual FTP", "Cron compile", "Ticket deploy"),
    ("Infrastructure as Code", "Defining infra declaratively in versioned files", "ClickOps console", "Bash snowflake", "Runbook wiki"),
    ("container", "Isolated userspace package of app+deps", "VM full kernel", "Jail chroot", "WASM component"),
    ("Docker", "Popular platform for building/running containers", "Podman twin", "LXC system", "Firecracker microvm"),
    ("Kubernetes", "Orchestrator scheduling containers at scale", "Docker Swarm", "Nomad Hashi", "ECS AWS"),
    ("pod", "Smallest deployable Kubernetes unit", "Deployment replica", "Service VIP", "Ingress route"),
    ("service mesh", "Sidecar layer for service-to-service traffic", "API gateway edge", "Ingress only", "iptables"),
    ("observability", "Logs, metrics, and traces for system insight", "Alert fatigue", "Dashboard vanity", "Ping check"),
    ("Prometheus", "Pull-based metrics monitoring system", "Grafana visualize", "StatsD push", "OpenTelemetry"),
    ("Grafana", "Visualization and alerting dashboards", "Prometheus scrape", "Kibana logs", "Jaeger traces"),
    ("SLO", "Service level objective target for reliability", "SLA contract", "SLI measure", "Error budget"),
    ("SLI", "Quantitative indicator of service level", "SLO target", "SLA legal", "MTTR recover"),
    ("error budget", "Allowed unreliability derived from SLO", "Uptime 100%", "Pager duty", "Toil hours"),
    ("toil", "Manual repetitive operational work", "Automation eng", "Feature dev", "Oncall page"),
    ("blue-green deploy", "Switch traffic between two identical environments", "Canary partial", "Rolling update", "Recreate downtime"),
    ("canary deploy", "Gradual rollout to a subset of users", "Blue-green cutover", "Feature flag", "Shadow traffic"),
    ("rolling update", "Incrementally replacing instances with new versions", "Big bang", "Blue-green", "A/B experiment"),
    ("Terraform", "IaC tool using declarative HCL providers", "CloudFormation", "Pulumi general", "Ansible config"),
    ("Ansible", "Agentless config management via SSH/API", "Chef agent", "Puppet model", "Salt"),
    ("GitOps", "Desired state in Git reconciled to clusters", "Push CD scripts", "ClickOps", "Helm manual"),
    ("artifact registry", "Store for versioned build outputs", "Git source", "Container registry twin", "Maven Central"),
    ("secret management", "Storing and injecting credentials safely", "Env files in git", "Hardcoded keys", "ConfigMap plain"),
    ("chaos engineering", "Injecting faults to test resilience", "Load test only", "Unit mock", "GameDay"),
    ("runbook", "Documented operational procedure for incidents", "Postmortem", "Alert rule", "Dashboard"),
    ("on-call", "Rotation responsible for responding to pages", "Follow-the-sun", "NOC", "SRE ownership"),
    ("MTTR", "Mean time to recover from failures", "MTTF failure", "MTBF between", "Availability %"),
    ("horizontal scaling", "Adding more instances to handle load", "Vertical bigger box", "Autoscaling policy", "Shard data"),
    ("autoscaling", "Automatically adjusting capacity from signals", "Manual resize", "Scheduled scale", "Predictive ML"),
    ("immutable infra", "Replace servers rather than mutating them", "Snowflake servers", "Config drift", "Golden AMI"),
    ("SRE", "Reliability engineering applying software to ops", "Classic sysadmin", "Platform eng twin", "NOC L1"),
]

C["mobilecloud"] = [
    ("IaaS", "Cloud offering virtualized compute/storage/network", "PaaS platform", "SaaS app", "FaaS functions"),
    ("PaaS", "Managed platform for deploying applications", "IaaS VMs", "SaaS end-user", "CaaS containers"),
    ("SaaS", "Software delivered as a hosted service", "On-prem license", "PaaS runtime", "IaaS raw"),
    ("FaaS", "Event-driven functions without managing servers", "Long-running VM", "Container always-on", "Batch job"),
    ("region", "Geographic cloud area with multiple zones", "Availability zone", "Edge PoP", "Local zone"),
    ("availability zone", "Isolated datacenter within a region", "Region multi", "Fault domain", "Placement group"),
    ("object storage", "Durable blob storage addressed by keys", "Block volume", "File NFS", "Cold archive"),
    ("block storage", "Network disk volumes for VMs", "Object S3", "File share", "Local SSD"),
    ("CDN cloud", "Edge distribution of content globally", "Origin bucket", "Load balancer", "Anycast DNS"),
    ("serverless", "Cloud model abstracting server management", "Lift-and-shift VM", "Bare metal", "K8s node"),
    ("API gateway cloud", "Managed entry for APIs with auth and limits", "ALB L7", "Nginx proxy", "Service mesh"),
    ("mobile SDK", "Libraries for building mobile app features", "REST only", "WebView wrap", "PWA"),
    ("React Native", "Cross-platform mobile UI via React", "Flutter widgets", "Native Swift/Kotlin", "Xamarin"),
    ("Flutter", "Cross-platform UI toolkit using Dart", "React Native", "Ionic web", "SwiftUI"),
    ("push notification", "Server-initiated message to a device", "SMS gateway", "Email", "In-app poll"),
    ("offline-first", "Design allowing useful work without network", "Online-only API", "Optimistic sync", "Conflict CRDT"),
    ("OAuth mobile", "Delegated auth flows for mobile clients", "Embedded password", "API key in app", "Basic auth"),
    ("deep link", "URL opening a specific in-app location", "Universal link", "Intent Android", "Custom scheme"),
    ("app store", "Distribution platform for mobile applications", "Sideload APK", "Enterprise MDM", "PWA install"),
    ("multi-tenancy", "Single system serving isolated customers", "Single-tenant deploy", "Shard per customer", "Cell architecture"),
    ("elasticity", "Ability to scale resources up/down with demand", "Static capacity", "Burst credit", "Reserved instance"),
    ("VPC", "Isolated virtual network in the cloud", "Public internet", "VPN link", "Peering"),
    ("IAM cloud", "Identity and access management for cloud APIs", "OS users", "SSO IdP", "RBAC roles"),
    ("managed database", "DB service operated by the cloud provider", "Self-hosted VM DB", "Serverless DB twin", "Edge SQLite"),
    ("edge computing", "Processing near users/devices to cut latency", "Central region only", "CDN cache alone", "5G MEC"),
    ("hybrid cloud", "Combination of on-prem and public cloud", "Multi-cloud vendors", "Private cloud", "Colo"),
    ("multi-cloud", "Using multiple public cloud providers", "Hybrid on-prem", "Single vendor", "Sovereign cloud"),
    ("cold start", "Latency when starting an idle serverless function", "Warm instance", "Provisioned concurrency", "Keep-alive"),
    ("mobile analytics", "Telemetry on app usage and performance", "Crash reporting", "A/B assign", "Session replay"),
    ("BaaS", "Backend-as-a-Service for mobile/web apps", "Custom monolith", "Firebase-like", "Supabase twin"),
]

C["functional"] = [
    ("pure function", "Output depends only on inputs; no side effects", "Impure I/O", "Method mutating this", "Random seeded"),
    ("side effect", "Observable interaction beyond returned value", "Referential transparency", "Local binding", "Tail call"),
    ("immutability", "Data that cannot be changed after creation", "In-place mutate", "Var reassignment", "Builder mutable"),
    ("higher-order function", "Function taking/returning functions", "First-order only", "Method overload", "Macro"),
    ("map FP", "Apply a function to each element of a structure", "Filter predicate", "Reduce fold", "FlatMap bind"),
    ("filter FP", "Keep elements satisfying a predicate", "Map transform", "Reject inverse", "Partition split"),
    ("reduce/fold", "Combine elements using a binary operator", "Scan prefix", "Unfold generate", "ZipWith"),
    ("recursion", "Function defined in terms of itself", "Iteration loop", "Corecursion", "Trampoline"),
    ("tail recursion", "Recursive call in tail position enabling reuse", "Non-tail recurse", "CPS convert", "Y combinator"),
    ("closure FP", "Function capturing free variables from scope", "Lambda calculus term", "Partial apply", "Curry"),
    ("currying", "Transforming multi-arg fn into chained single-arg", "Partial application", "Uncurry", "Tupled args"),
    ("partial application", "Fixing some arguments producing a new function", "Curry isomorphism", "Bind method", "Default args"),
    ("functor", "Type with a map preserving structure/laws", "Monad bind", "Applicative pure", "Traversable"),
    ("monad", "Type supporting flatMap/bind and unit with laws", "Functor map only", "Monoid append", "Arrow"),
    ("applicative", "Sequencing independent effects with mapN/ap", "Monad dependent", "Functor", "Alternative"),
    ("referential transparency", "Expression replaceable by its value safely", "Opaque effect", "IO action", "State thread"),
    ("lazy evaluation", "Defer computation until result is needed", "Eager strict", "Call-by-name", "Memoize"),
    ("algebraic data type", "Sum/product types composing data", "Class inheritance", "Record only", "Typedef alias"),
    ("pattern matching", "Branching on data constructors destructuring", "Switch equals", "Visitor OOP", "Instanceof"),
    ("option/maybe", "Type representing optional presence of a value", "Null pointer", "Exception", "Default sentinel"),
    ("either/result", "Type representing success or failure values", "Throw exceptions", "Errno codes", "Option only"),
    ("list FP", "Immutable linked sequence foundational in FP", "Array mutable", "Vector finger", "Stream lazy"),
    ("composition", "Combining functions so output feeds next input", "Pipelining |>", "Point-free style", "Application $"),
    ("point-free", "Defining functions without naming arguments", "Explicit lambda", "Eta reduce", "Pointful"),
    ("lambda calculus", "Formal system of functions as computation model", "Turing machine", "Combinatory logic", "SKI"),
    ("typeclass", "Ad-hoc polymorphism via interfaces on types", "OO interface", "Module signature", "Implicit param"),
    ("memoization", "Caching results of pure function calls", "Lazy thunk once", "Dynamic programming", "LRU cache"),
    ("persistent data structure", "Immutable structure with structural sharing", "Ephemeral mutate", "Copy-all", "HAMT map"),
    ("effect system", "Types tracking computational effects", "IO monad", "Algebraic effects", "Checked exceptions"),
    ("free monad", "Monad separating program description from interp", "Tagless final", "Free applicator", "Codensity"),
]

print('mid4', len(C))

C["concurrent"] = [
    ("thread Java", "Independent path of execution in a JVM process", "Process isolation", "Coroutine loom virtual", "ForkJoin task"),
    ("Runnable", "Interface representing a task to run", "Callable returns", "Future result", "Executor service"),
    ("synchronized Java", "Intrinsic lock ensuring mutual exclusion", "ReentrantLock explicit", "volatile visibility", "AtomicInteger"),
    ("volatile Java", "Field with visibility guarantees across threads", "synchronized mutex", "Atomic CAS", "final safe pub"),
    ("happens-before", "JMM ordering relation ensuring visibility", "Program order only", "CPU reorder free", "Seq lock"),
    ("race condition Java", "Bug from unsynchronized conflicting accesses", "Data race formal", "Benign race", "Atomic RMW"),
    ("deadlock Java", "Threads waiting circularly on locks", "Livelock retry", "Starvation unfair", "Lock convoy"),
    ("livelock", "Threads active but making no useful progress", "Deadlock stuck", "Busy spin", "Priority invert"),
    ("starvation", "Thread perpetually denied access to resources", "Fair lock", "Priority scheduling", "Work steal"),
    ("ExecutorService", "API managing a pool of worker threads", "Raw new Thread", "ForkJoinPool", "VirtualThread"),
    ("Future", "Handle for an asynchronous computation result", "CompletableFuture", "Promise JS", "Deferred"),
    ("CompletableFuture", "Composable async result with callbacks", "Future get block", "Rx Flowable", "Kotlin Deferred"),
    ("CountDownLatch", "Waits until a count reaches zero", "CyclicBarrier reuse", "Phaser phases", "Semaphore permits"),
    ("CyclicBarrier", "Parties wait until all arrive each generation", "CountDownLatch one-shot", "Exchanger", "Barrier Java"),
    ("Semaphore Java", "Counting permits controlling access", "Mutex binary", "ReadWriteLock", "StampedLock"),
    ("BlockingQueue", "Queue with blocking put/take for producers/consumers", "ConcurrentLinkedQueue", "TransferQueue", "DelayQueue"),
    ("producer-consumer", "Pattern decoupling producers and consumers via buffer", "Work stealing", "Actor mailbox", "Disruptor"),
    ("thread pool", "Reused workers executing submitted tasks", "Thread-per-request", "Virtual threads", "Event loop"),
    ("atomic class", "Lock-free primitives like AtomicInteger", "synchronized blocks", "volatile++ unsafe", "LongAdder"),
    ("CAS", "Compare-and-swap optimistic concurrency primitive", "Test-and-set", "LL/SC", "Mutex lock"),
    ("immutable concurrency", "Sharing immutable objects without locks", "Defensive copy", "ConcurrentHashMap", "CopyOnWrite"),
    ("ConcurrentHashMap", "Thread-safe concurrent hash map", "Hashtable synced", "Collections.synchronizedMap", "HashMap unsafe"),
    ("ThreadLocal", "Per-thread variable storage", "InheritableThreadLocal", "ScopedValue", "Actor state"),
    ("wait/notify", "Object monitor waiting and signaling API", "Lock Condition", "park/unpark", "CountDown"),
    ("ReentrantLock", "Explicit lock supporting fairness and conditions", "synchronized intrinsic", "StampedLock", "ReadWriteLock"),
    ("virtual thread", "Lightweight JVM thread (Project Loom)", "Platform thread", "Coroutine Kotlin", "Fiber Quasar"),
    ("fork/join", "Divide-and-conquer parallelism framework", "Executor fixed", "Parallel stream", "GPU offload"),
    ("parallel stream", "Stream operations using the common ForkJoinPool", "Sequential stream", "Reactive Flux", "Iterator"),
    ("memory visibility", "Whether writes by one thread are seen by another", "Atomicity RMW", "Ordering fences", "Cache coherency"),
    ("monitor", "Object associated with an intrinsic lock and wait set", "Semaphore", "Mutex pthread", "Barrier"),
]

C["theory"] = [
    ("alphabet", "Finite set of symbols for strings", "Language set", "Grammar rules", "Automaton states"),
    ("string", "Finite sequence of symbols from an alphabet", "Language infinite", "Word synonym", "Regex pattern"),
    ("language", "Set of strings over an alphabet", "Grammar generator", "Automaton recognizer", "Encoding"),
    ("DFA", "Deterministic finite automaton recognizing regular languages", "NFA nondet", "PDA stack", "TM tape"),
    ("NFA", "Nondeterministic FA equivalent in power to DFAs", "DFA unique", "ε-NFA twin", "PDA"),
    ("regular language", "Language recognized by a finite automaton", "CFL context-free", "CSL context-sensitive", "RE recursively enum"),
    ("regex theory", "Pattern denoting a regular language", "CFG grammar", "PEG", "Glob shell"),
    ("pumping lemma regular", "Tool proving languages are not regular", "Myhill-Nerode", "Closure props", "Minimize DFA"),
    ("CFG", "Context-free grammar with single nonterminal LHS", "Regular grammar", "CSG context", "Unrestricted"),
    ("PDA", "Pushdown automaton recognizing CFLs", "DFA no stack", "TM unbounded", "LBA linear"),
    ("CFL", "Context-free language generated by a CFG", "Regular subset", "Inherent ambiguous", "DCFL deter"),
    ("parse tree", "Tree showing derivation of a string from grammar", "AST compiler", "Dependency tree", "DAG deriv"),
    ("ambiguity", "Multiple leftmost derivations/parse trees", "Inherent ambiguous lang", "Disambig prec", "GLR"),
    ("Turing machine", "Model with infinite tape and transition function", "Finite automaton", "RAM model", "Lambda calc"),
    ("decidable", "Language with a TM that always halts correctly", "RE recognizable", "Undecidable", "PTIME"),
    ("recognizable", "Language accepted by a TM (may loop on no)", "Decidable total", "Co-RE", "Recursive"),
    ("halting problem", "Undecidable problem of whether a TM halts", "Busy beaver", "Post correspondence", "Rice theorem"),
    ("reduction", "Transforming one problem into another to transfer hardness", "Mapping many-one", "Turing oracle", "Approximation"),
    ("P", "Problems solvable in deterministic polynomial time", "NP verify", "PSPACE space", "EXPTIME"),
    ("NP", "Problems verifiable in deterministic poly time", "P solve", "co-NP complements", "NP-hard"),
    ("NP-complete", "Hardest problems in NP under poly reductions", "NP-hard maybe not NP", "P-complete", "PSPACE-complete"),
    ("NP-hard", "At least as hard as NP-complete problems", "NP-complete in NP", "Undecidable always", "Approximation"),
    ("Cook-Levin", "Theorem showing SAT is NP-complete", "Rice undecidable", "Savitch theorem", "Immerman–Szelepcsényi"),
    ("SAT", "Boolean satisfiability decision problem", "UNSAT co", "3-SAT NP-c", "HORNSAT P"),
    ("Church-Turing thesis", "Claim that TM capture effective computation", "Proven theorem", "Physical Church", "Hypercompute"),
    ("decidability boundary", "Separation between solvable and unsolvable problems", "Complexity P vs NP", "Grammar Chomsky", "Automata hierarchy"),
    ("Chomsky hierarchy", "Classification of grammars/languages by power", "Complexity zoo", "Type-0 to type-3", "Mildly context"),
    ("closure property", "Language class closed under an operation", "Pumping tool", "Decidability result", "Completeness"),
    ("Myhill-Nerode", "Equivalence characterizing regular languages/minimality", "Pumping lemma", "Brzozowski", "Hopcroft min"),
    ("oracle machine", "TM with a query tape to a language oracle", "Hypercomputer", "Advice string", "Randomized TM"),
]

C["formal"] = [
    ("formal specification", "Precise mathematical description of behavior", "Informal prose", "Test suite", "UML sketch"),
    ("precondition", "Condition assumed true before an operation", "Postcondition", "Invariant", "Frame condition"),
    ("postcondition", "Condition guaranteed true after an operation", "Precondition", "Loop invariant", "Modifies clause"),
    ("invariant", "Property that remains true throughout execution", "Assertion temporary", "Ghost variable", "Variant decrease"),
    ("loop invariant", "Property true before/after each iteration", "Termination variant", "Hoare triple", "Ghost state"),
    ("Hoare logic", "Proof system with {P}S{Q} triples", "Temporal LTL", "Separation logic heap", "Type system"),
    ("model checking", "Automated exploration of a system's state space", "Theorem proving interactive", "Testing samples", "Static lint"),
    ("temporal logic", "Logic reasoning about time-ordered properties", "Propositional only", "FOL predicates", "Hoare state"),
    ("LTL", "Linear temporal logic over infinite traces", "CTL branching", "CTL* combine", "MTL timed"),
    ("CTL", "Computation tree logic over branching time", "LTL linear", "mu-calculus", "ATL agents"),
    ("SAT solver", "Tool deciding boolean satisfiability", "SMT richer", "BDDs symbolic", "ASP answer"),
    ("SMT", "Satisfiability modulo theories (arith, arrays,...)", "SAT pure bool", "CSP constraints", "ILP integer"),
    ("theorem prover", "Interactive/automated system constructing proofs", "Model checker finite", "QuickCheck random", "Symbolic exec"),
    ("refinement", "Relating abstract specs to concrete implementations", "Abstraction omit", "Bisimulation", "Simulation"),
    ("bisimulation", "Equivalence preserving observable stepwise behavior", "Trace equiv weaker", "Simulation one-way", "Isomorphism"),
    ("type system formal", "Rules assigning types to prevent classes of errors", "Dependent types proofs", "Gradual typing", "Effect types"),
    ("dependent type", "Types depending on values enabling rich specs", "Simple types", "Refinement liquid", "Linear types"),
    ("separation logic", "Hoare logic extension for heap reasoning", "Classical Hoare", "Ownership Rust", "Region types"),
    ("symbolic execution", "Executing programs with symbolic inputs", "Concrete testing", "Abstract interp", "Fuzzing"),
    ("abstract interpretation", "Sound over-approx of program semantics", "Model check exact finite", "Dataflow analyses", "WP calculus"),
    ("weakest precondition", "Most permissive precondition ensuring postcondition", "Strongest post", "wp calculus Dijkstra", "sp forward"),
    ("safety property", "Something bad never happens", "Liveness eventually", "Fairness assumptions", "Hyperproperty"),
    ("liveness property", "Something good eventually happens", "Safety never-bad", "Nontermination", "Progress"),
    ("formal verification", "Proving correctness wrt a specification", "Validation fitness", "Testing confidence", "Code review"),
    ("model vs implementation", "Abstract model checked vs real code artifacts", "Extracted code", "Refinement proof", "Conformance"),
    ("Z notation", "Schema-based formal specification language", "VDM", "B method", "TLA+"),
    ("TLA+", "Temporal logic of actions for system specs", "Alloy relational", "Promela SPIN", "Event-B"),
    ("Alloy", "Relational modeling language with analyzer", "TLA+ TLC", "Z tools", "Spin Promela"),
    ("proof obligation", "Verification condition that must be discharged", "Lemma helper", "Axiom assume", "Tactic script"),
    ("runtime assertion", "Checkable predicate embedded in executing code", "Static proof", "Contract Eiffel", "Design by contract"),
]

C["ai"] = [
    ("agent", "Entity perceiving environment and acting toward goals", "Environment only", "Utility function alone", "Policy network"),
    ("PEAS", "Performance, Environment, Actuators, Sensors descriptors", "STRIPS ops", "BDI belief", "MDP tuple"),
    ("search problem", "States, actions, transitions, and goal test", "CSP constraints", "Planning PDDL", "RL MDP"),
    ("BFS AI", "Uniform layer search for shortest unweighted path", "DFS deep", "UCS cost", "A* heuristic"),
    ("DFS AI", "Deepening exploration via stack/recursion", "BFS layers", "IDS iterative", "Bidirectional"),
    ("A*", "Best-first search with f=g+h admissible heuristic", "Greedy best-first", "Dijkstra h=0", "IDA*"),
    ("heuristic", "Estimate of cost/distance to guide search", "Exact remaining", "Admissible never overestimate", "Consistent mono"),
    ("adversarial search", "Search with opposing agents (games)", "Single-agent path", "CSP", "MCTS"),
    ("minimax", "Optimal play assuming adversarial opponent", "Expectimax chance", "Alpha-beta prune", "Negamax"),
    ("alpha-beta", "Pruning minimax branches that cannot affect decision", "Minimax full", "MCTS random", "Beam search"),
    ("CSP", "Variables, domains, and constraints to satisfy", "Path search", "SAT encoding", "ILP"),
    ("backtracking", "DFS assigning variables with undo on failure", "Forward checking", "AC-3 arcs", "Min-conflicts"),
    ("knowledge base", "Store of sentences in a formal logic", "Inference engine", "Ontology OWL", "Expert rules"),
    ("propositional logic AI", "Logic of boolean variables and connectives", "FOL quantifiers", "Horn clauses", "Resolution"),
    ("FOL", "First-order logic with quantifiers and predicates", "Propositional", "HOL higher", "Description logic"),
    ("inference", "Deriving new sentences from known ones", "Learning parameters", "Search path", "Planning"),
    ("resolution", "Refutation-complete inference rule for FOL/SAT", "Modus ponens", "Unification", "Forward chain"),
    ("planning", "Finding action sequences achieving goals", "Scheduling times", "Reactive policy", "HTN hierarchy"),
    ("STRIPS", "Classical planning representation with preconds/effects", "PDDL language", "SitCalc", "HTN"),
    ("Bayesian network", "DAG encoding conditional independencies among vars", "Markov network undirected", "HMM sequence", "CRF"),
    ("HMM", "Hidden Markov model for sequential latent states", "CRF discriminative", "RNN neural", "Kalman filter"),
    ("MDP", "Markov decision process for sequential decisions", "POMDP partial", "Bandit one-state", "Game theory"),
    ("reinforcement learning AI", "Learning policies from reward signals", "Supervised labels", "Unsupervised cluster", "Imitation"),
    ("utility", "Numeric preference measure over outcomes", "Reward RL", "Heuristic search", "Cost path"),
    ("rational agent", "Agent selecting actions to maximize expected performance", "Reflex agent", "Omniscient", "Random"),
    ("knowledge representation", "Encoding information for automated reasoning", "ML embeddings", "Databases", "Ontologies"),
    ("expert system", "Rule-based system capturing specialist knowledge", "Neural net", "Search agent", "Planner"),
    ("natural language AI", "Processing/understanding human language", "Vision pixels", "Speech ASR", "Knowledge graphs"),
    ("computer vision AI", "Extracting meaning from images/video", "NLP text", "Robotics control", "Speech"),
    ("ethics AI", "Moral considerations in designing/deploying AI", "Alignment goals", "Bias fairness", "Safety"),
]

print('mid5', len(C))

C["ml"] = [
    ("supervised learning", "Learning from labeled input-output pairs", "Unsupervised structure", "RL rewards", "Self-supervised"),
    ("unsupervised learning", "Finding structure without labels", "Supervised labels", "RL policy", "Semi-supervised"),
    ("reinforcement learning", "Learning actions to maximize cumulative reward", "Supervised", "Clustering", "Imitation only"),
    ("training set", "Data used to fit model parameters", "Test holdout", "Validation tune", "Production stream"),
    ("test set", "Held-out data for final evaluation", "Training fit", "Validation select", "Cross-val fold"),
    ("overfitting", "Fitting noise; poor generalization", "Underfitting simple", "Regularization fix", "Bias high"),
    ("underfitting", "Model too simple to capture patterns", "Overfitting complex", "High variance", "Ensemble"),
    ("bias-variance", "Tradeoff between underfitting and overfitting sources", "Irreducible noise", "Bayes error", "Calibration"),
    ("regularization", "Penalizing complexity to improve generalization", "Dropout neural", "Early stopping", "Data aug"),
    ("cross-validation", "Resampling evaluation via multiple splits", "Single holdout", "Bootstrap", "Nested CV"),
    ("feature", "Input variable used by a model", "Label target", "Embedding learned", "One-hot"),
    ("label", "Desired output associated with an example", "Feature input", "Pseudo-label", "Weak label"),
    ("loss function", "Objective measuring prediction error", "Metric accuracy", "Regularizer", "Likelihood"),
    ("gradient descent", "Iterative optimization following negative gradient", "Closed form", "Newton second-order", "Evolutionary"),
    ("SGD", "Stochastic gradient descent on mini-batches", "Full-batch GD", "Adam adaptive", "Momentum"),
    ("linear regression", "Predicts continuous targets via linear weights", "Logistic class", "Polynomial", "Ridge"),
    ("logistic regression", "Classification via sigmoid/softmax probabilities", "Linear regression", "SVM margin", "Naive Bayes"),
    ("decision tree", "Axis-aligned splits forming a tree predictor", "Random forest", "Boosting", "Rule list"),
    ("random forest", "Bagged ensemble of randomized trees", "Single tree", "Gradient boosting", "ExtraTrees"),
    ("SVM", "Maximum-margin classifier with optional kernels", "Logistic linear", "k-NN lazy", "Perceptron"),
    ("neural network", "Composable layers of parameterized transformations", "Linear model", "Kernel method", "GP"),
    ("backpropagation", "Algorithm computing gradients via chain rule", "Forward only", "Evolutionary", "Finite diff"),
    ("activation", "Nonlinearity applied elementwise in networks", "Loss softmax", "Pooling", "BatchNorm"),
    ("CNN", "Conv nets exploiting local spatial structure", "RNN sequence", "Transformer attn", "MLP dense"),
    ("RNN", "Networks with recurrent state over sequences", "CNN spatial", "Transformer", "HMM"),
    ("transformer", "Architecture centered on attention mechanisms", "RNN recur", "CNN local", "Capsule"),
    ("precision", "Among predicted positives, fraction truly positive", "Recall coverage", "Accuracy overall", "F1 harmonic"),
    ("recall", "Among true positives, fraction correctly found", "Precision purity", "Specificity", "FPR"),
    ("ROC AUC", "Area under ROC curve summarizing ranking quality", "PR AUC imbalanced", "Accuracy", "Log-loss"),
    ("hyperparameter", "Config chosen outside training parameter updates", "Learned weight", "Architecture search", "Seed"),
]

C["datasci"] = [
    ("EDA", "Exploratory data analysis summarizing and visualizing", "Confirmatory test", "ETL pipeline", "Model deploy"),
    ("dataframe", "Tabular structure with labeled axes for analysis", "ndarray tensor", "dict nested", "SQL cursor"),
    ("ETL", "Extract, transform, load data pipelines", "ELT warehouse", "Streaming ETL", "Feature store"),
    ("missing data", "Absent values requiring imputation or dropping", "Outlier extreme", "Duplicate row", "Leakage"),
    ("outlier", "Point unusually distant from others", "Inlier", "Anomaly detect", "Leverage point"),
    ("imputation", "Filling missing values with estimates", "Complete-case drop", "Indicator missingness", "MICE"),
    ("normalization data", "Rescaling features to comparable ranges", "Standardize z-score", "Encode categorical", "Binning"),
    ("standardization", "Centering/scaling to zero mean unit variance", "Min-max scale", "Robust median", "Log transform"),
    ("categorical encoding", "Representing categories as numbers/vectors", "One-hot", "Target encode", "Embedding"),
    ("feature engineering", "Creating informative inputs from raw data", "Feature selection", "AutoML", "PCA reduce"),
    ("correlation data", "Association strength between variables", "Causation", "Mutual info", "Covariance"),
    ("hypothesis testing DS", "Statistical tests informing data decisions", "A/B experiment", "p-hacking risk", "Effect size"),
    ("visualization", "Graphical representation of data patterns", "Table dump", "Dashboard KPI", "EDA plots"),
    ("histogram", "Distribution of a variable via bins", "Boxplot IQR", "KDE smooth", "ECDF"),
    ("scatter plot", "Points showing relationship between two variables", "Line time", "Bar category", "Heatmap"),
    ("time series", "Observations indexed by time", "Cross-section", "Panel data", "Spatial"),
    ("SQL for data", "Querying relational datasets for analysis", "pandas local", "Spark distributed", "NoSQL doc"),
    ("data wrangling", "Cleaning and reshaping messy datasets", "Modeling fit", "Serving API", "Labeling"),
    ("join data", "Combining tables on keys for analysis", "Concat stack", "Pivot reshape", "Melt long"),
    ("aggregation", "Summarizing groups with sum/mean/count/etc", "Window functions", "Rolling stats", "Cube OLAP"),
    ("KPI", "Key performance indicator tracked by org", "Metric vanity", "OKR objective", "North star"),
    ("dashboard", "Curated views of metrics for monitoring", "Ad-hoc notebook", "Report PDF", "Alert"),
    ("data leakage", "Invalid signal from future/test info in training", "Overfitting", "Target leak", "Pipeline bug"),
    ("reproducibility", "Ability to rerun analyses with same results", "Random seeds", "Environment pin", "Data version"),
    ("data warehouse", "Central analytic store of structured data", "Data lake raw", "OLTP app DB", "Lakehouse"),
    ("data lake", "Store for large raw/structured/unstructured data", "Warehouse curated", "Lakehouse hybrid", "Object store"),
    ("A/B testing DS", "Controlled experiments comparing variants", "Observational bias", "Multi-arm bandit", "Switchback"),
    ("sampling bias", "Systematic error from non-representative samples", "Selection bias", "Survivorship", "Confounding"),
    ("p-value DS", "Evidence measure under a null hypothesis", "Effect size", "Bayes factor", "CI interval"),
    ("notebook", "Interactive document mixing code, text, and results", "Script batch", "Dashboard", "IDE only"),
]

C["vision"] = [
    ("pixel", "Smallest picture element with color/intensity", "Voxel 3D", "Texel texture", "Superpixel"),
    ("image convolution", "Filtering via local weighted neighborhood sums", "Correlation flip", "FFT multiply", "Morphology"),
    ("kernel/filter", "Small matrix defining a convolution operation", "Stride step", "Padding border", "Dilation rate"),
    ("edge detection", "Finding intensity discontinuities", "Canny multi-stage", "Sobel gradients", "Laplacian"),
    ("Gaussian blur", "Smoothing with a Gaussian kernel", "Box blur", "Median denoise", "Bilateral edge-aware"),
    ("histogram equalization", "Contrast enhancement via intensity remapping", "CLAHE local", "Gamma correct", "White balance"),
    ("color space", "System representing colors (RGB/HSV/Lab/...)", "Gamma encoding", "ICC profile", "Bayer CFA"),
    ("camera model", "Pinhole/projection geometry relating 3D to 2D", "Distortion lens", "Extrinsics pose", "Intrinsics K"),
    ("intrinsic matrix", "Camera parameters: focal length and principal point", "Extrinsic R|t", "Fundamental F", "Essential E"),
    ("homography", "Projective mapping between planes", "Affine 6-DoF", "Fundamental epipolar", "Essential pose"),
    ("epipolar geometry", "Geometry relating two views of a scene", "Triangulation", "Stereo disparity", "Bundle adjust"),
    ("stereo vision", "Depth from two calibrated viewpoints", "Monocular depth", "LiDAR", "Structured light"),
    ("optical flow", "Apparent motion of pixels between frames", "Scene flow 3D", "Tracking box", "Odometry"),
    ("feature descriptor", "Vector summarizing a local image patch", "SIFT classic", "ORB binary", "SuperPoint"),
    ("SIFT", "Scale-invariant keypoint detector/descriptor", "SURF", "ORB faster", "AKAZE"),
    ("CNN vision", "Deep conv nets for visual recognition", "ViT transformer", "HOG+SVM classic", "Bag of words"),
    ("classification vision", "Assigning an image to a category", "Detection boxes", "Segmentation masks", "Retrieval"),
    ("object detection", "Localizing and classifying objects with boxes", "Classification whole", "Segmentation dense", "Keypoints"),
    ("semantic segmentation", "Per-pixel class labeling", "Instance separate objects", "Panoptic unify", "Detection"),
    ("instance segmentation", "Masks for individual object instances", "Semantic classes", "Panoptic", "Pose"),
    ("IoU", "Intersection over union for box/mask overlap", "Dice coefficient", "Pixel accuracy", "mAP"),
    ("mAP", "Mean average precision detection metric", "Top-1 accuracy", "IoU threshold", "F1 mask"),
    ("data augmentation vision", "Synthetic transforms expanding training images", "Flip/crop/color", "Mixup", "AutoAugment"),
    ("transfer learning vision", "Reusing pretrained visual backbones", "Train from scratch", "Fine-tune head", "Distill"),
    ("NMS", "Non-maximum suppression removing duplicate detections", "Soft-NMS", "Softmax class", "Anchor match"),
    ("anchor box", "Prior boxes used by many detectors", "Anchor-free", "Region proposal", "ROI align"),
    ("receptive field", "Input region influencing a unit's activation", "Effective RF", "Dilated conv", "Stride"),
    ("batch normalization vision", "Normalizing activations to stabilize training", "LayerNorm ViT", "GroupNorm", "Dropout"),
    ("depth map", "Per-pixel distance from camera", "Disparity stereo", "Point cloud", "Mesh"),
    ("calibration", "Estimating camera intrinsics/extrinsics", "Chessboard corners", "Zhang method", "Stereo rectify"),
]

C["ir"] = [
    ("document", "Unit of text indexed for retrieval", "Query user", "Term token", "Corpus collection"),
    ("corpus", "Collection of documents for IR/NLP", "Lexicon vocab", "Index structure", "Annotation"),
    ("term", "Indexed word/token unit", "N-gram phrase", "Entity", "Lemma"),
    ("tokenization", "Splitting text into tokens", "Stemming", "Lemmatization", "Stopword"),
    ("stemming", "Crude reduction of words to stems", "Lemmatization dict", "Normalization case", "Stemmer Porter"),
    ("stop words", "Common words often ignored in indexing", "Rare IDF", "Stop list", "Function words"),
    ("inverted index", "Map from terms to posting lists of docs", "Forward index", "Suffix array", "Trie"),
    ("posting list", "Ordered list of docs/positions for a term", "Skip pointers", "Impact-ordered", "DocID gaps"),
    ("Boolean retrieval", "Exact matching with AND/OR/NOT queries", "Ranked retrieval", "Fuzzy match", "Phrase"),
    ("TF-IDF", "Term weighting by frequency and rarity", "BM25 ranking", "Binary TF", "Sublinear TF"),
    ("BM25", "Probabilistic ranking function improving TF-IDF", "TF-IDF classic", "Language model QL", "Divergence"),
    ("precision IR", "Fraction of retrieved docs that are relevant", "Recall coverage", "F1", "nDCG graded"),
    ("recall IR", "Fraction of relevant docs that were retrieved", "Precision purity", "R-precision", "MAP"),
    ("F1 IR", "Harmonic mean of precision and recall", "Accuracy", "MRR", "nDCG"),
    ("MAP", "Mean average precision over queries", "nDCG graded", "MRR first", "ERR"),
    ("nDCG", "Normalized discounted cumulative gain", "DCG unnormalized", "MAP binary", "Precision@k"),
    ("query expansion", "Adding related terms to improve recall", "Relevance feedback", "Pseudo RF", "WordNet"),
    ("relevance feedback", "Using judged docs to refine the query/model", "Pseudo feedback", "Rocchio", "Active learn"),
    ("PageRank", "Link-analysis score of web page importance", "HITS hubs", "BM25 text", "TrustRank"),
    ("crawling", "Fetching web pages for indexing", "Politeness delay", "Sitemap", "Frontier queue"),
    ("ranking", "Ordering results by estimated relevance", "Filtering boolean", "Diversification", "Personalize"),
    ("learning to rank", "ML models optimizing ranking metrics", "Pointwise/pairwise/listwise", "BM25 baseline", "LambdaMART"),
    ("embedding retrieval", "Dense vector similarity search", "Sparse lexical", "ANN index", "ColBERT late"),
    ("ANN search", "Approximate nearest neighbor for vectors", "Exact brute", "HNSW graph", "IVF PQ"),
    ("spell correction", "Fixing query typos before/with retrieval", "Edit distance", "Noisy channel", "Autocomplete"),
    ("faceted search", "Filtering results along metadata dimensions", "Aggregations", "Drill-down", "Breadcrumb"),
    ("snippet", "Short excerpt highlighting query matches", "Summary abstractive", "KWIC", "Passage"),
    ("duplicate detection", "Finding near-duplicate documents", "Shingling", "SimHash", "MinHash LSH"),
    ("evaluation IR", "Measuring system quality with test collections", "TREC tracks", "qrels judgments", "Interleaving"),
    ("click model", "Probabilistic model of user click behavior", "Position bias", "Cascade model", "UBM"),
]

print('mid6', len(C))

C["graphics"] = [
    ("rasterization", "Converting primitives into pixels", "Ray tracing paths", "Voxelization", "Tessellation"),
    ("ray tracing", "Simulating light by tracing rays through a scene", "Raster z-buffer", "Path tracing GI", "Radiosity"),
    ("pipeline graphics", "Stages transforming vertices to shaded pixels", "Fixed-function legacy", "Programmable shaders", "Compute pass"),
    ("vertex", "Point with attributes like position/normal/uv", "Fragment pixel", "Primitive triangle", "Index buffer"),
    ("fragment", "Candidate pixel data produced by rasterization", "Vertex shader out", "Texel sample", "Sample MSAA"),
    ("shader", "GPU program shading vertices/fragments/compute", "CPU draw", "Fixed pipeline", "HLSL/GLSL/WGSL"),
    ("MVP matrix", "Model-view-projection transform stack", "Normal matrix", "Viewport transform", "Clip space"),
    ("clip space", "Post-projection coordinates before divide", "NDC after w-divide", "Screen space", "World space"),
    ("NDC", "Normalized device coordinates after perspective divide", "Clip homogenous", "Window coords", "Texture UV"),
    ("z-buffer", "Depth buffer resolving visible surfaces", "Painter algorithm", "Stencil mask", "W-buffer"),
    ("texture mapping", "Applying image data onto surfaces via UVs", "Procedural noise", "Lightmap bake", "Bump map"),
    ("UV coordinates", "2D parameterization of a surface for texturing", "Barycentric", "Cubemap dir", "Triplanar"),
    ("normal vector", "Direction perpendicular to a surface", "Tangent space", "Bitangent", "Vertex normal"),
    ("Phong shading", "Per-pixel lighting with ambient/diffuse/specular", "Gouraud vertex", "Flat face", "PBR Cook-Torrance"),
    ("PBR", "Physically based rendering using energy-conserving BRDFs", "Phong empirical", "Toon shade", "Unlit"),
    ("BRDF", "Function describing reflectance at a surface point", "BTDF transmit", "BSDF general", "Phase function"),
    ("mesh", "Geometry as vertices and connectivity", "Point cloud", "SDF implicit", "NURBS"),
    ("triangle", "Primary rasterized primitive in real-time graphics", "Quad", "Line", "Point sprite"),
    ("GPU", "Processor optimized for parallel graphics/compute", "CPU latency", "DSP", "NPU"),
    ("framebuffer", "Memory holding rendered color/depth/stencil", "Swap chain", "Render target", "G-buffer"),
    ("anti-aliasing", "Techniques reducing jagged edge artifacts", "MSAA samples", "FXAA post", "TAA temporal"),
    ("alpha blending", "Compositing transparent fragments", "Premultiplied alpha", "Order-independent", "Cutout discard"),
    ("culling", "Discarding non-visible primitives early", "Back-face", "Frustum", "Occlusion query"),
    ("LOD", "Level of detail switching by distance/importance", "Tessellation adaptive", "Impostor", "Nanite-like"),
    ("shadow mapping", "Depth-from-light technique for shadows", "Shadow volumes", "Ray-traced shadows", "PCF filter"),
    ("environment map", "Texture capturing surrounding radiance", "Cubemap", "HDRI", "Reflection probe"),
    ("bezier curve", "Parametric curve defined by control points", "B-spline", "NURBS", "Catmull-Rom"),
    ("homogeneous coordinates", "w-augmented coords enabling projective transforms", "Cartesian 3D", "Barycentric", "Plucker"),
    ("double buffering", "Drawing to back buffer then swapping", "Triple buffer", "VSync", "Tearing"),
    ("WebGL/WebGPU", "Browser APIs for GPU-accelerated graphics", "Canvas 2D", "SVG", "CSS filters"),
]

C["hci"] = [
    ("usability", "How effectively/efficiently/satisfyingly users achieve goals", "Utility features", "Accessibility a11y", "UX broader"),
    ("UX", "Overall experience of using a product", "UI visuals only", "Usability subset", "CX customer"),
    ("UI", "Visual/interactive surface of a system", "UX journey", "GUI widgets", "CLI text"),
    ("affordance", "Perceived action possibilities of an object", "Signifier cue", "Constraint limit", "Mapping"),
    ("signifier", "Perceptible indicator of where action should occur", "Affordance real", "Feedback response", "Feedforward"),
    ("feedback HCI", "Information about the result of an action", "Feedforward hint", "Visibility status", "Lag latency"),
    ("mental model", "User's internal understanding of how a system works", "Implementation model", "Conceptual model design", "Metaphor"),
    ("Gulf of Execution", "Gap between user goals and actionable inputs", "Gulf of Evaluation", "Norman doors", "Mapping"),
    ("Gulf of Evaluation", "Gap between system state and user interpretation", "Gulf of Execution", "Visibility", "Feedback"),
    ("Fitts's law", "Time to point depends on distance and target size", "Hick's law choices", "Steering law", "Keystroke KLM"),
    ("Hick's law", "Decision time grows with number of choices", "Fitts pointing", "Miller 7±2", "Progressive disclose"),
    ("accessibility HCI", "Design enabling people with disabilities to use systems", "WCAG guidelines", "ARIA roles", "Inclusive design"),
    ("WCAG", "Web Content Accessibility Guidelines", "Section 508", "ARIA practices", "A11y tree"),
    ("persona", "Archetypal user representation guiding design", "Proto-persona", "Empathy map", "Journey map"),
    ("user journey", "End-to-end narrative of user interactions over time", "Task flow", "Service blueprint", "Storyboard"),
    ("wireframe", "Low-fidelity structural layout of an interface", "Mockup visual", "Prototype interactive", "Spec"),
    ("prototype HCI", "Interactive artifact for testing design ideas", "Wireframe static", "High-fi pixel", "Wizard of Oz"),
    ("usability testing", "Observing users attempting tasks on a design", "A/B metrics", "Heuristic eval", "Survey SUS"),
    ("heuristic evaluation", "Expert review against usability heuristics", "Nielsen 10", "Cognitive walkthrough", "Pluralistic"),
    ("cognitive load", "Mental effort required to use an interface", "Intrinsic/extraneous", "Chunking", "Progressive"),
    ("information architecture", "Organization and labeling of content/nav", "Navigation design", "Taxonomy", "Search findability"),
    ("responsive HCI", "Interfaces adapting across devices/contexts", "Adaptive server", "Mobile-first", "Breakpoint"),
    ("direct manipulation", "Interacting by pointing/dragging visible objects", "Command language", "Menu selection", "Form fill"),
    ("consistency HCI", "Similar things look/behave similarly", "Internal/external", "Standards", "Platform HIG"),
    ("error prevention", "Design reducing chance of user mistakes", "Undo recovery", "Confirmation", "Constraints"),
    ("learnability", "How easily new users become productive", "Memorability return", "Efficiency expert", "Errors"),
    ("Nielsen heuristics", "Ten general principles for interaction design", "Gestalt laws", "GOMS model", "KLM"),
    ("A/B testing HCI", "Comparing UI variants via metrics", "Multivariate", "Usability qual", "Eye tracking"),
    ("inclusive design", "Designing for diversity of abilities and contexts", "Accessibility compliance", "Universal design", "Equity"),
    ("dark pattern", "Deceptive UI steering users against their interests", "Persuasive ethical", "Nudging", "Confirmshaming"),
]

C["ethics"] = [
    ("privacy", "Control over personal information collection/use", "Confidentiality secrecy", "Anonymity", "Security"),
    ("informed consent", "Agreement after understanding risks/benefits", "Dark pattern consent", "Clickwrap", "Opt-in"),
    ("intellectual property", "Legal rights over creations (copyright/patent/trade secret)", "Public domain", "Fair use", "License"),
    ("copyright", "Exclusive rights to creative expressive works", "Patent invention", "Trademark brand", "Trade secret"),
    ("patent", "Time-limited exclusive rights to inventions", "Copyright art", "Trademark", "Prior art"),
    ("open source ethics", "Software with source available under OSI-like licenses", "Proprietary closed", "Freeware binary", "Copyleft"),
    ("professional responsibility", "Duties of computing professionals to public/clients", "ACM Code", "IEEE ethics", "Licensure"),
    ("ACM Code of Ethics", "Guiding ethical principles for computing professionals", "IEEE code", "Company policy", "Law only"),
    ("whistleblowing", "Reporting organizational wrongdoing publicly/internally", "NDA conflict", "Retaliation risk", "Responsible disclose"),
    ("algorithmic bias", "Systematic unfairness produced by algorithmic systems", "Data bias", "Disparate impact", "Fairness metrics"),
    ("fairness", "Just treatment across individuals/groups", "Equality vs equity", "Calibration", "Equalized odds"),
    ("transparency ethics", "Openness about how systems work and decide", "Explainability", "Trade secret tension", "Model cards"),
    ("accountability", "Ability to assign responsibility for system outcomes", "Liability legal", "Audit trail", "Governance"),
    ("dual use", "Technology usable for beneficial and harmful ends", "Export control", "Responsible research", "Biosecurity"),
    ("surveillance", "Systematic monitoring of people/activities", "Sousveillance", "Panopticon", "Data retention"),
    ("digital divide", "Unequal access to computing/internet resources", "Accessibility", "Literacy", "Infrastructure"),
    ("net neutrality", "Equal treatment of network traffic by ISPs", "Paid prioritization", "Zero-rating", "Throttling"),
    ("cybercrime ethics", "Moral/legal issues around computer-enabled crime", "Hacking unauthorized", "Fraud", "Harassment"),
    ("responsible disclosure", "Reporting vulnerabilities to vendors before public", "Full disclosure", "Bug bounty", "CVE assign"),
    ("data ethics", "Moral issues in collecting/using/sharing data", "Consent", "Purpose limitation", "Minimization"),
    ("GDPR", "EU regulation on personal data protection", "CCPA California", "HIPAA health", "COPPA children"),
    ("accessibility ethics", "Moral duty to make systems usable by all", "Legal compliance", "Inclusive design", "Reasonable accom"),
    ("environmental impact", "Energy/e-waste footprint of computing systems", "Green software", "Carbon accounting", "Right to repair"),
    ("autonomous systems ethics", "Moral issues for self-acting machines", "Liability", "Meaningful human control", "Killer robots"),
    ("misinformation", "False/misleading information spread at scale", "Disinformation intent", "Deepfakes", "Moderation"),
    ("conflict of interest", "Personal interests compromising professional judgment", "Disclosure", "Recusal", "Fiduciary"),
    ("plagiarism", "Presenting others' work as one's own", "Citation", "License compliance", "Academic integrity"),
    ("safety ethics", "Obligation to avoid unreasonable risk of harm", "Security CIA", "Hazard analysis", "Fail-safe"),
    ("stakeholder analysis ethics", "Identifying parties affected by a system", "Utilitarian calc", "Rights-based", "Care ethics"),
    ("value sensitive design", "Design method accounting for human values", "Participatory design", "Ethics review board", "Impact assess"),
]

C["numerical"] = [
    ("floating point", "Approximate real arithmetic with exponent+mantissa", "Fixed point", "Arbitrary precision", "IEEE 754"),
    ("machine epsilon", "Smallest ε such that fl(1+ε) ≠ 1", "Underflow denorm", "Overflow Inf", "Rounding unit"),
    ("rounding error", "Error from representing numbers finitely", "Truncation series", "Cancellation", "Conditioning"),
    ("cancellation", "Loss of significance subtracting close quantities", "Catastrophic cancel", "Stable rewrite", "Compensated sum"),
    ("conditioning", "Sensitivity of a problem to input perturbations", "Stability algorithm", "Condition number", "Backward error"),
    ("stability numerical", "Algorithm's amplification of rounding errors", "Forward error", "Backward stable", "Well-conditioned"),
    ("interpolation", "Fitting a function through given points", "Regression approx", "Extrapolation", "Spline"),
    ("polynomial interpolation", "Unique degree <n poly through n points", "Lagrange basis", "Newton divided", "Runge phenom"),
    ("spline", "Piecewise polynomial with smoothness constraints", "Bezier", "B-spline basis", "Cubic Hermite"),
    ("numerical integration", "Approximating definite integrals", "Trapezoid", "Simpson", "Gauss quad"),
    ("root finding", "Computing zeros of functions", "Bisection", "Newton-Raphson", "Secant"),
    ("Newton's method", "Iterative root finding using derivatives", "Halley", "Gradient descent opt", "Fixed point"),
    ("linear system solve", "Computing x in Ax=b numerically", "LU factorization", "Iterative Krylov", "QR least squares"),
    ("LU factorization", "Decomposing A into lower/upper triangular", "Partial pivoting", "Cholesky SPD", "QR"),
    ("iterative method", "Approaching solution via successive updates", "Jacobi", "Gauss-Seidel", "CG conjugate"),
    ("conjugate gradient", "Krylov solver for SPD systems", "GMRES general", "Multigrid", "Preconditioner"),
    ("ODE numerical", "Approximating solutions of differential equations", "Euler method", "RK4", "Stiff solvers"),
    ("Euler method", "Simple first-order ODE integrator", "Improved Euler", "RK methods", "Leapfrog"),
    ("finite difference", "Approximating derivatives via neighboring samples", "Finite element", "Finite volume", "Spectral"),
    ("FFT", "Fast algorithm for discrete Fourier transform", "DFT naive", "Convolution theorem", "DCT"),
    ("Monte Carlo", "Estimation via random sampling", "Quasi-MC", "Importance sampling", "MCMC"),
    ("optimization numerical", "Finding minima/maxima of functions", "Gradient methods", "Newton opt", "Line search"),
    ("least squares numerical", "Minimizing squared residual ||Ax-b||", "Normal equations", "QR solve", "SVD pseudo"),
    ("SVD numerical", "Singular value decomposition for analysis/solve", "EVD eigen", "PCA related", "Low-rank"),
    ("sparse matrix", "Matrix mostly zeros enabling special storage/algos", "CSR/CSC formats", "Dense BLAS", "Fill-in"),
    ("BLAS", "Basic Linear Algebra Subprograms standard", "LAPACK solvers", "cuBLAS GPU", "OpenBLAS"),
    ("LAPACK", "Library of dense linear algebra routines", "BLAS kernels", "ScaLAPACK", "Eigen C++"),
    ("truncation error", "Error from approximating infinite processes finitely", "Discretization", "Rounding", "Remainder term"),
    ("adaptive step", "Adjusting step size based on error estimates", "Fixed step", "Embedded RK", "PID control"),
    ("well-posed problem", "Existence, uniqueness, continuous dependence", "Ill-posed inverse", "Regularization Tikhonov", "Hadamard"),
]

print('mid7', len(C))

C["gamedev"] = [
    ("game loop", "Repeated update/render cycle driving a game", "Event-driven UI only", "Turn-based alone", "Physics fixed step"),
    ("delta time", "Elapsed time between frames for frame-rate independence", "Fixed timestep", "vsync interval", "Tick rate"),
    ("sprite", "2D image used as a game object graphic", "Tilemap", "Mesh 3D", "Particle"),
    ("tilemap", "Level made of tiled cells referencing tilesets", "Mesh terrain", "Navmesh", "BSP"),
    ("collision detection", "Determining whether objects intersect", "Collision response", "Broadphase", "Narrowphase"),
    ("AABB", "Axis-aligned bounding box for fast tests", "OBB oriented", "Sphere bound", "Capsule"),
    ("rigid body", "Physics body with mass responding to forces", "Soft body", "Trigger volume", "Kinematic"),
    ("kinematic body", "Moved by code; not fully dynamic physics", "Dynamic rigid", "Static collider", "Character controller"),
    ("transform game", "Position, rotation, and scale of an entity", "Matrix local/world", "Hierarchy parent", "Quaternion"),
    ("quaternion", "Rotation representation avoiding gimbal lock", "Euler angles", "Axis-angle", "Matrix 3x3"),
    ("camera game", "Viewpoint defining what is rendered", "Perspective/ortho", "Follow/orbit", "Culling frustum"),
    ("input mapping", "Binding device inputs to game actions", "Raw scan codes", "Rebindable", "Action buffer"),
    ("prefab", "Reusable entity template with components", "Prototype clone", "Scene instance", "Blueprint"),
    ("scene graph", "Hierarchy of entities/transforms in a scene", "ECS flat", "Spatial hash", "Quadtree"),
    ("ECS", "Entity-component-system architecture pattern", "OOP inheritance deep", "MVC UI", "Actor UE"),
    ("navmesh", "Navigable mesh for AI pathfinding", "Grid A*", "Waypoint graph", "Flow field"),
    ("pathfinding game", "Computing routes for agents around obstacles", "A* search", "Dijkstra", "Jump point"),
    ("animation clip", "Keyed motion asset applied to a skeleton/sprite", "State machine anim", "Blend tree", "IK"),
    ("state machine game", "Graph of states/transitions for AI/anim/UI", "Behavior tree", "GOAP planning", "HTN"),
    ("particle system", "Many small sprites simulating effects", "VFX GPU", "Trail renderer", "Soft particles"),
    ("shader game", "GPU program for materials/post-effects", "Material instance", "Post stack", "Compute cull"),
    ("audio mixer", "Bus routing and effects for game sound", "Spatial audio 3D", "Occlusion", "DSP"),
    ("networking game", "Synchronizing game state across clients/server", "Lockstep", "Client predict", "Server auth"),
    ("lag compensation", "Techniques mitigating latency in networked games", "Rewind hit detect", "Interpolation", "Extrapolation"),
    ("procedural generation", "Algorithmic content creation", "Hand-authored", "Wave function collapse", "Noise maps"),
    ("game feel", "Juicy responsiveness and feedback of controls", "Juice VFX", "Screen shake", "Coyote time"),
    ("fixed timestep", "Physics updated at constant dt for stability", "Variable render", "Spiral of death", "Accumulator"),
    ("culling game", "Skipping non-visible objects for performance", "Frustum/occlusion", "LOD swap", "Batching"),
    ("batching", "Combining draws to reduce API overhead", "Instancing", "Atlasing", "SRP batcher"),
    ("game engine", "Integrated tools/runtime for building games", "Unity/Unreal/Godot", "Custom framework", "Editor"),
]

C["quantum"] = [
    ("qubit", "Two-level quantum system as information unit", "Classical bit", "Qutrit", "Ancilla"),
    ("superposition", "Linear combination of basis states", "Mixture classical", "Entanglement correlate", "Measurement collapse"),
    ("entanglement", "Non-classical correlations between subsystems", "Product state", "Bell pair", "Separable"),
    ("measurement quantum", "Extracting classical outcomes; collapses state", "Unitary evolve", "POVM general", "Projective"),
    ("Bloch sphere", "Geometric representation of a single qubit", "Higher qudit", "Density matrix", "Pure state"),
    ("Dirac notation", "Ket/bra notation for quantum states", "Matrix components", "Wavefunction ψ", "Density ρ"),
    ("unitary gate", "Reversible quantum operation (unitary matrix)", "Measurement", "Noise CPTP", "Reset"),
    ("Hadamard", "Gate creating equal superposition from |0>/|1>", "Pauli-X flip", "CNOT entangle", "T phase"),
    ("Pauli gates", "X/Y/Z single-qubit operators", "Clifford group", "T gate non-Clifford", "Rotation Rx"),
    ("CNOT", "Controlled-NOT entangling two-qubit gate", "CZ phase", "SWAP", "Toffoli"),
    ("quantum circuit", "Sequence of gates and measurements on qubits", "Annealing Ising", "Analog Hamiltonian", "Cluster state"),
    ("No-cloning", "Theorem forbidding perfect copy of unknown states", "Broadcasting", "Teleportation transfer", "Dense coding"),
    ("teleportation", "Transferring a state using entanglement + classical bits", "No-cloning", "Superdense coding", "Swap test"),
    ("Deutsch-Jozsa", "Early algorithm distinguishing constant/balanced", "Bernstein-Vazirani", "Simon", "Grover"),
    ("Grover search", "Quadratic speedup for unstructured search", "Shor factoring", "Amplitude ampl", "Oracle"),
    ("Shor's algorithm", "Polynomial-time factoring/discrete log on a QC", "RSA threat", "Period finding", "QFT"),
    ("QFT", "Quantum Fourier transform used in many algorithms", "DFT classical", "Phase estimation", "Shor"),
    ("phase estimation", "Estimating eigenvalues of a unitary", "HHL linear", "QPE circuit", "Kickback"),
    ("noise quantum", "Decoherence and gate errors in real devices", "Depolarizing", "T1/T2", "Crosstalk"),
    ("decoherence", "Loss of quantum coherence due to environment", "T2 dephasing", "T1 relaxation", "Markoivan"),
    ("error correction QEC", "Encoding logical qubits to protect information", "Surface code", "Shor code", "Fault tolerance"),
    ("surface code", "Topological QEC code popular for hardware", "Stabilizer codes", "Threshold", "Magic states"),
    ("NISQ", "Noisy intermediate-scale quantum era devices", "FTQC fault-tolerant", "Annealer", "Simulator"),
    ("variational algorithm", "Hybrid quantum-classical optimization loops", "VQE chemistry", "QAOA opt", "Ansatz"),
    ("VQE", "Variational quantum eigensolver for ground energies", "QPE exact", "Classical CI", "UCC ansatz"),
    ("QAOA", "Quantum approx optimization algorithm", "VQE cousin", "Grover", "Annealing"),
    ("Hamiltonian", "Operator generating time evolution of a system", "Schrödinger", "Ising cost", "Trotter"),
    ("measurement basis", "Orthonormal basis determining outcome probabilities", "Z computational", "X/Y rotated", "Bell basis"),
    ("quantum advantage", "Task where quantum outperforms best classical", "Supremacy sampling", "Useful advantage", "Benchmark"),
    ("simulator quantum", "Classical simulation of quantum circuits", "Statevector", "Tensor network", "Hardware run"),
]

C["blockchain"] = [
    ("blockchain", "Append-only linked list of cryptographically hashed blocks", "Distributed DB alone", "Git history metaphor", "DAG ledger"),
    ("block", "Batch of transactions with header linking to prior block", "Merkle root", "Nonce PoW", "Timestamp"),
    ("hash chain", "Sequence where each block commits to previous hash", "Merkle tree txs", "Checksum CRC", "HMAC"),
    ("Merkle tree", "Hash tree enabling efficient inclusion proofs", "Patricia trie state", "Bloom filter", "Skip list"),
    ("consensus blockchain", "Protocol agreeing on ledger state among peers", "PoW/PoS", "BFT", "Longest chain"),
    ("Proof of Work", "Consensus via computational puzzle solving", "Proof of Stake", "PoA authority", "PoH history"),
    ("Proof of Stake", "Consensus weighted by staked cryptocurrency", "PoW energy", "Slashing", "Finality gadget"),
    ("transaction", "Signed state transition request on a ledger", "UTXO spend", "Account nonce", "Gas fee"),
    ("UTXO", "Unspent transaction output model (Bitcoin-like)", "Account balance model", "Coinbase", "Change output"),
    ("smart contract", "Program executed by a blockchain virtual machine", "Oracle off-chain", "Script Bitcoin limited", "dApp UI"),
    ("EVM", "Ethereum Virtual Machine executing contract bytecode", "WASM chain", "SVM Solana", "Move VM"),
    ("gas", "Unit metering computational cost of execution", "Fee market", "Gas limit", "EIP-1559"),
    ("wallet", "Software managing keys and constructing txs", "Custodial exchange", "Hardware wallet", "Address derive"),
    ("public key address", "Identifier derived from a public key/hash", "ENS name", "Multisig", "Contract addr"),
    ("private key crypto", "Secret authorizing spending/signing", "Seed phrase mnemonic", "HSM", "Keystore"),
    ("fork", "Divergent chains from consensus disagreement/upgrades", "Soft fork compatible", "Hard fork break", "Reorg"),
    ("reorg", "Chain reorganization replacing recent blocks", "Finality", "Uncle/ommer", "Deep reorg attack"),
    ("51% attack", "Majority hashpower/stake rewriting chain history", "Sybil identities", "Eclipse network", "Sandwich MEV"),
    ("token", "Fungible on-chain asset often via standards", "NFT unique", "ERC-20", "Stablecoin"),
    ("NFT", "Non-fungible token representing unique assets", "ERC-721/1155", "Royalty metadata", "Mint"),
    ("DeFi", "Decentralized finance protocols on smart contracts", "CEX centralized", "AMM pools", "Lending"),
    ("AMM", "Automated market maker using bonding curves/pools", "Order book CLOB", "Uniswap xy=k", "Impermanent loss"),
    ("oracle blockchain", "Bridge bringing off-chain data on-chain", "Chainlink", "Price feed", "Manipulation risk"),
    ("Layer 2", "Scaling protocols anchored to a base chain", "Rollup", "State channel", "Sidechain"),
    ("rollup", "L2 posting compressed txs/proofs to L1", "Optimistic fraud", "ZK validity", "Sequencer"),
    ("ZK-SNARK", "Succinct zero-knowledge proof system", "ZK-STARK", "Plonk", "Groth16"),
    ("permissioned ledger", "Blockchain with restricted participation", "Public permissionless", "Consortium", "Private DB"),
    ("finality", "Guarantee that a block will not be reverted", "Probabilistic PoW", "BFT immediate", "Checkpoint"),
    ("MEV", "Maximal extractable value from tx ordering", "Front-running", "Sandwich", "PBS"),
    ("dApp", "Decentralized application using smart contracts", "Web2 backend", "Wallet connect", "IPFS content"),
]

C["robotics"] = [
    ("DOF", "Degrees of freedom of a robot mechanism", "Actuator count", "Configuration space", "Task space"),
    ("configuration space", "Space of all joint configurations", "Workspace Cartesian", "C-obstacle", "Path planning"),
    ("forward kinematics", "Computing end-effector pose from joint angles", "Inverse kinematics", "Jacobian", "DH params"),
    ("inverse kinematics", "Finding joint angles for a desired pose", "FK easier", "Analytical/numeric", "Redundancy"),
    ("Jacobian robotics", "Maps joint velocities to end-effector twist", "Singularity", "Manipulability", "Force dual"),
    ("PID control", "Feedback controller with P, I, D terms", "State-space", "LQR optimal", "MPC"),
    ("trajectory", "Time-parameterized path of poses/joints", "Path geometric", "Trapezoidal vel", "Spline"),
    ("path planning robotics", "Finding collision-free routes in C-space", "RRT sampling", "A* grid", "Potential fields"),
    ("RRT", "Rapidly-exploring random tree planner", "PRM roadmap", "RRT*", "Optimization CHOMP"),
    ("SLAM", "Simultaneous localization and mapping", "Odometry only", "Known map localize", "Loop closure"),
    ("odometry", "Estimating motion from proprioceptive sensors", "Visual odometry", "Wheel slip", "IMU integrate"),
    ("IMU", "Inertial measurement unit (accel+gyro[+mag])", "GPS global", "Encoder joint", "Force torque"),
    ("LiDAR", "Laser ranging sensor producing point clouds", "RGB-D camera", "Radar", "Ultrasonic"),
    ("point cloud", "Set of 3D points from sensors", "Mesh surface", "Occupancy grid", "Octomap"),
    ("occupancy grid", "Discretized map of free/occupied space", "SDF signed", "Costmap", "Semantic map"),
    ("ROS", "Robot Operating System middleware ecosystem", "ROS 2 DDS", "Nodes topics", "tf trees"),
    ("actuator", "Device converting commands to motion/force", "Sensor measure", "Servo", "Stepper"),
    ("end effector", "Tool/gripper at the robot's distal end", "Wrist joints", "Tool center point", "Payload"),
    ("singularity", "Configuration where Jacobian loses rank", "Workspace boundary", "Gimbal lock", "Redundant escape"),
    ("holonomic", "Robot that can instantaneously move in all DOF directions", "Nonholonomic car", "Omni wheels", "Constraints"),
    ("nonholonomic", "Motion constrained (e.g., no sideways car motion)", "Holonomic omni", "Differential drive", "Ackermann"),
    ("Kalman filter", "Optimal linear estimator under Gaussian noise", "EKF nonlinear", "UKF unscented", "Particle filter"),
    ("particle filter", "Monte Carlo localization/estimation with samples", "EKF", "Histogram filter", "MCL"),
    ("impedance control", "Controlling dynamic relationship between force and motion", "Position control", "Force control", "Admittance"),
    ("grasp planning", "Choosing contact configurations to hold objects", "Force closure", "Suction", "Soft hand"),
    ("human-robot interaction", "Design of safe effective collaboration with humans", "Cobots", "Safety rated stop", "Intent prediction"),
    ("workspace", "Reachable Cartesian volume of the manipulator", "Dexterous workspace", "C-space", "Singularity loci"),
    ("DH parameters", "Standard link parameters for kinematic chains", "Product of exponentials", "URDF", "Screw theory"),
    ("compliance", "Ability to yield under contact forces", "Stiffness high", "Soft robotics", "Series elastic"),
    ("localization", "Estimating robot pose in a map/frame", "Global/local", "AMCL", "Beacon"),
]

print('mid8', len(C))

C["bioinfo"] = [
    ("DNA", "Molecule encoding genetic information with A/C/G/T bases", "RNA U base", "Protein amino acids", "Chromatin"),
    ("RNA", "Nucleotide polymer often as transcript with U instead of T", "mRNA/tRNA/rRNA", "DNA template", "Ribosome"),
    ("protein", "Polymer of amino acids performing cellular functions", "Peptide bond", "Primary structure", "Fold"),
    ("genome", "Complete genetic material of an organism", "Transcriptome", "Proteome", "Metagenome"),
    ("gene", "Functional unit of heredity typically encoding a product", "Exon/intron", "Allele", "Locus"),
    ("sequence alignment", "Arranging sequences to identify similarity", "Global Needleman", "Local Smith-Waterman", "BLAST heuristic"),
    ("BLAST", "Fast heuristic local alignment search tool", "Exact SW", "HMMER profiles", "BWA read map"),
    ("FASTA", "Text format for biological sequences", "FASTQ qualities", "SAM/BAM alignments", "VCF variants"),
    ("FASTQ", "Sequence format including per-base quality scores", "FASTA seq only", "Phred scores", "Illumina"),
    ("SAM/BAM", "Text/binary formats for read alignments", "CRAM compress", "BED intervals", "GFF features"),
    ("VCF", "Variant call format for SNPs/indels/etc", "BCF binary", "MAF mutation", "GWAS"),
    ("phylogeny", "Evolutionary tree relating sequences/species", "Distance methods", "ML trees", "Bayesian"),
    ("homology", "Similarity due to common ancestry", "Ortholog/paralog", "Analogy convergent", "Identity %"),
    ("ORF", "Open reading frame potentially coding", "Start/stop codon", "Six frames", "CDS"),
    ("codon", "Triplet of nucleotides encoding an amino acid", "Genetic code", "Synonymous", "Wobble"),
    ("transcription", "Synthesis of RNA from DNA template", "Translation protein", "Splicing", "Promoter"),
    ("translation bio", "Ribosome synthesizing protein from mRNA", "tRNA anticodon", "Initiation", "PTM"),
    ("NGS", "High-throughput next-generation sequencing", "Sanger classic", "Long-read PacBio/ONT", "Coverage"),
    ("read mapping", "Aligning short/long reads to a reference", "BWA/minimap2", "De novo assemble", "Variant call"),
    ("de novo assembly", "Reconstructing sequence without a reference", "Overlaps/graphs", "Contigs/scaffolds", "N50"),
    ("GWAS", "Genome-wide association study linking variants to traits", "Manhattan plot", "Population structure", "p-value"),
    ("motif finding", "Discovering short conserved sequence patterns", "PWM/PSSM", "MEME", "ChIP-seq peaks"),
    ("HMM bio", "Hidden Markov models for biological sequences", "Profile HMM", "Gene finding", "CRF"),
    ("RNA-seq", "Sequencing transcriptomes to quantify expression", "Differential expr", "TPM/FPKM", "Splicing"),
    ("differential expression", "Identifying genes with changed abundance", "DESeq2/edgeR", "Multiple testing", "Volcano"),
    ("multiple testing", "Correcting error rates across many hypotheses", "Bonferroni", "FDR Benjamini", "q-value"),
    ("homology modeling", "Predicting structure from related templates", "AlphaFold", "Docking", "MD sim"),
    ("docking", "Predicting binding pose of ligand/protein", "Scoring function", "Virtual screen", "MD refine"),
    ("metagenomics", "Sequencing DNA from environmental communities", "16S amplicon", "Binning MAGs", "Diversity"),
    ("CRISPR bioinfo", "Computational design/analysis of genome edits", "gRNA off-target", "Cas variants", "Indel analysis"),
]

C["capstone"] = [
    ("research question", "Focused question a project seeks to answer", "Hypothesis testable", "Aim objective", "Scope"),
    ("hypothesis", "Testable proposed explanation or outcome", "Null/alternative", "Prediction", "Theory"),
    ("literature review", "Survey and synthesis of prior related work", "Annotated bib", "Related work section", "Gap analysis"),
    ("methodology", "Systematic approach used to conduct the study", "Methods section", "Protocol", "Reproducibility"),
    ("experimental design", "Plan of factors, controls, and measurements", "A/B test", "Factorial", "Threats validity"),
    ("baseline", "Reference system/result for comparison", "Ablation", "SOTA", "Control condition"),
    ("ablation study", "Removing components to measure their contribution", "Sensitivity", "Factor analysis", "Oracle"),
    ("metric", "Quantitative measure of performance/quality", "KPI product", "Success criteria", "Benchmark"),
    ("dataset", "Collected/curated examples used for evaluation", "Train/val/test split", "License ethics", "Bias audit"),
    ("reproducibility research", "Others can rerun and obtain consistent results", "Artifacts", "Seeds env", "Open data"),
    ("threats to validity", "Factors limiting how results can be trusted/generalized", "Internal/external", "Construct", "Conclusion"),
    ("IRB", "Institutional review board overseeing human-subjects ethics", "Informed consent", "Exempt review", "Privacy"),
    ("project charter", "High-level authorization of scope/goals/stakeholders", "SOW", "Vision", "Success metrics"),
    ("milestone", "Significant checkpoint delivering a tangible outcome", "Sprint goal", "Gantt", "Dependency"),
    ("risk register", "Tracked list of risks with likelihood/impact/mitigations", "Issue log", "RAID log", "Contingency"),
    ("stakeholder capstone", "People affected by or influential to the project", "Sponsor", "User", "Advisor"),
    ("requirements traceability", "Linking requirements to design/tests/results", "RTM matrix", "Coverage", "Change impact"),
    ("prototype capstone", "Early system built to learn and validate ideas", "MVP", "Pilot", "PoC"),
    ("evaluation plan", "How success will be measured and judged", "Rubric", "User study", "Benchmark suite"),
    ("statistical significance", "Unlikely result under a null model at α level", "Effect size", "Power analysis", "CI"),
    ("technical writing", "Clear precise documentation of technical work", "IMRaD structure", "Abstract", "Figures"),
    ("oral presentation", "Spoken communication of project results", "Demo", "Q&A", "Slide design"),
    ("poster session", "Visual summary presented in a conference-style format", "Elevator pitch", "QR demo", "Takeaways"),
    ("version control research", "Tracking code/data/docs for collaboration", "Git tags release", "DVC data", "DOI zenodo"),
    ("open science", "Practices making research transparent and accessible", "Preprint", "Open materials", "Preregister"),
    ("citation", "Credit and pointer to prior work", "BibTeX", "DOI", "Plagiarism avoid"),
    ("limitation", "Honest boundary on what the work does not establish", "Future work", "Negative result", "Scope cut"),
    ("future work", "Promising next steps beyond current contributions", "Roadmap", "Open problems", "Extensions"),
    ("contribution", "Novel value delivered by the project", "Claim", "Artifact", "Empirical finding"),
    ("demo day", "Event showcasing working systems to an audience", "Fair", "Investor pitch", "Peer review"),
]

BANKS = [
  ("python", "Python Programming", "python"),
  ("java", "Java Programming", "java"),
  ("cprog", "C Programming", "c"),
  ("cpp", "C++ Programming", "cpp"),
  ("discrete", "Discrete Mathematics", "python"),
  ("probstat", "Probability and Statistics for CS", "python"),
  ("linalg", "Linear Algebra for CS", "python"),
  ("arch", "Computer Organization and Digital Logic", "c"),
  ("os", "Operating Systems", "c"),
  ("networks", "Computer Networks and Network Theory", "python"),
  ("cyber", "Cybersecurity", "python"),
  ("crypto", "Cryptography", "python"),
  ("db", "Databases", "sql"),
  ("parallel", "Parallel and Distributed Systems", "python"),
  ("compilers", "Compilers and Programming Languages", "python"),
  ("embedded", "Embedded Systems and IoT", "c"),
  ("htmlcss", "HTML and CSS", "css"),
  ("webtech", "Web Technologies", "javascript"),
  ("jsts", "JavaScript and TypeScript", "typescript"),
  ("se", "Software Engineering", "python"),
  ("devops", "DevOps and Site Reliability", "python"),
  ("mobilecloud", "Mobile and Cloud Computing", "javascript"),
  ("functional", "Functional Programming", "python"),
  ("concurrent", "Concurrent Programming", "java"),
  ("theory", "Theory of Computation", "python"),
  ("formal", "Formal Methods and Verification", "python"),
  ("ai", "Artificial Intelligence", "python"),
  ("ml", "Machine Learning", "python"),
  ("datasci", "Data Science", "python"),
  ("vision", "Computer Vision", "python"),
  ("ir", "Information Retrieval and Search", "python"),
  ("graphics", "Computer Graphics", "javascript"),
  ("hci", "Human-Computer Interaction", "javascript"),
  ("ethics", "Computer Ethics and Professional Practice", "python"),
  ("numerical", "Numerical Methods and Scientific Computing", "python"),
  ("gamedev", "Game Development", "javascript"),
  ("quantum", "Quantum Computing", "python"),
  ("blockchain", "Blockchain and Decentralized Systems", "javascript"),
  ("robotics", "Robotics", "python"),
  ("bioinfo", "Bioinformatics", "python"),
  ("capstone", "Capstone Projects and Research Methods", "python"),
]

assert len(BANKS) == 41
missing = [s for s,_,_ in BANKS if s not in C]
assert not missing, missing
short = {s: len(C[s]) for s,_,_ in BANKS if len(C[s]) < 28}
assert not short, short
print("ALL CONCEPTS OK", len(BANKS), {s: len(C[s]) for s,_,_ in BANKS})

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_MJS = Path(__file__).resolve().parent / "generateCsDemoBanks.mjs"
OUT_TS = ROOT / "src/data/demoBanks/allNewBanks.ts"

# Subject-specific numerical prompts (6+)
NUMBERS = {
  "python": [
    {"prompt": "What is len([1,2,3,4])?", "answer": 4},
    {"prompt": "What is 2 ** 10?", "answer": 1024},
    {"prompt": "What is 17 // 5 in Python 3?", "answer": 3},
    {"prompt": "What is 17 % 5?", "answer": 2},
    {"prompt": "How many elements are in range(0, 10, 2)?", "answer": 5},
    {"prompt": "What is bool(0) as 0/1 (false=0,true=1)?", "answer": 0},
  ],
  "java": [
    {"prompt": "What is 7 / 2 using integer division in Java?", "answer": 3},
    {"prompt": "What is 7 % 2 in Java?", "answer": 1},
    {"prompt": "How many bytes in a Java int (typically)?", "answer": 4},
    {"prompt": "What is Math.max(3, 9)?", "answer": 9},
    {"prompt": "Length of array new int[5]?", "answer": 5},
    {"prompt": "What is Integer.parseInt(\"42\")?", "answer": 42},
  ],
  "cprog": [
    {"prompt": "sizeof(char) in bytes on typical platforms?", "answer": 1},
    {"prompt": "What is 1 << 3?", "answer": 8},
    {"prompt": "What is 13 & 7?", "answer": 5},
    {"prompt": "What is 5 | 2?", "answer": 7},
    {"prompt": "strlen(\"hi\")?", "answer": 2},
    {"prompt": "NULL pointer comparison equals 0 as int?", "answer": 0},
  ],
  "cpp": [
    {"prompt": "std::vector size after push_back twice on empty?", "answer": 2},
    {"prompt": "What is sizeof(bool) commonly (bytes)?", "answer": 1},
    {"prompt": "1 << 4 equals?", "answer": 16},
    {"prompt": "std::string(\"abc\").size()?", "answer": 3},
    {"prompt": "Priority of * vs + : how many operators in a*b+c (count * and +)?", "answer": 2},
    {"prompt": "Empty std::vector capacity may be 0; size is?", "answer": 0},
  ],
  "discrete": [
    {"prompt": "How many subsets does a 3-element set have?", "answer": 8},
    {"prompt": "P(5,2) = 5*4 = ?", "answer": 20},
    {"prompt": "C(5,2) = ?", "answer": 10},
    {"prompt": "Number of edges in K_4 (complete graph)?", "answer": 6},
    {"prompt": "Truth values for a proposition: how many?", "answer": 2},
    {"prompt": "Binary strings of length 3: count?", "answer": 8},
  ],
  "probstat": [
    {"prompt": "Fair coin P(heads) as percent?", "answer": 50},
    {"prompt": "Dice faces on a fair d6?", "answer": 6},
    {"prompt": "Variance of Bernoulli(p=0.5) = p(1-p) = ?", "answer": 0.25, "tolerance": 0.001},
    {"prompt": "E[X] for fair d6 = 3.5; enter 7/2*2 as integer 7?", "answer": 7},
    {"prompt": "Binomial n=10,p=0.5 mean np?", "answer": 5},
    {"prompt": "z for mean of standard normal?", "answer": 0},
  ],
  "linalg": [
    {"prompt": "Dimension of R^3?", "answer": 3},
    {"prompt": "Identity I_2 has how many ones?", "answer": 2},
    {"prompt": "det([[1,0],[0,1]])?", "answer": 1},
    {"prompt": "Rank of zero 3x3 matrix?", "answer": 0},
    {"prompt": "Dot product of (1,2) and (3,4)?", "answer": 11},
    {"prompt": "Trace of diag(2,5)?", "answer": 7},
  ],
  "arch": [
    {"prompt": "Bits in a byte?", "answer": 8},
    {"prompt": "2^10 equals (KiB-ish)?", "answer": 1024},
    {"prompt": "How many values can 3 bits encode?", "answer": 8},
    {"prompt": "Hex A equals decimal?", "answer": 10},
    {"prompt": "Cache levels commonly counted (L1-L3): how many?", "answer": 3},
    {"prompt": "Two's complement 8-bit max positive?", "answer": 127},
  ],
  "os": [
    {"prompt": "Typical Unix success errno value?", "answer": 0},
    {"prompt": "stdout file descriptor number?", "answer": 1},
    {"prompt": "stderr file descriptor number?", "answer": 2},
    {"prompt": "stdin file descriptor number?", "answer": 0},
    {"prompt": "Page size often KiB (enter 4 for 4KiB)?", "answer": 4},
    {"prompt": "Binary semaphore max permits commonly?", "answer": 1},
  ],
  "networks": [
    {"prompt": "HTTP OK status code?", "answer": 200},
    {"prompt": "HTTPS default port?", "answer": 443},
    {"prompt": "HTTP default port?", "answer": 80},
    {"prompt": "IPv4 address bytes?", "answer": 4},
    {"prompt": "TCP handshake segments (SYN/SYN-ACK/ACK)?", "answer": 3},
    {"prompt": "OSI layers count?", "answer": 7},
  ],
  "cyber": [
    {"prompt": "CIA triad how many goals?", "answer": 3},
    {"prompt": "HTTP unauthorized status?", "answer": 401},
    {"prompt": "HTTP forbidden status?", "answer": 403},
    {"prompt": "Minimum factors in MFA?", "answer": 2},
    {"prompt": "OWASP Top Ten count?", "answer": 10},
    {"prompt": "AES-128 key bits?", "answer": 128},
  ],
  "crypto": [
    {"prompt": "AES-256 key size in bits?", "answer": 256},
    {"prompt": "SHA-256 output bits?", "answer": 256},
    {"prompt": "Bytes in an AES block?", "answer": 16},
    {"prompt": "RSA 2048 modulus bits?", "answer": 2048},
    {"prompt": "Hex digits in 128-bit value?", "answer": 32},
    {"prompt": "Diffie-Hellman parties minimally?", "answer": 2},
  ],
  "db": [
    {"prompt": "1NF/2NF/3NF: how many of these classic forms listed?", "answer": 3},
    {"prompt": "PRIMARY KEY uniqueness: at most how many NULLs typically in SQL PK?", "answer": 0},
    {"prompt": "INNER JOIN requires how many tables minimum?", "answer": 2},
    {"prompt": "ACID properties count?", "answer": 4},
    {"prompt": "SQL SELECT returns how many rows for empty table?", "answer": 0},
    {"prompt": "BINARY true as 1/0: UNIQUE allows how many identical non-null duplicates?", "answer": 0},
  ],
  "parallel": [
    {"prompt": "Amdahl: if serial fraction=0.5, max speedup?", "answer": 2},
    {"prompt": "2 workers ideal speedup for fully parallel work?", "answer": 2},
    {"prompt": "Bytes in a typical cache line (enter 64)?", "answer": 64},
    {"prompt": "MapReduce stages map+reduce: count?", "answer": 2},
    {"prompt": "Raft leader count in steady state?", "answer": 1},
    {"prompt": "Quorum of 5 nodes (majority)?", "answer": 3},
  ],
  "compilers": [
    {"prompt": "Chomsky type for regular grammars (number)?", "answer": 3},
    {"prompt": "Phases often counted roughly frontend+backend: min?", "answer": 2},
    {"prompt": "AST nodes for literal 1 expression: at least?", "answer": 1},
    {"prompt": "LR(0) lookahead tokens?", "answer": 0},
    {"prompt": "Binary operators in a+b*c?", "answer": 2},
    {"prompt": "x86-64 general purpose regs commonly taught (enter 16)?", "answer": 16},
  ],
  "embedded": [
    {"prompt": "I2C wires for data+clock?", "answer": 2},
    {"prompt": "UART typically needs TX/RX: how many signal lines?", "answer": 2},
    {"prompt": "ADC 10-bit max code?", "answer": 1023},
    {"prompt": "PWM duty 50% of 100?", "answer": 50},
    {"prompt": "GPIO high as 1?", "answer": 1},
    {"prompt": "Watchdog timeout if never kicked: resets? (1=yes)", "answer": 1},
  ],
  "htmlcss": [
    {"prompt": "Hex color #RGB has how many hex digits?", "answer": 3},
    {"prompt": "CSS box model core parts often listed (content+pad+border+margin)?", "answer": 4},
    {"prompt": "rem relative to root; root default px often?", "answer": 16},
    {"prompt": "Flex default flex-direction row as 1?", "answer": 1},
    {"prompt": "z-index only affects positioned; static=0 meaning default?", "answer": 0},
    {"prompt": "media query breakpoints commonly mobile-first: min count used in demos?", "answer": 1},
  ],
  "webtech": [
    {"prompt": "HTTP 404 means not found; code?", "answer": 404},
    {"prompt": "HTTP 500 server error code?", "answer": 500},
    {"prompt": "REST often uses how many common verbs CRUD-ish (GET POST PUT DELETE)?", "answer": 4},
    {"prompt": "JSON object top-level keys for {\"a\":1}: count?", "answer": 1},
    {"prompt": "WebSocket readyState OPEN typically?", "answer": 1},
    {"prompt": "TLS1.3 versions major?", "answer": 1},
  ],
  "jsts": [
    {"prompt": "typeof null === 'object' historically; enter 1 if true statement?", "answer": 1},
    {"prompt": "[1,2,3].length?", "answer": 3},
    {"prompt": "Number(\"42\")?", "answer": 42},
    {"prompt": "Math.min(3,1,4)?", "answer": 1},
    {"prompt": "Array(3).length?", "answer": 3},
    {"prompt": "Boolean(0) as 0/1?", "answer": 0},
  ],
  "se": [
    {"prompt": "SOLID principles count?", "answer": 5},
    {"prompt": "Scrum events commonly listed (sprint,planning,daily,review,retro)?", "answer": 5},
    {"prompt": "CI/CD pipeline stages build+test+deploy min?", "answer": 3},
    {"prompt": "Definition of Done is binary met? (1=yes concept)", "answer": 1},
    {"prompt": "Code review approvals often required before merge: min typical?", "answer": 1},
    {"prompt": "Story points Fibonacci-ish 1,2,3,5: how many shown?", "answer": 4},
  ],
  "devops": [
    {"prompt": "Three pillars of observability often listed?", "answer": 3},
    {"prompt": "Kubernetes replica count for HA often min?", "answer": 2},
    {"prompt": "SLO 99.9% monthly error budget hours approx 0.72; enter 999 for 99.9*10?", "answer": 999},
    {"prompt": "Blue-green environments count?", "answer": 2},
    {"prompt": "Canary starts at what percent often demo (enter 5)?", "answer": 5},
    {"prompt": "Dockerfile FROM layers min?", "answer": 1},
  ],
  "mobilecloud": [
    {"prompt": "Cloud service models IaaS/PaaS/SaaS count?", "answer": 3},
    {"prompt": "Multi-AZ typically at least how many zones?", "answer": 2},
    {"prompt": "HTTP 429 rate limit code?", "answer": 429},
    {"prompt": "Mobile platforms iOS+Android count major?", "answer": 2},
    {"prompt": "S3 eventually consistent historically for some ops; enter 1?", "answer": 1},
    {"prompt": "FaaS cold starts: 1 if can add latency?", "answer": 1},
  ],
  "functional": [
    {"prompt": "Functor laws commonly counted?", "answer": 2},
    {"prompt": "Monad laws commonly counted?", "answer": 3},
    {"prompt": "Arity of fully curried add(a)(b): first function arity?", "answer": 1},
    {"prompt": "Option some/none: how many cases?", "answer": 2},
    {"prompt": "map then map f.g composition: 1 if law?", "answer": 1},
    {"prompt": "foldl on empty list returns accumulator: 1?", "answer": 1},
  ],
  "concurrent": [
    {"prompt": "synchronized methods on same instance: mutual exclusion 1?", "answer": 1},
    {"prompt": "volatile write visibility: 1 if guaranteed by JMM for that field?", "answer": 1},
    {"prompt": "CountDownLatch(3) requires how many countDown to open?", "answer": 3},
    {"prompt": "Thread states roughly documented many; RUNNABLE is 1 state? (1)", "answer": 1},
    {"prompt": "Binary semaphore permits?", "answer": 1},
    {"prompt": "ForkJoin common pool parallelism often = cores: enter 1 if OS dependent?", "answer": 1},
  ],
  "theory": [
    {"prompt": "DFA accepting even-length binary: states minimal often 2?", "answer": 2},
    {"prompt": "Pumping lemma constant p > 0: 1?", "answer": 1},
    {"prompt": "Chomsky type-0 unrestricted: number?", "answer": 0},
    {"prompt": "P vs NP open: enter 1 if unsolved?", "answer": 1},
    {"prompt": "SAT is NP-complete: 1?", "answer": 1},
    {"prompt": "Halting problem decidable? 0=no", "answer": 0},
  ],
  "formal": [
    {"prompt": "Hoare triple parts P,S,Q count?", "answer": 3},
    {"prompt": "Safety vs liveness: two property classes?", "answer": 2},
    {"prompt": "SAT is NP-complete: 1?", "answer": 1},
    {"prompt": "Model checking explores state space: 1?", "answer": 1},
    {"prompt": "LTL operators G/F/X/U often taught: count?", "answer": 4},
    {"prompt": "Pre and post conditions: count?", "answer": 2},
  ],
  "ai": [
    {"prompt": "Branching factor of binary tree search fringe growth base?", "answer": 2},
    {"prompt": "Minimax depth-0 evaluation calls typically?", "answer": 1},
    {"prompt": "A* with h=0 becomes Dijkstra: 1?", "answer": 1},
    {"prompt": "CSP variables domains constraints: parts?", "answer": 3},
    {"prompt": "PEAS components count?", "answer": 4},
    {"prompt": "Admissible heuristic never overestimates: 1?", "answer": 1},
  ],
  "ml": [
    {"prompt": "Train/validation/test splits commonly how many sets?", "answer": 3},
    {"prompt": "Binary classification classes?", "answer": 2},
    {"prompt": "Confusion matrix cells for binary?", "answer": 4},
    {"prompt": "k in k-fold CV often?", "answer": 5},
    {"prompt": "Learning rate 0.01 as percent*100?", "answer": 1},
    {"prompt": "Precision=TP/(TP+FP); if TP=8 FP=2 precision*10?", "answer": 8},
  ],
  "datasci": [
    {"prompt": "Quartiles Q1 median Q3: how many cut points named?", "answer": 3},
    {"prompt": "IQR = Q3-Q1; if Q3=10 Q1=4 IQR?", "answer": 6},
    {"prompt": "z-score of the mean?", "answer": 0},
    {"prompt": "Pandas DataFrame 2-D: rank?", "answer": 2},
    {"prompt": "A/B variants minimum?", "answer": 2},
    {"prompt": "95% CI uses z approx 1.96; enter 196?", "answer": 196},
  ],
  "vision": [
    {"prompt": "RGB channels count?", "answer": 3},
    {"prompt": "Grayscale channels?", "answer": 1},
    {"prompt": "IoU of identical boxes?", "answer": 1},
    {"prompt": "3x3 kernel weights count?", "answer": 9},
    {"prompt": "Image 100x100 pixels count?", "answer": 10000},
    {"prompt": "Sobel often uses 3x3: size?", "answer": 3},
  ],
  "ir": [
    {"prompt": "Precision@10 looks at how many top docs?", "answer": 10},
    {"prompt": "Boolean AND of two posting lists intersects: 1?", "answer": 1},
    {"prompt": "TF of term appearing thrice in a doc?", "answer": 3},
    {"prompt": "Binary TF presence as 1?", "answer": 1},
    {"prompt": "MAP averages over how many queries (symbolically N): enter 1 for mean?", "answer": 1},
    {"prompt": "PageRank damping often 0.85; enter 85?", "answer": 85},
  ],
  "graphics": [
    {"prompt": "Triangle vertices count?", "answer": 3},
    {"prompt": "RGBA channels?", "answer": 4},
    {"prompt": "MVP matrices multiplied count typically?", "answer": 3},
    {"prompt": "Cube faces?", "answer": 6},
    {"prompt": "Homogeneous w for points often 1?", "answer": 1},
    {"prompt": "z-buffer compares depth: 1?", "answer": 1},
  ],
  "hci": [
    {"prompt": "Nielsen heuristics count?", "answer": 10},
    {"prompt": "Fitts index of difficulty log2(D/W+1): 1 if uses distance & width?", "answer": 1},
    {"prompt": "WCAG principle POUR count?", "answer": 4},
    {"prompt": "Usability test users classic discount usability often 5?", "answer": 5},
    {"prompt": "A/B two variants?", "answer": 2},
    {"prompt": "Gulf of Execution + Evaluation: gulfs?", "answer": 2},
  ],
  "ethics": [
    {"prompt": "ACM general principles historically many; enter 7 for classic count often cited?", "answer": 7},
    {"prompt": "CIA triad count?", "answer": 3},
    {"prompt": "GDPR lawful bases commonly listed up to?", "answer": 6},
    {"prompt": "Fair use factors in US copyright?", "answer": 4},
    {"prompt": "Dual-use concerns: 1 if real?", "answer": 1},
    {"prompt": "IRB review levels often exempt/expedited/full: count?", "answer": 3},
  ],
  "numerical": [
    {"prompt": "Machine epsilon double roughly 2^-52; enter 52?", "answer": 52},
    {"prompt": "Trapezoid rule panels for [a,b] with n intervals uses n+1 points: if n=4 points?", "answer": 5},
    {"prompt": "Newton iteration order of convergence ideally?", "answer": 2},
    {"prompt": "LU for n=2 matrix has how many triangular factors?", "answer": 2},
    {"prompt": "FFT of size 8 = 2^3: exponent?", "answer": 3},
    {"prompt": "Condition number of identity?", "answer": 1},
  ],
  "gamedev": [
    {"prompt": "Target 60 FPS frame ms approx 16.67; enter 17?", "answer": 17},
    {"prompt": "RGBA32 bytes per pixel?", "answer": 4},
    {"prompt": "AABB min/max points count?", "answer": 2},
    {"prompt": "Quaternion components?", "answer": 4},
    {"prompt": "Fixed timestep physics Hz often 60?", "answer": 60},
    {"prompt": "2D vector x,y components?", "answer": 2},
  ],
  "quantum": [
    {"prompt": "Qubit amplitudes for |0>+|1> normalized: 2 amplitudes?", "answer": 2},
    {"prompt": "Bell basis states count?", "answer": 4},
    {"prompt": "CNOT qubits involved?", "answer": 2},
    {"prompt": "Hadamard H^2 = I: 1?", "answer": 1},
    {"prompt": "Grover iterations scale ~sqrt(N): 1?", "answer": 1},
    {"prompt": "Measurement outcomes for 1 qubit ideally?", "answer": 2},
  ],
  "blockchain": [
    {"prompt": "Bitcoin block hash leading zeros vary; SHA-256 bits?", "answer": 256},
    {"prompt": "Ethereum account nonce starts at?", "answer": 0},
    {"prompt": "Merkle tree leaf for 8 txs: leaves?", "answer": 8},
    {"prompt": "PoS validators need stake >0: 1?", "answer": 1},
    {"prompt": "ERC-20 transfer events: 1 if standard?", "answer": 1},
    {"prompt": "Confirmations often wait N blocks; enter 6 classic BTC?", "answer": 6},
  ],
  "robotics": [
    {"prompt": "Planar arm with 2 revolute joints DOF?", "answer": 2},
    {"prompt": "PID terms count?", "answer": 3},
    {"prompt": "SE(3) rigid transform: rotation+translation 1?", "answer": 1},
    {"prompt": "Differential drive wheels minimum?", "answer": 2},
    {"prompt": "IMU accel axes typically?", "answer": 3},
    {"prompt": "RRT expands random trees: 1?", "answer": 1},
  ],
  "bioinfo": [
    {"prompt": "DNA bases count?", "answer": 4},
    {"prompt": "Codon length nucleotides?", "answer": 3},
    {"prompt": "Amino acids in standard code roughly?", "answer": 20},
    {"prompt": "Reading frames in double-stranded DNA?", "answer": 6},
    {"prompt": "Phred 30 error prob 0.001; enter 30?", "answer": 30},
    {"prompt": "Pairwise alignment sequences minimum?", "answer": 2},
  ],
  "capstone": [
    {"prompt": "IMRaD sections Intro/Methods/Results/Discussion count?", "answer": 4},
    {"prompt": "Train/val/test evaluation sets often?", "answer": 3},
    {"prompt": "Null and alternative hypotheses count?", "answer": 2},
    {"prompt": "Threats internal/external/construct/conclusion often 4?", "answer": 4},
    {"prompt": "Alpha 0.05 as percent?", "answer": 5},
    {"prompt": "Minimum advisors on many capstones?", "answer": 1},
  ],
}

def esc(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)

def concepts_to_js(concepts):
    parts = []
    for term, defn, d1, d2, d3 in concepts:
        parts.append(
            "{ term: %s, def: %s, distractors: [%s, %s, %s] }"
            % (esc(term), esc(defn), esc(d1), esc(d2), esc(d3))
        )
    return "[" + ",\n      ".join(parts) + "]"

def build_curriculum_js(slug, title, language, concepts):
    # Derive rich secondary content from concepts
    truths = []
    for i, (term, defn, d1, *_ ) in enumerate(concepts[:14]):
        if i % 2 == 0:
            truths.append("{ statement: %s, correct: true }" % esc(f"{term}: {defn}"))
        else:
            truths.append("{ statement: %s, correct: false }" % esc(f"{term} is best defined as: {d1}"))

    multi = []
    for i in range(8):
        a = concepts[i]
        b = concepts[i + 8]
        c = concepts[i + 16]
        multi.append(
            "{ prompt: %s, choices: [%s, %s, %s, %s], correct: [0, 1] }"
            % (
                esc(f"Select all that correctly relate to {title}."),
                esc(f"{a[0]} — {a[1]}"),
                esc(f"{b[0]} — {b[1]}"),
                esc(f"{c[0]} is unrelated nonsense: {c[2]}"),
                esc("None of these terms appear in computing curricula"),
            )
        )

    numbers = NUMBERS[slug]
    num_js = []
    for n in numbers:
        tol = n.get("tolerance", 0)
        num_js.append(
            "{ prompt: %s, answer: %s, tolerance: %s }" % (esc(n["prompt"]), n["answer"], tol)
        )

    blanks = []
    for term, defn, *_ in concepts[:8]:
        blanks.append(
            "{ prompt: %s, answers: [%s, %s] }"
            % (esc(f"Fill in: ___ is defined as “{defn[:90]}{'…' if len(defn)>90 else ''}”."), esc(term), esc(term.lower()))
        )

    shorts = []
    for term, defn, *_ in concepts[:10]:
        shorts.append("{ prompt: %s, answer: %s }" % (esc(f"Name the term: {defn}"), esc(term)))

    match_sets = []
    for k in range(5):
        chunk = concepts[k * 4 : k * 4 + 4]
        if len(chunk) < 3:
            chunk = concepts[k : k + 4]
        pairs = ", ".join(
            "{ left: %s, right: %s }" % (esc(t), esc(d[:100])) for t, d, *_ in chunk
        )
        match_sets.append(
            "{ prompt: %s, pairs: [%s] }" % (esc(f"Match each {title} term to its meaning."), pairs)
        )

    essays = [
        esc(f"Explain a core idea in {title} and give one concrete example from practice."),
        esc(f"Compare two related concepts in {title}. When would you choose one over the other?"),
        esc(f"Describe a common mistake learners make in {title} and how to avoid it."),
        esc(f"Design a small scenario that applies {title}. State assumptions, approach, and risks."),
    ]

    # Language-specific inline/code starters
    lang = language
    inlines = []
    codes = []
    if lang == "python":
        inlines = [
            "{ prompt: %s, accepted: [%s, %s], starter: %s }"
            % (esc(f'Return the course slug string "{slug}".'), esc(f'return "{slug}"'), esc(f"return '{slug}'"), esc("def label():\n    ")),
            "{ prompt: %s, accepted: [%s, %s], starter: %s }"
            % (esc("Return the integer 42."), esc("return 42"), esc("42"), esc("def answer():\n    ")),
            "{ prompt: %s, accepted: [%s], starter: %s }"
            % (esc("Return an empty list."), esc("return []"), esc("def empty():\n    ")),
            "{ prompt: %s, accepted: [%s, %s], starter: %s }"
            % (esc("Return True."), esc("return True"), esc("True"), esc("def ok():\n    ")),
        ]
        codes = [
            "{ prompt: %s, starter: %s, correct: %s }"
            % (esc("Implement identity(x) that returns x."), esc("def identity(x):\n    pass\n"), esc("def identity(x):\n    return x\n")),
            "{ prompt: %s, starter: %s, correct: %s }"
            % (esc("Implement add(a, b) returning a+b."), esc("def add(a, b):\n    pass\n"), esc("def add(a, b):\n    return a + b\n")),
            "{ prompt: %s, starter: %s, correct: %s }"
            % (esc("Implement is_even(n) returning True iff n is even."), esc("def is_even(n):\n    pass\n"), esc("def is_even(n):\n    return n % 2 == 0\n")),
        ]
    elif lang == "java":
        inlines = [
            "{ prompt: %s, accepted: [%s], starter: %s }"
            % (esc(f'Return "{slug}".'), esc(f'return "{slug}";'), esc("String label() {\n  \n}")),
            "{ prompt: %s, accepted: [%s], starter: %s }"
            % (esc("Return 42."), esc("return 42;"), esc("int answer() {\n  \n}")),
            "{ prompt: %s, accepted: [%s], starter: %s }"
            % (esc("Return true."), esc("return true;"), esc("boolean ok() {\n  \n}")),
            "{ prompt: %s, accepted: [%s], starter: %s }"
            % (esc("Return 0."), esc("return 0;"), esc("int zero() {\n  \n}")),
        ]
        codes = [
            "{ prompt: %s, starter: %s, correct: %s }"
            % (esc("Implement identity returning its int argument."), esc("int identity(int x) {\n  \n}\n"), esc("int identity(int x) {\n  return x;\n}\n")),
            "{ prompt: %s, starter: %s, correct: %s }"
            % (esc("Implement add(a,b)."), esc("int add(int a, int b) {\n  \n}\n"), esc("int add(int a, int b) {\n  return a + b;\n}\n")),
            "{ prompt: %s, starter: %s, correct: %s }"
            % (esc("Implement isEven(n)."), esc("boolean isEven(int n) {\n  \n}\n"), esc("boolean isEven(int n) {\n  return n % 2 == 0;\n}\n")),
        ]
    elif lang in ("c", "cpp"):
        ret = "return" 
        inlines = [
            "{ prompt: %s, accepted: [%s], starter: %s }"
            % (esc("Return 42."), esc("return 42;"), esc("int answer(void) {\n  \n}")),
            "{ prompt: %s, accepted: [%s], starter: %s }"
            % (esc("Return 0."), esc("return 0;"), esc("int zero(void) {\n  \n}")),
            "{ prompt: %s, accepted: [%s], starter: %s }"
            % (esc("Return 1."), esc("return 1;"), esc("int one(void) {\n  \n}")),
            "{ prompt: %s, accepted: [%s], starter: %s }"
            % (esc("Return -1."), esc("return -1;"), esc("int neg(void) {\n  \n}")),
        ]
        codes = [
            "{ prompt: %s, starter: %s, correct: %s }"
            % (esc("Implement identity(int x)."), esc("int identity(int x) {\n  \n}\n"), esc("int identity(int x) {\n  return x;\n}\n")),
            "{ prompt: %s, starter: %s, correct: %s }"
            % (esc("Implement add(int a, int b)."), esc("int add(int a, int b) {\n  \n}\n"), esc("int add(int a, int b) {\n  return a + b;\n}\n")),
            "{ prompt: %s, starter: %s, correct: %s }"
            % (esc("Implement is_even(int n) returning 1/0."), esc("int is_even(int n) {\n  \n}\n"), esc("int is_even(int n) {\n  return n % 2 == 0;\n}\n")),
        ]
    elif lang == "sql":
        inlines = [
            "{ prompt: %s, accepted: [%s, %s], starter: %s }"
            % (esc("Select all columns from users."), esc("SELECT * FROM users"), esc("select * from users"), esc("-- SQL\n")),
            "{ prompt: %s, accepted: [%s], starter: %s }"
            % (esc("Count rows in users."), esc("SELECT COUNT(*) FROM users"), esc("-- SQL\n")),
            "{ prompt: %s, accepted: [%s], starter: %s }"
            % (esc("Select name from users."), esc("SELECT name FROM users"), esc("-- SQL\n")),
            "{ prompt: %s, accepted: [%s], starter: %s }"
            % (esc("Delete nothing with false predicate (pattern)."), esc("DELETE FROM users WHERE 1=0"), esc("-- SQL\n")),
        ]
        codes = [
            "{ prompt: %s, starter: %s, correct: %s }"
            % (esc("Write a SELECT that returns 1 as n."), esc("-- write SQL\n"), esc("SELECT 1 AS n;\n")),
            "{ prompt: %s, starter: %s, correct: %s }"
            % (esc("Create a query selecting id from users."), esc("-- write SQL\n"), esc("SELECT id FROM users;\n")),
            "{ prompt: %s, starter: %s, correct: %s }"
            % (esc("Select distinct city from users."), esc("-- write SQL\n"), esc("SELECT DISTINCT city FROM users;\n")),
        ]
    elif lang == "css":
        inlines = [
            "{ prompt: %s, accepted: [%s], starter: %s }"
            % (esc("Set color to red on body."), esc("body { color: red; }"), esc("/* CSS */\n")),
            "{ prompt: %s, accepted: [%s], starter: %s }"
            % (esc("Set display flex on .row."), esc(".row { display: flex; }"), esc("/* CSS */\n")),
            "{ prompt: %s, accepted: [%s], starter: %s }"
            % (esc("Set margin 0 on body."), esc("body { margin: 0; }"), esc("/* CSS */\n")),
            "{ prompt: %s, accepted: [%s], starter: %s }"
            % (esc("Hide .secret with display none."), esc(".secret { display: none; }"), esc("/* CSS */\n")),
        ]
        codes = [
            "{ prompt: %s, starter: %s, correct: %s }"
            % (esc("Style h1 font-size 24px."), esc("/* CSS */\n"), esc("h1 { font-size: 24px; }\n")),
            "{ prompt: %s, starter: %s, correct: %s }"
            % (esc("Make .card padding 16px."), esc("/* CSS */\n"), esc(".card { padding: 16px; }\n")),
            "{ prompt: %s, starter: %s, correct: %s }"
            % (esc("Set a:link text-decoration none."), esc("/* CSS */\n"), esc("a:link { text-decoration: none; }\n")),
        ]
    elif lang == "typescript":
        inlines = [
            "{ prompt: %s, accepted: [%s, %s], starter: %s }"
            % (esc(f'Return "{slug}".'), esc(f'return "{slug}"'), esc(f"return '{slug}'"), esc("function label(): string {\n  \n}")),
            "{ prompt: %s, accepted: [%s], starter: %s }"
            % (esc("Return 42."), esc("return 42"), esc("function answer(): number {\n  \n}")),
            "{ prompt: %s, accepted: [%s], starter: %s }"
            % (esc("Return true."), esc("return true"), esc("function ok(): boolean {\n  \n}")),
            "{ prompt: %s, accepted: [%s], starter: %s }"
            % (esc("Return an empty array."), esc("return []"), esc("function empty(): number[] {\n  \n}")),
        ]
        codes = [
            "{ prompt: %s, starter: %s, correct: %s }"
            % (esc("Implement identity<T>(x: T): T."), esc("function identity<T>(x: T): T {\n  \n}\n"), esc("function identity<T>(x: T): T {\n  return x;\n}\n")),
            "{ prompt: %s, starter: %s, correct: %s }"
            % (esc("Implement add(a: number, b: number)."), esc("function add(a: number, b: number): number {\n  \n}\n"), esc("function add(a: number, b: number): number {\n  return a + b;\n}\n")),
            "{ prompt: %s, starter: %s, correct: %s }"
            % (esc("Implement isEven(n: number)."), esc("function isEven(n: number): boolean {\n  \n}\n"), esc("function isEven(n: number): boolean {\n  return n % 2 === 0;\n}\n")),
        ]
    else:  # javascript
        inlines = [
            "{ prompt: %s, accepted: [%s, %s], starter: %s }"
            % (esc(f'Return "{slug}".'), esc(f'return "{slug}"'), esc(f"return '{slug}'"), esc("function label() {\n  \n}")),
            "{ prompt: %s, accepted: [%s], starter: %s }"
            % (esc("Return 42."), esc("return 42"), esc("function answer() {\n  \n}")),
            "{ prompt: %s, accepted: [%s], starter: %s }"
            % (esc("Return true."), esc("return true"), esc("function ok() {\n  \n}")),
            "{ prompt: %s, accepted: [%s], starter: %s }"
            % (esc("Return []."), esc("return []"), esc("function empty() {\n  \n}")),
        ]
        codes = [
            "{ prompt: %s, starter: %s, correct: %s }"
            % (esc("Implement identity(x)."), esc("function identity(x) {\n  \n}\n"), esc("function identity(x) {\n  return x;\n}\n")),
            "{ prompt: %s, starter: %s, correct: %s }"
            % (esc("Implement add(a, b)."), esc("function add(a, b) {\n  \n}\n"), esc("function add(a, b) {\n  return a + b;\n}\n")),
            "{ prompt: %s, starter: %s, correct: %s }"
            % (esc("Implement isEven(n)."), esc("function isEven(n) {\n  \n}\n"), esc("function isEven(n) {\n  return n % 2 === 0;\n}\n")),
        ]

    notes = [
        esc(f"{title}: core vocabulary and definitions."),
        esc(f"{title}: applied practice across question types."),
    ]

    return f"""  {{
    slug: {esc(slug)},
    title: {esc(title)},
    language: {esc(language)},
    concepts: {concepts_to_js(concepts)},
    truths: [
      {",\n      ".join(truths)}
    ],
    multi: [
      {",\n      ".join(multi)}
    ],
    numbers: [
      {",\n      ".join(num_js)}
    ],
    blanks: [
      {",\n      ".join(blanks)}
    ],
    shorts: [
      {",\n      ".join(shorts)}
    ],
    matchSets: [
      {",\n      ".join(match_sets)}
    ],
    essays: [
      {",\n      ".join(essays)}
    ],
    inlines: [
      {",\n      ".join(inlines)}
    ],
    codes: [
      {",\n      ".join(codes)}
    ],
    notes: [
      {",\n      ".join(notes)}
    ],
  }}"""

# Build curricula objects as JS source (embedded in generator)
curricula_js = ",\n".join(
    build_curriculum_js(slug, title, lang, C[slug]) for slug, title, lang in BANKS
)
slugs_js = ", ".join(esc(s) for s, _, _ in BANKS)

mjs = f'''#!/usr/bin/env node
/**
 * Generates src/data/demoBanks/allNewBanks.ts with all 41 CS demo bank curricula.
 * Run: node scripts/generateCsDemoBanks.mjs
 */
import fs from "node:fs";
import path from "node:path";
import {{ fileURLToPath }} from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "../src/data/demoBanks/allNewBanks.ts");

/** @type {{import('../src/data/demoBankFactory.ts').BankCurriculum[]}} */
const ALL_NEW_CURRICULA = [
{curricula_js}
];

const NEW_DEMO_BANK_SLUGS = [
  {slugs_js}
];

if (ALL_NEW_CURRICULA.length !== 41) {{
  console.error("Expected 41 curricula, got", ALL_NEW_CURRICULA.length);
  process.exit(1);
}}
if (NEW_DEMO_BANK_SLUGS.length !== 41) {{
  console.error("Expected 41 slugs, got", NEW_DEMO_BANK_SLUGS.length);
  process.exit(1);
}}

const missingConcepts = ALL_NEW_CURRICULA.filter((c) => c.concepts.length < 28);
if (missingConcepts.length) {{
  console.error("Curricula with <28 concepts:", missingConcepts.map((c) => c.slug));
  process.exit(1);
}}

function emitCurriculum(c, indent = "  ") {{
  const j = (v) => JSON.stringify(v);
  const lines = [];
  lines.push(`${{indent}}{{`);
  lines.push(`${{indent}}  slug: ${{j(c.slug)}},`);
  lines.push(`${{indent}}  title: ${{j(c.title)}},`);
  lines.push(`${{indent}}  language: ${{j(c.language)}},`);
  lines.push(`${{indent}}  concepts: [`);
  for (const x of c.concepts) {{
    lines.push(`${{indent}}    {{ term: ${{j(x.term)}}, def: ${{j(x.def)}}, distractors: [${{j(x.distractors[0])}}, ${{j(x.distractors[1])}}, ${{j(x.distractors[2])}}] }},`);
  }}
  lines.push(`${{indent}}  ],`);
  lines.push(`${{indent}}  truths: [`);
  for (const t of c.truths) lines.push(`${{indent}}    {{ statement: ${{j(t.statement)}}, correct: ${{t.correct}} }},`);
  lines.push(`${{indent}}  ],`);
  lines.push(`${{indent}}  multi: [`);
  for (const m of c.multi) {{
    lines.push(`${{indent}}    {{ prompt: ${{j(m.prompt)}}, choices: [${{m.choices.map(j).join(", ")}}], correct: [${{m.correct.join(", ")}}] }},`);
  }}
  lines.push(`${{indent}}  ],`);
  lines.push(`${{indent}}  numbers: [`);
  for (const n of c.numbers) {{
    const tol = n.tolerance ?? 0;
    lines.push(`${{indent}}    {{ prompt: ${{j(n.prompt)}}, answer: ${{n.answer}}, tolerance: ${{tol}} }},`);
  }}
  lines.push(`${{indent}}  ],`);
  lines.push(`${{indent}}  blanks: [`);
  for (const b of c.blanks) lines.push(`${{indent}}    {{ prompt: ${{j(b.prompt)}}, answers: [${{b.answers.map(j).join(", ")}}] }},`);
  lines.push(`${{indent}}  ],`);
  lines.push(`${{indent}}  shorts: [`);
  for (const s of c.shorts) lines.push(`${{indent}}    {{ prompt: ${{j(s.prompt)}}, answer: ${{j(s.answer)}} }},`);
  lines.push(`${{indent}}  ],`);
  lines.push(`${{indent}}  matchSets: [`);
  for (const m of c.matchSets) {{
    const pairs = m.pairs.map((p) => `{{ left: ${{j(p.left)}}, right: ${{j(p.right)}} }}`).join(", ");
    lines.push(`${{indent}}    {{ prompt: ${{j(m.prompt)}}, pairs: [${{pairs}}] }},`);
  }}
  lines.push(`${{indent}}  ],`);
  lines.push(`${{indent}}  essays: [`);
  for (const e of c.essays) lines.push(`${{indent}}    ${{j(e)}},`);
  lines.push(`${{indent}}  ],`);
  lines.push(`${{indent}}  inlines: [`);
  for (const x of c.inlines) {{
    lines.push(`${{indent}}    {{ prompt: ${{j(x.prompt)}}, accepted: [${{x.accepted.map(j).join(", ")}}], starter: ${{j(x.starter)}} }},`);
  }}
  lines.push(`${{indent}}  ],`);
  lines.push(`${{indent}}  codes: [`);
  for (const x of c.codes) {{
    lines.push(`${{indent}}    {{ prompt: ${{j(x.prompt)}}, starter: ${{j(x.starter)}}, correct: ${{j(x.correct)}} }},`);
  }}
  lines.push(`${{indent}}  ],`);
  lines.push(`${{indent}}  notes: [`);
  for (const n of c.notes ?? []) lines.push(`${{indent}}    ${{j(n)}},`);
  lines.push(`${{indent}}  ],`);
  lines.push(`${{indent}}}}`);
  return lines.join("\\n");
}}

const header = `/**
 * Auto-generated by scripts/generateCsDemoBanks.mjs — do not hand-edit.
 * All 41 NEW CS demo bank curricula (frozen five banks live elsewhere).
 */
import type {{ BankCurriculum }} from "../demoBankFactory";
import {{ expandCurriculum }} from "../demoBankFactory";
import {{ makeBank }} from "../demoBankHelpers";
import type {{ QuestionBank }} from "../../utils/questionBanks";

`;

const body = [
  "export const ALL_NEW_CURRICULA: BankCurriculum[] = [",
  ALL_NEW_CURRICULA.map((c) => emitCurriculum(c)).join(",\\n"),
  "];",
  "",
  "export const NEW_DEMO_BANK_SLUGS: string[] = [",
  NEW_DEMO_BANK_SLUGS.map((s) => `  ${{JSON.stringify(s)}},`).join("\\n"),
  "];",
  "",
  "export function buildAllNewDemoBanks(courseId: string): QuestionBank[] {{",
  "  return ALL_NEW_CURRICULA.map((curriculum, index) => {{",
  "    const questions = expandCurriculum(courseId, curriculum);",
  "    return makeBank(courseId, curriculum.slug, curriculum.title, questions, index);",
  "  }});",
  "}}",
  "",
].join("\\n");

fs.mkdirSync(path.dirname(outPath), {{ recursive: true }});
fs.writeFileSync(outPath, header + body, "utf8");
console.log("Wrote", outPath);
console.log("bytes", fs.statSync(outPath).size);
console.log("slugs", NEW_DEMO_BANK_SLUGS.length);
'''

OUT_MJS.write_text(mjs)
print("Wrote generator", OUT_MJS, "bytes", OUT_MJS.stat().st_size)
