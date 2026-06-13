# One-Tap iPhone Microphone Shortcut

A home-screen icon that opens the **Microphone privacy settings** in one tap.

> **Important — read first:** iOS does **not** allow any app, icon, or shortcut to
> mute the microphone system-wide. There is no "mute microphone" action in the
> Shortcuts app. This guide builds the closest legitimate thing: a one-tap icon
> that jumps straight to the screen where each app's mic access is a toggle.

---

## Build the Shortcut (≈2 minutes)

1. Open the **Shortcuts** app → tap **+** (top right).
2. Tap **Add Action** → search **URL** → choose the **URL** action.
3. In the URL box, paste exactly:

   ```
   App-Prefs:root=Privacy&path=MICROPHONE
   ```

4. Tap **Add Action** again → search **Open URLs** → choose **Open URLs**
   (it auto-fills with the URL above).
5. Tap the name at the top → **Rename** to `Mic`. Optionally pick an icon/color.
6. Tap **Done**.

## Add it to the Home Screen

1. Open the shortcut → tap the **share / ⌄** menu → **Add to Home Screen**.
2. Tap the icon thumbnail to choose a custom image (e.g. a microphone photo) and set the name.
3. Tap **Add**.

Tapping the icon now opens the Microphone page, where each app's mic access is a one-tap switch.

---

## Good to know

- **It does not toggle the mic itself** — iOS has no API for that. It opens the
  switches; you flip the app you want.
- The **orange dot** at the top-right of the screen is your reliable indicator
  that the mic is live.
- The `App-Prefs:` URL is **unofficial**. It works on most iOS versions, but
  Apple occasionally changes the path. If the icon lands on the top-level
  Settings page instead of Microphone, the path changed for your iOS version —
  check **Settings → General → About → iOS Version** and look up the current
  `path=` value, or remove `&path=MICROPHONE` to at least open Privacy.

## If you really need true one-click mic mute

- **On calls (Zoom / Teams / FaceTime / Phone):** these apps already have a
  one-tap mute button on screen.
- **On a Mac:** a genuine one-click system mic mute *is* possible via apps like
  MicControl or MuteKey, or a custom toggle.
