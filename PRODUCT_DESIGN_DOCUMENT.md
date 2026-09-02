# Personal Finance Spending Tracker

## Product Design Document

**Version:** 0.1  
**Status:** Draft  
**Date:** 2026-08-20  
**Product Owner:** Harry Liu  

---

## 1. Product Overview

Personal Finance Spending Tracker is a web application for tracking personal expenses in a centralized, convenient, and visually informative way. The product is designed to help users understand their monthly spending across categories, quickly enter transactions, and reduce manual bookkeeping effort through AI-assisted extraction from bank statements, screenshots, images, and PDFs.

The initial version focuses on personal expense tracking only. It does not attempt to manage full personal wealth, income, savings, debts, investments, or multiple financial accounts. Those areas may be introduced in later versions after the core spending-tracking experience is reliable and useful.

The primary goal of the MVP is to create a fast and trustworthy transaction-entry workflow, supported by a useful monthly dashboard. The application should make it easy for a user to record transactions manually or upload transaction history documents, review AI-extracted transaction candidates, approve valid transactions, and view current-month spending insights.

---

## 2. Product Goals

### 2.1 Primary Goals

1. Provide a centralized place for users to track personal expenses and refunds.
2. Make transaction entry fast, especially when entering many transactions at once.
3. Use OpenAI API-based document and image understanding to extract transaction details from uploaded financial documents.
4. Always keep the user in control through a human review and approval step before transactions are saved.
5. Provide informative current-month dashboards showing spending totals, category breakdowns, trends, and refunds.
6. Support optional budgeting by spending category.
7. Separate each user's data through Google SSO authentication.

### 2.2 Secondary Goals

1. Provide a clean foundation for future savings, income, and broader wealth-management features.
2. Preserve import history and raw AI extraction records for auditability and debugging.
3. Support user-editable categories while still providing sensible defaults.
4. Allow transactions from multiple dates and months to be recorded accurately based on transaction date.

### 2.3 Non-Goals For MVP

The MVP will not include:

1. Income tracking.
2. Savings goals.
3. Net worth tracking.
4. Debt tracking.
5. Multiple financial accounts per user.
6. Transfers between financial accounts.
7. Credit card payment tracking.
8. Multi-currency support.
9. Shared household views.
10. Bank API integrations.
11. Merchant/category learning or memory.
12. Custom-trained machine learning models.
13. A dedicated advanced transaction search page.

---

## 3. Target Users

### 3.1 Initial User

The initial target user is an individual who wants a convenient and centralized way to track personal spending across multiple bank or credit card sources, without manually entering every transaction one by one.

The user may collect transaction histories from bank accounts, credit cards, screenshots, PDFs, or statement images and upload them to the application for AI-assisted extraction.

### 3.2 Near-Future Users

After the initial rollout, family members may be invited to use the product. Each person should have their own Google-authenticated profile and their own isolated personal spending data.

The MVP should therefore support multiple users at the application level, even though each user only has one logical financial account in V1.

---

## 4. Product Principles

1. **Human approval first:** AI can suggest transactions, but it must not silently save them without user review.
2. **Fast entry matters:** The product should minimize repetitive typing and support bulk workflows.
3. **Transaction date is authoritative:** Dashboards and budgets should use the date the transaction occurred, not the date it was entered or imported.
4. **Simple before comprehensive:** MVP should focus on expenses and refunds before expanding into broader financial management.
5. **User data isolation:** Each Google-authenticated user should only see their own financial data.
6. **Editable and recoverable:** Users should be able to edit or delete saved transactions.
7. **Transparent imports:** Uploaded files, raw extraction results, and approved transactions should be traceable through import history.

---

## 5. Core Concepts

### 5.1 User

A user is an individual authenticated through Google SSO. Each user has their own:

1. Transactions.
2. Categories.
3. Budgets.
4. Import batches.
5. Uploaded source files.
6. Dashboard data.

### 5.2 Transaction

A transaction is a saved financial record representing either an expense or a refund.

Each saved transaction must have:

1. Date.
2. Description or merchant.
3. Category.
4. Amount.
5. Type: expense or refund.

Optional transaction data includes:

1. Notes.
2. Source: manual entry or AI import.
3. Import batch reference.
4. Source file reference.
5. Created and updated timestamps.

Transactions do not need to be entered in chronological order.

### 5.3 Expense

An expense is a personal spending transaction. Expenses increase monthly category spending and contribute to budget usage.

### 5.4 Refund

A refund represents a return, cancellation, reimbursement from a merchant, or other reversal of a previous expense.

For MVP, refunds do not need to be linked to their original expense. A refund should be categorized normally and should reduce spending for that category and month.

### 5.5 Category

A category is a user-visible grouping used to organize transactions and summarize spending.

The application should provide default categories, but users should be able to add, edit, and delete their own categories.

Every saved transaction must belong to a category.

Category deletion should be handled as archival rather than permanent deletion. Archived categories should no longer be available for new transaction entry, but historical transactions should retain their original category.

### 5.6 Import Batch

An import batch represents one AI-assisted upload workflow. A batch may contain one or more uploaded files and may produce many candidate transactions.

One batch may include transactions across multiple dates and multiple calendar months.

### 5.7 Candidate Transaction

A candidate transaction is a transaction suggested by the OpenAI API after processing uploaded files. Candidate transactions are not saved to the user's transaction ledger until the user reviews and approves them.

Candidate transactions may contain incomplete fields. The user must complete all required fields before saving selected candidates.

### 5.8 Budget

A budget is a user-defined spending limit for a category. Budgets only apply to expenses in MVP. Budget mode is optional and can be toggled on or off by the user.

---

## 6. User Stories

### 6.1 Authentication

As a user, I want to sign in with my Google account so that my spending data is private and tied to my own profile.

As a user, I want each Google account to have separate data so that my family members can eventually use the same application independently.

### 6.2 Dashboard

As a user, I want to see my current calendar month's total spending so that I can quickly understand how much I have spent this month.

As a user, I want to see spending by category so that I can understand where my money is going.

As a user, I want to see refunds separately from expenses so that I can understand both gross spending and net spending.

As a user, I want dashboards to use transaction dates so that transactions imported later still count toward the correct month.

As a user, I want to see recent transactions so that I can quickly confirm that my latest entries were recorded correctly.

### 6.3 Manual Transaction Entry

As a user, I want to manually enter an expense when I only have one or a few transactions to record.

As a user, I want to manually enter a refund so that returns and cancellations reduce my spending totals.

As a user, I want required fields to be enforced so that saved transaction data stays clean.

As a user, I want to enter transactions out of chronological order so that I can record old transactions whenever I have time.

### 6.4 AI-Assisted Import

As a user, I want to upload PDFs, images, or screenshots of transaction histories so that I do not have to manually type many transactions.

As a user, I want to upload multiple files in one import batch so that I can review all extracted transactions together.

As a user, I want the AI to return structured transaction details so that I can quickly review and save them.

As a user, I want incomplete AI-extracted transactions to be clearly indicated so that I know what needs to be corrected before saving.

As a user, I want to include or exclude each AI-suggested transaction so that only the transactions I approve are saved.

As a user, I want AI-extracted transactions to be editable before saving so that I can correct mistakes.

### 6.5 Import History

As a user, I want the app to store uploaded source files so that I can refer back to where imported transactions came from.

As a user, I want the app to store raw AI extraction results so that imports can be audited or debugged later.

As a user, I want excluded candidate transactions to remain visible in raw import history but not be saved as transactions.

### 6.6 Categories

As a user, I want the app to provide default spending categories so that I can start using the app immediately.

As a user, I want to add or edit categories so that the app matches my personal spending habits.

As a user, I want deleted categories to stop appearing for new transactions while preserving my historical records.

As a user, I want re-adding a previously deleted category to restore it instead of creating a duplicate category.

As a user, I want every transaction to require a category so that dashboard summaries remain meaningful.

### 6.7 Budgeting

As a user, I want to turn budget mode on or off so that budgeting does not clutter the experience if I am not using it.

As a user, I want to set monthly budgets by category so that I can compare actual spending against planned spending.

As a user, I want some budgets to reset monthly so that categories like groceries behave like normal monthly limits.

As a user, I want some budgets to roll over so that categories like travel can accumulate unused budget over time.

### 6.8 Editing And Deleting

As a user, I want to edit saved transactions so that I can fix mistakes later.

As a user, I want to delete saved transactions so that I can remove accidental or duplicate records.

---

## 7. MVP Feature Scope

## 7.1 Must-Have MVP Features

### 7.1.1 Google SSO Login

The application must support Google SSO login.

Requirements:

1. Users authenticate with Google.
2. Each user has isolated data.
3. Transactions, categories, budgets, and imports belong to a specific user.
4. A user must not be able to access another user's data.

### 7.1.2 Monthly Dashboard

The dashboard is the main page of the application and should default to the current calendar month.

Required dashboard information:

1. Total monthly spending.
2. Gross expenses.
3. Refund total.
4. Net spending after refunds.
5. Spending by category.
6. Spending trend across the month.
7. Recent transactions.
8. Budget progress, if budget mode is enabled.

Dashboard rules:

1. Calculations must use transaction date.
2. Refunds should reduce net spending.
3. Budget progress should only be shown when budget mode is enabled.
4. The MVP dashboard does not need an advanced search experience.

### 7.1.3 Manual Transaction Entry

The application must allow users to manually create transactions.

Required fields:

1. Transaction type: expense or refund.
2. Date.
3. Description or merchant.
4. Category.
5. Amount.

Optional fields:

1. Notes.

Rules:

1. A transaction cannot be saved without a category.
2. A transaction cannot be saved without date, description, amount, and type.
3. Transactions may be entered in any order.
4. Credit card payments from debit/checking accounts should not be recorded as expenses in MVP.

### 7.1.4 Editable Categories

The application must provide default categories and allow user customization.

Initial default category suggestions:

1. Groceries.
2. Restaurants.
3. Coffee and snacks.
4. Transportation.
5. Gas.
6. Shopping.
7. Entertainment.
8. Subscriptions.
9. Health.
10. Fitness.
11. Personal care.
12. Home.
13. Utilities.
14. Travel.
15. Gifts.
16. Education.
17. Fees.
18. Other.

Requirements:

1. Users can add categories.
2. Users can edit categories.
3. Users can delete categories through archival, without affecting historical transaction data.
4. Every saved transaction must have a category.
5. Deleted categories should no longer appear as selectable options for new transactions.
6. Historical transactions should continue to display their original deleted category.
7. If a user creates a category with the same normalized name as an archived category, the application should reactivate the archived category instead of creating a duplicate.

Category lifecycle rules:

1. Category deletion is soft deletion.
2. A deleted category becomes archived or inactive.
3. Archived categories are hidden from normal category selection and category management views.
4. Archived categories remain attached to historical transactions that already used them.
5. Historical dashboards should still display archived categories for months where they were used.
6. Active category names should be unique per user.
7. Category name matching for duplicate prevention and reactivation should be case-insensitive and ignore leading or trailing whitespace.
8. The application should prevent two active categories with the same normalized name.
9. The application should provide clear confirmation copy before archiving a category, especially if existing transactions use it.

### 7.1.5 AI-Assisted Import

The application must support AI-assisted extraction of transactions from uploaded files.

Supported upload types:

1. PDF statements.
2. Images.
3. Screenshots.
4. Bank or credit card transaction history exports shown as images or PDFs.

Workflow:

1. User uploads one or more files.
2. The application creates an import batch.
3. The application sends files to OpenAI API for transaction extraction.
4. The AI returns structured candidate transactions.
5. The application displays all candidate transactions from the batch in a review interface.

Extraction expectations:

1. The AI should only return actual transaction entries.
2. The AI should not return balances, credit limits, statement totals, payment summaries, clearly identified credit-card balance repayments, or other non-transaction information.
3. If the AI cannot determine a field confidently, it should leave that field blank rather than guessing.
4. Candidate transactions may span multiple calendar months.
5. Candidate transactions are not saved until approved by the user.

### 7.1.6 Import Review And Approval

The application must provide a human review step before AI-extracted transactions are saved.

Review requirements:

1. Display all candidate transactions from all files in the batch together.
2. Allow the user to select or unselect each candidate transaction. At final approval, every unselected candidate is discarded from the ledger.
3. Allow the user to edit transaction type, date, description, category, amount, and notes.
4. Clearly indicate incomplete rows.
5. Prevent selected rows from being saved until all required fields are complete.
6. Save only selected and valid rows, or finalize with no selected rows to discard every suggestion.
7. When the batch is approved, discard every unselected row from the ledger and remove all finalized candidates from the review queue.

Rules:

1. Completed batch metadata and final candidate state should remain available for audit history, but completed candidates should not reappear in the temporary review queue.
2. Human review is mandatory for AI imports.
3. AI-suggested transactions should be treated as untrusted until approved.

### 7.1.7 Edit And Delete Saved Transactions

Users must be able to edit and delete saved transactions.

Requirements:

1. Users can update transaction date, type, description, category, amount, and notes.
2. Users can delete transactions.
3. Dashboard and budget calculations update after edits or deletions.

### 7.1.8 Import History

The application must store basic import history.

Import history should include:

1. Import batch ID.
2. User ID.
3. Uploaded source files.
4. Upload timestamp.
5. Raw AI extraction result.
6. Candidate transactions returned by the AI.
7. Which candidate transactions were approved.
8. Which candidate transactions were excluded.
9. Import status.

Suggested import statuses:

1. Uploaded.
2. Processing.
3. Ready for review.
4. Approved.
5. Failed.

### 7.1.9 Budget Mode

The application must include a budget mode, but budgeting is a secondary MVP goal.

Requirements:

1. Budget mode can be toggled on or off per user.
2. When budget mode is off, budget-specific dashboard elements should be hidden or inactive.
3. When budget mode is on, the user can set category budgets.
4. Budgets apply only to expenses.
5. Refunds reduce net spending but should be handled carefully in budget calculations.
6. Budget calculations use transaction date.

### 7.1.10 Rollover Budgets

Budget categories may support either monthly reset or rollover behavior.

Monthly reset budget:

1. Budget limit applies to a single calendar month.
2. Unused budget does not carry forward.
3. The next month starts fresh.

Rollover budget:

1. Unused budget carries forward into future months.
2. Overspending reduces future available budget.
3. Rollover availability is calculated using the configured monthly budget amount, transaction dates, and prior spending.

Example:

1. Travel budget is $300 per month.
2. January spending is $0, so $300 rolls forward.
3. February spending is $0, so available budget becomes $600.
4. March spending is $900, so available budget becomes $0.
5. April starts with $300 available.

If March spending were $1,000, April would start with $200 available after recovering the $100 overage.

---

## 7.2 Nice-To-Have For V1

The following features are useful but not required for the first usable MVP:

1. Duplicate detection during import review.
2. Bulk editing candidate transactions in the import review interface.
3. Month selector on dashboard.
4. Basic filters on transaction lists, such as month, category, and type.
5. CSV upload support.
6. Export transactions to CSV.
7. Simple budget alerts, such as near-budget and over-budget indicators.
8. Ability to undo an entire import batch.
9. AI confidence score display, if it can be produced reliably.
10. Basic import failure retry.
11. Simple file preview during import review.

---

## 7.3 Post-V1 Features

The following features should be deferred until after MVP:

1. Income tracking.
2. Savings goals.
3. Net worth tracking.
4. Debt tracking.
5. Multiple financial accounts per user.
6. Transfers between accounts.
7. Credit card payment detection and classification.
8. Persistent, user-configurable merchant/category rule management beyond the bounded extraction hints.
9. Model training or broader AI categorization learning beyond the bounded extraction hints.
10. Non-transaction classification.
11. Multi-currency support.
12. Shared household views.
13. Recurring transaction detection.
14. Subscription detection.
15. Advanced transaction search page.
16. Tax or business expense tagging.
17. Receipt matching.
18. Native mobile app.
19. Bank API integrations.
20. Investment tracking.
21. Personal wealth-management dashboards.
22. Custom-trained machine learning models.

---

## 8. Key Workflows

### 8.1 First-Time User Workflow

1. User opens the app.
2. User signs in with Google.
3. App creates a user profile.
4. App initializes default categories for the user.
5. User lands on the dashboard.
6. Dashboard shows empty current-month state until transactions are added.

### 8.2 Manual Transaction Entry Workflow

1. User navigates to transaction entry.
2. User selects manual entry.
3. User enters transaction type, date, description, category, and amount.
4. User optionally enters notes.
5. User saves the transaction.
6. App validates required fields.
7. App records the transaction.
8. Dashboard updates based on transaction date.

### 8.3 AI Import Workflow

1. User navigates to transaction entry.
2. User selects upload/import.
3. User uploads one or more PDFs, images, or screenshots.
4. App creates an import batch.
5. App stores uploaded source files.
6. App sends files to OpenAI API for transaction extraction.
7. App receives structured candidate transactions.
8. App stores raw extraction results.
9. App displays all candidate transactions in a review interface.
10. User reviews and edits candidate transactions.
11. User excludes any rows they do not want to record.
12. User completes missing required fields.
13. User approves selected valid transactions.
14. App saves approved rows as transactions.
15. App records which candidates were approved or excluded.
16. Dashboard updates based on transaction dates.

### 8.4 Edit Transaction Workflow

1. User opens a saved transaction.
2. User edits one or more fields.
3. App validates required fields.
4. App saves changes.
5. Dashboard and budgets update.

### 8.5 Delete Transaction Workflow

1. User selects a saved transaction.
2. User chooses delete.
3. App confirms the delete action.
4. App deletes or marks the transaction as deleted.
5. Dashboard and budgets update.

### 8.6 Budget Setup Workflow

1. User enables budget mode.
2. User selects a category.
3. User enters a monthly budget amount.
4. User chooses monthly reset or rollover behavior.
5. User saves the budget.
6. Dashboard displays budget progress for the current calendar month.

---

## 9. Data And Calculation Rules

### 9.1 Transaction Dates

Transaction date is the source of truth for dashboard and budget calculations.

Examples:

1. A transaction imported on August 19 with a transaction date of July 30 counts toward July.
2. A transaction manually entered today with a transaction date of August 1 counts toward August.
3. One import batch may create transactions across multiple months.

### 9.2 Expense And Refund Calculations

Gross expenses:

1. Sum of expense transactions for the selected month.

Refunds:

1. Sum of refund transactions for the selected month.

Net spending:

1. Gross expenses minus refunds.

Category spending:

1. Expense transactions increase category spending.
2. Refund transactions reduce category spending for their assigned category.

### 9.3 Budget Calculations

Budgets apply to expenses only in MVP.

Budget progress should compare category spending against the configured budget for the relevant month.

For rollover budgets:

1. Unused budget accumulates across months.
2. Overspending carries forward as a negative balance.
3. Available budget should be calculated from the budget start month through the selected month.

### 9.4 Category Requirement

Every saved transaction must have a category.

AI-extracted candidate transactions may temporarily have blank categories during review, but selected rows cannot be saved until categories are filled.

### 9.5 Category Archival And Reactivation

Category deletion should be treated as archival rather than permanent deletion.

When a user deletes a category:

1. The category becomes archived or inactive.
2. The category is hidden from future transaction-entry category options.
3. The category is hidden from normal active-category management views.
4. Historical transactions that already use the category are not changed.
5. Historical dashboards should continue to show the category where relevant.

When a user adds a category:

1. The application should compare the requested category name against active and archived categories for that user.
2. Matching should use a normalized category name, at minimum case-insensitive and trimmed.
3. If an active category with the same normalized name already exists, the application should not create a duplicate.
4. If an archived category with the same normalized name exists, the application should reactivate that category.
5. If no matching active or archived category exists, the application should create a new category.

---

## 10. AI Extraction Requirements

The application will use OpenAI API endpoints to process uploaded PDFs, images, and screenshots. The application will not train its own LLM model for MVP.

### 10.1 AI Responsibilities

The AI extraction process should attempt to identify:

1. Transaction date.
2. Merchant or description.
3. Amount.
4. Transaction type: expense or refund.
5. Suggested category, when reasonably inferable.
6. Notes or contextual details, when useful.

### 10.2 AI Behavior Guidelines

The extraction prompt should instruct the model to:

1. Return only actual transaction entries.
2. Ignore balances, statement totals, payment summaries, credit limits, clearly identified credit-card balance repayments, and other non-transaction rows.
3. Leave fields blank when uncertain.
4. Avoid inventing missing information.
5. Preserve transaction dates as shown in the document.
6. Return structured data suitable for application parsing.
7. Allow transactions across multiple months.
8. Remove a clearly incidental branch/store suffix or transaction-reference suffix only when the remaining merchant is unmistakable (for example, `FARM BOY #21` becomes `FARM BOY` and `PRESTO FARE/SFW5XTZCLP` becomes `PRESTO FARE`); otherwise preserve the source text.
9. May use a bounded list of the same user's previously confirmed merchant/category pairs as untrusted canonicalization hints for both merchant cleanup and suggested category. Send no dates, amounts, or notes; ignore archived categories and conflicting associations. Use a hint only for an exact or clearly close visible merchant variant, removing only clearly incidental payment-processor prefixes, branch/store/campus/city suffixes, country/currency markers, or payment descriptors. For example, with confirmed history, `HERO TEA WATERLOO` becomes `HERO TEA`, `AIRBNB PAYMENTS UK CAD` becomes `AIRBNB`, `SP J J PET CLUB` becomes `J&J PET CLUB`, and `UW TIM HORTONS DC` becomes `TIM HORTONS`. Do not make a blind textual replacement: retain useful service words such as `PRESTO FARE` even if prior history only contains `PRESTO`; never let a hint invent a value or override conflicting visible evidence.

### 10.3 Human Review Requirement

AI output must always go through human review before being saved.

The user must be able to:

1. Edit AI-filled fields.
2. Fill missing fields.
3. Leave unwanted rows unselected; approval discards them when it finalizes the batch.
4. Finalize review: save selected rows, or discard all when no rows are selected.

---

## 11. Privacy And Data Handling

The application will contain sensitive personal finance data. Privacy and data isolation should be treated as core product requirements.

### 11.1 User Isolation

1. Each user's data must be separated by authenticated user identity.
2. Users should not be able to view or modify other users' data.

### 11.2 Uploaded Files

For MVP, uploaded source bytes are processed in request memory only and are not stored on disk, in object storage, in the database, or through the OpenAI Files API.

### 11.3 AI Processing

Uploaded files and extracted content will be sent to OpenAI API endpoints for parsing. Each extraction may also send a bounded list of that same user's confirmed merchant name and active category pairs to improve careful merchant cleanup and category suggestions; it excludes transaction dates, amounts, notes, archived categories, and all other users' data. For owner-authorized debugging, the server process log stores the resulting instruction prompt and raw response text unencrypted; multipart file/image bytes and API secrets are not logged.

The product should make this behavior clear to users, especially if the application is later used by family members or broader audiences.

---

## 12. MVP Success Criteria

The MVP should be considered successful if:

1. A user can sign in with Google.
2. A user can manually create an expense or refund.
3. A user can upload one or more transaction-history files.
4. The app can send uploaded files to OpenAI and receive structured candidate transactions.
5. The user can review, edit, exclude, and approve AI-extracted transactions.
6. Approved transactions are saved correctly.
7. Transactions can span multiple months and appear in the correct monthly calculations.
8. The dashboard shows useful current-month spending information.
9. Categories are editable and required for saved transactions.
10. Budget mode can be enabled and used for category budgets.
11. Users can edit and delete saved transactions.
12. User data is isolated by Google account.

---

## 13. Open Questions And Future Decisions

The following questions do not block MVP definition but should be revisited before or during implementation:

1. Should deleted transactions be hard-deleted or soft-deleted for audit history?
2. How long should uploaded source files be retained?
3. Should users be able to permanently delete uploaded source files after import?
4. Should raw AI extraction results be visible to the user or only stored internally?
5. Should refunds reduce budget usage in the month they occur, even if the original purchase happened in a previous month?
6. Should budget mode be part of the first MVP release or shipped shortly after the core tracking/import loop?
7. What exact default category list should ship initially?
8. Should transaction amounts be stored as positive values with type determining behavior, or should expenses and refunds use signed amounts internally?
9. What file size limits should apply to uploads?
10. Should users be able to upload ZIP files containing multiple screenshots or PDFs?
11. Should the system support basic duplicate detection in MVP or defer it to a later V1 enhancement?

---

## 14. Recommended MVP Priority Order

The recommended build priority is:

1. Authentication and user data isolation.
2. Category model and default categories.
3. Manual transaction entry.
4. Transaction editing and deletion.
5. Current-month dashboard.
6. AI import batch creation and file upload.
7. OpenAI extraction integration.
8. Import review and approval.
9. Import history.
10. Budget mode.
11. Rollover budget support.
12. Nice-to-have V1 improvements.

This order prioritizes a working spending ledger first, then dashboard visibility, then AI-assisted bulk entry, then budget functionality.

---

## 15. Summary

The MVP should deliver a focused personal expense-tracking experience. Users sign in with Google, record expenses and refunds, organize them by editable categories, import transaction histories through OpenAI-powered extraction, review all AI suggestions before saving, and view current-month spending dashboards.

The app should avoid broader finance-management complexity in V1. It should instead make one core workflow excellent: fast, accurate, user-approved personal spending tracking.
