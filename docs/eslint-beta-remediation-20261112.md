# OVRLEE ESLint remediation — November 11–12, 2026

## Submitted local output
The user ran `npx expo lint` after the new Expo flat ESLint config was installed.
The pasted terminal tail ended: **202 problems (111 errors, 91 warnings)**. The pasted text starts in the middle of a `CollectionSlides.tsx` diagnostic, so the first part of the report is not included. Do not assume we have all 202 findings or claim zero remaining errors.

## Low-risk fixes committed
- `src/components/ProfileAvatar.tsx`: moved error state into a URL-keyed image child. Changing the avatar URL resets the failed-image state by remounting instead of synchronously clearing it inside an effect. Fallback initials remain visible when the image fails.
- `src/components/CoreFourSection.tsx`: escape JSX punctuation in the error-state copy.
- `src/components/FirstListenShowcase.tsx`: escape JSX punctuation in empty-state copy.

## Remaining high-priority themes observed in pasted output
- `CollectionSlides.tsx`: `react-hooks/static-components`. Inner `Title`, `Caption`, and `Photo` components are created during render. Refactor without losing styling from closure variables; preserve each slide layout, focus, photo editor and title font.
- `ListeningPartyPanel.tsx`, `OverlyIntro.tsx`, `party-session.tsx`: React Compiler ref/purity rules. Replacing an animated value/ref with naive state, or altering effects, risks animation and room-sync regressions. Requires dedicated changes and visual/device QA.
- `PhotoFrame.tsx`, `PhotoReframeEditor.tsx`, `ProfileAvatar.tsx`, `ShareIntentHandler.tsx`, `UnifiedRotation.tsx`, `WorldCityPicker.tsx`, `core-four.tsx`, `use-listening-party.ts`: `react-hooks/set-state-in-effect`, some related dependencies.
- `FirstListenShowcase.tsx`, `UnifiedRotation.tsx`, `YouTwoCard.tsx`: Date.now in render/hook initializer flagged as impure; consider a stable subscribed clock rather than hiding it from lint.
- Numerous unused variables and hook dependency warnings.

## Guardrails
1. Do not globally disable React Compiler/Hook lint rules merely to make CI green.
2. Fix these in small functional batches, running `npx tsc --noEmit`, `npx expo lint`, and focused device checks after each.
3. Keep the stricter lint run separate from required beta build checks until the baseline is clean. The repo's CI currently runs TypeScript and feature tests, not lint.
4. EAS Preview installation does not depend on local Metro; lint errors do not automatically mean the JavaScript bundle will fail, but genuine errors need review.
5. Re-run `npx expo lint` to get a fresh baseline after pulling the three changes above. Save machine-readable JSON if continued automated triage is needed.

## Useful commands
```sh
git pull --ff-only origin claude-build
npx tsc --noEmit
npx expo lint
```
