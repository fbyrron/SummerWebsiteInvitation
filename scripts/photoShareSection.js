// photoShareSection.js
// PhotoShareSection component — "Share Your Moments" scene.
//
// Lets a guest pick multiple photos/videos from their device, preview the
// selection (nothing is uploaded yet), then tap "Share Moments" to send the
// files to our storage. A prominent in-page loading banner runs during the
// upload, then an in-page success/error message is written, and the
// just-shared items are removed from the preview.
//
// -----------------------------------------------------------------------
// Why an upload ENDPOINT instead of the Google Drive folder link
// -----------------------------------------------------------------------
// This is a static site (no server). A shared Google Drive FOLDER link only
// lets people VIEW that folder; a web page cannot upload files into it by
// code, and Drive has no "anyone can upload via link" mode without auth.
// To accept guest uploads without making guests sign in, deploy a tiny
// Google Apps Script web app tied to the host's own Google account, and put
// its URL in `config.photoUploadEndpoint`. The website POSTs each file to
// that endpoint; the script writes it into the host's Drive folder. The
// guest never sees Drive and never signs in.
//
// The Drive folder link is deliberately NOT referenced anywhere in this
// module or the UI, per the requirement to not show Drive.
//
// ---- Apps Script to deploy (script.google.com -> New project) ----------
//   const FOLDER_ID = 'PASTE_YOUR_DRIVE_FOLDER_ID_HERE';
//   const UPLOAD_SECRET = 'PASTE_THE_SAME_SECRET_AS_eventConfig.js';
//   function doPost(e) {
//     const body = JSON.parse(e.postData.contents);
//     // Reject anything that doesn't carry our shared secret.
//     if (UPLOAD_SECRET && body.secret !== UPLOAD_SECRET) {
//       return ContentService
//         .createTextOutput(JSON.stringify({ ok: false, error: 'unauthorized' }))
//         .setMimeType(ContentService.MimeType.JSON);
//     }
//     const folder = DriveApp.getFolderById(FOLDER_ID);
//     const bytes = Utilities.base64Decode(body.dataBase64);
//     const blob = Utilities.newBlob(bytes, body.mimeType, body.fileName);
//     folder.createFile(blob);
//     return ContentService
//       .createTextOutput(JSON.stringify({ ok: true }))
//       .setMimeType(ContentService.MimeType.JSON);
//   }
//   Then: Deploy -> New deployment -> type "Web app" ->
//     Execute as: Me,  Who has access: Anyone.
//   Copy the /exec URL into eventConfig.js's photoUploadEndpoint, and set
//   the SAME secret string in both UPLOAD_SECRET above and eventConfig.js's
//   uploadSecret.
//   (FOLDER_ID is the last path segment of your Drive folder URL.)
// -------------------------------------------------------------------------
//
// The endpoint receives a JSON POST per file: { fileName, mimeType,
// dataBase64, secret }. base64 is used so the whole thing is a simple JSON
// body an Apps Script `doPost` can parse without multipart handling. The
// `secret` is a shared phrase (config.uploadSecret) the script checks so
// only this site can write to the folder - see eventConfig.js's own note
// on why this deters casual writes rather than being true secrecy on a
// static site.
//
// Follows this codebase's conventions: getElementById guard + no-op when the
// section isn't on the page (so main.js can call it on every page safely),
// clear-and-rebuild render(config), createElement/textContent only (no
// innerHTML with interpolated data), and ScrollRevealController.observe().

import { observe } from './scrollRevealController.js';

/** Accepted upload types for the file picker. */
const ACCEPT_TYPES = 'image/*,video/*';

/**
 * Largest single file we allow a guest to share, in bytes. Google Apps
 * Script web-app POST bodies are capped around 50 MB, and we base64-encode
 * the file (which inflates it ~33%), so the raw file must stay well under
 * that. 40 MB raw -> ~53 MB encoded is already at the edge, so the limit is
 * set at 35 MB to leave headroom for the JSON envelope. Oversized files are
 * rejected up front with a message instead of failing mid-upload.
 */
const MAX_FILE_BYTES = 35 * 1024 * 1024;

/** Default success message shown on the page after a successful share. */
const SUCCESS_MESSAGE = 'Got it! Thank you for sharing your magical moments with us — this means a lot. 💛';

/**
 * Per-page selection state. Each entry is one file the guest picked and has
 * not yet shared: { id, file, url }. `url` is an object URL for the preview
 * thumbnail and is revoked when the item is removed, to avoid leaking memory.
 * @type {Array<{id: number, file: File, url: string}>}
 */
let selectedItems = [];
let nextItemId = 1;

/** True while an upload is in flight, to block double-submits. */
let isSharing = false;

/**
 * Reads a File as a base64 string (without the data: URL prefix), for the
 * JSON POST body the Apps Script endpoint expects.
 *
 * @param {File} file
 * @returns {Promise<string>}
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('File read failed'));
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads one file to the configured endpoint as a JSON POST, including the
 * shared `secret` the Apps Script checks so only this site can write.
 *
 * @param {string} endpoint
 * @param {string} secret - config.uploadSecret; sent as `secret` in the body.
 * @param {File} file
 * @returns {Promise<void>}
 */
async function shareOneFile(endpoint, secret, file) {
  const dataBase64 = await fileToBase64(file);
  const response = await fetch(endpoint, {
    method: 'POST',
    // Apps Script web apps accept text/plain without triggering a CORS
    // preflight; the body is still JSON that doPost parses.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      dataBase64,
      secret,
    }),
  });
  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }
  // Apps Script returns HTTP 200 even when it rejects the request (e.g. a
  // bad secret), signalling the real outcome in the JSON body's `ok` flag.
  // Parse it and treat ok:false as a failure so a wrong secret doesn't look
  // like a successful share. A non-JSON body (rare) is treated as success,
  // matching the pre-secret behavior of trusting a 200.
  try {
    const result = await response.clone().json();
    if (result && result.ok === false) {
      throw new Error(`Upload rejected: ${result.error || 'unknown'}`);
    }
  } catch (parseError) {
    if (parseError instanceof Error && parseError.message.startsWith('Upload rejected')) {
      throw parseError;
    }
    // Body wasn't JSON - fall through and treat the 200 as success.
  }
}

/**
 * Human-readable file size, e.g. "2.4 MB".
 * @param {number} bytes
 * @returns {string}
 */
function formatSize(bytes) {
  if (!bytes && bytes !== 0) {
    return '';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Removes a selected item by id, revoking its preview object URL, then
 * re-renders the preview grid and Share button state.
 * @param {number} id
 */
function removeItem(id) {
  const item = selectedItems.find((entry) => entry.id === id);
  if (item) {
    URL.revokeObjectURL(item.url);
  }
  selectedItems = selectedItems.filter((entry) => entry.id !== id);
  renderPreview();
}

/**
 * Builds one preview tile (thumbnail + name/size + remove button) for a
 * selected, not-yet-shared item.
 * @param {{id: number, file: File, url: string}} item
 * @returns {HTMLDivElement}
 */
function buildPreviewTile(item) {
  const tile = document.createElement('div');
  tile.className = 'photo-share__tile';

  const media = document.createElement('div');
  media.className = 'photo-share__thumb';

  if (item.file.type.startsWith('video/')) {
    const video = document.createElement('video');
    video.className = 'photo-share__media';
    video.src = item.url;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('aria-hidden', 'true');
    media.appendChild(video);

    const badge = document.createElement('span');
    badge.className = 'photo-share__badge';
    badge.textContent = '▶ Video';
    media.appendChild(badge);
  } else {
    const img = document.createElement('img');
    img.className = 'photo-share__media';
    img.src = item.url;
    img.alt = item.file.name;
    img.loading = 'lazy';
    img.decoding = 'async';
    media.appendChild(img);
  }

  tile.appendChild(media);

  const meta = document.createElement('div');
  meta.className = 'photo-share__meta';

  const name = document.createElement('p');
  name.className = 'photo-share__name';
  name.textContent = item.file.name;
  meta.appendChild(name);

  const size = document.createElement('p');
  size.className = 'photo-share__size';
  size.textContent = formatSize(item.file.size);
  meta.appendChild(size);

  tile.appendChild(meta);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'photo-share__remove';
  remove.setAttribute('aria-label', `Remove ${item.file.name}`);
  remove.textContent = '✕';
  remove.addEventListener('click', () => {
    if (isSharing) {
      return;
    }
    removeItem(item.id);
  });
  tile.appendChild(remove);

  return tile;
}

/**
 * Re-renders the preview grid, the "N selected" count, and the enabled/
 * disabled + label state of the Share Moments button, from `selectedItems`.
 */
function renderPreview() {
  const grid = document.getElementById('photo-share-preview');
  const shareButton = document.getElementById('photo-share-submit');
  const count = document.getElementById('photo-share-count');
  if (!grid || !shareButton || !count) {
    return;
  }

  grid.textContent = '';
  for (const item of selectedItems) {
    grid.appendChild(buildPreviewTile(item));
  }

  const n = selectedItems.length;
  count.textContent = n === 0
    ? 'No files selected yet.'
    : `${n} file${n === 1 ? '' : 's'} ready to share.`;

  shareButton.hidden = n === 0;
  shareButton.disabled = n === 0 || isSharing;
}

/**
 * Adds newly picked files to `selectedItems` (creating a preview object URL
 * for each) and re-renders. Duplicate picks of the same file are allowed —
 * the guest is in control of what they share.
 *
 * Files over MAX_FILE_BYTES are skipped (not previewed), because the upload
 * endpoint can't accept them; the guest is told which ones were too big via
 * the in-page status so a large video doesn't silently disappear.
 *
 * @param {FileList|File[]} files
 */
function addFiles(files) {
  const tooLarge = [];
  for (const file of Array.from(files || [])) {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      tooLarge.push(file.name);
      continue;
    }
    selectedItems.push({
      id: nextItemId++,
      file,
      url: URL.createObjectURL(file),
    });
  }
  renderPreview();

  if (tooLarge.length > 0) {
    const limitMb = Math.round(MAX_FILE_BYTES / (1024 * 1024));
    const names = tooLarge.join(', ');
    showStatus(
      tooLarge.length === 1
        ? `“${names}” is too large to share (max ${limitMb} MB). Please pick a smaller file. 🧚`
        : `${tooLarge.length} files were too large to share (max ${limitMb} MB each): ${names}. 🧚`,
      'error',
    );
  }
}

/**
 * Writes a message into the in-page status area (#photo-share-status),
 * replacing the old bottom snackbar toast. The message stays on the page
 * until it's replaced or cleared, so a guest can read the success/error
 * without racing an auto-dismiss timer.
 *
 * @param {string} message - text to show (empty string clears it).
 * @param {'success'|'error'|'info'} [type='info'] - drives the styling.
 */
function showStatus(message, type = 'info') {
  const status = document.getElementById('photo-share-status');
  if (!status) {
    return;
  }
  status.textContent = message || '';
  status.classList.remove(
    'photo-share__status--success',
    'photo-share__status--error',
    'photo-share__status--info',
  );
  if (message) {
    status.classList.add(`photo-share__status--${type}`);
    status.hidden = false;
  } else {
    status.hidden = true;
  }
}

/**
 * Sets the loading state on the section: toggles a class, disables the
 * Share button and swaps its label to a spinner + "Sharing...".
 * @param {boolean} loading
 */
function setLoading(loading) {
  isSharing = loading;
  const section = document.getElementById('photo-share');
  const shareButton = document.getElementById('photo-share-submit');
  const picker = document.getElementById('photo-share-input');
  if (section) {
    section.classList.toggle('photo-share--loading', loading);
  }
  if (picker) {
    picker.disabled = loading;
  }
  if (shareButton) {
    shareButton.disabled = loading || selectedItems.length === 0;
    shareButton.textContent = '';
    if (loading) {
      const spinner = document.createElement('span');
      spinner.className = 'photo-share__spinner';
      spinner.setAttribute('aria-hidden', 'true');
      shareButton.appendChild(spinner);
      shareButton.appendChild(document.createTextNode('Sharing…'));
    } else {
      shareButton.textContent = 'Share Moments';
    }
  }

  // Full-width loading banner above the buttons, so the loading state is
  // obvious even on a small screen where the button's own spinner is easy
  // to miss. Shown only while uploading; cleared by handleShare's own
  // success/error status message afterwards.
  const banner = document.getElementById('photo-share-loading');
  if (banner) {
    banner.hidden = !loading;
  }
}

/**
 * Handles the "Share Moments" click: uploads every selected file to the
 * configured endpoint, shows the loading state throughout, then writes an
 * in-page success/error message and removes the shared items from the
 * preview.
 *
 * When no endpoint is configured, shows a friendly "not set up yet" message
 * rather than failing — the picker/preview still work for everyone.
 *
 * @param {{photoUploadEndpoint?: string, uploadSecret?: string}} config
 */
async function handleShare(config) {
  if (isSharing || selectedItems.length === 0) {
    return;
  }

  const endpoint = config && typeof config.photoUploadEndpoint === 'string'
    ? config.photoUploadEndpoint.trim()
    : '';
  const secret = config && typeof config.uploadSecret === 'string'
    ? config.uploadSecret
    : '';

  if (!endpoint) {
    showStatus('Photo sharing isn’t set up yet — please try again later. 🧚', 'error');
    return;
  }

  // Clear any prior success/error message before this run.
  showStatus('');
  setLoading(true);

  // Snapshot what we're sharing so items removed/added mid-upload don't
  // desync the "remove shared items" step.
  const batch = selectedItems.slice();
  const sharedIds = [];
  let failures = 0;

  for (const item of batch) {
    try {
      await shareOneFile(endpoint, secret, item.file);
      sharedIds.push(item.id);
    } catch (error) {
      failures += 1;
      console.error('Failed to share a file:', error);
    }
  }

  // Remove only the items that actually uploaded, revoking their preview URLs.
  for (const id of sharedIds) {
    const item = selectedItems.find((entry) => entry.id === id);
    if (item) {
      URL.revokeObjectURL(item.url);
    }
  }
  selectedItems = selectedItems.filter((entry) => !sharedIds.includes(entry.id));

  setLoading(false);
  renderPreview();

  if (failures === 0) {
    showStatus(SUCCESS_MESSAGE, 'success');
  } else if (sharedIds.length > 0) {
    showStatus(`Shared ${sharedIds.length}, but ${failures} didn’t go through. Please retry those. 🧚`, 'error');
  } else {
    showStatus('Hmm, sharing didn’t go through. Please check your connection and try again. 🧚', 'error');
  }
}

/**
 * Renders the "Share Your Moments" scene into #photo-share.
 *
 * No-op when #photo-share is absent (so main.js can call it on every page).
 * Clears and rebuilds on every call, matching the codebase's render idiom.
 *
 * @param {Object} config - EventConfig-shaped object; reads photoUploadEndpoint.
 */
export function render(config) {
  const section = document.getElementById('photo-share');
  if (!section) {
    return;
  }

  // Reset per-render state (revoke any leftover preview URLs first).
  for (const item of selectedItems) {
    URL.revokeObjectURL(item.url);
  }
  selectedItems = [];
  isSharing = false;

  section.textContent = '';

  const content = document.createElement('div');
  content.className = 'photo-share__content';
  content.setAttribute('data-reveal-direction', 'fade-up');

  const number = document.createElement('p');
  number.className = 'section-number';
  number.textContent = '04';
  content.appendChild(number);

  const heading = document.createElement('h2');
  heading.className = 'photo-share__heading';
  heading.textContent = 'Share Your Moments';
  content.appendChild(heading);

  const intro = document.createElement('p');
  intro.className = 'photo-share__intro';
  intro.textContent = 'Snapped a photo or video during the party? Add your favorites here and share them with us.';
  content.appendChild(intro);

  // Hidden native file input + a styled label that triggers it. `multiple`
  // + accept="image/*,video/*" lets the guest pick several photos/videos
  // straight from their gallery.
  const input = document.createElement('input');
  input.type = 'file';
  input.id = 'photo-share-input';
  input.className = 'photo-share__input';
  input.accept = ACCEPT_TYPES;
  input.multiple = true;
  input.addEventListener('change', (event) => {
    addFiles(event.target.files);
    // Reset so picking the same file again still fires 'change'.
    event.target.value = '';
  });
  content.appendChild(input);

  const pickLabel = document.createElement('label');
  pickLabel.className = 'photo-share__pick cta-button castle-button';
  pickLabel.setAttribute('for', 'photo-share-input');
  pickLabel.textContent = 'Choose Photos or Videos';
  content.appendChild(pickLabel);

  const count = document.createElement('p');
  count.id = 'photo-share-count';
  count.className = 'photo-share__count';
  count.setAttribute('aria-live', 'polite');
  count.textContent = 'No files selected yet.';
  content.appendChild(count);

  const grid = document.createElement('div');
  grid.id = 'photo-share-preview';
  grid.className = 'photo-share__preview';
  content.appendChild(grid);

  // The Share Moments button. Stays hidden (and disabled) until at least
  // one file is selected — renderPreview() flips `hidden`/`disabled` from
  // the current selection count, so on a fresh page with nothing picked it
  // is not shown at all.
  const shareButton = document.createElement('button');
  shareButton.type = 'button';
  shareButton.id = 'photo-share-submit';
  shareButton.className = 'photo-share__submit cta-button castle-button';
  shareButton.textContent = 'Share Moments';
  shareButton.hidden = true;
  shareButton.disabled = true;
  shareButton.addEventListener('click', () => {
    handleShare(config);
  });
  content.appendChild(shareButton);

  // Prominent full-width loading banner (spinner + "Sharing your moments…"),
  // shown only while an upload is in flight. This is the main, hard-to-miss
  // loading indicator; the button's own inline spinner is secondary.
  const loading = document.createElement('div');
  loading.id = 'photo-share-loading';
  loading.className = 'photo-share__loading';
  loading.setAttribute('role', 'status');
  loading.setAttribute('aria-live', 'polite');
  loading.hidden = true;
  const loadingSpinner = document.createElement('span');
  loadingSpinner.className = 'photo-share__loading-spinner';
  loadingSpinner.setAttribute('aria-hidden', 'true');
  loading.appendChild(loadingSpinner);
  loading.appendChild(document.createTextNode('Sharing your moments…'));
  content.appendChild(loading);

  // In-page status message (success / error), replacing the old snackbar.
  // Stays on the page until the next action, so the guest can read it.
  const status = document.createElement('p');
  status.id = 'photo-share-status';
  status.className = 'photo-share__status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.hidden = true;
  content.appendChild(status);

  section.appendChild(content);

  renderPreview();
  observe([content]);
}

export default render;
