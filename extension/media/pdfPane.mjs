'use strict';

/**
 * Blink-free pdf.js pane renderer.
 *
 * Pure browser ES module: no VS Code API, no `require`, no bare-specifier
 * imports. `pdfjsLib` and `workerUrl` are injected by the caller (a later
 * task wires this up inside a VS Code webview; a plain browser page can use
 * it unchanged). This module must not touch `window`/`document` at import
 * time -- only inside `createPdfPane()` and the functions it calls once a
 * caller actually invokes it.
 *
 * Design summary
 * --------------
 * `container` holds at most two layer elements at any instant:
 *   - `currentLayer`  -- the committed, visible layer (0 or 1).
 *   - `buildingLayer` -- an in-flight, hidden layer under construction (0 or 1).
 * A monotonically increasing `generation` counter is bumped on every
 * `show()`/`refit()`/`clear()`/`destroy()` call. Any in-flight render checks
 * its captured generation after every `await` and abandons itself (silently)
 * if a newer call has since started. Starting a new `show()`/`refit()` also
 * *immediately* tears down any existing `buildingLayer` so two hidden,
 * not-yet-committed layers can never coexist in the DOM.
 *
 * The actual swap ("make new layer visible, remove old layer, destroy the
 * old pdf.js document") happens in `commitSwap()`, which contains no
 * `await` at all -- it runs as one synchronous block.
 *
 * pdf.js document ownership: a layer never destroys its own `pdf`. Only two
 * places ever call `pdf.destroy()`:
 *   1. `commitSwap()`, for the *previous* layer's document, and only when
 *      that document differs from the new layer's (a `refit()` reuses the
 *      same document across old and new layers, so it must survive).
 *   2. The `show()` call that loaded a given document, when that exact
 *      document never became the current layer (aborted, superseded, or a
 *      later stage failed).
 */

const PAGE_GAP = 16;

export function createPdfPane({ container, pdfjsLib, workerUrl, onState }) {
  const emitRaw = typeof onState === 'function' ? onState : () => {};

  preparePaneContainer(container);

  let generation = 0;
  let destroyed = false;
  let currentLayer = null; // the committed, visible layer
  let buildingLayer = null; // an in-flight, hidden layer (at most one)
  let currentEmpty = null; // the `.pdfpane-empty` element from clear(), if any

  let workerPromise = null;
  let paneWorker = null; // the pdfjsLib.PDFWorker instance, or null in main-thread fallback
  let workerKind = null; // 'worker' | 'main-thread'

  function emit(state) {
    try {
      emitRaw(state);
    } catch {
      // A misbehaving caller callback must never break rendering.
    }
  }

  function ensureWorker() {
    if (!workerPromise) {
      workerPromise = initWorker(pdfjsLib, workerUrl)
        .then(({ worker, kind }) => {
          workerKind = kind;
          if (destroyed) {
            terminateWorker(worker);
            return null;
          }
          paneWorker = worker;
          return worker;
        })
        .catch(() => {
          workerKind = 'main-thread';
          return null;
        });
    }
    return workerPromise;
  }

  async function show(bytes) {
    if (destroyed) return;
    const myGen = ++generation;
    abandonBuildingLayer();
    const t0 = now();

    let data;
    try {
      data = toOwnedUint8Array(bytes);
    } catch (err) {
      reportErrorIfCurrent(myGen, err);
      return;
    }

    let pdf = null;
    try {
      const worker = await ensureWorker();
      if (destroyed || myGen !== generation) return;

      const task = pdfjsLib.getDocument({
        data,
        worker: worker || undefined,
        isEvalSupported: false,
        useSystemFonts: false,
      });
      pdf = await task.promise;
      if (!(pdf.numPages > 0)) throw new Error('PDF has no pages');
    } catch (err) {
      if (pdf) pdf.destroy().catch(() => {});
      reportErrorIfCurrent(myGen, err);
      return;
    }

    if (destroyed || myGen !== generation) {
      pdf.destroy().catch(() => {});
      return;
    }

    try {
      const committed = await mountAndSwap(pdf, myGen);
      if (committed) {
        if (myGen === generation) {
          emit({ phase: 'swapped', pages: pdf.numPages, ms: now() - t0, worker: workerKind });
        }
      } else {
        pdf.destroy().catch(() => {});
      }
    } catch (err) {
      pdf.destroy().catch(() => {});
      reportErrorIfCurrent(myGen, err);
    }
  }

  function refit() {
    if (destroyed || !currentLayer) return;
    const pdf = currentLayer.pdf;
    const myGen = ++generation;
    abandonBuildingLayer();
    const t0 = now();

    mountAndSwap(pdf, myGen)
      .then((committed) => {
        if (committed && myGen === generation) {
          emit({ phase: 'swapped', pages: pdf.numPages, ms: now() - t0, worker: workerKind });
        }
      })
      .catch((err) => {
        reportErrorIfCurrent(myGen, err);
      });
  }

  function clear(message) {
    if (destroyed) return;
    generation++;
    abandonBuildingLayer();
    if (currentLayer) {
      const dying = currentLayer;
      currentLayer = null;
      teardownLayer(dying);
      dying.pdf.destroy().catch(() => {});
    }
    removeCurrentEmpty();
    const empty = document.createElement('div');
    empty.className = 'pdfpane-empty';
    empty.textContent = typeof message === 'string' ? message : '';
    container.appendChild(empty);
    currentEmpty = empty;
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    generation++;
    abandonBuildingLayer();
    if (currentLayer) {
      const dying = currentLayer;
      currentLayer = null;
      teardownLayer(dying);
      dying.pdf.destroy().catch(() => {});
    }
    removeCurrentEmpty();
    container.textContent = '';
    if (paneWorker) {
      terminateWorker(paneWorker);
      paneWorker = null;
    }
  }

  function abandonBuildingLayer() {
    if (!buildingLayer) return;
    const stale = buildingLayer;
    buildingLayer = null;
    teardownLayer(stale);
    // Ownership of stale.pdf stays with whichever show()/refit() call loaded
    // it; that call's own generation check (after this synchronous point)
    // will destroy it, unless it is the same document as currentLayer's
    // (a refit() in flight), which must not be destroyed here.
  }

  function removeCurrentEmpty() {
    if (currentEmpty && currentEmpty.parentNode) {
      currentEmpty.parentNode.removeChild(currentEmpty);
    }
    currentEmpty = null;
  }

  function reportErrorIfCurrent(myGen, err) {
    if (destroyed || myGen !== generation) return; // superseded: stay silent, this is "latest wins", not a failure
    emit({ phase: 'error', message: describeError(err) });
  }

  /**
   * Build a new layer for `pdf`, render its eager pages, and -- if still the
   * latest request -- swap it in. Returns whether it committed. Throws only
   * for genuine failures (a corrupt/broken render); a stale/superseded
   * attempt resolves to `false` without throwing.
   */
  async function mountAndSwap(pdf, myGen) {
    const layer = await buildLayer(pdf);

    if (destroyed || myGen !== generation) {
      teardownLayer(layer);
      return false;
    }

    buildingLayer = layer;
    container.appendChild(layer.root);
    emit({ phase: 'rendering', pages: pdf.numPages });

    const eager = computeEagerEntries(layer);
    try {
      await Promise.all(eager.map((entry) => renderPage(pdfjsLib, layer, entry)));
    } catch (err) {
      if (buildingLayer === layer) buildingLayer = null;
      teardownLayer(layer);
      throw err;
    }

    if (destroyed || myGen !== generation) {
      if (buildingLayer === layer) buildingLayer = null;
      teardownLayer(layer);
      return false;
    }

    commitSwap(layer);
    attachLazyObserver(pdfjsLib, layer);
    return true;
  }

  function commitSwap(layer) {
    const previous = currentLayer;
    layer.root.scrollTop = layer.targetScrollTop || 0;
    layer.root.style.visibility = 'visible';
    currentLayer = layer;
    buildingLayer = null;
    removeCurrentEmpty();
    if (previous && previous !== layer) {
      teardownLayer(previous);
      if (previous.pdf !== layer.pdf) previous.pdf.destroy().catch(() => {});
    }
  }

  /** Builds the DOM for a new layer (sized page placeholders, no rendering yet). */
  async function buildLayer(pdf) {
    const contentWidth = Math.max(1, container.clientWidth || container.getBoundingClientRect().width || 1);
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;

    const pageNumbers = Array.from({ length: pdf.numPages }, (_, i) => i + 1);
    const pages = await Promise.all(pageNumbers.map((n) => pdf.getPage(n)));

    const root = document.createElement('div');
    root.className = 'pdfpane-layer';
    root.style.visibility = 'hidden';

    const baseWidth = pages[0].getViewport({ scale: 1 }).width;
    const scale = baseWidth > 0 ? contentWidth / baseWidth : 1;

    const pageEntries = [];
    let runningTop = 0;
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const viewport = page.getViewport({ scale });

      const pageDiv = document.createElement('div');
      pageDiv.className = 'pdfpane-page';
      pageDiv.dataset.pageIndex = String(i);
      pageDiv.style.width = `${viewport.width}px`;
      pageDiv.style.height = `${viewport.height}px`;
      pageDiv.style.marginTop = `${PAGE_GAP}px`;
      pageDiv.style.setProperty('--scale-factor', String(scale));
      pageDiv.style.setProperty('--total-scale-factor', String(scale));
      root.appendChild(pageDiv);

      runningTop += PAGE_GAP;
      pageEntries.push({
        pageDiv,
        page,
        pageNumber: i + 1,
        top: runningTop,
        height: viewport.height,
        rendered: false,
        rendering: false,
        renderTask: null,
        textLayer: null,
      });
      runningTop += viewport.height;
    }

    return {
      root,
      pdf,
      scale,
      dpr,
      pageEntries,
      contentHeight: runningTop + PAGE_GAP,
      observer: null,
      destroyed: false,
      targetScrollTop: 0,
    };
  }

  /** Pages intersecting the container's viewport at the (clamped) old scroll offset. */
  function computeEagerEntries(layer) {
    const clientHeight = Math.max(1, container.clientHeight || 1);
    const maxScroll = Math.max(0, layer.contentHeight - clientHeight);
    const desired = currentLayer ? currentLayer.root.scrollTop : 0;
    const clamped = Math.min(Math.max(0, desired), maxScroll);
    layer.targetScrollTop = clamped;

    const viewTop = clamped;
    const viewBottom = clamped + clientHeight;
    return layer.pageEntries.filter((entry) => entry.top < viewBottom && entry.top + entry.height > viewTop);
  }

  function attachLazyObserver(lib, layer) {
    const remaining = layer.pageEntries.filter((entry) => !entry.rendered);
    if (remaining.length === 0) return;

    const observer = new IntersectionObserver(
      (observerEntries) => {
        for (const observerEntry of observerEntries) {
          if (!observerEntry.isIntersecting) continue;
          const index = Number(observerEntry.target.dataset.pageIndex);
          const entry = layer.pageEntries[index];
          if (!entry || entry.rendered || entry.rendering) continue;
          observer.unobserve(observerEntry.target);
          renderPage(lib, layer, entry).catch(() => {
            // A single lazy page failing must not disturb an already-displayed document.
          });
        }
      },
      { root: layer.root, rootMargin: '600px 0px', threshold: 0 }
    );

    layer.observer = observer;
    for (const entry of remaining) observer.observe(entry.pageDiv);
  }

  return { show, clear, refit, destroy };
}

/** Renders one page's canvas, then its text layer, into `entry.pageDiv`. */
async function renderPage(pdfjsLib, layer, entry) {
  if (entry.rendered || entry.rendering) return;
  entry.rendering = true;
  try {
    const { page } = entry;
    const viewport = page.getViewport({ scale: layer.scale });
    const dpr = layer.dpr;

    const canvas = document.createElement('canvas');
    canvas.className = 'pdfpane-canvas';
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    canvas.width = Math.max(1, Math.round(viewport.width * dpr));
    canvas.height = Math.max(1, Math.round(viewport.height * dpr));
    const canvasContext = canvas.getContext('2d');

    const renderTask = page.render({
      canvas,
      canvasContext,
      viewport,
      ...(dpr !== 1 ? { transform: [dpr, 0, 0, dpr, 0, 0] } : {}),
    });
    entry.renderTask = renderTask;
    await renderTask.promise;
    entry.renderTask = null;
    if (layer.destroyed) return;

    const textLayerRoot = document.createElement('div');
    textLayerRoot.className = 'textLayer';
    const textLayer = new pdfjsLib.TextLayer({
      textContentSource: page.streamTextContent(),
      container: textLayerRoot,
      viewport,
    });
    entry.textLayer = textLayer;
    await textLayer.render();
    entry.textLayer = null;
    if (layer.destroyed) return;

    entry.pageDiv.appendChild(canvas);
    entry.pageDiv.appendChild(textLayerRoot);
    entry.rendered = true;
  } finally {
    entry.rendering = false;
  }
}

/** Tears down a layer's DOM, observer and in-flight render/text tasks. Never touches `layer.pdf`. Idempotent. */
function teardownLayer(layer) {
  if (!layer || layer.destroyed) return;
  layer.destroyed = true;
  if (layer.observer) {
    layer.observer.disconnect();
    layer.observer = null;
  }
  for (const entry of layer.pageEntries) {
    if (entry.renderTask) {
      try {
        entry.renderTask.cancel();
      } catch {
        // best-effort cancellation
      }
    }
    if (entry.textLayer) {
      try {
        entry.textLayer.cancel();
      } catch {
        // best-effort cancellation
      }
    }
  }
  if (layer.root.parentNode) {
    layer.root.parentNode.removeChild(layer.root);
  }
}

function terminateWorker(worker) {
  if (!worker) return;
  try {
    const result = worker.destroy();
    if (result && typeof result.then === 'function') result.catch(() => {});
  } catch {
    // best-effort
  }
}

/**
 * Sets up the pdf.js worker per the contract: try a module worker built
 * from a blob of the fetched `workerUrl`; on any failure (fetch error,
 * blocked by CSP, or the worker erroring before first use), fall back to
 * `GlobalWorkerOptions.workerSrc` so pdf.js runs its own fallback path
 * (a same-origin worker, or its built-in main-thread mode).
 */
async function initWorker(pdfjsLib, workerUrl) {
  try {
    const rawWorker = await buildModuleWorker(workerUrl);
    pdfjsLib.GlobalWorkerOptions.workerPort = rawWorker;
    const worker = new pdfjsLib.PDFWorker({ port: rawWorker });
    return { worker, kind: 'worker' };
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
    return { worker: null, kind: 'main-thread' };
  }
}

function buildModuleWorker(workerUrl) {
  return new Promise((resolve, reject) => {
    let blobUrl = null;
    let settled = false;

    const cleanupBlob = () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        blobUrl = null;
      }
    };

    fetch(workerUrl)
      .then((resp) => {
        if (!resp.ok) throw new Error(`worker fetch failed: ${resp.status}`);
        return resp.text();
      })
      .then((code) => {
        blobUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
        const worker = new Worker(blobUrl, { type: 'module' });

        const finish = (ok, err) => {
          if (settled) return;
          settled = true;
          worker.removeEventListener('error', onError);
          cleanupBlob();
          if (ok) {
            resolve(worker);
          } else {
            try {
              worker.terminate();
            } catch {
              // best-effort
            }
            reject(err);
          }
        };

        const onError = (event) => finish(false, (event && event.error) || new Error('worker failed to start'));
        worker.addEventListener('error', onError);
        // Give the worker a brief chance to fail fast (CSP violation, parse
        // error) before treating it as live.
        setTimeout(() => finish(true), 50);
      })
      .catch((err) => {
        cleanupBlob();
        reject(err);
      });
  });
}

function preparePaneContainer(container) {
  const computed = typeof window !== 'undefined' && window.getComputedStyle ? window.getComputedStyle(container) : null;
  if (!computed || computed.position === 'static') {
    container.style.position = 'relative';
  }
  container.style.overflow = 'hidden';
}

function toOwnedUint8Array(bytes) {
  if (bytes instanceof Uint8Array) return bytes.slice();
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes.slice(0));
  if (ArrayBuffer.isView(bytes)) {
    return new Uint8Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  }
  throw new Error('show(bytes) requires a Uint8Array');
}

function describeError(err) {
  if (err instanceof Error) return err.message || String(err);
  if (typeof err === 'string') return err;
  return 'Unknown error';
}

function now() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}
