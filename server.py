import os
import logging
from flask import Flask, request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_cors import CORS
import google.generativeai as genai
from dotenv import load_dotenv

# Load env vars
load_dotenv()

# --- 1. CONFIGURATION & SECURITY ---
app = Flask(__name__)
# Enable CORS for all routes, allowing requests from localhost:5173 (Vite default)
CORS(app, resources={r"/*": {"origins": "*"}})

# Configure Logging
logging.basicConfig(level=logging.INFO)

# Load API Key
API_KEY = os.getenv("VITE_GOOGLE_CLIENT_ID") # Using existing env var name if possible, or GEMINI specific
# Actually, the user's prompt used GEMINI_API_KEY. Let's stick to that but fall back or use a specific one.
# The user might have VITE_GOOGLE_CLIENT_ID for OAuth, but Gemini needs an API key (AI Studio).
# I will assume the user has set GEMINI_API_KEY as per the prompt instructions.
API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    print("WARNING: GEMINI_API_KEY not found in env.")

if API_KEY:
    genai.configure(api_key=API_KEY)
    model = genai.GenerativeModel('gemini-1.5-flash')

# --- 2. THROTTLING SETUP ---
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

# --- 3. ROUTES & LOGIC ---

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"}), 200

@app.route('/analyze', methods=['POST'])
@limiter.limit("10 per minute")
def analyze():
    if not API_KEY:
        return jsonify({"error": "Server missing API Key configuration"}), 500

    # 1. Validation
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    try:
        # 2. Process Image
        image_data = file.read()
        
        # 3. Validation (Max 10MB)
        if len(image_data) > 10 * 1024 * 1024:
            return jsonify({"error": "File too large. Max 10MB."}), 400

        image_parts = [{"mime_type": file.content_type, "data": image_data}]

        # 4. Master Prompt for JSON Extraction
        system_prompt = """
        You are an expense extraction assistant. Analyze the uploaded bill/receipt image.
        Return a PURE JSON array of objects. Do not use markdown code blocks.
        
        Each object must have:
        - "date": "YYYY-MM-DD" (Found on bill, or today's date if missing)
        - "item": "Short description of item"
        - "category": "One of [Food, Travel, Shopping, Bills, Entertainment, Health, Education, Investment, Other] - infer best fit"
        - "subcategory": "Specifics if available (e.g. 'Pizza' for Food)"
        - "amount": Number (Parse currency, convert to simple number)
        - "paymentMethod": "UPI" (STRICTLY ALWAYS return "UPI")
        - "notes": "Any other details like Vendor name"

        Example:
        [{"date": "2024-05-12", "item": "McDonalds Burger", "category": "Food", "amount": 349, "paymentMethod": "UPI", "notes": "McDonalds"}]
        
        If image is not a bill or unclear, return generic error in JSON like [{"error": "Invalid Document"}] but try your best to parse partial data.
        """

        # 5. Call Gemini
        response = model.generate_content([system_prompt, image_parts[0]])
        
        # 6. Return Clean JSON
        return jsonify({"analysis": response.text})

    except Exception as e:
        logging.error(f"Error processing request: {e}")
        return jsonify({"error": f"Failed to analyze image: {str(e)}"}), 500

# Handle Rate Limit Errors
@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({"error": "Rate limit exceeded. Try again later."}), 429

if __name__ == '__main__':
    print(f"Starting server on port 5000...")
    app.run(debug=True, port=5000, threaded=True)
