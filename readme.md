# patient-viz

*patient-viz* is a tool allowing to view and explore electronic medical records
or other time sequence event data. The web-based tool is mostly written in
[d3](http://d3js.org/) and uses [python](https://www.python.org/) and shell on the back-end.


## Setup

Setting up the project can be done without prerequisites on *MacOS* and *linux*.
For windows you need to install [git](https://git-for-windows.github.io/) and
[python](https://www.python.org/downloads/) and use *git BASH* to execute shell commands.

*patient-viz* supports omop data format as input:

* OMOP Common Data Model: A PostgreSQL based data model. Instructions for setting
  up the connection can be found [here](#omop-common-data-model).

## OMOP Common Data Model

*patient-viz* can connect to PostgreSQL databases in the
[OMOP Common Data Model](https://github.com/OHDSI/CommonDataModel/).
In order to do so you can use the following commands (assuming a fresh clone
of the repository):

```bash
./setup.sh --default-omop
```

or

```bash
./setup.sh --default-omop --apt
```

if `apt-get` is available on your system.
On MacOS the installation of the dependency `psycopg2` may fail. In this case please refer to the
[psycopg installation guide](http://initd.org/psycopg/docs/install.html).

Note: Dependency installation may require sudo rights and will prompt as needed.
Do *not* run `setup.sh` with sudo.

You will be prompted questions to configure the connection to the PostgreSQL database
containing the data. Using the external CCS hierarchy and caching are recommended
options that allow for a richer and smoother user experience.

After successfully configuring the connection you can run

```bash
./server.py
```

If you prefer to not cache patient files edit `config.txt` (or the config file you are using)
to set `"use_cache": false`. `patient-viz` cannot automatically detect changes to
the database content. When using caching you can force the patient files to
update by removing the corresponding files in the `json` folder
(the `json` folder can be safely removed to clear all cached patient files) and
the `patients.txt` file (this file only contains a small subset of patient ids in the
database; other patients can be accessed via specifying the URL as described above;
once a patient file has been cached it will show up in the patient list regardless of the
content of patients.txt). The `dictionary.json` file contains the mappings for
readable code names; if those mappings change the file needs to be removed when using caching.

If you want to stop the server you can type `quit` into its console
(`CTRL-C` might affect the terminal which can be fixed by running `reset`).
Type `help` for available server commands.

