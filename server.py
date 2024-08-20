import math
from flask import Flask, jsonify, request, send_from_directory, render_template
import os
import json
import logging
from omop import OMOP  # Importing the OMOP module
from flask_caching import Cache
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad
import base64

# Intialize the flask app
app = Flask(__name__, static_folder="static", template_folder="templates")

# Configure cache to use simple in-memory caching
cache = Cache(app, config={"CACHE_TYPE": "simple"})

# Configure logging
logging.basicConfig(
    level=logging.DEBUG, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Ensure if "json" folder exists; if not creates one
if not os.path.exists("json"):
    os.makedirs("json")

# Generate a key and initialization vector for encryption
ENCRYPTION_KEY = b"ThisIsA16ByteKey"
IV = b"ThisIsA16ByteIV!"


def encrypt_data(data):
    """
    Encrypts the provided data using AES encryption in CBC mode.
    """
    cipher = AES.new(ENCRYPTION_KEY, AES.MODE_CBC, IV)
    padded_data = pad(data.encode(), AES.block_size)
    encrypted = cipher.encrypt(padded_data)
    return base64.b64encode(encrypted).decode("utf-8")


# Load settings from environment variables
settings = {
    "omop_user": os.getenv("OMOP_USER", "etl_viz"),
    "omop_passwd": os.getenv("OMOP_PASSWD", "prem123"),
    "omop_host": os.getenv("OMOP_HOST", "localhost"),
    "omop_port": os.getenv("OMOP_PORT", "5432"),
    "omop_db": os.getenv("OMOP_DB", "synthea10"),
    "omop_schema": os.getenv("OMOP_SCHEMA", "cdm_synthea10"),
    "omop_engine": os.getenv("OMOP_ENGINE", "postgresql"),
    "omop_use_alt_hierarchies": True,
    "use_cache": True,
    "ccs_diag": os.getenv("CCS_DIAG", "path/to/ccs_diag/file"),
    "ccs_proc": os.getenv("CCS_PROC", "path/to/ccs_proc/file"),
}
# Initialize OMOP instance with settings
omop = OMOP(settings, True)

if not os.path.exists("json"):
    os.makedirs("json")


# Route to render the main index page
@app.route("/")
def index():
    """
    Serves the main page of the web app
    """
    return render_template("index.html")


# Route to serve the dictionary JSON file
@app.route("/json/dictionary.json")
def get_json_dictionary():
    """
    Serves the dictionary JSON file if it exists, dictionary.json contains hierarchical data. 
    """
    dictionary_path = "json/dictionary.json"
    if os.path.exists(dictionary_path):
        try:
            with open(dictionary_path, "r") as file:
                dictionary = json.load(file)
            return jsonify(dictionary)
        except Exception as e:
            logger.error(f"Error reading dictionary.json: {e}")
            return jsonify({})
    else:
        return jsonify({})

# Route to serve static files from the patient-viz directory
@app.route("/patient-viz/<path:filename>")
def static_files(filename):
    return send_from_directory("static", filename)


# Route to serve static files from the static directory
@app.route("/static/<path:filename>")
def custom_static(filename):
    return send_from_directory(app.static_folder, filename)

# Route to get the dictionary domain types
@app.route("/get_dictionary_by_type", methods=["GET"])
@cache.cached(timeout=300, query_string=True)
def get_dictionary_by_type():
    """
    Fetches and returns the dictionary data filtered by a specific event type.
    """
    event_type = request.args.get("type")
    if not event_type:
        return jsonify({"error": "No event type provided"}), 400

    try:
        dictionary = load_or_create_dictionary()
        if event_type in dictionary:
            return jsonify({event_type: dictionary[event_type]})
        else:
            return jsonify({}), 404
    except Exception as e:
        logger.error(f"Error fetching dictionary data for type {event_type}: {e}")
        return jsonify({"error": f"Failed to fetch dictionary data: {str(e)}"}), 500

# Route to get the patient data from omop module
@app.route("/get_patient_data", methods=["GET"])
@cache.cached(timeout=300, query_string=True)
def get_patient_data():
    """
    Fetches patient's detail based on the patient id and group parameter.
    """
    person_id = request.args.get("id")
    group = request.args.get("group")

    if not person_id:
        return jsonify({"error": "No patient ID provided"}), 400

    if person_id.startswith("json/") and person_id.endswith(".json"):
        person_id = person_id[5:-5]

    try:
        dictionary = load_or_create_dictionary()
        # Get patient data from the omop class
        patient_data = omop.get_patient(person_id, dictionary, None, None, group)

        dictionary_path = "json/dictionary.json"
        with open(dictionary_path, "w") as f:
            json.dump(dictionary,f)

        # Include only the relevant dictionary data
        if group and group in dictionary:
            patient_data["dictionary"] = {group: dictionary[group]}
        else:
            patient_data["dictionary"] = dictionary

        encrypted_data = encrypt_data(json.dumps(patient_data))

        return jsonify({"encrypted_data": encrypted_data})

    except Exception as e:
        logger.error(f"Error fetching patient data: {e}")
        return jsonify({"error": f"Failed to fetch patient data: {str(e)}"}), 500


# Load the existing dictionary.json file or create a new one with hierarchies.
def load_or_create_dictionary():
    dictionary_path = "json/dictionary.json"
    if os.path.exists(dictionary_path):
        with open(dictionary_path, "r") as file:
            dictionary = json.load(file)
    else:
        # Create a new dictionary with hierarchies
        dictionary = {}
        new_dict_entries = set()
        omop.update_hierarchies(dictionary, new_dict_entries)

    return dictionary


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=8080)
