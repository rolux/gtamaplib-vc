![gtamaplib-vc](ui/gtamaplib-vc.png)

# gtamaplib-vc

(vc stands for vibe-coded, not for Vice City!)

**gtamaplib-vc** is a collection of interfaces and tools on top of [gtamaplib](https://github.com/rolux/gtamaplib), including a UI for browsing the map, cameras and landmarks, and a fast and furious optimizer that improves existing calibrations and triangulations.

## Setup

Clone this repository, then `cd` into the `gtamaplib-vc` directory:

```bash
cd gtamaplib-vc
```

Install Python dependencies. Old school:

```bash
python3 -m pip install -r requirements.txt
```

Or more modern:

```bash
uv pip install -r requirements.txt
```

Then run the bootstrap script:

```bash
python3 bootstrap.py
```

The bootstrap script clones **gtamaplib** into `./gtamaplib`, fetches its Git LFS assets, sparse-checks out the `yanis,12` map tiles from [map.gtadb.org](https://map.gtadb.org) into `./gtadb.org`, and then generates the local browser data.

## Updating

To update the linked **gtamaplib** and **gtadb.org** checkouts and regenerate local browser data, run:

```bash
python3 update.py
```

This runs `git pull --ff-only` in the external dependency checkouts and then runs `import_data.py`.

Updating **gtamaplib** may change imported cameras, landmarks, observations, and pre-triangulated points. Existing optimizer results may no longer describe exactly the same starting data after an update. The same is true for updating **gtamaplib-vc** isself, which may change the behavior of the optimizer.

## Regenerating Data

`bootstrap.py` already runs the importer. `update.py` also runs the importer after pulling dependencies. You do not need to run `import_data.py` after either command.

During development, if you only want to regenerate local browser data without pulling external repositories, run:

```bash
python3 import_data.py
```

The importer writes `data/gtamapdata.json` from **gtamaplib**, creates editable `data/special.json` and `data/config.json` files if missing, writes generated VC additions to `data/import_extras.json`, creates `ui/data/overlay.json`, and generates thumbnails in `ui/thumbnails/`.

Generated files are intentionally not tracked:

```text
data/gtamapdata.json
data/import_extras.json
data/gtamaplib-vc.json
ui/data/overlay.json
ui/*-bw.jpg
ui/thumbnails/
optimizer/current.json
optimizer/results/
optimizer/renders/
```

## Development Helpers

`get_candidate_cameras.py` is an experimental helper for inspecting cameras that may be useful next in the optimization chain. Its ranking logic is still provisional.

## Server

Start the local UI server:

```bash
python3 server.py
```

Then open:

```text
http://127.0.0.1:8026/
```

The UI has a couple of useful keyboard shortcuts, like `up`/`down` for list navigation, and `esc` (or `cmd+click`) to deselect.

## Optimizer

The optimizer chain lives in `optimizer/`:

```text
optimizer/chain.json
optimizer/priors.json
optimizer/configs/
optimizer/results/
optimizer/renders/
```

`optimizer/chain.json` is a plain ordered list of camera names. Each camera has a matching config file in `optimizer/configs/` that lists the landmarks, rays, and objects used for that calibration stage.

Run one stage of this optimizer chain with:

```bash
python3 optimize.py --stage 1
```

The default local and global optimizer limits are 2000 function evaluations. They can be changed with:

```bash
python3 optimize.py --stage 1 --max-steps-local 2000 --max-steps-global 2000
```

Each run writes a numbered result JSON into `optimizer/results/`, updates `data/gtamaplib-vc.json` as the current complete VC world snapshot, and renders the current optimizer state into `optimizer/renders/`.

## Notes

Please keep in mind that v1.0.0 is pre-release software. Some parts may change quickly, others may still be unfinished.

**gtamaplib-vc** was written by Codex. The quality and readability of the code will reflect this.
