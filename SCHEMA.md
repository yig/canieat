# canieat — Data Schema

`index.html` is a fully self-contained static page. All data lives in JavaScript arrays and objects in the `<script>` block. No build step; no external dependencies except Google Fonts.

---

## Core arrays

### `CATS` — category list
```js
const CATS = [ "Beef & Veal", "Lamb & Game", "Pork & Charcuterie", "Poultry",
               "Shellfish", "Fish", "Vegetarian / Vegan", "Mushroom",
               "Soup & Broth", "Dessert", "Cheese", "Technique & Sauce", "Other" ];
```
Each `FOODS` entry must use one of these exact strings as its `cat` field. CATS controls filter button order.

---

### `FOODS` — dish entries
```js
const FOODS = [
  {
    name: "Dish Name",          // string — unique display name
    cat:  "Category",           // must match a CATS entry
    desc: "Short description.", // 1–2 sentence description
    r:    { <restriction-id>: "y"|"n"|"p"|"u", ... },  // dietary status (see RESTRICTIONS)
    notes:{ <restriction-id>: "Explanation string.", ... }, // optional per-column tooltip text
  },
  ...
];
```
`r` values:
- `"y"` — generally compatible / safe
- `"n"` — not compatible
- `"p"` — partial / depends on preparation or certification
- `"u"` — unknown / varies by tradition (default if key absent)

`notes` is optional; keys are restriction IDs. Shown in the tooltip when the user hovers a cell.

After `FOODS` is declared, the runtime merges `CONTAINS_DATA` into each entry:
```js
FOODS.forEach(f => { f.c = CONTAINS_DATA[f.name] || {}; });
```
`f.c` is the ingredient-presence map used in "Contains" mode.

---

### `RESTRICTIONS` — "I eat…" columns (diet mode)
```js
const RESTRICTIONS = [
  { id: "vegetarian", label: "Vegetarian", icon: "🥦", def: "Definition text shown in glossary." },
  { id: "vegan",      label: "Vegan",      icon: "🌱", def: "..." },
  { id: "pescatarian",label: "Pescatarian",icon: "🐠", def: "..." },
  { id: "vegequarian",label: "Vegequarian",icon: "🥗", def: "..." },
  { id: "noRedMeat",  label: "No Red Meat",icon: "🚫🥩", def: "..." },
  { id: "jain",       label: "Jain",       icon: "🕊️", def: "..." },
  { id: "kosher",     label: "Kosher",     icon: "✡️", def: "..." },
  { id: "halal",      label: "Halal",      icon: "☪️", def: "..." },
  { id: "lent",       label: "Lent",       icon: "✝️", def: "..." },
];
```
These are the columns shown when the mode toggle is set to **I eat…**.

---

### `INGREDIENTS` — "Contains" columns (contains mode)
```js
const INGREDIENTS = [
  { id: "gluten",   label: "Gluten",    icon: "🌾", def: "Definition..." },
  { id: "dairy",    label: "Dairy",     icon: "🥛", def: "..." },
  { id: "eggs",     label: "Eggs",      icon: "🥚", def: "..." },
  { id: "treenuts", label: "Tree Nuts", icon: "🌰", def: "..." },
  { id: "peanuts",  label: "Peanuts",   icon: "🥜", def: "..." },
  { id: "shellfish",label: "Shellfish", icon: "🦞", def: "..." },
  { id: "fish",     label: "Fish",      icon: "🐟", def: "..." },
  { id: "chicken",  label: "Chicken",   icon: "🍗", def: "..." },
  { id: "beef",     label: "Beef",      icon: "🥩", def: "..." },
  { id: "pork",     label: "Pork",      icon: "🐷", def: "..." },
  { id: "lamb",     label: "Lamb",      icon: "🐑", def: "..." },
  { id: "game",     label: "Game",      icon: "🦌", def: "..." },
  { id: "alcohol",  label: "Alcohol",   icon: "🍷", def: "..." },
  { id: "legumes",  label: "Legumes",   icon: "🫘", def: "..." },
];
```
These are the columns shown when the mode toggle is set to **Contains**.

Cell values in `f.c` use the same `"y"/"n"/"p"/"u"` convention. In **Contains** mode, `"y"` renders green (ingredient present), `"n"` renders as a muted dark cell (absent — not alarming red).

---

### `CONTAINS_DATA` — ingredient-presence lookup
```js
const CONTAINS_DATA = {
  "Dish Name": {
    gluten:"n", dairy:"n", eggs:"n", treenuts:"n", peanuts:"n",
    shellfish:"n", fish:"n", chicken:"n", beef:"n", pork:"n",
    lamb:"n", game:"n", alcohol:"n", legumes:"n"
  },
  ...
};
```
Every `FOODS` entry should have a matching key here; otherwise `f.c` defaults to `{}` and all Contains cells show `"u"` (unknown). The key must exactly match `food.name`.

---

## Mode toggle

```js
let mode = "diet";   // "diet" | "contains"
```

- **diet** — uses `RESTRICTIONS` columns and `food.r` data
- **contains** — uses `INGREDIENTS` columns and `food.c` data

---

## Adding a new dish

1. Add a `FOODS` entry with `name`, `cat`, `desc`, `r`, and optionally `notes`.
2. Add a matching `CONTAINS_DATA` entry with all ingredient IDs set to `"y"`, `"n"`, or `"p"`.
3. If the dish belongs to a new category, add it to `CATS` (and update the filter UI if needed).

## Adding a new column

### New dietary restriction
1. Add `{ id, label, icon, def }` to `RESTRICTIONS`.
2. Add the new `id` key with a value to every `FOODS[*].r` object (or accept `"u"` as default).

### New ingredient
1. Add `{ id, label, icon, def }` to `INGREDIENTS`.
2. Add the new `id` key with a value to every `CONTAINS_DATA` entry (or accept `"u"` as default).
