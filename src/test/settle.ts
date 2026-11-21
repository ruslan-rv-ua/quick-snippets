import { act } from '@testing-library/react';

/**
 * Waits until the mocked backend has answered what the test has just done and React has finished
 * everything that answer started, effects included. It does not wait for timers.
 *
 * Call it right after the action that sends the request (rendering the app, opening a dialog,
 * Save), with nothing awaited in between: the backend's promise callbacks then run inside act,
 * and act also runs the effects of the updates they make.
 *
 * Use it instead of waitFor or findBy… when the next step is a key press or a focus check. Those
 * come back once the page shows the result, but React 19 runs effects in a later step: it yields
 * after every commit. On a busy computer the test went on in between, while the key handlers that
 * effects set still came from before the answer. Escape and Ctrl+Enter in the settings dialog were
 * then ignored as if a save were still running, Ctrl+D found no selected snippet, and the first
 * focus of a dialog was not set yet (TASK-46).
 */
export async function settle(): Promise<void> {
  await act(async () => {});
}
