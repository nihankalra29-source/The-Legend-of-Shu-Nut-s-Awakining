const Story = {
  flags: new Set(),
  hasFlag(f) { return this.flags.has(f); },
  setFlag(f) { this.flags.add(f); },
};

// Dialogue lines can name an action to run once the box closes.
// The actual game object registers itself here so dialogue.js stays decoupled.
let ACTIVE_GAME = null;
function registerGame(game) { ACTIVE_GAME = game; }
function handleDialogueAction(action) {
  if (ACTIVE_GAME && typeof ACTIVE_GAME.onDialogueAction === 'function') {
    ACTIVE_GAME.onDialogueAction(action);
  }
}
