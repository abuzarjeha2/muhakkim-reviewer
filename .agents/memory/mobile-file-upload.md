---
name: Mobile file upload pattern (FileZone)
description: The reliable file-input pattern for Muhakkim on mobile, and why the overlay variant failed on Android Chrome.
---

# Mobile-reliable file upload pattern

For client-side file pickers in محكّم برو V4, use the pattern that the app already uses in 30+ places:

```jsx
<div onClick={()=>ref.current?.click()} ...dropzone styles...>
  <input ref={ref} type="file" multiple style={{display:"none"}}
    onChange={e=>setFiles(Array.from(e.target.files).slice(0,3))}/>
</div>
```

Reset the input value in the click handler (before `.click()`), NOT inside `onChange`.

**Why:** `FileZone` was the lone outlier — it used an `opacity:0` absolutely-positioned `<input>` overlaid inside a `<label>` AND reset `e.target.value=""` synchronously inside `onChange`. A real user on Android Chrome reported the native picker opened and a file was selected, but it never registered as attached (no ✅), for all file types. The fix was to align FileZone with the proven `div + ref.click() + display:none` pattern and move the value reset out of `onChange`. Resetting value inside `onChange` risks dropping the just-selected file on some Android Chrome builds; the overlay-in-label variant is less reliable than an explicit user-gesture `ref.click()`.

**How to apply:** never reintroduce the opacity-overlay-input-in-label variant; never reset `input.value` inside `onChange` (do it in the click/openPicker handler so re-selecting the same file still fires change). Note: Playwright `setInputFiles` bypasses the native picker, so automated tests CANNOT reproduce native-picker mobile bugs — they only confirm no regression. Real-device confirmation requires the user. A frontend fix only reaches the live site after the user re-publishes.
