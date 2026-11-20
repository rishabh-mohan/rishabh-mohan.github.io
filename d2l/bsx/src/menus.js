// Purdue dining menus (api.hfs.purdue.edu's GraphQL service, public, no sign-in). Content
// scripts cannot read another site in Chrome, so requests go through background.js, which
// holds the queries. The food filter and the grouping are plain functions so tests can run
// them without a browser.
BSX.menus = (() => {
  const api = globalThis.browser || globalThis.chrome;
  const cache = new Map(); // request -> { at, promise }
  const TTL = 10 * 60 * 1000;

  async function ask(msg) {
    if (!api || !api.runtime || !api.runtime.sendMessage) throw new Error('Menus are not available here.');
    const res = await api.runtime.sendMessage({ type: 'bsx-menus', ...msg });
    if (!res || res.error) throw Object.assign(new Error(res ? res.error : 'No answer from the extension.'), { code: res && res.error });
    return res.data;
  }
  function get(msg) {
    const key = JSON.stringify(msg);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL) return hit.promise;
    const promise = ask(msg);
    promise.catch(() => cache.delete(key));
    cache.set(key, { at: Date.now(), promise });
    return promise;
  }

  // Purdue's answer in the shape the page uses. An item with a submenu in Purdue's app (Salad
  // Bar, Bread and Condiments, Pizza Toppers) carries its parts as Components. Traits are the
  // allergens and diets Purdue marks it with (Milk, Gluten, Vegetarian …).
  const time = (iso) => (iso ? String(iso).slice(11, 19) : null); // Purdue's own clock (Eastern)
  function item(a) {
    const traits = ((a.item && a.item.traits) || []).map((t) => t.name);
    return {
      ID: a.item ? a.item.itemId : a.id,
      Name: String(a.displayName || (a.item && a.item.name) || '').trim(),
      Allergens: traits.map((Name) => ({ Name, Value: true })),
      Ingredients: (a.item && a.item.ingredients) || '',
      IsVegetarian: traits.includes('Vegetarian') || traits.includes('Vegan'),
      Components: a.hasComponents && a.components && a.components.length ? a.components.map(item) : null,
    };
  }
  function shape(menu) {
    if (!menu) return { IsPublished: false, Meals: [], Notes: '' };
    return {
      IsPublished: true,
      Notes: menu.notes || '',
      Meals: (menu.meals || []).map((m) => ({
        Name: m.name,
        Status: m.status === 'OPEN' ? 'Open' : 'Closed',
        Hours: m.startTime && m.endTime ? { StartTime: time(m.startTime), EndTime: time(m.endTime) } : null,
        Stations: (m.stations || []).map((s) => ({ Name: s.name || '', Items: (s.items || []).map(item) })),
      })),
    };
  }

  // The dining courts (not Quick Bites or On-the-GO!), in Purdue's order.
  const courts = () => get({ op: 'courts' }).then((d) => (d.diningCourts || []).filter((c) => c.category === 'Dining Courts').map((c) => c.name));
  const day = (court, date) => get({ op: 'day', court, date }).then((d) => shape(d.diningCourtByName && d.diningCourtByName.dailyMenu));
  // A day's menu without keeping it: for search, which reads three weeks of menus and keeps only
  // what it needs from each (each court-day is about 300 KB).
  const dayOnce = (court, date) => ask({ op: 'day', court, date }).then((d) => shape(d.diningCourtByName && d.diningCourtByName.dailyMenu));
  // The names of every dish a court served on a day (open meals; parts inside bars included).
  const namesOnce = (court, date) => ask({ op: 'names', court, date }).then((d) => {
    const menu = d.diningCourtByName && d.diningCourtByName.dailyMenu;
    const out = new Set();
    for (const m of (menu && menu.meals) || []) {
      if (m.status !== 'OPEN') continue;
      for (const s of m.stations || []) for (const i of s.items || []) {
        if (i.components && i.components.length) for (const c of i.components) out.add(String(c.displayName || '').trim());
        else out.add(String(i.displayName || '').trim());
      }
    }
    out.delete('');
    return [...out];
  });
  const clear = () => cache.clear();

  // ---- kinds of dish ---------------------------------------------------------
  // The API has no "main dish" flag, so the words in a dish's name decide (see kindOf): Jasmine
  // Rice is a grain, Boom Boom Sauce a sauce, Pecan Pie a dessert, anything unrecognised a main.
  // A dish with parts (a submenu in Purdue's app) is a bundle, whatever its name.
  const CATS = [
    ['sauce', 'Sauces & dressings', "sauce gravy dressing dip chutney salsa raita crema aioli ketchup mustard mayo mayonnaise relish syrup honey jam jelly nutella vinaigrette vinegar oil seasoning oregano butter margarine hummus cream spread ranch"],
    ['bread', 'Breads', 'bun bread breadstick roll toast tortilla naan pita focaccia triangle biscuit bagel croissant cracker'],
    ['grain', 'Rice & grains', 'rice couscous'],
    ['side', 'Sides', 'vegetable bean corn potato potatoe fry frie wedge coleslaw slaw zucchini cauliflower broccoli carrot tomato tomatoe lettuce avocado blend onion salad chip spinach pea green cucumber celery radish arugula mushroom olive pepper pickle giardiniera pepperoncini kale mix sauerkraut'],
    ['fruit', 'Fruit', 'fruit kiwi cantaloupe applesauce orange cocktail melon grape banana apple pear berry blueberry strawberry mango pineapple raisin cherry'],
    ['dessert', 'Desserts', 'cookie cake pie brownie cobbler crisp pudding muffin ice sundae bar donut cupcake yogurt'],
    ['cheese', 'Cheeses', 'cheese feta mozzarella provolone cheddar parmesan swiss cojack'],
    ['topping', 'Toppings', "topping topper crouton sprinkle flake granola seed'nola sugar cinnamon"],
    ['drink', 'Drinks', 'milk juice'],
  ];
  const LABEL = Object.fromEntries(CATS.map(([k, l]) => [k, l]));
  const HEAD = new Map([...CATS.flatMap(([k, , ws]) => ws.split(' ').map((w) => [w, k])), ]);
  const NAMED = [[/\bice cream\b/i, 'dessert'], [/\bbacon bits\b/i, 'topping'], [/\b(chocolate|peanut butter) chips\b/i, 'topping'], [/\bspring rolls?\b/i, 'side'], [/\bbread and butter pickles?\b/i, 'side'], [/\b(crushed red pepper|red pepper flakes)\b/i, 'topping']];
  const SKIP_STATIONS = /^by request$/i;
  const words = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z' ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  // Words for the shape a food is cut into, skipped to find what it is: Hard Boiled Egg Slices
  // are eggs, Cantaloupe Slices fruit, Celery Sticks a vegetable.
  const FORM = new Set(['slice', 'slices', 'chunk', 'chunks', 'stick', 'sticks', 'spear', 'spears', 'ring', 'rings', 'strip', 'strips', 'bit', 'bits', 'crumble', 'crumbles', 'half', 'halves', 'wedge', 'wedges', 'piece', 'pieces', 'breast']);
  // "X and Y" / "X with Y" / "X in Y" is an X: Beef and Mushrooms in Cream Sauce is beef.
  const headOf = (name) => {
    const w = words(String(name).replace(/\s+(with|w\/|in|on)\s+.*$/i, '').replace(/\s+(and|&)\s+.*$/i, ''));
    while (w.length > 1 && FORM.has(w[w.length - 1])) w.pop();
    return w[w.length - 1] || '';
  };
  // Words that make a dish a main wherever they appear: Orange Chicken, Cheese Pizza.
  const MAIN = new Set(['beef', 'steak', 'burger', 'hamburger', 'brisket', 'birria', 'meatball', 'meatloaf', 'pork', 'bacon', 'ham', 'sausage', 'pepperoni', 'chorizo', 'carnitas', 'chicken', 'drumstick', 'wing', 'nugget', 'tender', 'tenderloin', 'turkey', 'lamb', 'gyro', 'fish', 'salmon', 'tuna', 'cod', 'tilapia', 'pollock', 'catfish', 'shrimp', 'crab', 'lobster', 'scallop', 'calamari',
    'pasta', 'rotini', 'penne', 'spaghetti', 'lasagna', 'ravioli', 'mac', 'noodle', 'pizza', 'calzone', 'curry', 'tofu', 'taco', 'burrito', 'quesadilla', 'enchilada', 'fajita', 'sandwich', 'wrap', 'panini', 'soup', 'chili', 'stew', 'bite', 'strip', 'egg', 'omelet', 'omelette', 'pancake', 'waffle', 'tikki', 'samosa', 'paneer', 'falafel', 'dumpling', 'potsticker', 'casserole', 'hot dog', 'dog']);
  const forms = (w) => [w, w.replace(/s$/, ''), w.replace(/es$/, '')];
  const catOf = (w) => forms(w).map((f) => HEAD.get(f)).find(Boolean);
  // Contains check, in order: the word the name ends on (Chicken Gravy is a sauce), then any
  // main word anywhere (Beef and Mushrooms in Cream Sauce is a main), then any side word
  // anywhere (Spicy Cheesy Corn Bake is a side), else a main.
  // Takes an item, or just a name.
  function kindOf(x) {
    if (x && x.Components && x.Components.length) return 'bundle';
    const n = String(x && typeof x === 'object' ? x.Name : x).trim();
    for (const [re, k] of NAMED) if (re.test(n)) return k;
    const head = headOf(n);
    if (forms(head).some((f) => MAIN.has(f))) return 'main'; // Pollock Bites, not Bacon Bits
    const ends = catOf(head);
    if (ends) return ends;
    const all = words(n);
    if (all.some((w) => forms(w).some((f) => MAIN.has(f)))) return 'main';
    for (const w of all.reverse()) {
      const k = catOf(w);
      if (k) return k;
    }
    return 'main';
  }
  const isMain = (x) => ['main', 'bundle'].includes(kindOf(x));

  // A big bundle's parts (Salad Bar, Deli Bar), grouped by kind: Proteins, Cheeses,
  // Vegetables, Sauces & dressings … Purdue lists them flat. A bundle of eight parts or fewer
  // (Pizza Toppers) is not grouped.
  const PART_LABEL = { main: 'Proteins', side: 'Vegetables' };
  const PART_ORDER = ['main', 'cheese', 'side', 'sauce', 'bread', 'topping', 'grain', 'fruit', 'dessert', 'drink'];
  function partGroups(bundle) {
    const list = bundle.Components || [];
    if (list.length <= 8) return null;
    const by = new Map();
    for (const part of list) {
      const k = kindOf(part) === 'bundle' ? 'main' : kindOf(part);
      if (!by.has(k)) by.set(k, []);
      by.get(k).push(part);
    }
    return PART_ORDER.filter((k) => by.has(k)).map((k) => ({ label: PART_LABEL[k] || LABEL[k], items: by.get(k) }));
  }

  // A station's dishes for display: mains one by one (mains sharing a last word, like three
  // pizzas, as one group), bundles with their parts, then sides; two or more of one kind
  // (sauces, breads, desserts …) as one group, except Sides, which are always listed.
  function compact(items) {
    const mains = new Map();
    const sides = new Map();
    const bundles = [];
    for (const i of items) {
      const k = kindOf(i);
      if (k === 'bundle') bundles.push(i);
      else if (k === 'main') {
        const head = headOf(i.Name).replace(/s$/, '');
        if (!mains.has(head)) mains.set(head, []);
        mains.get(head).push(i);
      } else {
        if (!sides.has(k)) sides.set(k, []);
        sides.get(k).push(i);
      }
    }
    const out = [];
    for (const [head, list] of mains) {
      if (list.length === 1 || !head) out.push(...list.map((i) => ({ type: 'item', item: i })));
      else out.push({ type: 'group', label: `${head[0].toUpperCase()}${head.slice(1)}s`, short: list.map((i) => i.Name.replace(new RegExp(`\\s*\\b${head}s?\\b`, 'i'), '').trim() || i.Name), items: list });
    }
    for (const i of bundles) out.push({ type: 'bundle', item: i });
    for (const [k] of CATS) {
      const list = sides.get(k);
      if (!list) continue;
      // Sides are often the best thing at a station, so each is listed on its own.
      if (list.length === 1 || k === 'side') out.push(...list.map((i) => ({ type: 'item', item: i, side: true })));
      else out.push({ type: 'group', label: LABEL[k], items: list, side: true });
    }
    return out;
  }

  // Every dish in a day's menu, parts inside bars included, with where it is served. Closed
  // meals are left out.
  function dishes(day) {
    const out = [];
    for (const meal of day.Meals || []) {
      if (meal.Status !== 'Open') continue;
      for (const station of meal.Stations || []) {
        for (const item of station.Items || []) {
          if (item.Components) for (const part of item.Components) out.push({ item: part, meal: meal.Name, station: station.Name, parent: item.Name });
          out.push({ item, meal: meal.Name, station: station.Name, parent: null });
        }
      }
    }
    return out;
  }
  // Favourites are kept by name, so the same dish is found again on any day and at any court.
  const favKey = (name) => norm(name);

  // ---- food filter ----------------------------------------------------------
  // A blocked word also blocks the foods it stands for (beef → steak, burger …). A word that
  // names an allergen the API tracks also blocks items flagged with it.
  const GROUPS = {
    beef: ['beef', 'steak', 'burger', 'hamburger', 'cheeseburger', 'brisket', 'birria', 'meatball', 'meatloaf', 'sirloin', 'ribeye', 'pastrami', 'corned beef', 'barbacoa', 'carne asada', 'bulgogi', 'philly', 'oxtail', 'short rib'],
    pork: ['pork', 'bacon', 'ham', 'sausage', 'pepperoni', 'prosciutto', 'chorizo', 'carnitas', 'salami', 'bratwurst', 'brat', 'kielbasa', 'pancetta', 'spam', 'lard', 'porchetta', 'char siu', 'tonkatsu', 'al pastor', 'capicola', 'andouille', 'baby back', 'spare rib'],
    chicken: ['chicken', 'drumstick', 'wing', 'nugget', 'tender', 'tenderloin', 'poultry'],
    turkey: ['turkey'],
    lamb: ['lamb', 'gyro', 'mutton'],
    fish: ['fish', 'salmon', 'tuna', 'cod', 'tilapia', 'pollock', 'catfish', 'swai', 'halibut', 'trout', 'mahi', 'anchovy', 'sardine', 'sushi', 'swordfish', 'haddock'],
    shellfish: ['shellfish', 'shrimp', 'crab', 'lobster', 'clam', 'scallop', 'mussel', 'oyster', 'calamari', 'squid', 'crawfish', 'prawn'],
    dairy: ['dairy', 'milk', 'cheese', 'cheesy', 'cream', 'butter', 'yogurt', 'alfredo', 'queso', 'mozzarella', 'parmesan', 'cheddar', 'ranch', 'ricotta', 'feta', 'buttermilk', 'whey', 'casein', 'lactose', 'ghee'],
    egg: ['egg', 'omelet', 'omelette', 'quiche', 'frittata', 'mayo', 'mayonnaise', 'aioli'],
    nuts: ['nut', 'cashew', 'almond', 'pecan', 'walnut', 'pistachio', 'hazelnut', 'macadamia'],
    peanut: ['peanut', 'kung pao', 'satay'],
    mushroom: ['mushroom', 'portobello', 'shiitake', 'cremini'],
    spicy: ['spicy', 'jalapeno', 'habanero', 'buffalo', 'sriracha', 'cajun', 'kung pao', 'chipotle', 'ghost pepper', 'nashville'],
    soy: ['soy', 'tofu', 'edamame', 'tempeh', 'miso'],
    gluten: ['gluten', 'wheat', 'bread', 'pasta', 'bun', 'tortilla', 'pizza', 'breaded', 'noodle'],
  };
  const ALIAS = { meat: ['beef', 'pork', 'chicken', 'turkey', 'lamb'], poultry: ['chicken', 'turkey'], seafood: ['fish', 'shellfish'], milk: ['dairy'], eggs: ['egg'], 'tree nuts': ['nuts'], 'tree nut': ['nuts'], nut: ['nuts'], peanuts: ['peanut'], wheat: ['gluten'], mushrooms: ['mushroom'], 'red meat': ['beef', 'pork', 'lamb'] };
  const ALLERGEN = { dairy: 'Milk', egg: 'Eggs', fish: 'Fish', shellfish: 'Shellfish', nuts: 'Tree Nuts', peanut: 'Peanuts', soy: 'Soy', gluten: 'Gluten', sesame: 'Sesame', coconut: 'Coconut' };
  const MEAT = new Set(['beef', 'pork', 'chicken', 'turkey', 'lamb', 'fish', 'shellfish']);

  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, ' ');
  const groupsOf = (term) => {
    const t = norm(term);
    if (ALIAS[t]) return ALIAS[t];
    if (GROUPS[t] || ALLERGEN[t]) return [t];
    const single = t.replace(/s$/, '');
    if (GROUPS[single] || ALLERGEN[single]) return [single];
    return [];
  };
  // Everything one blocked word stands for, for the settings page.
  function expand(term) {
    const groups = groupsOf(term);
    const foods = new Set(groups.length ? groups.flatMap((g) => GROUPS[g] || [g]) : [norm(term)]);
    return { foods: [...foods], allergens: groups.map((g) => ALLERGEN[g]).filter(Boolean), meat: groups.some((g) => MEAT.has(g)) };
  }
  // A food word that means something else next to these: a Chicken Burger is not beef.
  const UNLESS = { burger: /\b(chicken|turkey|salmon|fish|tuna|bean|veggie|portobello|mushroom|quinoa)\b/ };
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Whole words, plurals allowed: "ham" blocks "Ham" and "Hams", not "Hamburger" (beef does that).
  const wordRe = (food) => new RegExp(`(^|[^a-z])${escape(food).replace(/ /g, '[\\s-]+')}(s|es)?([^a-z]|$)`);
  const MEATLESS = /\b(vegan|vegetarian|veggie|impossible|beyond|plant[- ]based|meatless|tofu)\b/;
  const CARRIER = /\b(bun|buns|roll|rolls|toppings?|toppers)$/; // "Hamburger Bun", "Hot Dog Toppings": no meat in them

  // A matcher for a list of blocked words: item -> the blocked word it hit, or null.
  // Text to match against: "Peanut Butter" and "Cocoa Butter" are not dairy butter, "Cream of
  // Tartar" is not cream.
  const plain = (s) => norm(s).replace(/\b(peanut|cocoa|apple|almond|cashew|sunflower|seed|nut|shea|soy|pumpkin)\s+butter\b/g, '$1').replace(/\bcream of tartar\b/g, 'tartar');
  // An item the filter could only judge by its name: Purdue lists no ingredients for it.
  const unlisted = (item) => !(item.Components && item.Components.length) && !String(item.Ingredients || '').trim();

  function blocker(terms) {
    const rules = terms.map((t) => {
      const e = expand(t);
      return { term: t, res: e.foods.map((f) => ({ re: wordRe(f), unless: UNLESS[f] })), allergens: e.allergens, meat: e.meat };
    });
    // Checks Purdue's allergen marks, then the name, then the ingredient list. The answer is the
    // blocked word, with ", in ingredients" when only the ingredient list gave it away.
    return (item) => {
      const name = plain(item.Name || '');
      const ingredients = plain(item.Ingredients || '');
      const flags = new Set((item.Allergens || []).filter((a) => a.Value).map((a) => a.Name));
      const meatless = MEATLESS.test(name) || CARRIER.test(name) || flags.has('Vegan') || flags.has('Vegetarian') || item.IsVegetarian;
      for (const r of rules) {
        if (r.allergens.some((a) => flags.has(a))) return r.term;
        // "Veggie Burger" is not beef by its name; its ingredient list is still checked.
        if (!(r.meat && meatless) && r.res.some(({ re, unless }) => re.test(name) && !(unless && unless.test(name)))) return r.term;
        // Words with an exception ("burger" unless chicken …) need the dish's name to judge, so
        // they are not looked for in ingredient lists.
        if (ingredients && r.res.some(({ re, unless }) => !unless && re.test(ingredients))) return `${r.term}, in ingredients`;
      }
      return null;
    };
  }

  const vegetarian = (item) => Boolean(item.IsVegetarian) || (item.Allergens || []).some((a) => a.Value && (a.Name === 'Vegetarian' || a.Name === 'Vegan'));
  const vegan = (item) => (item.Allergens || []).some((a) => a.Value && a.Name === 'Vegan');

  return { courts, day, dayOnce, namesOnce, shape, dishes, favKey, clear, kindOf, isMain, compact, partGroups, unlisted, SKIP_STATIONS, expand, blocker, vegetarian, vegan };
})();
