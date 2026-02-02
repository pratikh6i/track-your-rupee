/**
 * Track Your Rupee - Daily Summary Webhook
 * 
 * This Google Apps Script sends a daily expense summary to Google Chat at 11:30 PM.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open your expense tracking Google Sheet
 * 2. Go to Extensions > Apps Script
 * 3. Delete any existing code and paste this entire script
 * 4. Update the CONFIG below with your webhook URL and Gemini API key
 * 5. Click "Run" > "sendDailySummary" to test
 * 6. Click the clock icon (Triggers) > "Add Trigger"
 *    - Choose function: sendDailySummary
 *    - Event source: Time-driven
 *    - Type: Day timer
 *    - Time: 11pm to midnight
 * 7. Save and authorize when prompted
 */

// ============ CONFIGURATION ============
const CONFIG = {
  WEBHOOK_URL: '', // Paste your Google Chat webhook URL here (from Settings sheet)
  GEMINI_API_KEY: '', // Optional: Paste your Gemini API key for AI insights
  SHEET_NAME: 'Expenses', // Name of your expenses sheet
  SETTINGS_SHEET: 'Settings', // Name of settings sheet (to auto-read webhook URL)
};

// ============ MAIN FUNCTION ============
function sendDailySummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Try to get webhook URL from Settings sheet first
  let webhookUrl = CONFIG.WEBHOOK_URL;
  let geminiKey = CONFIG.GEMINI_API_KEY;
  
  try {
    const settingsSheet = ss.getSheetByName(CONFIG.SETTINGS_SHEET);
    if (settingsSheet) {
      const settingsData = settingsSheet.getDataRange().getValues();
      for (const row of settingsData) {
        if (row[0] === 'webhookUrl' && row[1]) webhookUrl = row[1];
        if (row[0] === 'geminiApiKey' && row[1]) geminiKey = row[1];
      }
    }
  } catch (e) {
    Logger.log('Could not read settings sheet: ' + e);
  }
  
  if (!webhookUrl) {
    Logger.log('No webhook URL configured. Skipping.');
    return;
  }
  
  // Get today's expenses
  const today = new Date();
  const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  
  // Try 'Expenses' then 'Sheet1'
  let expensesSheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!expensesSheet) {
    expensesSheet = ss.getSheetByName('Sheet1');
  }
  
  if (!expensesSheet) {
    Logger.log('Neither "Expenses" nor "Sheet1" sheet found');
    return;
  }
  
  const data = expensesSheet.getDataRange().getValues();
  const headers = data[0];
  
  // Find column indices
  const dateCol = headers.indexOf('Date');
  const itemCol = headers.indexOf('Item');
  const categoryCol = headers.indexOf('Category');
  const amountCol = headers.indexOf('Amount');
  
  if (dateCol === -1 || amountCol === -1) {
    Logger.log('Required columns not found');
    return;
  }
  
  // Filter today's expenses
  const todayExpenses = [];
  let totalSpent = 0;
  let totalIncome = 0;
  const categoryTotals = {};
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowDate = row[dateCol];
    
    // Handle date comparison
    let rowDateStr;
    if (rowDate instanceof Date) {
      rowDateStr = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } else {
      rowDateStr = String(rowDate).split('T')[0];
    }
    
    if (rowDateStr === todayStr) {
      const item = row[itemCol] || 'Unknown';
      const category = row[categoryCol] || 'Other';
      const amount = Math.abs(parseFloat(row[amountCol]) || 0);
      
      if (category === 'Income') {
        totalIncome += amount;
      } else {
        totalSpent += amount;
        categoryTotals[category] = (categoryTotals[category] || 0) + amount;
        todayExpenses.push({ item, category, amount });
      }
    }
  }
  
  // Get monthly budget from settings
  let monthlyBudget = 11000;
  try {
    const settingsSheet = ss.getSheetByName(CONFIG.SETTINGS_SHEET);
    if (settingsSheet) {
      const settingsData = settingsSheet.getDataRange().getValues();
      for (const row of settingsData) {
        if (row[0] === 'monthlyBudget' && row[1]) {
          monthlyBudget = parseFloat(row[1]) || 11000;
        }
      }
    }
  } catch (e) {}
  
  // Calculate month's total spending
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthStartStr = Utilities.formatDate(monthStart, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  
  let monthTotal = 0;
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowDate = row[dateCol];
    let rowDateStr;
    if (rowDate instanceof Date) {
      rowDateStr = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } else {
      rowDateStr = String(rowDate).split('T')[0];
    }
    
    if (rowDateStr >= monthStartStr && row[categoryCol] !== 'Income') {
      monthTotal += Math.abs(parseFloat(row[amountCol]) || 0);
    }
  }
  
  const budgetPercent = monthlyBudget > 0 ? Math.round((monthTotal / monthlyBudget) * 100) : 0;
  const remaining = monthlyBudget - monthTotal;
  
  // Build the message
  let message = '';
  
  // Header
  const dayName = Utilities.formatDate(today, Session.getScriptTimeZone(), 'EEEE');
  const dateFormatted = Utilities.formatDate(today, Session.getScriptTimeZone(), 'dd MMM yyyy');
  
  message += `*Daily Expense Summary* (${dateFormatted})\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  if (todayExpenses.length === 0) {
    message += `✨ No expenses recorded today! Great job.\n\n`;
  } else {
    // Expenses table in code block
    message += `*TODAY'S SPENDING*\n`;
    message += `\`\`\`\n`;
    message += `Item               | Category    | Amount\n`;
    message += `-------------------|-------------|--------\n`;
    
    todayExpenses.forEach((exp, i) => {
      const item = exp.item.substring(0, 18).padEnd(18);
      const cat = exp.category.substring(0, 11).padEnd(11);
      const amt = `₹${exp.amount}`.padStart(7);
      message += `${item} | ${cat} | ${amt}\n`;
    });
    
    const totalLine = `TOTAL SPENT`.padEnd(31);
    const totalVal = `₹${totalSpent}`.padStart(7);
    message += `-------------------|-------------|--------\n`;
    message += `${totalLine} | ${totalVal}\n`;
    message += `\`\`\`\n\n`;
  }
  
  // Monthly progress in code block
  message += `*MONTHLY BUDGET PROGRESS*\n`;
  message += `\`\`\`\n`;
  const spentStr = `Spent this month`.padEnd(20);
  const budgetStr = `Monthly Budget`.padEnd(20);
  const remainStr = `Remaining`.padEnd(20);
  
  message += `${spentStr} : ₹${monthTotal.toLocaleString('en-IN')}\n`;
  message += `${budgetStr} : ₹${monthlyBudget.toLocaleString('en-IN')}\n`;
  message += `${remainStr} : ₹${remaining.toLocaleString('en-IN')}\n\n`;
  
  // Progress bar
  const filledBlocks = Math.min(Math.round(budgetPercent / 10), 10);
  const emptyBlocks = 10 - filledBlocks;
  const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
  message += `[${progressBar}] ${budgetPercent}%\n`;
  message += `\`\`\`\n\n`;
  
  // Add fun comment - try Gemini, fallback to hardcoded
  let funComment = getFunComment(totalSpent, budgetPercent, todayExpenses.length);
  
  if (geminiKey && todayExpenses.length > 0) {
    try {
      const aiPrompt = `Analyze today's spend: ₹${totalSpent}. Total month: ₹${monthTotal}/₹${monthlyBudget}. Give a short, witty 1-sentence behavioral insight.`;
      const aiComment = getGeminiInsight(geminiKey, todayExpenses, monthTotal, monthlyBudget);
      if (aiComment) funComment = aiComment;
    } catch (e) {
      Logger.log('Gemini failed, using fallback: ' + e);
    }
  }
  
  message += `💡 *Insight:* ${funComment}`;
  
  // Send to webhook
  sendToWebhook(webhookUrl, message);
  Logger.log('Daily summary sent successfully!');
}

// ============ HELPER FUNCTIONS ============

function getFunComment(todaySpent, budgetPercent, itemCount) {
  const comments = {
    noSpend: [
      "🏆 Zero spending today! Your wallet threw a party!",
      "💎 A day without expenses is a day well lived!",
      "🧘 Financial zen achieved - no money left your pocket today!",
      "🎉 Your future self thanks you for saving today!"
    ],
    lowSpend: [
      "👏 Minimal spending today - keep up the great work!",
      "🌟 Smart spending! You're treating your money well.",
      "💪 Under control! You're the boss of your budget.",
      "✨ Light spending day - more for savings!"
    ],
    normalSpend: [
      "📊 Balanced spending today - you're on track!",
      "👍 Reasonable expenses - nothing to worry about!",
      "⚖️ Maintaining financial balance like a pro!",
      "🎯 Normal day at the expense office!"
    ],
    highSpend: [
      "⚠️ Heavy spending day - maybe review tomorrow's plan?",
      "💸 Wallet got a workout today! Time to rest it.",
      "🔍 Might want to review these expenses later!",
      "📉 Spending spike detected - stay mindful!"
    ],
    overBudget: [
      "🚨 Budget alert! Time to enter survival mode!",
      "⛔ Over budget! Emergency saving measures needed!",
      "🆘 Red zone reached - freeze non-essential spending!",
      "🔴 Budget exceeded - every rupee counts now!"
    ]
  };
  
  let category;
  if (itemCount === 0) category = 'noSpend';
  else if (todaySpent < 200) category = 'lowSpend';
  else if (todaySpent < 1000) category = 'normalSpend';
  else if (budgetPercent > 100) category = 'overBudget';
  else category = 'highSpend';
  
  const options = comments[category];
  return options[Math.floor(Math.random() * options.length)];
}

function getGeminiInsight(apiKey, expenses, monthTotal, budget) {
  const expenseList = expenses.map(e => `${e.item} (${e.category}): ₹${e.amount}`).join(', ');
  
  const prompt = `You are a witty financial advisor. Based on today's expenses: [${expenseList}]. 
Monthly spend so far: ₹${monthTotal} of ₹${budget} budget (${Math.round(monthTotal/budget*100)}% used).
Give ONE short, funny but insightful comment (max 50 words) about the spending pattern. 
Be encouraging if good, gently warning if overspending. Use 1-2 emojis. No markdown.`;

  try {
    const response = UrlFetchApp.fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        contentType: 'application/json',
        payload: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 100, temperature: 0.8 }
        }),
        muteHttpExceptions: true
      }
    );
    
    const data = JSON.parse(response.getContentText());
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text.trim();
    }
  } catch (e) {
    Logger.log('Gemini error: ' + e);
  }
  
  return null;
}

function sendToWebhook(url, text) {
  UrlFetchApp.fetch(url, {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify({ text: text })
  });
}

// ============ TRIGGER SETUP ============
function createDailyTrigger() {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'sendDailySummary') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create new trigger for 11:30 PM
  ScriptApp.newTrigger('sendDailySummary')
    .timeBased()
    .atHour(23)
    .nearMinute(30)
    .everyDays(1)
    .create();
  
  Logger.log('Daily trigger created for 11:30 PM');
}

// Run this once to set up the trigger
function setup() {
  createDailyTrigger();
  Logger.log('Setup complete! The summary will be sent every night at 11:30 PM.');
}

/**
 * WEBHOOK PROXY (For Webapp use)
 * Allows the webapp to send reports through this script to avoid CORS issues.
 */
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Get webhook URL from settings sheet
    let webhookUrl = CONFIG.WEBHOOK_URL;
    const settingsSheet = ss.getSheetByName(CONFIG.SETTINGS_SHEET);
    if (settingsSheet) {
      const settingsData = settingsSheet.getDataRange().getValues();
      for (const row of settingsData) {
        if (row[0] === 'webhookUrl' && row[1]) webhookUrl = row[1];
      }
    }
    
    if (webhookUrl && params.text) {
      sendToWebhook(webhookUrl, params.text);
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
