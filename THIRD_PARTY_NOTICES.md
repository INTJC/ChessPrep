# Third-Party Notices

ChessPrep Lab is distributed under the GNU Affero General Public License
version 3.0 (AGPL-3.0-only). The full terms are in LICENSE.

The Windows offline installers aggregate the following third-party works.
Each work remains governed by its own license; inclusion here does not
relicense it as part of ChessPrep Lab.

## Maia-3 software

- Project: Maia-3 by the University of Toronto Computational Social Science Lab
- Source: https://github.com/CSSLab/maia3
- License: GNU Affero General Public License version 3.0
- Bundled use: the Python inference/UCI package used for human-like move prediction

## Stockfish

- Project: Stockfish 18 by the Stockfish developers
- Source: https://github.com/official-stockfish/Stockfish
- License: GNU General Public License version 3.0
- Bundled use: chess analysis and move-quality filtering

Stockfish's complete license and corresponding source are available from the
upstream project. A distributor of a ChessPrep Lab binary must also satisfy
Stockfish's GPL source-availability requirements.

## Maia-3 model weights

- 23M model: https://huggingface.co/UofTCSSLab/Maia3-23M
- 79M model: https://huggingface.co/UofTCSSLab/Maia3-79M
- Mirror used by the offline build: https://hf-mirror.com

As checked on 2026-07-15, the Hugging Face metadata for both model repositories
does not declare a license. The ChessPrep Lab AGPL license does not grant rights
to these model weights. Anyone redistributing an installer that contains the
weights must independently confirm and comply with the model publisher's terms.

## Bundled runtimes and Python packages

The offline installer also contains Node.js, Python, PyTorch, NumPy,
python-chess, Hugging Face Hub, and their transitive dependencies. Their
copyright and license files are retained in the bundled runtime and Python
package metadata directories. Those components remain under their respective
licenses.

No trademark rights are granted by the ChessPrep Lab license.
