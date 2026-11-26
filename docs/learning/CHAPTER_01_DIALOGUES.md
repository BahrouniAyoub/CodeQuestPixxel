# Chapter 1 Dialogues — Mentor Alex (Proposed, Revised)

> **Status**: Proposed scripted dialogue (documentation only). No external AI/chatbot. No implementation.  
> **Date**: 2026-11-26 (revised after Task 003 review)

## Voice Guidelines

- Alex is warm, clear, and practical.
- Avoid jargon; explain terms when first used.
- Never give full paid-client solution or exact Café answer before/during assessment.
- Keep messages short enough for Mail/Chat UI.
- Encourage effort; normalize mistakes; explain errors plainly.

## 1. Player Initial Request for Help (Mail)

**Thread**: `Need help with a Python job`  
**From**: Player  
**To**: Alex Rivera

> Subject: Found a job... but I don't know Python yet
>
> Hey Alex,
>
> I found a small freelance job on GigBoard — a café wants a simple calculator app. It pays $50, which would really help.
>
> The problem is: the job needs Python, and I've never coded before.
>
> Do you think I can learn enough to do it? If so, where should I start?
>
> — [Player Name]

## 2. Alex Response — Encouragement and Plan (Mail)

**From**: Alex Rivera

> Subject: Re: Found a job... but I don't know Python yet
>
> Hey [Player Name],
>
> Great find — and yes, you can absolutely learn enough for this. Everyone starts somewhere, and this is a perfect first project.
>
> Here's the plan:
> 1. **Learn the basics** — I'll send you a short beginner Python guide (core path: ~30–45 minutes).
> 2. **Practice in a safe workspace** — small exercises, no client pressure.
> 3. **Prove you're ready** — finish the core lessons, or pass the readiness checks if you already know some basics.
> 4. **Build the café job** — once you're ready, you'll take the real task with confidence.
>
> I've put together a beginner lesson pack in your browser: **CodeQuest Learn → Python Basics for the Café Job**.
>
> Start with Lesson 1, or try "Check My Skills" if you want to test what you already know. Either way, I'll help you get ready. Message me if you get stuck.
>
> You've got this.
> — Alex

## 3. Introduction to Python (Browser Lesson / Mail Snippet)

**Lesson intro text (Alex voice):**

> "Python is a programming language — a way to give your computer clear instructions. You don't need to know everything at once. For this café job, we'll learn exactly what you need: showing messages, storing prices, doing math, making decisions, and asking the customer for input.
>
> Let's start small. Your first program will just make the computer say hello."

## 4. Learning Progress Feedback (Chat)

### After Lesson 1-2
**Alex (Chat):**
> Nice work getting started! You've already learned two big things: how to show output and how to store information. That's the foundation for every program you'll write.

### After Lesson 3-4
**Alex (Chat):**
> You're thinking like a programmer now. Calculating totals and formatting messages are exactly the kind of skills the café job needs.

### After Lesson 5-6
**Alex (Chat):**
> Functions and decisions are a big step. This is where your code starts becoming reusable and smart. The café discount rule won't scare you now.

### After Lesson 7-8
**Alex (Chat):**
> Handling user input and errors is what makes a program feel professional. Great job sticking with the tricky parts.

## 5. Confirmation That Player Is Ready (Mail)

**From**: Alex Rivera

> Subject: You're ready for the Café Calculator job
>
> Hey [Player Name],
>
> You've shown you have the basics you need for this first job — showing output, storing values, doing math, making decisions, and writing reusable functions. If the client task asks for input or validation, you can also lean on the optional lessons.
>
> Whether you learned through the lessons or proved it with the readiness checks, you're ready to take the Café Calculator job on GigBoard.
>
> A few pro tips before you start:
> - Read the client request carefully.
> - Build one small piece at a time.
> - Test before you submit.
> - If you get stuck, ask me for a hint — I'll guide you, but I want *you* to solve it.
>
> Go get that first paycheck.
> — Alex

## 6. Progressive Hint Examples (Chat, during practice/client task)

**H1 (nudge):**
> "Take a look at what your function returns. Is it giving back a value, or just printing it?"

**H2 (concept):**
> "Remember: `return` sends a value back from a function. `print()` just displays it on screen."

**H3 (targeted, practice scenario - travel/shopping, not café):**
> "In this practice, your `total_cost` should add the notebook cost and the pen cost. Check the line where you multiply pens by their price."

**Client-task boundary:**
> "I can't write the client code for you, but I can help you debug it. What does the error message say?"

**Assessment boundary:**
> "I can explain the concept, but the readiness check needs to be your own work. Want a small hint about the rule you're using?"

## 7. Congratulations After Successful Delivery (Mail)

**From**: Alex Rivera

> Subject: First paycheck earned!
>
> Hey [Player Name],
>
> You did it — your first paid programming job! $50 earned with real code you wrote yourself.
>
> What impressed me most wasn't just that it worked. You followed the process: learned the basics, practiced, built the solution, tested it, and delivered it.
>
> That's how real developers work.
>
> Take a moment to celebrate. When you're ready, I'll keep an eye out for the next opportunity.
>
> Proud of you.
> — Alex

## 8. Optional Failure/Encouragement Lines

**After failed test:**
> "Not quite yet — but this is normal. Read the error or failed test, fix one thing, and try again."

**After repeated failure:**
> "Let's slow down. Which part are you working on: calculating, formatting, input, or validation?"

**After player asks for full solution:**
> "I know it's tempting, but solving it yourself is what makes you a developer. I'll give you a hint instead."