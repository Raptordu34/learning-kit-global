# Arrows — SVG Elements

> Conventions : voir `CATALOG.md`

---

## arrow-right

Flèche horizontale simple pointant à droite. Usage : icône inline 24×24.

```html
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <line x1="4" y1="12" x2="19" y2="12" stroke="#d67556" stroke-width="2" stroke-linecap="round"/>
  <polygon points="19,12 13,8.5 13,15.5" fill="#d67556"/>
</svg>
```

---

## arrow-left

Flèche horizontale simple pointant à gauche. Usage : icône inline 24×24.

```html
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <line x1="20" y1="12" x2="5" y2="12" stroke="#d67556" stroke-width="2" stroke-linecap="round"/>
  <polygon points="5,12 11,8.5 11,15.5" fill="#d67556"/>
</svg>
```

---

## arrow-up

Flèche verticale simple pointant vers le haut. Usage : icône inline 24×24.

```html
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <line x1="12" y1="20" x2="12" y2="5" stroke="#d67556" stroke-width="2" stroke-linecap="round"/>
  <polygon points="12,5 8.5,11 15.5,11" fill="#d67556"/>
</svg>
```

---

## arrow-down

Flèche verticale simple pointant vers le bas. Usage : icône inline 24×24.

```html
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <line x1="12" y1="4" x2="12" y2="19" stroke="#d67556" stroke-width="2" stroke-linecap="round"/>
  <polygon points="12,19 8.5,13 15.5,13" fill="#d67556"/>
</svg>
```

---

## arrow-curved-right

Flèche courbe (arc vers le haut) de gauche à droite. Usage : connecteur 200×40 entre blocs.

```html
<svg width="200" height="40" viewBox="0 0 200 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M 10 24 C 60 5, 140 5, 184 20" stroke="#d67556" stroke-width="2" stroke-linecap="round" fill="none"/>
  <polygon points="188,21 179,15 182,26" fill="#d67556"/>
</svg>
```

---

## arrow-double

Flèche double-tête horizontale (←→). Usage : connecteur 200×40, indique une relation bidirectionnelle symétrique.

```html
<svg width="200" height="40" viewBox="0 0 200 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <line x1="18" y1="20" x2="182" y2="20" stroke="#d67556" stroke-width="2" stroke-linecap="round"/>
  <polygon points="15,20 22,16 22,24" fill="#d67556"/>
  <polygon points="185,20 178,16 178,24" fill="#d67556"/>
</svg>
```

---

## arrow-bidirectional

Deux flèches parallèles en sens opposés (→ et ←). Usage : connecteur 200×40, indique un flux dans les deux directions (ex: requête/réponse).

```html
<svg width="200" height="40" viewBox="0 0 200 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Flèche du haut : gauche → droite -->
  <line x1="15" y1="14" x2="181" y2="14" stroke="#d67556" stroke-width="2" stroke-linecap="round"/>
  <polygon points="184,14 177,10 177,18" fill="#d67556"/>
  <!-- Flèche du bas : droite → gauche -->
  <line x1="185" y1="26" x2="19" y2="26" stroke="#9e9a94" stroke-width="2" stroke-linecap="round"/>
  <polygon points="16,26 23,22 23,30" fill="#9e9a94"/>
</svg>
```
