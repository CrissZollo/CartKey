/** True when this window was loaded as the fullscreen toast overlay (used
 * when the library window is hidden) rather than the main library window. */
export const isToastMode = new URLSearchParams(window.location.search).get('mode') === 'toast'
