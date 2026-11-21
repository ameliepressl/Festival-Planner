// Festival Architect — the vendor library: a large catalogue of (fictional) food and drink stands,
// each with a menu. The 24 original vendors stay in rules/vendor-rules.js (VENDORS); these are extra
// stands the team can pick from. Only data and calculations live here, so they can be tested (tests/).
//
// Every stand type has a dish photo from Wikipedia (freely licensed Wikimedia Commons image of the
// dish, e.g. "Taco"), a few fictional stand names and a menu. Prices are fictional festival prices.
// Menus use the shorthand of menuFrom() in rules/vendor-rules.js ('Item|price|tags'), so that file
// must be loaded first. In the tests (Node) it is required instead.

const libraryRules = typeof module !== 'undefined' && typeof require === 'function' ? require('./vendor-rules.js') : { menuFrom };

const VENDOR_TYPES = [
  // ——— Food ———
  { cuisine: 'Burgers', category: 'Food', icon: '🍔', photo: 'Hamburger', fee: 1150, text: 'Smashed burgers with crispy fries.',
    names: ['Patty Wagon', 'Double Stack', 'Brioche & Beef', 'Grill Sergeant'],
    menu: ['Classic cheeseburger|11|', 'Veggie halloumi burger|10.5|v', 'Vegan smash burger|11.5|vg,v', 'Fries|4.5|vg,v,gf', 'Sweet potato fries|5.5|vg,v,gf'] },
  { cuisine: 'Tacos', category: 'Food', icon: '🌮', photo: 'Taco', fee: 900, text: 'Soft corn tacos, salsas and guacamole.',
    names: ['Taco Libre', 'La Tortilla Loca', 'Salsa Sisters', 'El Camión'],
    menu: ['Carnitas tacos (3)|10|gf', 'Chicken tinga tacos (3)|9.5|gf', 'Jackfruit tacos (3)|9.5|vg,v,gf', 'Nachos with guacamole|7|vg,v,gf', 'Churro bites|4|v'] },
  { cuisine: 'Pizza', category: 'Food', icon: '🍕', photo: 'Pizza', fee: 1000, text: 'Wood-fired pizza by the slice or whole.',
    names: ['Dough Bros', 'Napoli Express', 'Slice Society', 'Fire & Flour'],
    menu: ['Margherita slice|5|v', 'Pepperoni slice|5.5|', 'Vegan marinara slice|5|vg,v', 'Whole margherita|13|v', 'Gluten-free margherita|14|v,gf'] },
  { cuisine: 'Ramen', category: 'Food', icon: '🍜', photo: 'Ramen', fee: 950, text: 'Steaming bowls of ramen with rich broths.',
    names: ['Slurp Station', 'Broth Theory', 'Noodle Nomads', 'Umami Van'],
    menu: ['Tonkotsu ramen|12.5|', 'Miso vegetable ramen|11.5|vg,v', 'Spicy chicken ramen|12|', 'Gyoza (5)|6|', 'Edamame|4|vg,v,gf'] },
  { cuisine: 'Sushi & poke', category: 'Food', icon: '🍣', photo: 'Poke (dish)', fee: 1050, text: 'Fresh poke bowls and sushi rolls.',
    names: ['Poke Paradise', 'Maki Mobile', 'Rice & Shine', 'Wave Bowl'],
    menu: ['Salmon poke bowl|13|gf', 'Tofu poke bowl|11.5|vg,v,gf', 'California roll (8)|9|', 'Avocado maki (8)|7.5|vg,v,gf', 'Miso soup|3.5|vg,v'] },
  { cuisine: 'Falafel', category: 'Food', icon: '🧆', photo: 'Falafel', fee: 750, text: 'Crispy falafel, hummus and fresh pita.',
    names: ['Chickpea Champs', 'Pita Pit Stop', 'Hummus Hut', 'Sesame Street Food'],
    menu: ['Falafel wrap|8.5|vg,v', 'Falafel plate with hummus|10|vg,v,gf', 'Halloumi wrap|9|v', 'Hummus & pita|5.5|vg,v', 'Baklava|3.5|v'] },
  { cuisine: 'Portuguese sandwiches', category: 'Food', icon: '🥪', photo: 'Bifana', fee: 850, text: 'Marinated pork bifanas, the Lisbon classic.',
    names: ['Bifana da Esquina', 'Pão & Porco', 'Tasca Móvel', 'O Bifaneiro'],
    menu: ['Bifana|6|', 'Prego (steak roll)|8|', 'Mushroom bifana|6|vg,v', 'Caldo verde soup|4.5|gf', 'Batatas fritas|3.5|vg,v,gf'] },
  { cuisine: 'Francesinha', category: 'Food', icon: '🥘', photo: 'Francesinha', fee: 1000, text: 'The famous Porto sandwich drowned in beer sauce.',
    names: ['Porto Sauce Co.', 'Francesinha Factory', 'Molho Mágico', 'Ribeira Kitchen'],
    menu: ['Francesinha with fries|14|', 'Veggie francesinha|13|v', 'Fries with sauce|5|v', 'Bifana|6|'] },
  { cuisine: 'Pastries', category: 'Food', icon: '🥧', photo: 'Pastel de nata', fee: 550, text: 'Warm pastéis de nata and Portuguese sweets.',
    names: ['Nata Nata', 'Canela Doce', 'Forno da Avó', 'Sweet Belém'],
    menu: ['Pastel de nata|1.8|v', 'Box of 6 natas|9.5|v', 'Bola de Berlim|3|v', 'Vegan nata|2.2|vg,v', 'Galão|2.5|v,gf'] },
  { cuisine: 'BBQ', category: 'Food', icon: '🍖', photo: 'Barbecue', fee: 1300, text: 'Low and slow smoked meats.',
    names: ['Smokestack BBQ', 'Pitmaster Pete', 'Brisket Brothers', 'Charcoal & Co.'],
    menu: ['Pulled pork bun|11|', 'Smoked brisket plate|15|gf', 'BBQ jackfruit bun|10|vg,v', 'Corn on the cob|4|v,gf', 'Coleslaw|3|v,gf'] },
  { cuisine: 'Curry', category: 'Food', icon: '🍛', photo: 'Curry', fee: 900, text: 'Aromatic curries with rice and naan.',
    names: ['Curry On', 'Spice Route', 'Masala Mobile', 'Tikka Truck'],
    menu: ['Chicken tikka masala|11|gf', 'Chana masala|9.5|vg,v,gf', 'Vegetable korma|10|v,gf', 'Garlic naan|3|v', 'Mango lassi|4|v,gf'] },
  { cuisine: 'Ice cream', category: 'Food', icon: '🍦', photo: 'Gelato', fee: 600, text: 'Italian gelato and fruity sorbets.',
    names: ['Scoop Dreams', 'Gelato Galaxy', 'Frozen Fiesta', 'Cone Zone'],
    menu: ['Gelato, 2 scoops|4.5|v,gf', 'Sorbet, 2 scoops|4.5|vg,v,gf', 'Affogato|5|v,gf', 'Waffle cone extra|1|v'] },
  { cuisine: 'Churros', category: 'Food', icon: '🍩', photo: 'Churro', fee: 500, text: 'Churros straight from the fryer.',
    names: ['Churro Champion', 'Sugar Rush', 'Dulce Churros', 'Twist & Dip'],
    menu: ['Churros (6) with chocolate|6|vg,v', 'Churros with dulce de leche|6.5|v', 'Cinnamon sugar churros|5|vg,v', 'Hot chocolate|3.5|v'] },
  { cuisine: 'Crêpes', category: 'Food', icon: '🥞', photo: 'Crêpe', fee: 600, text: 'Sweet crêpes and savoury galettes.',
    names: ['Crêpe Expectations', 'La Galette', 'Flip & Fold', 'Le Petit Crêpier'],
    menu: ['Nutella crêpe|6|v', 'Lemon & sugar crêpe|5|v', 'Ham & cheese galette|8|gf', 'Spinach & goat cheese galette|8|v,gf', 'Vegan banana crêpe|6.5|vg,v'] },
  { cuisine: 'Bánh mì', category: 'Food', icon: '🥖', photo: 'Bánh mì', fee: 800, text: 'Vietnamese baguettes with pickles and herbs.',
    names: ['Saigon Street', 'Banh Mi Boys', 'Pickle & Pâté', 'Lemongrass Lane'],
    menu: ['Pork bánh mì|9|', 'Lemongrass chicken bánh mì|9|', 'Tofu bánh mì|8.5|vg,v', 'Summer rolls (2)|6|vg,v,gf', 'Vietnamese iced coffee|4|v,gf'] },
  { cuisine: 'Dumplings', category: 'Food', icon: '🥟', photo: 'Dumpling', fee: 850, text: 'Handmade dumplings, steamed or fried.',
    names: ['Dumpling Dynasty', 'Wrap Stars', 'Little Parcels', 'Steam Team'],
    menu: ['Pork dumplings (8)|9|', 'Vegetable dumplings (8)|8.5|vg,v', 'Chicken gyoza (6)|8|', 'Chili oil noodles|8|vg,v', 'Sesame cucumber|3.5|vg,v,gf'] },
  { cuisine: 'Bao', category: 'Food', icon: '🫓', photo: 'Gua bao', fee: 850, text: 'Fluffy steamed bao buns.',
    names: ['Bao Wow', 'Fluffy Buns', 'Bao Down', 'Cloud Kitchen'],
    menu: ['Pork belly bao (2)|10|', 'Fried chicken bao (2)|9.5|', 'Crispy tofu bao (2)|9|vg,v', 'Kimchi fries|6|vg,v'] },
  { cuisine: 'Arepas', category: 'Food', icon: '🫓', photo: 'Arepa', fee: 750, text: 'Venezuelan corn arepas, naturally gluten-free.',
    names: ['Arepa Republic', 'Maíz Mobile', 'Caracas Corner', 'Golden Corn'],
    menu: ['Reina pepiada arepa|9|gf', 'Shredded beef arepa|9.5|gf', 'Black bean & plantain arepa|8.5|vg,v,gf', 'Cheese arepa|7|v,gf', 'Tequeños (4)|6|v'] },
  { cuisine: 'Empanadas', category: 'Food', icon: '🥟', photo: 'Empanada', fee: 700, text: 'Baked Argentinian empanadas.',
    names: ['Empanada Mama', 'Pampa Pockets', 'Crimp & Bake', 'Buenos Bites'],
    menu: ['Beef empanada|4|', 'Chicken empanada|4|', 'Spinach & cheese empanada|4|v', 'Vegan lentil empanada|4|vg,v', '3 empanadas deal|11|'] },
  { cuisine: 'Hot dogs', category: 'Food', icon: '🌭', photo: 'Hot dog', fee: 800, text: 'Gourmet hot dogs with crispy onions.',
    names: ['Top Dog', 'Frank & Furter', 'Bun Intended', 'Hound Town'],
    menu: ['Classic hot dog|7|', 'Chili cheese dog|8.5|', 'Vegan sausage dog|7.5|vg,v', 'Loaded fries|6|v'] },
  { cuisine: 'Fish & chips', category: 'Food', icon: '🐟', photo: 'Fish and chips', fee: 950, text: 'Beer-battered fish with chunky chips.',
    names: ['The Codfather', 'Batter Up', 'Salt & Vinegar', 'Atlantic Fry'],
    menu: ['Fish & chips|13|', 'Gluten-free fish & chips|14|gf', 'Battered halloumi & chips|11|v', 'Mushy peas|3|vg,v,gf', 'Chips|4.5|vg,v,gf'] },
  { cuisine: 'Paella', category: 'Food', icon: '🥘', photo: 'Paella', fee: 1000, text: 'Giant pans of paella cooked on site.',
    names: ['Paella Party', 'Arroz & Amigos', 'Big Pan Valencia', 'Saffron Stories'],
    menu: ['Seafood paella|13|gf', 'Chicken paella|12|gf', 'Vegetable paella|11|vg,v,gf', 'Patatas bravas|5.5|vg,v,gf'] },
  { cuisine: 'Kebab', category: 'Food', icon: '🥙', photo: 'Kebab', fee: 900, text: 'Grilled kebabs in fresh flatbread.',
    names: ['Kebab Kingdom', 'Skewer Squad', 'Döner Deluxe', 'Grill of Istanbul'],
    menu: ['Chicken döner wrap|9|', 'Lamb shish plate|13|gf', 'Halloumi skewer wrap|9|v', 'Falafel döner|8.5|vg,v', 'Garlic sauce fries|5|v,gf'] },
  { cuisine: 'Fried chicken', category: 'Food', icon: '🍗', photo: 'Fried chicken', fee: 1000, text: 'Crunchy fried chicken and dips.',
    names: ['Cluck Norris', 'Crispy Coop', 'Wing It', 'Buttermilk & Co.'],
    menu: ['Fried chicken bucket|12|', 'Chicken burger|10.5|', 'Cauliflower wings|8.5|vg,v', 'Mac & cheese|6|v', 'Fries|4.5|vg,v,gf'] },
  { cuisine: 'Waffles', category: 'Food', icon: '🧇', photo: 'Waffle', fee: 550, text: 'Belgian waffles with sweet toppings.',
    names: ['Waffle Wagon', 'Grid Iron Sweets', 'Liège Lounge', 'Syrup Stop'],
    menu: ['Waffle with chocolate|5.5|v', 'Waffle with strawberries & cream|6.5|v', 'Vegan waffle with berries|6|vg,v', 'Bubble waffle|6|v'] },
  { cuisine: 'Pierogi', category: 'Food', icon: '🥟', photo: 'Pierogi', fee: 750, text: 'Polish dumplings, boiled and pan-fried.',
    names: ['Pierogi Palace', 'Babcia’s Kitchen', 'Krakow Corner', 'Dough Joy'],
    menu: ['Potato & cheese pierogi (6)|8.5|v', 'Meat pierogi (6)|9|', 'Mushroom & cabbage pierogi (6)|8.5|vg,v', 'Beetroot soup|4|vg,v,gf'] },
  { cuisine: 'Bowls', category: 'Food', icon: '🥗', photo: 'Buddha bowl', fee: 800, text: 'Colourful grain bowls and salads.',
    names: ['Bowl Model', 'Grain Train', 'Leaf It Out', 'Rainbow Bowls'],
    menu: ['Buddha bowl|10.5|vg,v,gf', 'Chicken quinoa bowl|11|gf', 'Halloumi salad|10|v,gf', 'Açaí bowl|8|vg,v,gf', 'Fresh fruit cup|4|vg,v,gf'] },
  { cuisine: 'Sushi', category: 'Food', icon: '🍱', photo: 'Sushi', fee: 1050, text: 'Nigiri and maki made to order.',
    names: ['Sushi Surf', 'Nori Nori', 'Wasabi Wheels', 'Tokyo Tent'],
    menu: ['Salmon nigiri (6)|11|gf', 'Mixed maki box (12)|13|', 'Veggie maki box (12)|11|vg,v,gf', 'Seaweed salad|5|vg,v'] },
  // ——— Drinks ———
  { cuisine: 'Craft beer', category: 'Drinks', icon: '🍺', photo: 'Beer', fee: 1450, text: 'Local craft beer on tap.',
    names: ['Hop Culture', 'Tap Tap Lisboa', 'Barrel Brothers', 'Foam Party Brewing'],
    menu: ['Lager (0.4 l)|4.5|a', 'IPA (0.4 l)|5.5|a', 'Wheat beer (0.4 l)|5|a', 'Alcohol-free beer|4|af', 'Lemon shandy|4.5|a'] },
  { cuisine: 'Cocktails', category: 'Drinks', icon: '🍹', photo: 'Cocktail', fee: 1400, text: 'Cocktails, spritzes and mocktails.',
    names: ['Shaken Not Stirred', 'Golden Hour Bar', 'Tiki Tent', 'The Mixing Lab'],
    menu: ['Aperol spritz|8|a', 'Caipirinha|8|a', 'Espresso martini|9|a', 'Virgin mojito|5.5|af', 'Passion fruit mocktail|5.5|af'] },
  { cuisine: 'Mojitos', category: 'Drinks', icon: '🌿', photo: 'Mojito', fee: 1250, text: 'Fresh mint mojitos and Cuban classics.',
    names: ['Mint Condition', 'Havana Nights', 'Lime & Leaf', 'Rum Runners'],
    menu: ['Classic mojito|8|a', 'Strawberry mojito|8.5|a', 'Cuba libre|7.5|a', 'Virgin mojito|5|af'] },
  { cuisine: 'Gin & tonic', category: 'Drinks', icon: '🍸', photo: 'Gin and tonic', fee: 1300, text: 'Gin bar with Portuguese and craft gins.',
    names: ['Juniper Junction', 'Tonic Temple', 'The Gin Garden', 'Botanical Bar'],
    menu: ['Classic gin & tonic|9|a', 'Pink gin & tonic|9.5|a', 'Portuguese gin & tonic|10|a', 'Alcohol-free G&T|6|af'] },
  { cuisine: 'Wine', category: 'Drinks', icon: '🍷', photo: 'Vinho verde', fee: 1200, text: 'Portuguese wines by the glass.',
    names: ['Vinho & Vibes', 'Grape Escape', 'Adega Móvel', 'Douro Deck'],
    menu: ['Vinho verde (glass)|5|a', 'Red Douro wine (glass)|5.5|a', 'Rosé (glass)|5|a', 'Bottle of vinho verde|18|a', 'Grape juice|3|af'] },
  { cuisine: 'Sangria', category: 'Drinks', icon: '🍷', photo: 'Sangria', fee: 1150, text: 'Big jugs of fruity sangria.',
    names: ['Sangria Sunset', 'Fruit Punch Club', 'La Jarra', 'Red Summer'],
    menu: ['Red sangria (glass)|6|a', 'White sangria (glass)|6|a', 'Sangria jug (1 l)|20|a', 'Alcohol-free sangria|4.5|af'] },
  { cuisine: 'Port wine', category: 'Drinks', icon: '🥃', photo: 'Port wine', fee: 1100, text: 'Port tonic and port tastings.',
    names: ['Porto Tónico', 'Ruby & Tawny', 'Cais do Vinho', 'Fortified Friends'],
    menu: ['Port tonic|7|a', 'Tawny port (glass)|5|a', 'Ruby port (glass)|4.5|a', 'Tonic water|2.5|af'] },
  { cuisine: 'Cider', category: 'Drinks', icon: '🍏', photo: 'Cider', fee: 1150, text: 'Crisp apple and pear ciders.',
    names: ['Orchard Edge', 'Cider House Rules', 'Apple Jack’s', 'Pear Pressure'],
    menu: ['Apple cider (0.4 l)|5.5|a', 'Pear cider (0.4 l)|5.5|a', 'Berry cider (0.4 l)|6|a', 'Sparkling apple juice|3.5|af'] },
  { cuisine: 'Coffee', category: 'Drinks', icon: '☕', photo: 'Espresso', fee: 700, text: 'Espresso bar with oat and soy milk.',
    names: ['Daily Grind', 'Brew Crew', 'Espresso Yourself', 'Bica Bar'],
    menu: ['Espresso (bica)|1.5|vg,af', 'Cappuccino|3|v,af', 'Oat flat white|3.5|vg,af', 'Iced latte|4|v,af', 'Chai latte|3.8|v,af'] },
  { cuisine: 'Lemonade', category: 'Drinks', icon: '🍋', photo: 'Lemonade', fee: 500, text: 'Freshly squeezed lemonades.',
    names: ['Squeeze the Day', 'Lemon Aid', 'Citrus Circus', 'Zest Fest'],
    menu: ['Classic lemonade|4|vg,af', 'Pink lemonade|4.5|vg,af', 'Ginger mint lemonade|4.5|vg,af', 'Spiked lemonade|7|a'] },
  { cuisine: 'Smoothies', category: 'Drinks', icon: '🥤', photo: 'Smoothie', fee: 600, text: 'Fruit smoothies and fresh juices.',
    names: ['Blend It', 'Fruit Loop', 'Tropical Twist', 'Green Machine'],
    menu: ['Mango smoothie|5.5|vg,af', 'Berry blast smoothie|5.5|vg,af', 'Green detox smoothie|6|vg,af', 'Fresh orange juice|4|vg,af'] },
  { cuisine: 'Iced tea', category: 'Drinks', icon: '🧊', photo: 'Iced tea', fee: 500, text: 'Home-brewed iced teas.',
    names: ['Chill Brew', 'Tea Party', 'Steep & Ice', 'Peachy Keen'],
    menu: ['Peach iced tea|3.5|vg,af', 'Lemon green tea|3.5|vg,af', 'Hibiscus iced tea|4|vg,af', 'Tea & rum punch|7|a'] },
  { cuisine: 'Bubble tea', category: 'Drinks', icon: '🧋', photo: 'Bubble tea', fee: 650, text: 'Bubble tea with chewy tapioca pearls.',
    names: ['Pearl Jam', 'Boba Fête', 'Tapioca Town', 'Bubble Trouble'],
    menu: ['Milk tea with pearls|5|v,af', 'Taro milk tea|5.5|v,af', 'Mango fruit tea|5|vg,af', 'Matcha oat latte|5.5|vg,af'] },
  { cuisine: 'Kombucha', category: 'Drinks', icon: '🧃', photo: 'Kombucha', fee: 450, text: 'Craft kombucha and soft drinks.',
    names: ['Booch Bar', 'Ferment Fest', 'SCOBY Doo', 'Fizz Lab'],
    menu: ['Ginger kombucha|4.5|vg,af', 'Berry kombucha|4.5|vg,af', 'Ginger beer|3.5|vg,af', 'Craft cola|3|vg,af'] },
  { cuisine: 'Sake', category: 'Drinks', icon: '🍶', photo: 'Sake', fee: 1100, text: 'Japanese sake and highballs.',
    names: ['Sake Bomb Bar', 'Rising Sun Sips', 'Kanpai Kiosk', 'Rice Wine Room'],
    menu: ['Cold sake (glass)|6|a', 'Yuzu highball|8|a', 'Plum wine|5.5|a', 'Yuzu soda|4|af'] }
];

// A small, fixed number from a text (the same text always gives the same number).
function vendorHash(text) {
  let h = 2166136261;
  for (const ch of text) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function vendorSlug(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// The menu of one stand. Every stand gets slightly different prices (± €0.50 on items from €4),
// so stands of the same kind do not all look the same.
function standMenu(lines, standName) {
  return libraryRules.menuFrom(lines).map((m) => {
    const shift = m.price >= 4 ? ((vendorHash(standName + m.item) % 3) - 1) * 0.5 : 0;
    return { ...m, price: m.price + shift };
  });
}

// The stand's tags follow from its menu, using the same words as the original vendors
// (so the "visitor needs" check in vendor-rules.js works for every stand).
function tagsFromMenu(menu, category) {
  const has = (tag) => menu.some((m) => m.tags.includes(tag));
  const tags = [];
  if (has('vegan')) tags.push('vegan');
  if (has('vegetarian')) tags.push('vegetarian');
  if (has('gluten-free')) tags.push('gluten-free');
  if (category === 'Drinks' && has('alcohol')) tags.push('alcohol');
  if (category === 'Drinks' && has('alcohol-free')) tags.push('alcohol-free');
  return tags;
}

const VENDOR_LIBRARY = VENDOR_TYPES.flatMap((type) => type.names.map((name) => {
  const menu = standMenu(type.menu, name);
  return {
    id: `v-${vendorSlug(name)}`, name, category: type.category, cuisine: type.cuisine, icon: type.icon,
    photo: type.photo, fee: type.fee + ((vendorHash(name) % 7) - 3) * 50,
    tags: tagsFromMenu(menu, type.category), text: type.text, menu
  };
}));

if (typeof module !== 'undefined') {
  module.exports = { VENDOR_TYPES, VENDOR_LIBRARY, standMenu, tagsFromMenu, vendorSlug };
}
