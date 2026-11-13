// The start screen: log in as the Dungeon Master (left) or as a player (right).
// Players can also create an account, and pick a free hero the first time.
import { signIn, signUp, signOut, myProfile, claimCharacter, explain } from '../net/backend.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

// `onLoggedIn()` is called after any successful login or hero pick; the app then
// loads the party and decides where to go.
export function createStartScreen(root, { onLoggedIn }) {
  const playerForm = root.querySelector('.auth[data-side="player"]');
  const nameInput = playerForm.querySelector('.auth__name');
  const submit = playerForm.querySelector('.auth__submit');
  const switchBtn = root.querySelector('[data-step="login"] .auth__switch');
  const heroes = root.querySelector('.start__heroes');
  const claimError = root.querySelector('[data-step="claim"] .auth__error');
  let signingUp = false;

  const showError = (form, message) => {
    const el = form.querySelector('.auth__error');
    el.textContent = message;
    el.hidden = !message;
  };

  function busy(form, on) {
    for (const el of form.querySelectorAll('input, button')) el.disabled = on;
  }

  function step(name) {
    for (const el of root.querySelectorAll('.start__step')) el.hidden = el.dataset.step !== name;
  }

  switchBtn.addEventListener('click', () => {
    signingUp = !signingUp;
    nameInput.hidden = !signingUp;
    nameInput.required = signingUp;
    submit.textContent = signingUp ? 'Create account' : 'Log in';
    switchBtn.textContent = signingUp ? 'Already have an account? Log in' : 'New here? Create an account';
    playerForm.password.autocomplete = signingUp ? 'new-password' : 'current-password';
    showError(playerForm, '');
  });

  for (const form of root.querySelectorAll('.auth')) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      showError(form, '');
      busy(form, true);
      const email = form.email.value.trim();
      const password = form.password.value;
      try {
        if (form.dataset.side === 'player' && signingUp) await signUp(nameInput.value.trim(), email, password);
        else await signIn(email, password);
        // The DM side only lets the Dungeon Master in.
        if (form.dataset.side === 'dm' && (await myProfile())?.role !== 'dm') {
          await signOut();
          throw new Error('This account is not the Dungeon Master.');
        }
        form.password.value = '';
        await onLoggedIn();
      } catch (err) {
        showError(form, explain(err));
      } finally {
        busy(form, false);
      }
    });
  }

  // First login as a player: choose one of the free heroes.
  heroes.addEventListener('click', async (e) => {
    const pick = e.target.closest('.hero-pick:not([disabled])');
    if (!pick) return;
    claimError.hidden = true;
    try {
      await claimCharacter(pick.dataset.id);
      await onLoggedIn();
    } catch (err) {
      claimError.textContent = explain(err);
      claimError.hidden = false;
    }
  });
  root.querySelector('[data-action="logout"]').addEventListener('click', async () => {
    await signOut();
    step('login');
  });

  return {
    show() { root.hidden = false; step('login'); },
    hide() { root.hidden = true; },
    // `rows` are the party's characters with their owners.
    showClaim(rows) {
      root.hidden = false;
      step('claim');
      heroes.innerHTML = rows.length
        ? rows.map(({ data: c, owner }) => `
          <li>
            <button type="button" class="hero-pick" data-id="${esc(c.id)}"${owner ? ' disabled' : ''}>
              <span class="hero-pick__badge" style="background:${esc(c.colour)}">${esc(c.name[0])}</span>
              <span class="hero-pick__who"><b>${esc(c.name)}</b><small>${owner ? 'Taken by another player' : `Level ${c.level} ${esc(c.class)} · ${esc(c.race)}`}</small></span>
              <span class="hero-pick__go" aria-hidden="true">${owner ? '' : '›'}</span>
            </button>
          </li>`).join('')
        : '<li class="start__wait">The Dungeon Master has not set up the party yet. Try again soon.</li>';
    },
  };
}
