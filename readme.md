# patient-viz

*patient-viz* is a tool allowing to view and explore electronic medical records
or other time sequence event data. The web-based tool is mostly written in
[d3](http://d3js.org/) and uses [python](https://www.python.org/) and shell on the back-end.

## Prerequisites
- Python 3.6 or above
- PostgreSQL
- Git

## Setup

Setting up the project can be done without prerequisites on *MacOS* and *linux*.
For windows you need to install [git](https://git-for-windows.github.io/) and
[python](https://www.python.org/downloads/) and use *git BASH* to execute shell commands.

* OMOP Common Data Model: A PostgreSQL based data model. Instructions for setting
  up the connection can be found [here](#omop-common-data-model).

## OMOP Common Data Model

*patient-viz* can connect to PostgreSQL databases in the
[OMOP Common Data Model](https://github.com/OHDSI/CommonDataModel/).
In order to do so you can use the following commands (assuming a fresh clone
of the repository):

```bash
git clone https://code.stanfordmed.org/data-science/patient-viz.git 
cd patient_viz
```

Create and activate a Python virtual environment
```bash
python3 -m venv venv
source venv/bin/activate 
```

Install Python Dependencies 
```bash
pip install requirements.txt
```

Set Up Environment Variables
```
OMOP_USER=your_db_user
OMOP_PASSWD=your_db_password
OMOP_HOST=localhost
OMOP_PORT=5432
OMOP_DB=your_database
OMOP_SCHEMA=your_schema
OMOP_ENGINE=postgresql
CCS_DIAG=path/to/ccs_diag/file
CCS_PROC=path/to/ccs_proc/file
```

After successfully configuring the connection you can run

```bash
python server.py
```
you can find javascript files in the static folder and index.html in the templates folder. 

 The `dictionary.json` file contains the mappings for readable code names; if those mappings change the file needs to be removed when using caching.

If you want to stop the server you can type `quit` into its console
(`CTRL-C` might affect the terminal which can be fixed by running `reset`).
Type `help` for available server commands.

