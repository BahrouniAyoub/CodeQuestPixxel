# Learning UI Wireframes (Conceptual)

> **Status**: Proposed conceptual wireframes (documentation only). Text/ASCII layout for design discussion.

## 1. First-Time PixelOS Tutorial

```text
+-----------------------------------------------------------------------------------+
| [Dimmed PixelOS desktop]                                                          |
|                                                                                   |
|   [Desktop Icons]        +-----------------------------------------------+         |
|   [Browser]              | Welcome to PixelOS                      1/6   |         |
|   [Mail]                 | This is your in-game computer.                |         |
|   [Editor]               | You'll use it to find jobs, learn Python,      |         |
|                          | and deliver client work.                      |         |
|                          | [Skip] [Back] [Next]                          |         |
|                          +----------------------v------------------------+         |
|                                                 [Highlighted Desktop Area]        |
|-----------------------------------------------------------------------------------|
| Start  [Browser] [Mail] [Editor] ...                                 10:24 AM     |
+-----------------------------------------------------------------------------------+
```

## 2. GigBoard Job Discovery

```text
+---------------- Browser: CodeQuest Web -------------------------------------------+
| [<] [>] [↻] [Home] [gigboard.codequest/jobs/cafe-calculator            ] [Go]   |
|-----------------------------------------------------------------------------------|
| GigBoard > Python Jobs                                                            |
| +--------------------------------------+  +-----------------------------------+   |
| | GB-1042 Café Calculator         $50  |  | Need Python?                      |   |
| | Alex Morgan · Beginner               |  | You found a real client job.      |   |
| | Build a simple calculator...         |  | Ask Alex for beginner lessons.    |   |
| | [View Job]                           |  | [Message Alex] [Later]            |   |
| +--------------------------------------+  +-----------------------------------+   |
+-----------------------------------------------------------------------------------+
```

## 3. Contacting the Mentor

```text
+---------------- CodeQuest Mail ----------------------------------------------------+
| Inbox | Sent | Compose                                                            |
|--------------------------+--------------------------------------------------------|
| Alex Rivera              | Subject: Need help with a Python job                   |
| Welcome to PixelOS       | Hey Alex, I found a Café Calculator job on GigBoard... |
|                          |                                                        |
|                          | [Attach lesson request template]                       |
|                          | [Send] [Save Draft]                                    |
+--------------------------+--------------------------------------------------------+
```

## 4. Mentor Email Response

```text
+---------------- CodeQuest Mail ----------------------------------------------------+
| From: Alex Rivera                                   Re: Need help with a Python job|
|-----------------------------------------------------------------------------------|
| Great find — you can absolutely learn enough for this.                            |
| Plan: 1) Learn basics  2) Practice safely  3) Build the café job                  |
|                                                                                   |
| [Open Python Basics in Browser]   [Open Practice Folder]                          |
+-----------------------------------------------------------------------------------+
```

## 5. Python Learning Website (Browser)

```text
+---------------- Browser: learn.codequest/ch1 -------------------------------------+
| Python Basics for the Café Job                                    Progress 3/8    |
|-----------------------------------------------------------------------------------|
| Lessons                     | Lesson 3: Calculating Prices                        |
| [x] 1. First Words          | Objective: Use arithmetic to calculate totals       |
| [x] 2. Storing Information  |                                                     |
| [>] 3. Calculating Prices   | Example:                                            |
| [ ] 4. Text and Receipts    |   coffees = 2                                       |
| [ ] 5. Making Decisions     |   total = coffees * 3                               |
| ...                         |                                                     |
|                             | [Open Practice in Editor] [Mark Complete*]          |
+-----------------------------------------------------------------------------------+
* Mark complete enabled only after practice tests pass.
```

## 6. Lesson Interface

```text
+---------------- Lesson: Calculating Prices ----------------------------------------+
| Objective | Explanation | Worked Example | Practice | Hints                       |
|-----------------------------------------------------------------------------------|
| A café needs correct totals. Multiply quantity by price, then add items.          |
|                                                                                   |
| Worked example                                                                   |
| +-----------------------------------------------------------------------------+   |
| | coffee_price = 3                                                            |   |
| | sandwiches = 2                                                              |   |
| | total = sandwiches * 5                                                      |   |
| | print(total)                                                                |   |
| +-----------------------------------------------------------------------------+   |
| [Try in Editor]                                                                   |
+-----------------------------------------------------------------------------------+
```

## 7. Guided Practice Exercise

```text
+---------------- Code Editor (Practice Mode) --------------------------------------+
| Lesson: L1-03 Calculating Prices        [Run] [Submit Practice] [Hints] [Reset]  |
|----------------------------------+------------------------------------------------|
| # starter                        | Output / Test Results                          |
| coffee_price = 3                 | > Run: 21                                      |
| sandwich_price = 5                |                                                |
| coffees = 2                      | Submit Practice:                               |
| sandwiches = 3                   | [PASS] calculates 2 coffees + 3 sandwiches     |
| # Calculate total                | [PASS] total variable exists                   |
|                                  | Feedback: Nice! Your total is correct.         |
+----------------------------------+------------------------------------------------+
```

## 8. Code Editor Validation (Client Task)

```text
+---------------- Code Editor (Client Task: CAFE-T2 Discount Rules) ----------------+
| [Run] [Submit Test] [Open in Tickets] [Files: calculator.py | main.py]           |
|----------------------------------+------------------------------------------------|
| def apply_discount(total):       | Test Results                                   |
|     if total >= 20:              | [PASS] 19.99 unchanged                         |
|         return total * 0.9       | [FAIL] 20.00 should return 18.0                |
|     return total                 | Hint 2: The $20 threshold is inclusive.        |
|                                  | [Show details] [Retry]                         |
+----------------------------------+------------------------------------------------+
```

## 9. Café Task Interface

```text
+---------------- My Tickets / Café Project ----------------------------------------+
| Café Calculator - Client Tasks                                  Progress 2/6     |
|-----------------------------------------------------------------------------------|
| [x] T1 Calculate totals                                                           |
| [>] T2 Apply discount rule                                                        |
| [ ] T3 Receipt output                                                              |
| ...                                                                               |
|-----------------------------------------------------------------------------------|
| Client request: "Orders of $20 or more get 10% off."                              |
| Required files: calculator.py                                                     |
| Acceptance: boundary at 20, no negative totals, return values                      |
| [Open in Code Editor] [Verify Task]                                               |
+-----------------------------------------------------------------------------------+
```

## 10. Progress and Skills Interface

```text
+---------------- Progress / Skills -------------------------------------------------+
| Chapter 1: The First Paycheck                     Career: Beginner                |
|-----------------------------------------------------------------------------------|
| Skills                                                                            |
| [■■■□□] Variables & Types   [■■■□□] Arithmetic   [■■□□□] Conditions              |
| [■■□□□] Functions           [■□□□□] Input/Validation                              |
|                                                                                   |
| Current objective: Complete Lesson 5 - Making Decisions                           |
| Rewards earned: $0 so far (client payment locked until delivery)                  |
+-----------------------------------------------------------------------------------+
```