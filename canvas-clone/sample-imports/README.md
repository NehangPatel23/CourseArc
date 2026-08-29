# Sample quiz / bank import files

Upload any of these via **Import** on a quiz’s Questions tab or in a question bank editor.

| File | Format | Questions | Notes |
|------|--------|-----------|--------|
| `cs-quiz-sample.json` | JSON | 25 | **Best** — all types, points, correct/incorrect feedback |
| `cs-quiz-sample.csv` | CSV | 25 | Includes `points` + `feedback` / `correct_feedback` / `incorrect_feedback` |
| `cs-quiz-sample.md` | Markdown | 25 | `points:` / `correct_feedback:` / `incorrect_feedback:` supported |
| `sample-algorithms.json` | JSON | 6 | Smaller algorithms mix with feedback |

## Types covered (JSON)

- Multiple choice, multiple answers  
- True/false, short answer, fill in the blank, numerical  
- Matching, essay  
- Inline code, coding  
- Note / instruction (not scored; use type `note`)

Each sample question includes **whole-number points** (content-aware) plus **correct** and **incorrect** feedback (with `feedback` as fallback).

Optional import fields for scoring depth: `partialCredit`, `partialCreditPenalty`, `tolerance`, `partialTolerance`, `nearMatchThreshold` (JSON keys or CSV/Markdown equivalents; threshold may be 0–1 or 0–100%).

Imports and the editor **Auto-assign points** button use a points agent that scores
recall → concept → application → synthesis (by type + prompt wording) with **integer** values.

## Quiz point totals

If the quiz’s **Points** field is set, attempt scoring scales all inline + bank-drawn question
weights to whole numbers (largest-remainder) so the attempt totals that many points. Notes stay at 0.

## How to use

1. Open a quiz → **Questions**, or open a question bank.  
2. Click **Import**.  
3. Choose one of these files.  
4. Questions are appended (new IDs). Save the quiz/bank when done.
