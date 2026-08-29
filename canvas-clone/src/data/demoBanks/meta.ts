import type { BankMeta } from "../../utils/bankMeta";
import { normalizeBankMeta } from "../../utils/bankMeta";

type SeedMeta = Partial<BankMeta> & { notes?: string };

/** Instructor metadata for bundled CS packs, keyed by catalog slug. */
const BY_SLUG: Record<string, SeedMeta> = {
  "data-structures": {
    audience: "sophomore",
    difficulty: "intermediate",
    examUse: "quiz",
    tags: ["DSA", "CS2", "trees", "graphs"],
    notes: "Core CS2 pool: arrays through graphs. Good for weekly quizzes and a midterm.",
  },
  "algorithms-complexity": {
    audience: "sophomore",
    difficulty: "intermediate",
    examUse: "midterm",
    tags: ["algorithms", "complexity", "sorting"],
    notes: "Asymptotics, sorting, and graph algorithms. Mix of recall and analysis.",
  },
  "programming-fundamentals": {
    audience: "freshman",
    difficulty: "intro",
    examUse: "quiz",
    tags: ["CS1", "control-flow", "functions"],
    notes: "First-year programming: types, loops, functions, and basic debugging.",
  },
  "systems-os-networking": {
    audience: "junior",
    difficulty: "intermediate",
    examUse: "quiz",
    tags: ["systems", "OS", "networking"],
    notes: "Survey bank spanning OS and intro networking. Split by topic for smaller quizzes.",
  },
  "nlp-language-models": {
    audience: "senior",
    difficulty: "advanced",
    examUse: "quiz",
    tags: ["NLP", "transformers", "AI"],
    notes: "Language models and NLP concepts. Best as a senior elective or grad intro.",
  },
  python: {
    audience: "freshman",
    difficulty: "intro",
    examUse: "homework",
    tags: ["Python", "syntax", "stdlib"],
  },
  java: {
    audience: "freshman",
    difficulty: "intro",
    examUse: "quiz",
    tags: ["Java", "OOP", "syntax"],
  },
  c: {
    audience: "sophomore",
    difficulty: "intermediate",
    examUse: "quiz",
    tags: ["C", "pointers", "memory"],
  },
  cpp: {
    audience: "sophomore",
    difficulty: "intermediate",
    examUse: "quiz",
    tags: ["C++", "OOP", "STL"],
  },
  "discrete-math": {
    audience: "freshman",
    difficulty: "intermediate",
    examUse: "midterm",
    tags: ["proofs", "sets", "logic"],
  },
  "probability-stats": {
    audience: "sophomore",
    difficulty: "intermediate",
    examUse: "quiz",
    tags: ["probability", "statistics"],
  },
  "linear-algebra": {
    audience: "sophomore",
    difficulty: "intermediate",
    examUse: "quiz",
    tags: ["linear-algebra", "matrices"],
  },
  "computer-organization": {
    audience: "sophomore",
    difficulty: "intermediate",
    examUse: "midterm",
    tags: ["architecture", "digital-logic"],
  },
  "operating-systems": {
    audience: "junior",
    difficulty: "intermediate",
    examUse: "midterm",
    tags: ["OS", "concurrency", "memory"],
  },
  "computer-networks": {
    audience: "junior",
    difficulty: "intermediate",
    examUse: "quiz",
    tags: ["networking", "TCP", "routing"],
  },
  cybersecurity: {
    audience: "junior",
    difficulty: "intermediate",
    examUse: "quiz",
    tags: ["security", "threats"],
  },
  cryptography: {
    audience: "senior",
    difficulty: "advanced",
    examUse: "quiz",
    tags: ["crypto", "security"],
  },
  databases: {
    audience: "junior",
    difficulty: "intermediate",
    examUse: "quiz",
    tags: ["SQL", "relational", "indexing"],
  },
  "parallel-distributed": {
    audience: "senior",
    difficulty: "advanced",
    examUse: "quiz",
    tags: ["distributed", "parallel"],
  },
  compilers: {
    audience: "senior",
    difficulty: "advanced",
    examUse: "midterm",
    tags: ["compilers", "parsing", "languages"],
  },
  "embedded-iot": {
    audience: "junior",
    difficulty: "intermediate",
    examUse: "quiz",
    tags: ["embedded", "IoT"],
  },
  "html-css": {
    audience: "freshman",
    difficulty: "intro",
    examUse: "homework",
    tags: ["HTML", "CSS", "web"],
  },
  "web-technologies": {
    audience: "sophomore",
    difficulty: "intermediate",
    examUse: "quiz",
    tags: ["web", "HTTP", "APIs"],
  },
  "javascript-typescript": {
    audience: "sophomore",
    difficulty: "intermediate",
    examUse: "quiz",
    tags: ["JavaScript", "TypeScript", "web"],
  },
  "software-engineering": {
    audience: "junior",
    difficulty: "intermediate",
    examUse: "homework",
    tags: ["process", "testing", "design"],
  },
  "devops-sre": {
    audience: "senior",
    difficulty: "intermediate",
    examUse: "quiz",
    tags: ["DevOps", "SRE", "CI"],
  },
  "mobile-cloud": {
    audience: "junior",
    difficulty: "intermediate",
    examUse: "quiz",
    tags: ["mobile", "cloud"],
  },
  "functional-programming": {
    audience: "junior",
    difficulty: "advanced",
    examUse: "quiz",
    tags: ["FP", "lambda", "types"],
  },
  "concurrent-programming": {
    audience: "junior",
    difficulty: "advanced",
    examUse: "quiz",
    tags: ["concurrency", "threads"],
  },
  "theory-of-computation": {
    audience: "senior",
    difficulty: "advanced",
    examUse: "midterm",
    tags: ["TOC", "automata", "complexity"],
  },
  "formal-methods": {
    audience: "graduate",
    difficulty: "advanced",
    examUse: "quiz",
    tags: ["verification", "formal-methods"],
  },
  "artificial-intelligence": {
    audience: "senior",
    difficulty: "intermediate",
    examUse: "quiz",
    tags: ["AI", "search", "knowledge"],
  },
  "machine-learning": {
    audience: "senior",
    difficulty: "advanced",
    examUse: "midterm",
    tags: ["ML", "models", "training"],
  },
  "data-science": {
    audience: "junior",
    difficulty: "intermediate",
    examUse: "homework",
    tags: ["data", "EDA", "stats"],
  },
  "computer-vision": {
    audience: "senior",
    difficulty: "advanced",
    examUse: "quiz",
    tags: ["vision", "images"],
  },
  "information-retrieval": {
    audience: "senior",
    difficulty: "intermediate",
    examUse: "quiz",
    tags: ["IR", "search"],
  },
  "computer-graphics": {
    audience: "senior",
    difficulty: "intermediate",
    examUse: "quiz",
    tags: ["graphics", "rendering"],
  },
  "human-computer-interaction": {
    audience: "junior",
    difficulty: "intro",
    examUse: "homework",
    tags: ["HCI", "UX"],
  },
  "computer-ethics": {
    audience: "sophomore",
    difficulty: "intro",
    examUse: "homework",
    tags: ["ethics", "policy"],
  },
  "numerical-methods": {
    audience: "junior",
    difficulty: "advanced",
    examUse: "quiz",
    tags: ["numerics", "scientific-computing"],
  },
  "game-development": {
    audience: "junior",
    difficulty: "intermediate",
    examUse: "quiz",
    tags: ["games", "engines"],
  },
  "quantum-computing": {
    audience: "graduate",
    difficulty: "advanced",
    examUse: "quiz",
    tags: ["quantum", "qubits"],
  },
  blockchain: {
    audience: "senior",
    difficulty: "intermediate",
    examUse: "quiz",
    tags: ["blockchain", "consensus"],
  },
  robotics: {
    audience: "senior",
    difficulty: "intermediate",
    examUse: "quiz",
    tags: ["robotics", "control"],
  },
  bioinformatics: {
    audience: "graduate",
    difficulty: "advanced",
    examUse: "quiz",
    tags: ["bioinformatics", "genomics"],
  },
  "capstone-research": {
    audience: "senior",
    difficulty: "advanced",
    examUse: "homework",
    tags: ["capstone", "research"],
    notes: "Methods and writing items for senior design / research seminars.",
  },
};

export function demoSeedMeta(slug: string): BankMeta & { notes: string } {
  const row = BY_SLUG[slug] ?? {};
  const meta = normalizeBankMeta({ ...row, status: "ready" });
  return {
    ...meta,
    status: "ready",
    notes: typeof row.notes === "string" ? row.notes : "",
  };
}
