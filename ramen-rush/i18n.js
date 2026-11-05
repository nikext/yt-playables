/* Ramen Rush: all player-facing strings. {n} {m} = numbers, {x} = a name. */
(function () {
  'use strict';
  var RR = window.RR = window.RR || {};

  var D = {
    en: {
      tag: 'Night-market noodle stall', play: 'Open the stall', cont: 'Continue · Day {n}', fresh: 'New stall', sure: 'Tap again to start over',
      bestDay: 'Best day {n}', earnedAll: '{n} coins earned', day: 'Day {n}', endless: 'Endless night {n}', goal: 'Goal {n}',
      paused: 'Paused', resume: 'Resume', soundOn: 'Sound: On', soundOff: 'Sound: Off', quit: 'Quit to menu', tapCont: 'Tap to continue',
      tut1: 'Tap the noodles to start boiling', tut2: 'Tap the pot with the broth they want', tut3: 'Add the topping from their order',
      tut4: 'Noodles are cooking. Done when the ring is full', tut5: 'Ready! Tap the burner to drain them into the bowl', tut6: 'Drag the bowl to the customer (or tap them)',
      tut7: 'Watch the patience bars. Wrong bowl? Drag it to the bin.',
      closing: 'Last orders!', dayDone: 'Day {n} closed', served: 'Served', lost: 'Lost', tips: 'Tips', streak: 'Best streak', earned: 'Earned',
      goalMet: 'Goal reached!', goalMissed: 'Goal missed. Keep your coins and try again.', rep: 'Reputation', wallet: 'Wallet',
      shop: 'Upgrades', nextDay: 'Open day {n}', retryDay: 'Retry day {n}', owned: 'Owned', max: 'Max', from: 'Day {n}', broke: 'Not enough coins',
      newMenu: 'New on the menu!', vip: 'VIP', wrong: 'Wrong bowl!', gaveUp: 'Gave up waiting', perfect: 'Perfect!', noBurner: 'All burners busy',
      notReady: 'Still cooking', needBase: 'Needs broth and noodles', overcooked: 'Overcooked!', binned: 'Binned', streakN: 'Streak x{n}',
      master: 'Night market master! Endless nights from here.', cont2: 'Next',
      u_slot: 'Counter space', d_slot: '+1 bowl in prep', u_burn: 'Extra burner', d_burn: '+1 batch of noodles at once',
      u_boil: 'Hot stove', d_boil: 'Noodles cook faster', u_deco: 'Lanterns', d_deco: 'Customers wait longer', u_tip: 'Tip jar', d_tip: '+25% tips',
      d_special: 'New orders that pay more',
      i0_0: 'Shoyu broth', i0_1: 'Miso broth', i0_2: 'Tonkotsu broth', i0_3: 'Spicy broth',
      i1_0: 'Thin noodles', i1_1: 'Wavy noodles', i1_2: 'Udon',
      i2_0: 'Egg', i2_1: 'Nori', i2_2: 'Scallion', i2_3: 'Chashu', i2_4: 'Naruto', i2_5: 'Corn', i2_6: 'Mushroom',
      i3_0: 'Green tea', i3_1: 'Soda'
    },
    es: {
      tag: 'Puesto de fideos del mercado nocturno', play: 'Abrir el puesto', cont: 'Continuar · Día {n}', fresh: 'Nuevo puesto', sure: 'Toca otra vez para empezar de cero',
      bestDay: 'Mejor día {n}', earnedAll: '{n} monedas ganadas', day: 'Día {n}', endless: 'Noche sin fin {n}', goal: 'Meta {n}',
      paused: 'Pausa', resume: 'Seguir', soundOn: 'Sonido: sí', soundOff: 'Sonido: no', quit: 'Salir al menú', tapCont: 'Toca para continuar',
      tut1: 'Toca los fideos para ponerlos a hervir', tut2: 'Toca la olla con el caldo que piden', tut3: 'Añade el ingrediente del pedido',
      tut4: 'Los fideos se cuecen. Listos cuando el anillo se llene', tut5: '¡Listos! Toca el fuego para echarlos al bol', tut6: 'Arrastra el bol al cliente (o tócalo)',
      tut7: 'Vigila la paciencia. ¿Bol equivocado? Arrástralo a la basura.',
      closing: '¡Últimos pedidos!', dayDone: 'Día {n} cerrado', served: 'Servidos', lost: 'Perdidos', tips: 'Propinas', streak: 'Mejor racha', earned: 'Ganado',
      goalMet: '¡Meta cumplida!', goalMissed: 'Meta no alcanzada. Te quedas las monedas: inténtalo otra vez.', rep: 'Reputación', wallet: 'Monedero',
      shop: 'Mejoras', nextDay: 'Abrir día {n}', retryDay: 'Repetir día {n}', owned: 'Tuyo', max: 'Máx.', from: 'Día {n}', broke: 'No te alcanza',
      newMenu: '¡Nuevo en el menú!', vip: 'VIP', wrong: '¡Bol equivocado!', gaveUp: 'Se cansó de esperar', perfect: '¡Perfecto!', noBurner: 'Fuegos ocupados',
      notReady: 'Aún se cuecen', needBase: 'Falta caldo y fideos', overcooked: '¡Pasados!', binned: 'A la basura', streakN: 'Racha x{n}',
      master: '¡Maestro del mercado nocturno! Ahora, noches sin fin.', cont2: 'Seguir',
      u_slot: 'Más barra', d_slot: '+1 bol en preparación', u_burn: 'Otro fuego', d_burn: '+1 tanda de fideos a la vez',
      u_boil: 'Fogón potente', d_boil: 'Los fideos se cuecen antes', u_deco: 'Farolillos', d_deco: 'Los clientes esperan más', u_tip: 'Bote de propinas', d_tip: '+25 % de propinas',
      d_special: 'Pedidos nuevos que pagan más',
      i0_0: 'Caldo shoyu', i0_1: 'Caldo miso', i0_2: 'Caldo tonkotsu', i0_3: 'Caldo picante',
      i1_0: 'Fideos finos', i1_1: 'Fideos ondulados', i1_2: 'Udon',
      i2_0: 'Huevo', i2_1: 'Nori', i2_2: 'Cebolleta', i2_3: 'Chashu', i2_4: 'Naruto', i2_5: 'Maíz', i2_6: 'Seta',
      i3_0: 'Té verde', i3_1: 'Refresco'
    },
    pt: {
      tag: 'Barraca de lámen da feira noturna', play: 'Abrir a barraca', cont: 'Continuar · Dia {n}', fresh: 'Nova barraca', sure: 'Toque de novo para recomeçar',
      bestDay: 'Melhor dia {n}', earnedAll: '{n} moedas ganhas', day: 'Dia {n}', endless: 'Noite sem fim {n}', goal: 'Meta {n}',
      paused: 'Pausado', resume: 'Continuar', soundOn: 'Som: ligado', soundOff: 'Som: desligado', quit: 'Sair para o menu', tapCont: 'Toque para continuar',
      tut1: 'Toque no macarrão para começar a cozinhar', tut2: 'Toque na panela com o caldo pedido', tut3: 'Coloque a cobertura do pedido',
      tut4: 'O macarrão está cozinhando. Pronto quando o anel encher', tut5: 'Pronto! Toque no fogão para escorrer no bowl', tut6: 'Arraste o bowl até o cliente (ou toque nele)',
      tut7: 'Fique de olho na paciência. Bowl errado? Arraste para o lixo.',
      closing: 'Últimos pedidos!', dayDone: 'Dia {n} encerrado', served: 'Servidos', lost: 'Perdidos', tips: 'Gorjetas', streak: 'Melhor sequência', earned: 'Ganho',
      goalMet: 'Meta batida!', goalMissed: 'Meta não batida. As moedas ficam com você: tente de novo.', rep: 'Reputação', wallet: 'Carteira',
      shop: 'Melhorias', nextDay: 'Abrir dia {n}', retryDay: 'Repetir dia {n}', owned: 'Seu', max: 'Máx.', from: 'Dia {n}', broke: 'Moedas insuficientes',
      newMenu: 'Novidade no cardápio!', vip: 'VIP', wrong: 'Bowl errado!', gaveUp: 'Cansou de esperar', perfect: 'Perfeito!', noBurner: 'Fogões ocupados',
      notReady: 'Ainda cozinhando', needBase: 'Falta caldo e macarrão', overcooked: 'Passou do ponto!', binned: 'No lixo', streakN: 'Sequência x{n}',
      master: 'Mestre da feira noturna! Agora, noites sem fim.', cont2: 'Seguir',
      u_slot: 'Mais balcão', d_slot: '+1 bowl em preparo', u_burn: 'Outro fogão', d_burn: '+1 porção de macarrão por vez',
      u_boil: 'Fogo alto', d_boil: 'O macarrão cozinha mais rápido', u_deco: 'Lanternas', d_deco: 'Clientes esperam mais', u_tip: 'Pote de gorjeta', d_tip: '+25% de gorjetas',
      d_special: 'Pedidos novos que pagam mais',
      i0_0: 'Caldo shoyu', i0_1: 'Caldo missô', i0_2: 'Caldo tonkotsu', i0_3: 'Caldo apimentado',
      i1_0: 'Macarrão fino', i1_1: 'Macarrão ondulado', i1_2: 'Udon',
      i2_0: 'Ovo', i2_1: 'Nori', i2_2: 'Cebolinha', i2_3: 'Chashu', i2_4: 'Naruto', i2_5: 'Milho', i2_6: 'Cogumelo',
      i3_0: 'Chá verde', i3_1: 'Refrigerante'
    },
    fr: {
      tag: 'Stand de nouilles du marché de nuit', play: 'Ouvrir le stand', cont: 'Continuer · Jour {n}', fresh: 'Nouveau stand', sure: 'Touchez encore pour tout recommencer',
      bestDay: 'Meilleur jour {n}', earnedAll: '{n} pièces gagnées', day: 'Jour {n}', endless: 'Nuit sans fin {n}', goal: 'Objectif {n}',
      paused: 'Pause', resume: 'Reprendre', soundOn: 'Son : oui', soundOff: 'Son : non', quit: 'Quitter vers le menu', tapCont: 'Touchez pour continuer',
      tut1: 'Touchez les nouilles pour les faire cuire', tut2: 'Touchez la marmite du bouillon demandé', tut3: 'Ajoutez la garniture de la commande',
      tut4: 'Les nouilles cuisent. Prêtes quand l’anneau est plein', tut5: 'Prêtes ! Touchez le feu pour les égoutter dans le bol', tut6: 'Glissez le bol vers le client (ou touchez-le)',
      tut7: 'Surveillez la patience. Mauvais bol ? Glissez-le à la poubelle.',
      closing: 'Dernières commandes !', dayDone: 'Jour {n} terminé', served: 'Servis', lost: 'Perdus', tips: 'Pourboires', streak: 'Meilleure série', earned: 'Gagné',
      goalMet: 'Objectif atteint !', goalMissed: 'Objectif manqué. Gardez vos pièces et réessayez.', rep: 'Réputation', wallet: 'Caisse',
      shop: 'Améliorations', nextDay: 'Ouvrir le jour {n}', retryDay: 'Rejouer le jour {n}', owned: 'Acquis', max: 'Max', from: 'Jour {n}', broke: 'Pas assez de pièces',
      newMenu: 'Nouveau au menu !', vip: 'VIP', wrong: 'Mauvais bol !', gaveUp: 'Lassé d’attendre', perfect: 'Parfait !', noBurner: 'Feux tous pris',
      notReady: 'Ça cuit encore', needBase: 'Il faut bouillon et nouilles', overcooked: 'Trop cuites !', binned: 'À la poubelle', streakN: 'Série x{n}',
      master: 'Maître du marché de nuit ! Place aux nuits sans fin.', cont2: 'Suite',
      u_slot: 'Plus de comptoir', d_slot: '+1 bol en préparation', u_burn: 'Feu en plus', d_burn: '+1 portion de nouilles à la fois',
      u_boil: 'Feu vif', d_boil: 'Les nouilles cuisent plus vite', u_deco: 'Lanternes', d_deco: 'Les clients patientent plus', u_tip: 'Pot à pourboires', d_tip: '+25 % de pourboires',
      d_special: 'Nouvelles commandes mieux payées',
      i0_0: 'Bouillon shoyu', i0_1: 'Bouillon miso', i0_2: 'Bouillon tonkotsu', i0_3: 'Bouillon épicé',
      i1_0: 'Nouilles fines', i1_1: 'Nouilles ondulées', i1_2: 'Udon',
      i2_0: 'Œuf', i2_1: 'Nori', i2_2: 'Ciboule', i2_3: 'Chashu', i2_4: 'Naruto', i2_5: 'Maïs', i2_6: 'Champignon',
      i3_0: 'Thé vert', i3_1: 'Soda'
    },
    de: {
      tag: 'Nudelstand auf dem Nachtmarkt', play: 'Stand öffnen', cont: 'Weiter · Tag {n}', fresh: 'Neuer Stand', sure: 'Nochmal tippen zum Neustart',
      bestDay: 'Bester Tag {n}', earnedAll: '{n} Münzen verdient', day: 'Tag {n}', endless: 'Endlose Nacht {n}', goal: 'Ziel {n}',
      paused: 'Pause', resume: 'Weiter', soundOn: 'Ton: an', soundOff: 'Ton: aus', quit: 'Zum Menü', tapCont: 'Tippen zum Fortfahren',
      tut1: 'Tippe die Nudeln an, um sie zu kochen', tut2: 'Tippe den Topf mit der gewünschten Brühe an', tut3: 'Gib das bestellte Topping dazu',
      tut4: 'Die Nudeln kochen. Fertig, wenn der Ring voll ist', tut5: 'Fertig! Tippe den Brenner an, um sie in die Schale zu geben', tut6: 'Zieh die Schale zum Gast (oder tippe ihn an)',
      tut7: 'Achte auf die Geduld. Falsche Schale? Zieh sie in den Eimer.',
      closing: 'Letzte Bestellungen!', dayDone: 'Tag {n} geschafft', served: 'Bedient', lost: 'Verloren', tips: 'Trinkgeld', streak: 'Beste Serie', earned: 'Verdient',
      goalMet: 'Ziel erreicht!', goalMissed: 'Ziel verfehlt. Die Münzen bleiben dir: nochmal versuchen.', rep: 'Ruf', wallet: 'Kasse',
      shop: 'Upgrades', nextDay: 'Tag {n} öffnen', retryDay: 'Tag {n} wiederholen', owned: 'Gekauft', max: 'Max', from: 'Tag {n}', broke: 'Nicht genug Münzen',
      newMenu: 'Neu auf der Karte!', vip: 'VIP', wrong: 'Falsche Schale!', gaveUp: 'Wartet nicht mehr', perfect: 'Perfekt!', noBurner: 'Alle Brenner belegt',
      notReady: 'Kocht noch', needBase: 'Brühe und Nudeln fehlen', overcooked: 'Verkocht!', binned: 'Weggeworfen', streakN: 'Serie x{n}',
      master: 'Meister des Nachtmarkts! Ab jetzt endlose Nächte.', cont2: 'Weiter',
      u_slot: 'Mehr Theke', d_slot: '+1 Schale in Arbeit', u_burn: 'Extra-Brenner', d_burn: '+1 Nudelportion gleichzeitig',
      u_boil: 'Heißer Herd', d_boil: 'Nudeln garen schneller', u_deco: 'Laternen', d_deco: 'Gäste warten länger', u_tip: 'Trinkgeldglas', d_tip: '+25 % Trinkgeld',
      d_special: 'Neue Bestellungen, die mehr bringen',
      i0_0: 'Shoyu-Brühe', i0_1: 'Miso-Brühe', i0_2: 'Tonkotsu-Brühe', i0_3: 'Scharfe Brühe',
      i1_0: 'Dünne Nudeln', i1_1: 'Wellige Nudeln', i1_2: 'Udon',
      i2_0: 'Ei', i2_1: 'Nori', i2_2: 'Frühlingszwiebel', i2_3: 'Chashu', i2_4: 'Naruto', i2_5: 'Mais', i2_6: 'Pilz',
      i3_0: 'Grüner Tee', i3_1: 'Limo'
    }
  };

  var lang = 'en';
  RR.setLang = function (tag) {
    var l = String(tag || 'en').toLowerCase().slice(0, 2);
    lang = D[l] ? l : 'en';
  };
  RR.lang = function () { return lang; };
  RR.t = function (key, n, x) {
    var s = (D[lang] && D[lang][key]) || D.en[key] || key;
    if (n !== undefined) s = s.replace('{n}', n);
    if (x !== undefined) s = s.replace('{x}', x);
    return s;
  };
  RR.DICT = D;
})();
