from flask import Flask, jsonify, request, send_from_directory, render_template
import os
import json
import logging
from omop import OMOP

app = Flask(__name__, static_folder='static')

logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

settings = {
        'omop_user': 'etl_viz',
        'omop_passwd': 'prem123',
        'omop_host': 'localhost',
        'omop_port': '5432',
        'omop_db': 'synthea10',
        'omop_schema': 'cdm_synthea10',
        'omop_engine': 'postgresql',
        'omop_use_alt_hierarchies': True,
        'use_cache': True,
        'ccs_diag': 'path/to/ccs_diag/file',
        'ccs_proc': 'path/to/ccs_proc/file',
    }

omop = OMOP(settings, True)

@app.route('/')
def index():
    return render_template('index.html')       
              
@app.route('/patients.txt')
@app.route('/patient-viz/patients.txt')
def get_patients_list():
    logger.info("get_list called")
    try:
        return send_from_directory('.', 'patients.txt')
    except Exception as e:
        logger.error(f"Error reading patients.txt: {e}")
        return jsonify([])

# @app.route('/json/<path:filename>')
# @app.route('/patient-viz/json/<path:filename>')
# def get_json_file(filename):
#     try:
#         if not filename.endswith('.json'):
#             filename += '.json'
#         return send_from_directory('json', filename)
#     except Exception as e:
#         logger.error(f"Error sending json file {filename}: {e}")
#         return jsonify({"error": "File not found"}), 404

@app.route('/json/<path:filename>')
@app.route('/patient-viz/json/<path:filename>')
def get_json_file(filename):
    try:
        if not filename.endswith('.json'):
            filename += '.json'
        
        file_path = os.path.join('json', filename)
        
        if not os.path.exists(file_path):
            # If the file doesn't exist, generate it
            person_source_value = filename.replace('.json', '')
            patient_data = omop.get_patient(person_source_value, {}, None, None)
            
            with open(file_path, 'w') as f:
                json.dump(patient_data, f)
        
        return send_from_directory('json', filename)
    except Exception as e:
        logger.error(f"Error sending json file {filename}: {e}")
        return jsonify({"error": "File not found"}), 404
    
@app.route('/json/dictionary.json')
def get_json_dictionary():
    return get_dictionary()

@app.route('/patient-viz/dictionary.json')
def get_dictionary():
    try:
        with open('json/dictionary.json', 'r') as file:
            dictionary = json.load(file)
        return jsonify(dictionary)
    except Exception as e:
        logger.error(f"Error reading dictionary.json: {e}")
        return jsonify({})
    
@app.route('/patient-viz/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

@app.route('/static/<path:filename>')
def custom_static(filename):
    return send_from_directory(app.static_folder, filename)

@app.route('/get_patient_data', methods=['GET'])
def get_patient_data():
    person_id = request.args.get('id')
    if not person_id:
        return jsonify({"error": "No patient ID provided"}), 400

    # Remove 'json/' prefix and '.json' suffix if present
    if person_id.startswith('json/') and person_id.endswith('.json'):
        person_id = person_id[5:-5]

    try:
        # Fetch patient data
        patient_data = omop.get_patient(person_id, {}, None, None)

        # Update dictionary
        dictionary_path = 'json/dictionary.json'
        if os.path.exists(dictionary_path):
            with open(dictionary_path, 'r') as f:
                dictionary = json.load(f)
        else:
            dictionary = {}

        for group, group_data in patient_data.items():
            if isinstance(group_data, dict):
                if group not in dictionary:
                    dictionary[group] = {}
                dictionary[group].update(group_data)

        # Save updated dictionary
        with open(dictionary_path, 'w') as f:
            json.dump(dictionary, f)

        # Save patient data as JSON file
        patient_file_path = f'json/{person_id}.json'
        with open(patient_file_path, 'w') as f:
            json.dump(patient_data, f)

        return jsonify(patient_data)

    except Exception as e:
        logger.error(f"Error fetching patient data: {e}")
        return jsonify({"error": f"Failed to fetch patient data: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=8080)




