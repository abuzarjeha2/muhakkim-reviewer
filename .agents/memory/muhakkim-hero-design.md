---
name: Muhakkim hero / brand-word styling
description: Why the hero brand word uses solid gold, not gradient-clip text
---

The hero `<h1>` brand word ("محكّم") uses a plain `color:T.gold`, NOT a
`background:goldG + WebkitBackgroundClip:text + WebkitTextFillColor:transparent`
gradient.

**Why:** `WebkitTextFillColor:transparent` overrides `color`, so on a browser that
honors text-fill-color but not `background-clip:text`, the word renders invisible.
The user is Arabic-first on mobile where partial support is plausible — reliability
beats the flourish, and solid `#b45309` looks nearly identical to the gradient anyway.

**How to apply:** If gradient text is ever wanted, gate it behind
`CSS.supports('background-clip:text') || CSS.supports('-webkit-background-clip:text')`
and keep solid gold as the default fallback. The hero title size uses
`clamp(30px,7vw,44px)` for responsiveness — keep that.
