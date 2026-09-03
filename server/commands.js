const store = require('./store');
const world = require('./world');

const RANK = { player: 0, admin: 1, manager: 2, owner: 3 };

const SHOP_ITEMS = {
  acorn_key: { label: 'Acorn Key', price: 50, buyAs: 'key' },
  husk_lantern: { label: 'Husk Lantern', price: 75, buyAs: 'lantern' },
  totem: { label: 'Totem of Undying', price: 1000, buyAs: 'totem' },
};
const ITEM_ALIASES = {
  key: 'acorn_key', acorn_key: 'acorn_key',
  lantern: 'husk_lantern', husk_lantern: 'husk_lantern',
  totem: 'totem', 'totem_of_undying': 'totem',
};

function resolveItem(name) {
  if (!name) return null;
  return ITEM_ALIASES[name.toLowerCase()] || null;
}

function itemLabel(itemId) {
  return SHOP_ITEMS[itemId] ? SHOP_ITEMS[itemId].label : itemId;
}

function parseDuration(str) {
  const m = /^(\d+)(s|m|h|d)$/i.exec(str.trim());
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit];
  return n * mult;
}

function formatDuration(ms) {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.ceil(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.ceil(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.ceil(h / 24)}d`;
}

function kickOnlineUser(username, reason) {
  const p = world.findOnlineByName(username);
  if (p) {
    world.sendTo(p.id, { type: 'kicked', reason });
    p.ws.close();
  }
}

// ctx: { player: online-registry entry for the command sender, send(msg) helper }
function handleCommand(ctx, rawText) {
  const send = (text) => ctx.send({ type: 'system', text });
  const parts = rawText.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const actor = ctx.player;
  const actorRank = RANK[actor.role] ?? 0;
  // actor's own account, for balance/inventory - always read fresh, never cached on the online entry.
  const actorUser = () => store.findByUsername(actor.username);

  if (cmd === '/help') {
    const lines = [
      '/tpa <player> - request to teleport to a player',
      '/tpaccept, /tpdeny - respond to a teleport request',
      '/shop - see what gold buys, /shop buy <key|lantern|totem>',
      '/list <key|lantern|totem> <price> - list an item on the auction house',
      '/ah - browse listings, /ah buy <id>, /ah cancel <id>',
    ];
    if (actorRank >= RANK.admin) {
      lines.push(
        '/tp <player> - teleport straight to a player',
        '/eco give <player> <amount> - give gold',
        '/eco take <player> <amount> - take gold (never below 0)',
        '/ban <player> [reason] - ban a player',
        '/tempban <player> <time e.g. 10m/2h/1d> [reason] - temporarily ban',
        '/pardon <player> - remove a ban'
      );
    }
    if (actorRank >= RANK.owner) {
      lines.push('/op <player> [manager] - grant admin, or manager', '/deop <player> - revoke admin/manager');
    }
    return send(lines.join('\n'));
  }

  if (cmd === '/tpa') {
    const targetName = parts[1];
    if (!targetName) return send('Usage: /tpa <player>');
    if (targetName.toLowerCase() === actor.username.toLowerCase()) return send("You can't teleport to yourself.");
    const target = world.findOnlineByName(targetName);
    if (!target) return send(`${targetName} is not online.`);
    world.pendingTpa.set(target.username.toLowerCase(), {
      fromId: actor.id,
      fromUsername: actor.username,
      expiresAt: Date.now() + 60000,
    });
    world.sendTo(target.id, { type: 'tpaRequest', from: actor.username });
    send(`Teleport request sent to ${target.username}. It expires in 60s.`);
    return;
  }

  if (cmd === '/tpaccept' || cmd === '/tpdeny') {
    const req = world.pendingTpa.get(actor.username.toLowerCase());
    if (!req || req.expiresAt < Date.now()) {
      world.pendingTpa.delete(actor.username.toLowerCase());
      return send('You have no pending teleport request.');
    }
    world.pendingTpa.delete(actor.username.toLowerCase());
    const requester = world.online.get(req.fromId);
    if (!requester) return send(`${req.fromUsername} is no longer online.`);
    if (cmd === '/tpdeny') {
      world.sendTo(requester.id, { type: 'system', text: `${actor.username} denied your teleport request.` });
      return send(`Denied ${req.fromUsername}'s request.`);
    }
    const sameMap = requester.map === actor.map;
    world.changeMap(requester, actor.map, actor.x, actor.y);
    world.sendTo(requester.id, sameMap
      ? { type: 'teleport', x: actor.x, y: actor.y }
      : { type: 'mapChanged', map: actor.map, x: actor.x, y: actor.y, players: world.playersInMap(actor.map, requester.id) });
    world.sendTo(requester.id, { type: 'system', text: `${actor.username} accepted your teleport request.` });
    send(`Teleported ${req.fromUsername} to you.`);
    return;
  }

  if (cmd === '/tp') {
    if (actorRank < RANK.admin) return send('You do not have permission to use /tp.');
    const targetName = parts[1];
    if (!targetName) return send('Usage: /tp <player>');
    const target = world.findOnlineByName(targetName);
    if (!target) return send(`${targetName} is not online.`);
    const sameMap = actor.map === target.map;
    world.changeMap(actor, target.map, target.x, target.y);
    ctx.send(sameMap
      ? { type: 'teleport', x: target.x, y: target.y }
      : { type: 'mapChanged', map: target.map, x: target.x, y: target.y, players: world.playersInMap(target.map, actor.id) });
    send(`Teleported to ${target.username}.`);
    return;
  }

  if (cmd === '/op' || cmd === '/deop') {
    if (actorRank < RANK.owner) return send('Only the owner can use this command.');
    const targetName = parts[1];
    if (!targetName) return send(`Usage: ${cmd} <player>${cmd === '/op' ? ' [manager]' : ''}`);
    const user = store.findByUsername(targetName);
    if (!user) return send(`No such player: ${targetName}`);
    if (user.role === 'owner') return send("The owner's role can't be changed.");

    if (cmd === '/op') {
      const wantsManager = (parts[2] || '').toLowerCase() === 'manager';
      user.role = wantsManager ? 'manager' : 'admin';
    } else {
      user.role = 'player';
    }
    store.saveUser(user);
    const onlineTarget = world.findOnlineByName(targetName);
    if (onlineTarget) {
      onlineTarget.role = user.role;
      world.sendTo(onlineTarget.id, { type: 'roleUpdate', role: user.role });
      world.broadcast({ type: 'playerUpdate', id: onlineTarget.id, role: user.role });
    }
    send(cmd === '/op' ? `${user.username} is now ${user.role === 'manager' ? 'a manager' : 'an admin'}.` : `${user.username} is no longer staff.`);
    return;
  }

  if (cmd === '/eco') {
    if (actorRank < RANK.admin) return send('You do not have permission to use /eco.');
    const sub = (parts[1] || '').toLowerCase();
    const targetName = parts[2];
    const amount = parseInt(parts[3], 10);
    if (!['give', 'take'].includes(sub) || !targetName || !Number.isInteger(amount) || amount <= 0) {
      return send('Usage: /eco give <player> <amount>  or  /eco take <player> <amount>');
    }
    const user = store.findByUsername(targetName);
    if (!user) return send(`No such player: ${targetName}`);

    if (sub === 'give') {
      user.balance += amount;
      store.saveUser(user);
      send(`Gave ${amount}g to ${user.username}. New balance: ${user.balance}g.`);
    } else {
      const taken = Math.min(amount, user.balance);
      user.balance -= taken;
      store.saveUser(user);
      send(taken < amount
        ? `${user.username} only had ${taken}g - took it all. New balance: 0g.`
        : `Took ${taken}g from ${user.username}. New balance: ${user.balance}g.`);
    }
    const onlineTarget = world.findOnlineByName(targetName);
    if (onlineTarget) world.sendTo(onlineTarget.id, { type: 'system', text: `Your balance is now ${user.balance}g.` });
    return;
  }

  if (cmd === '/shop') {
    if (!parts[1]) {
      const balance = actorUser().balance;
      const lines = Object.entries(SHOP_ITEMS).map(([id, item]) => `${item.label} - ${item.price}g  (/shop buy ${item.buyAs})`);
      lines.push(`Your balance: ${balance}g`);
      return send(lines.join('\n'));
    }
    if (parts[1].toLowerCase() !== 'buy') return send('Usage: /shop  or  /shop buy <key|lantern|totem>');
    const itemId = resolveItem(parts[2]);
    if (!itemId) return send('Usage: /shop buy <key|lantern|totem>');
    const user = actorUser();
    const price = SHOP_ITEMS[itemId].price;
    if (user.balance < price) return send(`You need ${price}g for a ${itemLabel(itemId)} - you have ${user.balance}g.`);
    user.balance -= price;
    user.inventory[itemId] += 1;
    store.saveUser(user);
    send(`Bought a ${itemLabel(itemId)} for ${price}g. Balance: ${user.balance}g.`);
    return;
  }

  if (cmd === '/list') {
    const itemId = resolveItem(parts[1]);
    const price = parseInt(parts[2], 10);
    if (!itemId || !Number.isInteger(price) || price <= 0) return send('Usage: /list <key|lantern|totem> <price>');
    const user = actorUser();
    if (user.inventory[itemId] < 1) return send(`You don't have a ${itemLabel(itemId)} to list.`);
    user.inventory[itemId] -= 1;
    store.saveUser(user);
    const listing = { id: store.nextListingId(), seller: user.username, item: itemId, price };
    store.addListing(listing);
    world.broadcast({ type: 'system', text: `${user.username} listed a ${itemLabel(itemId)} for ${price}g! Buy it with /ah buy ${listing.id}` });
    return;
  }

  if (cmd === '/ah') {
    const sub = (parts[1] || '').toLowerCase();
    if (!sub) {
      const listings = store.getListings();
      if (listings.length === 0) return send('The auction house is empty.');
      return send(listings.map(l => `#${l.id} ${itemLabel(l.item)} - ${l.price}g (seller: ${l.seller})`).join('\n'));
    }
    const id = parseInt(parts[2], 10);
    if (!Number.isInteger(id)) return send(`Usage: /ah ${sub === 'cancel' ? 'cancel' : 'buy'} <id>`);
    const listing = store.getListings().find(l => l.id === id);
    if (!listing) return send(`No listing #${id}.`);

    if (sub === 'cancel') {
      if (listing.seller.toLowerCase() !== actor.username.toLowerCase() && actorRank < RANK.admin) {
        return send("You can't cancel someone else's listing.");
      }
      const seller = store.findByUsername(listing.seller);
      if (seller) { seller.inventory[listing.item] += 1; store.saveUser(seller); }
      store.removeListing(id);
      send(`Cancelled listing #${id}. The ${itemLabel(listing.item)} is back in ${listing.seller}'s inventory.`);
      return;
    }

    if (sub === 'buy') {
      if (listing.seller.toLowerCase() === actor.username.toLowerCase()) {
        return send("That's your own listing - use /ah cancel instead.");
      }
      const buyer = actorUser();
      if (buyer.balance < listing.price) return send(`You need ${listing.price}g - you have ${buyer.balance}g.`);
      buyer.balance -= listing.price;
      buyer.inventory[listing.item] += 1;
      store.saveUser(buyer);
      const seller = store.findByUsername(listing.seller);
      if (seller) {
        seller.balance += listing.price;
        store.saveUser(seller);
        const onlineSeller = world.findOnlineByName(listing.seller);
        if (onlineSeller) world.sendTo(onlineSeller.id, { type: 'system', text: `Your ${itemLabel(listing.item)} sold for ${listing.price}g to ${buyer.username}!` });
      }
      store.removeListing(id);
      send(`Bought a ${itemLabel(listing.item)} for ${listing.price}g. Balance: ${buyer.balance}g.`);
      return;
    }

    return send('Usage: /ah, /ah buy <id>, or /ah cancel <id>');
  }

  if (cmd === '/ban' || cmd === '/tempban') {
    if (actorRank < RANK.admin) return send('You do not have permission to use this command.');
    const targetName = parts[1];
    if (!targetName) return send(`Usage: ${cmd} <player>${cmd === '/tempban' ? ' <time>' : ''} [reason]`);
    const user = store.findByUsername(targetName);
    if (!user) return send(`No such player: ${targetName}`);
    if ((RANK[user.role] ?? 0) >= actorRank) return send(`You can't act on ${user.username}.`);

    let until = null;
    let reasonParts = parts.slice(2);
    if (cmd === '/tempban') {
      const durationMs = parseDuration(parts[2] || '');
      if (durationMs === null) return send('Usage: /tempban <player> <time e.g. 10m, 2h, 1d> [reason]');
      until = Date.now() + durationMs;
      reasonParts = parts.slice(3);
    }
    const reason = reasonParts.join(' ') || 'No reason given.';
    user.banned = { until, reason, by: actor.username };
    store.saveUser(user);
    kickOnlineUser(user.username, until
      ? `Temporarily banned for ${formatDuration(until - Date.now())}: ${reason}`
      : `Banned: ${reason}`);
    send(until
      ? `${user.username} was tempbanned for ${formatDuration(until - Date.now())}.`
      : `${user.username} was banned.`);
    return;
  }

  if (cmd === '/pardon') {
    if (actorRank < RANK.admin) return send('You do not have permission to use /pardon.');
    const targetName = parts[1];
    if (!targetName) return send('Usage: /pardon <player>');
    const user = store.findByUsername(targetName);
    if (!user) return send(`No such player: ${targetName}`);
    if ((RANK[user.role] ?? 0) >= actorRank) return send(`You can't act on ${user.username}.`);
    if (!user.banned) return send(`${user.username} is not banned.`);
    user.banned = null;
    store.saveUser(user);
    send(`${user.username} has been pardoned.`);
    return;
  }

  send(`Unknown command: ${cmd}. Try /help.`);
}

module.exports = { handleCommand, parseDuration, formatDuration, RANK, SHOP_ITEMS };
