# CS question bank import pack (46 banks)

Each `.json` file matches the Question Banks export format:

```json
{ "version": 1, "title": "...", "questions": [ ... ], "exportedAt": ... }
```

## How to import

1. Open a course → **Question Banks**
2. Click **Import**
3. Choose one file from this folder (or several, one at a time)
4. Resolve title conflicts with **Rename / Replace / Skip** if prompted

Every question includes `feedback`, `correctFeedback`, and `incorrectFeedback` (notes/groups use a short non-graded note).

Banks 01–05 are the extended originals (Data Structures, Algorithms, Programming Fundamentals, Systems, NLP) at the same full size as 06–46.

## Catalog

| # | File | Title | ~Questions |
|---|------|-------|------------|
| 1 | `01-data-structures.json` | Data Structures | 104 |
| 2 | `02-algorithms-complexity.json` | Algorithms & Complexity | 104 |
| 3 | `03-programming-fundamentals.json` | Programming Fundamentals | 104 |
| 4 | `04-systems-os-networking.json` | Systems, OS & Networking | 104 |
| 5 | `05-nlp-language-models.json` | NLP & Language Models | 104 |
| 6 | `06-python.json` | Python Programming | 104 |
| 7 | `07-java.json` | Java Programming | 104 |
| 8 | `08-c.json` | C Programming | 104 |
| 9 | `09-cpp.json` | C++ Programming | 104 |
| 10 | `10-discrete-math.json` | Discrete Mathematics | 104 |
| 11 | `11-probability-stats.json` | Probability and Statistics for CS | 104 |
| 12 | `12-linear-algebra.json` | Linear Algebra for CS | 104 |
| 13 | `13-computer-organization.json` | Computer Organization and Digital Logic | 104 |
| 14 | `14-operating-systems.json` | Operating Systems | 104 |
| 15 | `15-computer-networks.json` | Computer Networks and Network Theory | 104 |
| 16 | `16-cybersecurity.json` | Cybersecurity | 104 |
| 17 | `17-cryptography.json` | Cryptography | 104 |
| 18 | `18-databases.json` | Databases | 104 |
| 19 | `19-parallel-distributed.json` | Parallel and Distributed Systems | 104 |
| 20 | `20-compilers.json` | Compilers and Programming Languages | 104 |
| 21 | `21-embedded-iot.json` | Embedded Systems and IoT | 104 |
| 22 | `22-html-css.json` | HTML and CSS | 104 |
| 23 | `23-web-technologies.json` | Web Technologies | 104 |
| 24 | `24-javascript-typescript.json` | JavaScript and TypeScript | 104 |
| 25 | `25-software-engineering.json` | Software Engineering | 104 |
| 26 | `26-devops-sre.json` | DevOps and Site Reliability | 104 |
| 27 | `27-mobile-cloud.json` | Mobile and Cloud Computing | 104 |
| 28 | `28-functional-programming.json` | Functional Programming | 104 |
| 29 | `29-concurrent-programming.json` | Concurrent Programming | 104 |
| 30 | `30-theory-of-computation.json` | Theory of Computation | 104 |
| 31 | `31-formal-methods.json` | Formal Methods and Verification | 104 |
| 32 | `32-artificial-intelligence.json` | Artificial Intelligence | 104 |
| 33 | `33-machine-learning.json` | Machine Learning | 104 |
| 34 | `34-data-science.json` | Data Science | 104 |
| 35 | `35-computer-vision.json` | Computer Vision | 104 |
| 36 | `36-information-retrieval.json` | Information Retrieval and Search | 104 |
| 37 | `37-computer-graphics.json` | Computer Graphics | 104 |
| 38 | `38-human-computer-interaction.json` | Human–Computer Interaction | 104 |
| 39 | `39-computer-ethics.json` | Computer Ethics and Professional Practice | 104 |
| 40 | `40-numerical-methods.json` | Numerical Methods and Scientific Computing | 104 |
| 41 | `41-game-development.json` | Game Development | 104 |
| 42 | `42-quantum-computing.json` | Quantum Computing | 104 |
| 43 | `43-blockchain.json` | Blockchain and Decentralized Systems | 104 |
| 44 | `44-robotics.json` | Robotics | 104 |
| 45 | `45-bioinformatics.json` | Bioinformatics | 104 |
| 46 | `46-capstone-research.json` | Capstone Projects and Research Methods | 104 |

Regenerate with:

```bash
node scripts/generateCsBanks.mjs
```
