/**
 * Google Apps Script for Duplicate Detection
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Sheet
 * 2. Go to Extensions > Apps Script
 * 3. Delete any existing code and paste this entire script
 * 4. Click "Deploy" > "New deployment"
 * 5. Select type: "Web app"
 * 6. Set "Execute as": "Me"
 * 7. Set "Who has access": "Anyone" (or "Anyone with Google account")
 * 8. Click "Deploy" and authorize the script
 * 9. Copy the Web App URL - you can optionally use it in Settings
 * 
 * NOTE: This script is OPTIONAL. The app already has frontend duplicate detection.
 * This provides an additional server-side layer for guaranteed prevention.
 */

/**
 * Appends a row only if it does not already exist.
 * Uses LockService for concurrency safety.
 * 
 * @param {Array} newRowData - The array of values to append
 * @return {Object} result - Success or error status
 */
function appendUniqueRow(newRowData) {
  // Get the main data sheet (first sheet or "Sheet1")
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Sheet1") || ss.getSheets()[0];
  const lock = LockService.getScriptLock();
  
  // 1. Concurrency Lock: Wait up to 10s for other processes
  try {
    lock.waitLock(10000); 
  } catch (e) {
    return { 
      status: "error", 
      message: "Server busy, could not acquire lock." 
    };
  }

  try {
    // 2. Fetch existing data for comparison
    const lastRow = sheet.getLastRow();
    
    // If sheet is empty (only header), just append
    if (lastRow <= 1) {
      sheet.appendRow(newRowData);
      return { status: "success", message: "First row added." };
    }

    // Get existing data (skip header row)
    const existingData = sheet.getRange(2, 1, lastRow - 1, newRowData.length).getValues();

    // 3. Create Signature: Date + Amount + Item (normalized)
    // Format: "date|amount|item" in lowercase
    const createSignature = (row) => {
      const date = String(row[0] || '').trim();
      const item = String(row[1] || '').toLowerCase().trim();
      const amount = String(row[4] || '').trim(); // Amount is 5th column (index 4)
      return `${date}|${amount}|${item}`;
    };

    const newSignature = createSignature(newRowData);

    const isDuplicate = existingData.some(row => {
      const existingSignature = createSignature(row);
      return existingSignature === newSignature;
    });

    // 4. The Logic Gate
    if (isDuplicate) {
      console.log("Duplicate detected: " + newSignature);
      return { 
        status: "duplicate", 
        message: "Duplicate row rejected." 
      }; 
    } else {
      sheet.appendRow(newRowData);
      return { 
        status: "success", 
        message: "Transaction recorded." 
      };
    }

  } catch (err) {
    return { 
      status: "error", 
      message: err.toString() 
    };
  } finally {
    // 5. Always release the lock
    lock.releaseLock();
  }
}

/**
 * Web App Entry Point
 * Handles POST requests from the frontend
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // Validate required fields
    if (!data.row || !Array.isArray(data.row)) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Invalid request format. Expected { row: [...] }"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const result = appendUniqueRow(data.row);
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Web App Entry Point for GET (testing)
 */
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "Track your Rupee - Duplicate Check API is running",
    usage: "POST { row: [date, item, category, subcategory, amount, paymentMethod, notes, month] }"
  })).setMimeType(ContentService.MimeType.JSON);
}
