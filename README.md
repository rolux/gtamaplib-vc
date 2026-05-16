![gtamaplib-vc](ui/gtamaplib-vc.png)

# gtamaplib-vc

(vc stands for vibe-coded, not for Vice City!)

**gtamaplib-vc** is a collection of interfaces and tools on top of [gtamaplib](https://github.com/rolux/gtamaplib), including a UI for browsing the map, cameras and landmarks, and a fast and furious optimizer that improves existing calibrations and triangulations.

## Setup

Clone this repository, then `cd` into the `gtamaplib-vc` directory:

```bash
cd gtamaplib-vc
```

Run the bootstrap script:

```bash
python3 bootstrap.py
```

The bootstrap script clones **gtamaplib** into `./gtamaplib`, sparse-checks out the `yanis,12` map tiles from [map.gtadb.org](https://map.gtadb.org) into `./gtadb.org`, and then generates the local browser data.

## Regenerating Data

`bootstrap.py` already runs the importer. You do not need to run `import_data.py` after bootstrapping.

During development, if **gtamaplib** data changes and you only want to regenerate the local browser data, run:

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

## Optimizer

The optimizer chain lives in `optimizer/`:

```text
optimizer/chain.json
optimizer/priors.json
optimizer/configs/
optimizer/results/
optimizer/renders/
```

`optimizer/chain.json` is a plain ordered list of camera names. Each camera has a matching config file in `optimizer/configs/` that lists the landmarks, rays, and objects used for that calibration step.

Run one optimizer step with:

```bash
python3 optimize.py --step 1
```

The default local and global optimizer limits are 2000 steps. They can be changed with:

```bash
python3 optimize.py --step 1 --max-steps-local 2000 --max-steps-global 2000
```

Each run writes a numbered result JSON into `optimizer/results/`, updates `data/gtamaplib-vc.json` as the current complete VC world snapshot, and renders the current optimizer state into `optimizer/renders/`.

## Notes

Please keep in mind that v1.0.0 is pre-release software. Some parts of it may still be unfinished.

**gtamaplib-vc** was written by Codex. The quality and readability of the code will reflect this.
